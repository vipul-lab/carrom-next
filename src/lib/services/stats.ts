import 'server-only'
import { Types, type PipelineStage } from 'mongoose'
import { Player } from '../models/Player'
import { Team } from '../models/Team'
import { periodMatch, type StatsPeriod } from '../stats-period'
import { ALL_GAMES, scopeMatch, type GameScope } from '../game-scope'
import type { RecordStatus } from '../enums'

/**
 * Derived statistics.
 *
 * The one rule that shapes the whole app is unchanged from the Laravel version:
 * **statistics are never stored — they are derived from game data.** There is no
 * `wins` field on a team or a `totalPoints` field on a player. What were
 * correlated SQL sub-selects are aggregation `$lookup` sub-pipelines here, which
 * keeps the same property: filtering, sorting and paging all happen inside the
 * database, and deleting or re-scoring a game corrects every ranking, profile
 * and report at once because there is no denormalised copy to drift.
 */

export interface TeamRef {
  id: string
  name: string
  code: string
  color: string
  logo: string | null
}

export interface PlayerWithStats {
  id: string
  name: string
  photo: string | null
  mobile: string | null
  email: string | null
  status: RecordStatus
  createdAt: string | null
  team: TeamRef | null
  gamesCount: number
  winsCount: number
  lossesCount: number
  totalPoints: number
  /** Whole-percentage win rate, rounded to one decimal place. */
  winRate: number
  averagePoints: number
}

export interface TeamWithStats {
  id: string
  name: string
  code: string
  color: string
  logo: string | null
  description: string | null
  status: RecordStatus
  createdAt: string | null
  gamesCount: number
  winsCount: number
  lossesCount: number
  totalPoints: number
  playersCount: number
  activePlayersCount: number
  winRate: number
  averagePoints: number
}

export type SortKey = 'wins' | 'win_rate' | 'games' | 'name'

export const PLAYER_SORTS: Record<SortKey, string> = {
  wins: 'Most wins',
  win_rate: 'Win percentage',
  games: 'Games played',
  name: 'Name (A–Z)',
}

export const TEAM_SORTS: Record<SortKey, string> = { ...PLAYER_SORTS }

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Escape a user-supplied search term so it cannot inject regex syntax. */
export function searchRegex(term: string): RegExp {
  return new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

function sortStage(sort: SortKey | undefined, nameField: string): PipelineStage.Sort['$sort'] {
  switch (sort) {
    case 'win_rate':
      return { winRatePct: -1, winsCount: -1, [nameField]: 1 }
    case 'games':
      return { gamesCount: -1, winsCount: -1, [nameField]: 1 }
    case 'name':
      return { [nameField]: 1 }
    default:
      // The default ladder: points, then wins, then average points per game.
      return { totalPoints: -1, winsCount: -1, avgPoints: -1, [nameField]: 1 }
  }
}

/* -------------------------------------------------------------------------
 | Players
 |------------------------------------------------------------------------*/

export interface PlayerFilters {
  search?: string | null
  teamId?: string | null
  status?: string | null
  sort?: SortKey
}

/**
 * The player pipeline up to (and including) the sort, without paging. Callers
 * append `$skip`/`$limit`, or a `$facet` when they also need a total count.
 */
function playerPipeline(
  period: StatsPeriod,
  filters: PlayerFilters = {},
  scope: GameScope = ALL_GAMES,
): PipelineStage[] {
  const match: Record<string, unknown> = {}

  if (filters.search) {
    const rx = searchRegex(filters.search)
    match.$or = [{ name: rx }, { mobile: rx }, { email: rx }]
  }
  if (filters.teamId && Types.ObjectId.isValid(filters.teamId)) {
    match.teamId = new Types.ObjectId(filters.teamId)
  }
  if (filters.status) match.status = filters.status

  const dateMatch = periodMatch(period)
  const gameScope = scopeMatch(scope)

  return [
    { $match: match },
    {
      $lookup: {
        from: 'teams',
        localField: 'teamId',
        foreignField: '_id',
        as: 'teamDoc',
      },
    },
    {
      // Every completed game this player appeared in, reduced to the two facts
      // that matter: who won, and which side the player was on.
      $lookup: {
        from: 'games',
        let: { pid: '$_id' },
        pipeline: [
          {
            $match: {
              status: 'completed',
              ...dateMatch,
              ...gameScope,
              $expr: { $in: ['$$pid', '$lineup.playerId'] },
            },
          },
          {
            $project: {
              _id: 0,
              winnerTeamId: 1,
              entry: {
                $first: {
                  $filter: { input: '$lineup', as: 'l', cond: { $eq: ['$$l.playerId', '$$pid'] } },
                },
              },
            },
          },
        ],
        as: 'apps',
      },
    },
    {
      $addFields: {
        gamesCount: { $size: '$apps' },
        totalPoints: { $sum: '$apps.entry.points' },
        winsCount: {
          $size: {
            $filter: {
              input: '$apps',
              as: 'a',
              cond: {
                $and: [
                  { $ne: ['$$a.winnerTeamId', null] },
                  { $eq: ['$$a.winnerTeamId', '$$a.entry.teamId'] },
                ],
              },
            },
          },
        },
        lossesCount: {
          $size: {
            $filter: {
              input: '$apps',
              as: 'a',
              cond: {
                $and: [
                  { $ne: ['$$a.winnerTeamId', null] },
                  { $ne: ['$$a.winnerTeamId', '$$a.entry.teamId'] },
                ],
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        winRatePct: {
          $cond: [{ $gt: ['$gamesCount', 0] }, { $divide: ['$winsCount', '$gamesCount'] }, 0],
        },
        avgPoints: {
          $cond: [{ $gt: ['$gamesCount', 0] }, { $divide: ['$totalPoints', '$gamesCount'] }, 0],
        },
      },
    },
    { $project: { apps: 0 } },
    { $sort: sortStage(filters.sort, 'name') },
  ]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toPlayer(row: any): PlayerWithStats {
  const team = row.teamDoc?.[0]

  return {
    id: String(row._id),
    name: row.name,
    photo: row.photo ?? null,
    mobile: row.mobile ?? null,
    email: row.email ?? null,
    status: row.status,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    team: team
      ? {
          id: String(team._id),
          name: team.name,
          code: team.code,
          color: team.color,
          logo: team.logo ?? null,
        }
      : null,
    gamesCount: row.gamesCount ?? 0,
    winsCount: row.winsCount ?? 0,
    lossesCount: row.lossesCount ?? 0,
    totalPoints: row.totalPoints ?? 0,
    winRate: round1((row.winRatePct ?? 0) * 100),
    averagePoints: round1(row.avgPoints ?? 0),
  }
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  perPage: number
  lastPage: number
  /** 1-based index of the first row on this page — used to number ladder rows. */
  firstItem: number
}

export async function paginatePlayers(
  period: StatsPeriod,
  filters: PlayerFilters,
  page: number,
  perPage: number,
  scope: GameScope = ALL_GAMES,
): Promise<Paginated<PlayerWithStats>> {
  const safePage = Math.max(1, page)

  const [result] = await Player.aggregate([
    ...playerPipeline(period, filters, scope),
    {
      $facet: {
        rows: [{ $skip: (safePage - 1) * perPage }, { $limit: perPage }],
        meta: [{ $count: 'total' }],
      },
    },
  ])

  const total: number = result?.meta?.[0]?.total ?? 0

  return {
    items: (result?.rows ?? []).map(toPlayer),
    total,
    page: safePage,
    perPage,
    lastPage: Math.max(1, Math.ceil(total / perPage)),
    firstItem: total === 0 ? 0 : (safePage - 1) * perPage + 1,
  }
}

export async function listPlayers(
  period: StatsPeriod,
  filters: PlayerFilters = {},
  limit?: number,
  scope: GameScope = ALL_GAMES,
): Promise<PlayerWithStats[]> {
  const pipeline = playerPipeline(period, filters, scope)
  if (limit) pipeline.push({ $limit: limit })

  const rows = await Player.aggregate(pipeline)
  return rows.map(toPlayer)
}

export async function topPlayers(
  limit: number,
  period: StatsPeriod,
  scope: GameScope = ALL_GAMES,
): Promise<PlayerWithStats[]> {
  return listPlayers(period, {}, limit, scope)
}

export async function findPlayerWithStats(
  id: string,
  period: StatsPeriod,
  scope: GameScope = ALL_GAMES,
): Promise<PlayerWithStats | null> {
  if (!Types.ObjectId.isValid(id)) return null

  const rows = await Player.aggregate([
    { $match: { _id: new Types.ObjectId(id) } },
    ...playerPipeline(period, {}, scope).slice(1),
  ])

  return rows[0] ? toPlayer(rows[0]) : null
}

/** 1-based position on the all-player ladder, or null if the player is unranked. */
export async function playerRank(
  id: string,
  period: StatsPeriod,
  scope: GameScope = ALL_GAMES,
): Promise<number | null> {
  const rows = await Player.aggregate([
    ...playerPipeline(period, {}, scope),
    { $project: { _id: 1 } },
  ])
  const index = rows.findIndex((r: { _id: Types.ObjectId }) => String(r._id) === id)

  return index === -1 ? null : index + 1
}

/* -------------------------------------------------------------------------
 | Teams
 |------------------------------------------------------------------------*/

export interface TeamFilters {
  search?: string | null
  status?: string | null
  sort?: SortKey
}

function teamPipeline(
  period: StatsPeriod,
  filters: TeamFilters = {},
  scope: GameScope = ALL_GAMES,
): PipelineStage[] {
  const match: Record<string, unknown> = {}

  if (filters.search) {
    const rx = searchRegex(filters.search)
    match.$or = [{ name: rx }, { code: rx }]
  }
  if (filters.status) match.status = filters.status

  const dateMatch = periodMatch(period)
  const gameScope = scopeMatch(scope)

  return [
    { $match: match },
    {
      // Every completed game this team took part in, on either side of the board.
      $lookup: {
        from: 'games',
        let: { tid: '$_id' },
        pipeline: [
          {
            $match: {
              status: 'completed',
              ...dateMatch,
              ...gameScope,
              $expr: { $or: [{ $eq: ['$teamAId', '$$tid'] }, { $eq: ['$teamBId', '$$tid'] }] },
            },
          },
          {
            $project: {
              _id: 0,
              winnerTeamId: 1,
              score: { $cond: [{ $eq: ['$teamAId', '$$tid'] }, '$teamAScore', '$teamBScore'] },
            },
          },
        ],
        as: 'played',
      },
    },
    {
      $lookup: {
        from: 'players',
        let: { tid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$teamId', '$$tid'] } } },
          { $project: { _id: 0, status: 1 } },
        ],
        as: 'roster',
      },
    },
    {
      $addFields: {
        gamesCount: { $size: '$played' },
        totalPoints: { $sum: '$played.score' },
        winsCount: {
          $size: {
            $filter: { input: '$played', as: 'g', cond: { $eq: ['$$g.winnerTeamId', '$_id'] } },
          },
        },
        lossesCount: {
          $size: {
            $filter: {
              input: '$played',
              as: 'g',
              cond: {
                $and: [
                  { $ne: ['$$g.winnerTeamId', null] },
                  { $ne: ['$$g.winnerTeamId', '$_id'] },
                ],
              },
            },
          },
        },
        playersCount: { $size: '$roster' },
        activePlayersCount: {
          $size: {
            $filter: { input: '$roster', as: 'p', cond: { $eq: ['$$p.status', 'active'] } },
          },
        },
      },
    },
    {
      $addFields: {
        winRatePct: {
          $cond: [{ $gt: ['$gamesCount', 0] }, { $divide: ['$winsCount', '$gamesCount'] }, 0],
        },
        avgPoints: {
          $cond: [{ $gt: ['$gamesCount', 0] }, { $divide: ['$totalPoints', '$gamesCount'] }, 0],
        },
      },
    },
    { $project: { played: 0, roster: 0 } },
    { $sort: sortStage(filters.sort, 'name') },
  ]
}

function toTeam(row: any): TeamWithStats {
  return {
    id: String(row._id),
    name: row.name,
    code: row.code,
    color: row.color,
    logo: row.logo ?? null,
    description: row.description ?? null,
    status: row.status,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    gamesCount: row.gamesCount ?? 0,
    winsCount: row.winsCount ?? 0,
    lossesCount: row.lossesCount ?? 0,
    totalPoints: row.totalPoints ?? 0,
    playersCount: row.playersCount ?? 0,
    activePlayersCount: row.activePlayersCount ?? 0,
    winRate: round1((row.winRatePct ?? 0) * 100),
    averagePoints: round1(row.avgPoints ?? 0),
  }
}

export async function paginateTeams(
  period: StatsPeriod,
  filters: TeamFilters,
  page: number,
  perPage: number,
  scope: GameScope = ALL_GAMES,
): Promise<Paginated<TeamWithStats>> {
  const safePage = Math.max(1, page)

  const [result] = await Team.aggregate([
    ...teamPipeline(period, filters, scope),
    {
      $facet: {
        rows: [{ $skip: (safePage - 1) * perPage }, { $limit: perPage }],
        meta: [{ $count: 'total' }],
      },
    },
  ])

  const total: number = result?.meta?.[0]?.total ?? 0

  return {
    items: (result?.rows ?? []).map(toTeam),
    total,
    page: safePage,
    perPage,
    lastPage: Math.max(1, Math.ceil(total / perPage)),
    firstItem: total === 0 ? 0 : (safePage - 1) * perPage + 1,
  }
}

export async function listTeams(
  period: StatsPeriod,
  filters: TeamFilters = {},
  limit?: number,
  scope: GameScope = ALL_GAMES,
): Promise<TeamWithStats[]> {
  const pipeline = teamPipeline(period, filters, scope)
  if (limit) pipeline.push({ $limit: limit })

  const rows = await Team.aggregate(pipeline)
  return rows.map(toTeam)
}

export async function topTeams(
  limit: number,
  period: StatsPeriod,
  scope: GameScope = ALL_GAMES,
): Promise<TeamWithStats[]> {
  return listTeams(period, {}, limit, scope)
}

export async function findTeamWithStats(
  id: string,
  period: StatsPeriod,
  scope: GameScope = ALL_GAMES,
): Promise<TeamWithStats | null> {
  if (!Types.ObjectId.isValid(id)) return null

  const rows = await Team.aggregate([
    { $match: { _id: new Types.ObjectId(id) } },
    ...teamPipeline(period, {}, scope).slice(1),
  ])

  return rows[0] ? toTeam(rows[0]) : null
}

/** 1-based position on the team ladder, or null if the team is unranked. */
export async function teamRank(
  id: string,
  period: StatsPeriod,
  scope: GameScope = ALL_GAMES,
): Promise<number | null> {
  const rows = await Team.aggregate([...teamPipeline(period, {}, scope), { $project: { _id: 1 } }])
  const index = rows.findIndex((r: { _id: Types.ObjectId }) => String(r._id) === id)

  return index === -1 ? null : index + 1
}
