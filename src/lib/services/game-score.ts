import 'server-only'
import { Types } from 'mongoose'
import { Game, type GameDoc, type LineupEntry } from '../models/Game'
import { nextSequence } from '../models/Counter'
import type { GameFormat, GameStatus } from '../enums'

/**
 * Owns every write that can change a game's score.
 *
 * Team scores are never supplied by the client: they are always re-derived from
 * the embedded line-up, and the winner follows from those marks. Because the
 * line-up lives inside the game document, each of these operations is a single
 * document write — atomic by construction, which is what the Laravel version
 * needed `DB::transaction` for.
 */

export interface GameInput {
  format: GameFormat
  /** null (or absent) makes this a friendly. */
  tournamentId?: string | null
  teamAId: string
  teamBId: string
  gameDate: string
  status?: GameStatus | null
  teamAPlayers: string[]
  teamBPlayers: string[]
}

/** A blank or invalid selection means "no tournament", i.e. a friendly. */
function toTournamentId(value: string | null | undefined): Types.ObjectId | null {
  return value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null
}

/** Dates are day-precision; store them at UTC midnight so they never shift. */
function toUtcDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

/**
 * Reconcile the line-up with the submitted teams. Points already recorded for
 * players who remain in the line-up are preserved.
 */
function buildLineup(
  existing: LineupEntry[],
  teamAId: Types.ObjectId,
  teamBId: Types.ObjectId,
  teamAPlayers: string[],
  teamBPlayers: string[],
): LineupEntry[] {
  const seen = new Set<string>()
  const previous = new Map(existing.map((e) => [String(e.playerId), e.points]))
  const lineup: LineupEntry[] = []

  const push = (playerId: string, teamId: Types.ObjectId) => {
    // A player may appear at most once in a game — the first side wins the tie,
    // and GameInput validation rejects the overlap before it ever gets here.
    if (!Types.ObjectId.isValid(playerId) || seen.has(playerId)) return
    seen.add(playerId)

    lineup.push({
      playerId: new Types.ObjectId(playerId),
      teamId,
      points: previous.get(playerId) ?? 0,
    })
  }

  teamAPlayers.forEach((id) => push(id, teamAId))
  teamBPlayers.forEach((id) => push(id, teamBId))

  return lineup
}

/**
 * Derive the winner from the two team scores. The scores themselves are entered
 * by the scorer — this is the single place that turns them into a result, so a
 * game can never disagree with its own scoreline.
 *
 * Equal scores are a draw: no winner, and neither side takes a loss.
 */
export function recalculate(game: GameDoc): GameDoc {
  // A knockout tie exists before its teams are known; until both sides are
  // filled in there is nothing to score.
  if (!game.teamAId || !game.teamBId) {
    game.teamAScore = 0
    game.teamBScore = 0
    game.winnerTeamId = null
    return game
  }

  if (game.status !== 'completed') {
    game.winnerTeamId = null
    return game
  }

  game.winnerTeamId =
    game.teamAScore > game.teamBScore
      ? game.teamAId
      : game.teamBScore > game.teamAScore
        ? game.teamBId
        : null

  return game
}

/**
 * Create a game together with its line-up. The game starts as "scheduled" with
 * a 0–0 score until the admin records a result on the scoring screen.
 */
export async function createGame(input: GameInput): Promise<GameDoc> {
  const teamAId = new Types.ObjectId(input.teamAId)
  const teamBId = new Types.ObjectId(input.teamBId)

  const game = new Game({
    number: await nextSequence('games'),
    tournamentId: toTournamentId(input.tournamentId),
    format: input.format,
    teamAId,
    teamBId,
    gameDate: toUtcDate(input.gameDate),
    status: 'scheduled',
    lineup: buildLineup([], teamAId, teamBId, input.teamAPlayers, input.teamBPlayers),
  })

  recalculate(game)
  await game.save()

  return game
}

/** Update a game's details and line-up, then recalculate its result. */
export async function updateGame(id: string, input: GameInput): Promise<GameDoc | null> {
  const game = await Game.findById(id)
  if (!game) return null

  const teamAId = new Types.ObjectId(input.teamAId)
  const teamBId = new Types.ObjectId(input.teamBId)

  game.format = input.format
  game.tournamentId = toTournamentId(input.tournamentId)
  game.teamAId = teamAId
  game.teamBId = teamBId
  game.gameDate = toUtcDate(input.gameDate)
  if (input.status) game.status = input.status

  game.lineup = buildLineup(game.lineup, teamAId, teamBId, input.teamAPlayers, input.teamBPlayers)

  recalculate(game)
  await game.save()

  return game
}

/**
 * Record the scoreline and close the game out.
 *
 * Each player's appearance carries their own side's score, so a career points
 * total is the sum of their rows and needs nothing stored on the player.
 */
export async function recordTeamScores(
  id: string,
  teamAScore: number,
  teamBScore: number,
): Promise<GameDoc | null> {
  const game = await Game.findById(id)
  if (!game) return null

  game.teamAScore = teamAScore
  game.teamBScore = teamBScore

  for (const entry of game.lineup) {
    entry.points = entry.teamId.equals(game.teamAId!) ? teamAScore : teamBScore
  }

  game.status = 'completed'
  recalculate(game)
  await game.save()

  return game
}

/** Reopen a completed game so its result can be corrected. */
export async function reopenGame(id: string): Promise<GameDoc | null> {
  const game = await Game.findById(id)
  if (!game) return null

  game.status = 'scheduled'
  recalculate(game)
  await game.save()

  return game
}

export async function cancelGame(id: string): Promise<GameDoc | null> {
  const game = await Game.findById(id)
  if (!game) return null

  game.status = 'cancelled'
  recalculate(game)
  await game.save()

  return game
}

/**
 * Delete a game and its line-up. Because every statistic in the app is derived
 * from game data, removing the document is enough to roll back the game's
 * contribution to every player and team ranking.
 */
export async function deleteGame(id: string): Promise<void> {
  await Game.findByIdAndDelete(id)
}
