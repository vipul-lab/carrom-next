import 'server-only'
import { Types, type PipelineStage } from 'mongoose'
import { Game, gameLabel } from '../models/Game'
import { formatLabel, type GameFormat, type GameStatus } from '../enums'
import { periodMatch, type StatsPeriod } from '../stats-period'
import { searchRegex, type TeamRef } from './stats'
import type { Paginated } from './stats'

/**
 * Reading games. Every list view in the app goes through `queryGames`, which
 * resolves the two team references and (optionally) the line-up's players in the
 * same aggregation, so a page never issues a query per row.
 */

export interface LineupView {
  playerId: string
  teamId: string
  points: number
  player: { id: string; name: string; photo: string | null } | null
}

export interface GameView {
  id: string
  number: number
  label: string
  format: GameFormat
  formatLabel: string
  gameDate: string
  status: GameStatus
  teamAScore: number
  teamBScore: number
  teamA: TeamRef | null
  teamB: TeamRef | null
  winner: TeamRef | null
  winnerTeamId: string | null
  lineup: LineupView[]
  playersCount: number
  createdAt: string | null
  updatedAt: string | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function teamRef(doc: any): TeamRef | null {
  if (!doc) return null
  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code,
    color: doc.color,
    logo: doc.logo ?? null,
  }
}

function toGame(row: any): GameView {
  const players: Map<string, any> = new Map(
    (row.lineupPlayers ?? []).map((p: any) => [String(p._id), p]),
  )

  return {
    id: String(row._id),
    number: row.number,
    label: gameLabel(row.number),
    format: row.format,
    formatLabel: formatLabel(row.format),
    gameDate: new Date(row.gameDate).toISOString(),
    status: row.status,
    teamAScore: row.teamAScore ?? 0,
    teamBScore: row.teamBScore ?? 0,
    teamA: teamRef(row.teamADoc?.[0]),
    teamB: teamRef(row.teamBDoc?.[0]),
    winner: teamRef(row.winnerDoc?.[0]),
    winnerTeamId: row.winnerTeamId ? String(row.winnerTeamId) : null,
    lineup: (row.lineup ?? []).map((entry: any) => {
      const player = players.get(String(entry.playerId))
      return {
        playerId: String(entry.playerId),
        teamId: String(entry.teamId),
        points: entry.points ?? 0,
        player: player
          ? { id: String(player._id), name: player.name, photo: player.photo ?? null }
          : null,
      }
    }),
    playersCount: (row.lineup ?? []).length,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }
}

/** "Won by Falcons", "Cancelled", or "Awaiting result". */
export function resultLabel(game: GameView): string {
  if (game.status !== 'completed') {
    return game.status === 'cancelled' ? 'Cancelled' : 'Awaiting result'
  }

  return game.winner?.name ?? 'Unresolved'
}

export function scoreline(game: GameView): string {
  return game.status === 'completed' ? `${game.teamAScore} – ${game.teamBScore}` : '—'
}

export function isCompleted(game: GameView): boolean {
  return game.status === 'completed'
}

export function lineupFor(game: GameView, teamId: string | null | undefined): LineupView[] {
  if (!teamId) return []
  return game.lineup.filter((entry) => entry.teamId === teamId)
}

export function opponentOf(game: GameView, teamId: string): TeamRef | null {
  return teamId === game.teamA?.id ? game.teamB : game.teamA
}

export function didTeamWin(game: GameView, teamId: string | null | undefined): boolean {
  return !!teamId && game.status === 'completed' && game.winnerTeamId === teamId
}

/** The joins every game view needs. `withPlayers` adds the line-up's members. */
function hydrationStages(withPlayers: boolean): PipelineStage[] {
  const stages: PipelineStage[] = [
    { $lookup: { from: 'teams', localField: 'teamAId', foreignField: '_id', as: 'teamADoc' } },
    { $lookup: { from: 'teams', localField: 'teamBId', foreignField: '_id', as: 'teamBDoc' } },
    { $lookup: { from: 'teams', localField: 'winnerTeamId', foreignField: '_id', as: 'winnerDoc' } },
  ]

  if (withPlayers) {
    stages.push({
      $lookup: {
        from: 'players',
        localField: 'lineup.playerId',
        foreignField: '_id',
        as: 'lineupPlayers',
      },
    })
  }

  return stages
}

export interface GameFilters {
  search?: string | null
  teamId?: string | null
  playerId?: string | null
  format?: string | null
  winner?: string | null
  status?: string | null
  from?: string | null
  to?: string | null
}

async function resolveSearchMatch(term: string): Promise<Record<string, unknown>> {
  const rx = searchRegex(term)

  // A team name match needs the team's id; a numeric term is treated as a
  // game number so "#GM-0012" and "12" both find the same fixture.
  const { Team } = await import('../models/Team')
  const teamIds = (await Team.find({ name: rx }).select('_id').lean()).map((t) => t._id)

  const clauses: Record<string, unknown>[] = []
  if (teamIds.length) clauses.push({ teamAId: { $in: teamIds } }, { teamBId: { $in: teamIds } })

  const numeric = Number(term.replace(/[^0-9]/g, ''))
  if (Number.isFinite(numeric) && term.replace(/[^0-9]/g, '') !== '') {
    clauses.push({ number: numeric })
  }

  return clauses.length ? { $or: clauses } : { _id: null }
}

async function buildGameMatch(filters: GameFilters): Promise<Record<string, unknown>> {
  const and: Record<string, unknown>[] = []

  if (filters.search?.trim()) and.push(await resolveSearchMatch(filters.search.trim()))

  if (filters.teamId && Types.ObjectId.isValid(filters.teamId)) {
    const id = new Types.ObjectId(filters.teamId)
    and.push({ $or: [{ teamAId: id }, { teamBId: id }] })
  }

  if (filters.playerId && Types.ObjectId.isValid(filters.playerId)) {
    and.push({ 'lineup.playerId': new Types.ObjectId(filters.playerId) })
  }

  if (filters.winner && Types.ObjectId.isValid(filters.winner)) {
    and.push({ winnerTeamId: new Types.ObjectId(filters.winner) })
  }

  if (filters.format) and.push({ format: filters.format })
  if (filters.status) and.push({ status: filters.status })

  const dateMatch = periodMatch({ from: filters.from ?? null, to: filters.to ?? null, key: 'custom' })
  if (Object.keys(dateMatch).length) and.push(dateMatch)

  return and.length ? { $and: and } : {}
}

export async function paginateGames(
  filters: GameFilters,
  page: number,
  perPage: number,
): Promise<Paginated<GameView>> {
  const safePage = Math.max(1, page)
  const match = await buildGameMatch(filters)

  const [result] = await Game.aggregate([
    { $match: match },
    { $sort: { gameDate: -1, number: -1 } },
    {
      $facet: {
        rows: [
          { $skip: (safePage - 1) * perPage },
          { $limit: perPage },
          ...(hydrationStages(false) as PipelineStage.FacetPipelineStage[]),
        ],
        meta: [{ $count: 'total' }],
      },
    },
  ])

  const total: number = result?.meta?.[0]?.total ?? 0

  return {
    items: (result?.rows ?? []).map(toGame),
    total,
    page: safePage,
    perPage,
    lastPage: Math.max(1, Math.ceil(total / perPage)),
    firstItem: total === 0 ? 0 : (safePage - 1) * perPage + 1,
  }
}

export async function listGames(
  filters: GameFilters = {},
  limit?: number,
  withPlayers = false,
): Promise<GameView[]> {
  const match = await buildGameMatch(filters)

  const pipeline: PipelineStage[] = [
    { $match: match },
    { $sort: { gameDate: -1, number: -1 } },
  ]

  if (limit) pipeline.push({ $limit: limit })
  pipeline.push(...hydrationStages(withPlayers))

  const rows = await Game.aggregate(pipeline)
  return rows.map(toGame)
}

/** A single fixture, with both teams and every line-up member resolved. */
export async function findGame(id: string): Promise<GameView | null> {
  if (!Types.ObjectId.isValid(id)) return null

  const rows = await Game.aggregate([
    { $match: { _id: new Types.ObjectId(id) } },
    ...hydrationStages(true),
  ])

  return rows[0] ? toGame(rows[0]) : null
}

/** Completed games this player took part in, newest first. */
export async function playerAppearances(
  playerId: string,
  period: StatsPeriod,
): Promise<GameView[]> {
  if (!Types.ObjectId.isValid(playerId)) return []

  const rows = await Game.aggregate([
    {
      $match: {
        status: 'completed',
        'lineup.playerId': new Types.ObjectId(playerId),
        ...periodMatch(period),
      },
    },
    { $sort: { gameDate: -1, number: -1 } },
    ...hydrationStages(false),
  ])

  return rows.map(toGame)
}

export async function upcomingGamesForPlayer(playerId: string, limit = 5): Promise<GameView[]> {
  if (!Types.ObjectId.isValid(playerId)) return []

  const rows = await Game.aggregate([
    { $match: { status: 'scheduled', 'lineup.playerId': new Types.ObjectId(playerId) } },
    { $sort: { gameDate: 1 } },
    { $limit: limit },
    ...hydrationStages(false),
  ])

  return rows.map(toGame)
}
