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
 * A side counts as the winner when any of its players is marked as one. Using
 * max() rather than a strict all-or-nothing check keeps the result stable if a
 * player is swapped into an already-scored game.
 */
function sideWon(lineup: LineupEntry[], teamId: Types.ObjectId): boolean {
  return lineup.some((entry) => entry.teamId.equals(teamId) && entry.points > 0)
}

/**
 * Recompute the team results and the winner from the line-up. Safe to call at
 * any time — this is the single source of truth for a result.
 *
 * A side scores 1 if its players are marked as winners and 0 otherwise, so a
 * 1v1 win counts exactly the same as a 2v2 win. Validation guarantees the two
 * sides never agree, so a completed game always has a winner.
 */
export function recalculate(game: GameDoc): GameDoc {
  const teamAWon = sideWon(game.lineup, game.teamAId)
  const teamBWon = sideWon(game.lineup, game.teamBId)

  game.teamAScore = teamAWon ? 1 : 0
  game.teamBScore = teamBWon ? 1 : 0

  if (game.status === 'completed' && teamAWon !== teamBWon) {
    game.winnerTeamId = teamAWon ? game.teamAId : game.teamBId
  } else {
    // A game that is not finished — or has no decisive result — has no winner
    // to report.
    game.winnerTeamId = null
  }

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
 * Record the result and close the game out.
 *
 * @param points playerId => 1 (won) or 0 (lost)
 */
export async function recordScores(
  id: string,
  points: Record<string, number>,
): Promise<GameDoc | null> {
  const game = await Game.findById(id)
  if (!game) return null

  for (const entry of game.lineup) {
    const key = String(entry.playerId)
    if (key in points) {
      // Anything truthy counts as a win; the value stored is always 1 or 0.
      entry.points = points[key] > 0 ? 1 : 0
    }
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
