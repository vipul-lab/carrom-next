'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Types } from 'mongoose'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/db'
import { Player } from '@/lib/models/Player'
import { Team } from '@/lib/models/Team'
import { Game, gameLabel } from '@/lib/models/Game'
import {
  createGame,
  deleteGame,
  recordScores,
  reopenGame,
  updateGame,
  type GameInput,
} from '@/lib/services/game-score'
import { GAME_FORMATS, GAME_STATUSES, formatLabel, playersPerTeam, type GameFormat } from '@/lib/enums'
import type { ActionState } from '@/lib/action-state'

/**
 * Game creation and editing, including every line-up business rule: the two
 * sides must differ, each side must field exactly the number of players the
 * format demands, and each selected player must be an active member of the team
 * they are being fielded for.
 *
 * These are the same rules the browser enforces while picking a line-up — the
 * client-side version is convenience only, and everything is re-checked here.
 */

const GameSchema = z.object({
  format: z.enum(GAME_FORMATS),
  teamAId: z.string().min(1, 'Select an active team for Team A.'),
  teamBId: z.string().min(1, 'Select an active team for Team B.'),
  gameDate: z.string().min(1, 'The game date field is required.'),
  status: z.enum(GAME_STATUSES).nullable().optional(),
})

function readIds(formData: FormData, field: string): string[] {
  return formData
    .getAll(field)
    .map((value) => String(value))
    .filter((value) => value !== '' && Types.ObjectId.isValid(value))
}

async function validateGameForm(
  formData: FormData,
): Promise<{ input: GameInput; errors?: never } | { input?: never; errors: Record<string, string[]> }> {
  const parsed = GameSchema.safeParse({
    format: formData.get('format'),
    teamAId: formData.get('teamAId'),
    teamBId: formData.get('teamBId'),
    gameDate: formData.get('gameDate'),
    status: formData.get('status') || null,
  })

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  const { format, teamAId, teamBId, gameDate, status } = parsed.data
  const perTeam = playersPerTeam(format as GameFormat)
  const errors: Record<string, string[]> = {}

  if (teamAId === teamBId) {
    errors.teamAId = ['Team A and Team B must be two different teams.']
    errors.teamBId = ['Team A and Team B must be two different teams.']
  }

  const teamAPlayers = readIds(formData, 'teamAPlayers')
  const teamBPlayers = readIds(formData, 'teamBPlayers')

  // Exactly N players a side, and never the same player twice on one side.
  for (const [field, ids] of [
    ['teamAPlayers', teamAPlayers],
    ['teamBPlayers', teamBPlayers],
  ] as const) {
    const label = field === 'teamAPlayers' ? 'Team A' : 'Team B'

    if (new Set(ids).size !== ids.length) {
      errors[field] = ['A player cannot be selected twice for the same team.']
    } else if (ids.length !== perTeam) {
      errors[field] = [
        `Select exactly ${perTeam} ${perTeam === 1 ? 'player' : 'players'} for ${label}.`,
      ]
    }
  }

  await connectToDatabase()

  // Both teams must exist and be active.
  const teams = await Team.find({
    _id: { $in: [teamAId, teamBId].filter((id) => Types.ObjectId.isValid(id)) },
    status: 'active',
  })
    .select('_id')
    .lean()

  const activeTeamIds = new Set(teams.map((t) => String(t._id)))
  if (!activeTeamIds.has(teamAId)) errors.teamAId = ['Select an active team for Team A.']
  if (!activeTeamIds.has(teamBId)) errors.teamBId = ['Select an active team for Team B.']

  // A player may never appear on both sides of the same board.
  const overlap = teamAPlayers.filter((id) => teamBPlayers.includes(id))
  if (overlap.length) {
    const names = (await Player.find({ _id: { $in: overlap } }).select('name').lean())
      .map((p) => p.name)
      .join(', ')

    errors.teamBPlayers = [`The same player cannot play for both teams (${names}).`]
  }

  // Every picked player must be an active member of the side they play for, and
  // the team must have enough active members to field the format at all.
  for (const [field, ids, teamId] of [
    ['teamAPlayers', teamAPlayers, teamAId],
    ['teamBPlayers', teamBPlayers, teamBId],
  ] as const) {
    if (!Types.ObjectId.isValid(teamId)) continue

    const label = field === 'teamAPlayers' ? 'Team A' : 'Team B'
    const available = await Player.countDocuments({ teamId, status: 'active' })

    if (available < perTeam) {
      errors[field] = [
        `This team only has ${available} active member(s) and needs at least ${perTeam} to play a ${formatLabel(format as GameFormat)} game.`,
      ]
      continue
    }

    if (errors[field] || ids.length === 0) continue

    const eligible = await Player.countDocuments({ _id: { $in: ids }, teamId, status: 'active' })

    if (eligible !== ids.length) {
      errors[field] = [`Every ${label} player must be an active member of the selected team.`]
    }
  }

  if (Object.keys(errors).length) return { errors }

  return {
    input: {
      format: format as GameFormat,
      teamAId,
      teamBId,
      gameDate,
      status: status ?? null,
      teamAPlayers,
      teamBPlayers,
    },
  }
}

export async function createGameAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await validateGameForm(formData)
  if (result.errors) return { ok: false, errors: result.errors }

  const game = await createGame(result.input)
  const label = gameLabel(game.number)

  revalidatePath('/games')
  redirect(
    `/games/${game._id}/score?ok=${encodeURIComponent(`Game ${label} was created. Record the result below.`)}`,
  )
}

export async function updateGameAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) return { ok: false, message: 'That game no longer exists.' }

  const result = await validateGameForm(formData)
  if (result.errors) return { ok: false, errors: result.errors }

  const game = await updateGame(id, result.input)
  if (!game) return { ok: false, message: 'That game no longer exists.' }

  const label = gameLabel(game.number)

  revalidatePath('/games')
  revalidatePath(`/games/${id}`)
  redirect(`/games/${id}?ok=${encodeURIComponent(`Game ${label} was updated.`)}`)
}

/* -------------------------------------------------------------------------
 | Scoring
 |------------------------------------------------------------------------*/

/**
 * Only a per-player win/loss mark is accepted — the team result and the winner
 * are derived server-side, so there is nothing here for a client to tamper with.
 *
 * Because draws are not supported, the two sides must disagree: one team must be
 * marked entirely as winners and the other entirely as losers.
 */
export async function recordScoreAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) return { ok: false, message: 'That game no longer exists.' }

  await connectToDatabase()

  const game = await Game.findById(id)
  if (!game) return { ok: false, message: 'That game no longer exists.' }

  if (game.lineup.length === 0) {
    return {
      ok: false,
      errors: {
        points: ['This game has no line-up yet. Edit the game and pick its players first.'],
      },
    }
  }

  const points: Record<string, number> = {}

  for (const [key, value] of formData.entries()) {
    const match = /^points\[(.+)\]$/.exec(key)
    if (!match) continue

    const mark = Number(value)
    if (mark !== 0 && mark !== 1) {
      return { ok: false, errors: { points: ['A result must be a win or a loss.'] } }
    }

    points[match[1]] = mark
  }

  const expected = game.lineup.map((entry) => String(entry.playerId))
  const submitted = Object.keys(points)

  // Every selected player must have a mark, and no stranger may be scored.
  const missing = expected.filter((id) => !submitted.includes(id))
  const unknown = submitted.filter((id) => !expected.includes(id))

  if (missing.length) {
    const names = (await Player.find({ _id: { $in: missing } }).select('name').lean())
      .map((p) => p.name)
      .join(', ')

    return { ok: false, errors: { points: [`Mark every player in the line-up (${names} missing).`] } }
  }

  if (unknown.length) {
    return {
      ok: false,
      errors: { points: ['A result was submitted for a player who is not in this game.'] },
    }
  }

  // Each side must be internally consistent — partners win or lose together.
  const sides: Record<'A' | 'B', boolean> = { A: false, B: false }

  for (const [label, teamId] of [
    ['A', game.teamAId],
    ['B', game.teamBId],
  ] as const) {
    const marks = game.lineup
      .filter((entry) => entry.teamId.equals(teamId))
      .map((entry) => points[String(entry.playerId)] > 0)

    if (new Set(marks).size > 1) {
      return {
        ok: false,
        errors: {
          points: [
            `Team ${label}'s players must all be marked the same way — partners win or lose together.`,
          ],
        },
      }
    }

    sides[label] = marks[0] ?? false
  }

  // And the two sides must differ — every game ends with exactly one winner.
  if (sides.A === sides.B) {
    return {
      ok: false,
      errors: {
        points: [
          sides.A
            ? 'Both teams are marked as winners. Exactly one team must win.'
            : 'Both teams are marked as losers. Exactly one team must win.',
        ],
      },
    }
  }

  const saved = await recordScores(id, points)
  if (!saved) return { ok: false, message: 'That game no longer exists.' }

  const winner = await Team.findById(saved.winnerTeamId).select('name').lean()
  const label = gameLabel(saved.number)

  revalidatePath('/games')
  revalidatePath(`/games/${id}`)
  revalidatePath('/dashboard')
  redirect(
    `/games/${id}?ok=${encodeURIComponent(`Result saved for ${label}. ${winner?.name ?? 'The winner'} won.`)}`,
  )
}

/** Put a completed game back into scoring so a mistake can be corrected. */
export async function reopenGameAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) redirect('/games?err=That+game+no+longer+exists.')

  await connectToDatabase()
  const game = await reopenGame(id)
  if (!game) redirect('/games?err=That+game+no+longer+exists.')

  revalidatePath('/games')
  revalidatePath(`/games/${id}`)
  redirect(
    `/games/${id}/score?ok=${encodeURIComponent(`Game ${gameLabel(game.number)} was reopened for scoring.`)}`,
  )
}

export async function deleteGameAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) redirect('/games?err=That+game+no+longer+exists.')

  await connectToDatabase()

  const game = await Game.findById(id).select('number').lean()
  if (!game) redirect('/games?err=That+game+no+longer+exists.')

  const label = gameLabel(game.number)
  await deleteGame(id)

  revalidatePath('/games')
  revalidatePath('/dashboard')
  redirect(
    `/games?ok=${encodeURIComponent(`Game ${label} was deleted and its result was removed from every ranking.`)}`,
  )
}
