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
  recordTeamScores,
  reopenGame,
  updateGame,
  type GameInput,
} from '@/lib/services/game-score'
import { GAME_FORMATS, GAME_STATUSES, formatLabel, playersPerTeam, type GameFormat } from '@/lib/enums'
import type { ActionState } from '@/lib/action-state'
import { FORBIDDEN, isEditor, requireEditorOrRedirect } from '@/lib/authz'
import { resolveDraw } from '@/lib/services/draw'

/**
 * Push a result through the draw. A group game may have decided a qualifying
 * place, and a knockout win feeds the next round — both are recomputed from the
 * current standings rather than patched, so a corrected result propagates too.
 */
async function refreshDraw(tournamentId: unknown): Promise<void> {
  if (tournamentId) await resolveDraw(String(tournamentId))
}

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
  // Blank means a friendly — the absence of a tournament, not a validation error.
  tournamentId: z.string().trim().nullable().optional(),
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
    tournamentId: (formData.get('tournamentId') as string)?.trim() || null,
    teamAId: formData.get('teamAId'),
    teamBId: formData.get('teamBId'),
    gameDate: formData.get('gameDate'),
    status: formData.get('status') || null,
  })

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  const { format, tournamentId, teamAId, teamBId, gameDate, status } = parsed.data
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

  // A named tournament must actually exist; anything else is a friendly.
  if (tournamentId) {
    const { Tournament } = await import('@/lib/models/Tournament')
    if (!Types.ObjectId.isValid(tournamentId) || !(await Tournament.exists({ _id: tournamentId }))) {
      errors.tournamentId = ['Select a tournament that exists, or leave it as a friendly.']
    }
  }

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
      tournamentId: tournamentId ?? null,
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
  if (!(await isEditor())) return FORBIDDEN

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
  if (!(await isEditor())) return FORBIDDEN

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
  if (!(await isEditor())) return FORBIDDEN

  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) return { ok: false, message: 'That game no longer exists.' }

  await connectToDatabase()

  const game = await Game.findById(id)
  if (!game) return { ok: false, message: 'That game no longer exists.' }

  if (!game.teamAId || !game.teamBId) {
    return {
      ok: false,
      errors: { teamAScore: ['This tie has no opponents yet — it is waiting on an earlier round.'] },
    }
  }

  // One score per side. Anything that is not a whole number of points at least
  // zero is rejected rather than silently coerced.
  const read = (field: string): number | null => {
    const raw = String(formData.get(field) ?? '').trim()
    if (raw === '') return null

    const value = Number(raw)
    if (!Number.isInteger(value) || value < 0 || value > 9999) return null

    return value
  }

  const teamAScore = read('teamAScore')
  const teamBScore = read('teamBScore')
  const errors: Record<string, string[]> = {}

  if (teamAScore === null) errors.teamAScore = ['Enter a whole number of points, 0 or more.']
  if (teamBScore === null) errors.teamBScore = ['Enter a whole number of points, 0 or more.']
  if (Object.keys(errors).length) return { ok: false, errors }

  // A knockout tie has to produce someone to send to the next round, so a draw
  // cannot be recorded there. Group games may legitimately end level.
  if (teamAScore === teamBScore && game.stage !== 'group') {
    return {
      ok: false,
      errors: {
        teamBScore: [
          'A knockout tie cannot end level — one side has to go through. Enter a decisive score.',
        ],
      },
    }
  }

  const saved = await recordTeamScores(id, teamAScore!, teamBScore!)
  if (!saved) return { ok: false, message: 'That game no longer exists.' }

  await refreshDraw(saved.tournamentId)

  const winner = await Team.findById(saved.winnerTeamId).select('name').lean()
  const label = gameLabel(saved.number)
  const outcome = winner ? `${winner.name} won ${Math.max(teamAScore!, teamBScore!)}–${Math.min(teamAScore!, teamBScore!)}.` : `It finished level at ${teamAScore}–${teamBScore}.`

  revalidatePath('/games')
  revalidatePath(`/games/${id}`)
  revalidatePath('/dashboard')
  revalidatePath('/tournaments')
  redirect(`/games/${id}?ok=${encodeURIComponent(`Result saved for ${label}. ${outcome}`)}`)
}

export async function reopenGameAction(formData: FormData): Promise<void> {
  await requireEditorOrRedirect('/games')

  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) redirect('/games?err=That+game+no+longer+exists.')

  await connectToDatabase()
  const game = await reopenGame(id)
  if (!game) redirect('/games?err=That+game+no+longer+exists.')

  // Reopening can un-decide a qualifying place, so the draw is recomputed.
  await refreshDraw(game.tournamentId)

  revalidatePath('/games')
  revalidatePath(`/games/${id}`)
  revalidatePath('/tournaments')
  redirect(
    `/games/${id}/score?ok=${encodeURIComponent(`Game ${gameLabel(game.number)} was reopened for scoring.`)}`,
  )
}

export async function deleteGameAction(formData: FormData): Promise<void> {
  await requireEditorOrRedirect('/games')

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
