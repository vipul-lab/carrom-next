import 'server-only'
import { Types, type PipelineStage } from 'mongoose'
import { Tournament } from '../models/Tournament'
import { Game } from '../models/Game'
import type { TournamentStatus } from '../enums'
import { searchRegex, type Paginated } from './stats'

/**
 * Reading tournaments.
 *
 * The counts here follow the same rule as every other statistic in the app:
 * nothing is stored on the tournament document. Games carry the reference, so a
 * game moved in or out — or deleted — corrects the tallies with no field to
 * update and nothing to drift.
 */

export interface TournamentView {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string | null
  status: TournamentStatus
  createdAt: string | null
  gamesCount: number
  completedCount: number
  scheduledCount: number
  /** Distinct teams that have actually appeared in one of its games. */
  teamsCount: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toTournament(row: any): TournamentView {
  return {
    id: String(row._id),
    name: row.name,
    description: row.description ?? null,
    startDate: new Date(row.startDate).toISOString(),
    endDate: row.endDate ? new Date(row.endDate).toISOString() : null,
    status: row.status,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    gamesCount: row.gamesCount ?? 0,
    completedCount: row.completedCount ?? 0,
    scheduledCount: row.scheduledCount ?? 0,
    teamsCount: row.teamsCount ?? 0,
  }
}

export interface TournamentFilters {
  search?: string | null
  status?: string | null
}

function tournamentPipeline(filters: TournamentFilters = {}): PipelineStage[] {
  const match: Record<string, unknown> = {}

  if (filters.search) match.name = searchRegex(filters.search)
  if (filters.status) match.status = filters.status

  return [
    { $match: match },
    {
      $lookup: {
        from: 'games',
        let: { tid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$tournamentId', '$$tid'] } } },
          { $project: { _id: 0, status: 1, teamAId: 1, teamBId: 1 } },
        ],
        as: 'games',
      },
    },
    {
      $addFields: {
        gamesCount: { $size: '$games' },
        completedCount: {
          $size: { $filter: { input: '$games', as: 'g', cond: { $eq: ['$$g.status', 'completed'] } } },
        },
        scheduledCount: {
          $size: { $filter: { input: '$games', as: 'g', cond: { $eq: ['$$g.status', 'scheduled'] } } },
        },
        teamsCount: {
          $size: {
            $setUnion: [
              { $setUnion: ['$games.teamAId', []] },
              { $setUnion: ['$games.teamBId', []] },
            ],
          },
        },
      },
    },
    { $project: { games: 0 } },
    { $sort: { startDate: -1, name: 1 } },
  ]
}

export async function paginateTournaments(
  filters: TournamentFilters,
  page: number,
  perPage: number,
): Promise<Paginated<TournamentView>> {
  const safePage = Math.max(1, page)

  const [result] = await Tournament.aggregate([
    ...tournamentPipeline(filters),
    {
      $facet: {
        rows: [{ $skip: (safePage - 1) * perPage }, { $limit: perPage }],
        meta: [{ $count: 'total' }],
      },
    },
  ])

  const total: number = result?.meta?.[0]?.total ?? 0

  return {
    items: (result?.rows ?? []).map(toTournament),
    total,
    page: safePage,
    perPage,
    lastPage: Math.max(1, Math.ceil(total / perPage)),
    firstItem: total === 0 ? 0 : (safePage - 1) * perPage + 1,
  }
}

export async function listTournaments(filters: TournamentFilters = {}): Promise<TournamentView[]> {
  const rows = await Tournament.aggregate(tournamentPipeline(filters))
  return rows.map(toTournament)
}

export async function findTournament(id: string): Promise<TournamentView | null> {
  if (!Types.ObjectId.isValid(id)) return null

  const rows = await Tournament.aggregate([
    { $match: { _id: new Types.ObjectId(id) } },
    ...tournamentPipeline().slice(1),
  ])

  return rows[0] ? toTournament(rows[0]) : null
}

/** The picker options on the game form: every tournament still worth joining. */
export async function selectableTournaments(): Promise<{ id: string; name: string }[]> {
  const rows = await Tournament.find({ status: { $in: ['upcoming', 'active'] } })
    .sort({ startDate: -1 })
    .select('name')
    .lean()

  return rows.map((row) => ({ id: String(row._id), name: row.name }))
}

/**
 * How many games reference this tournament. Deleting one that has games would
 * silently turn all of them into friendlies, so the delete action refuses.
 */
export async function tournamentGameCount(id: string): Promise<number> {
  if (!Types.ObjectId.isValid(id)) return 0
  return Game.countDocuments({ tournamentId: new Types.ObjectId(id) })
}
