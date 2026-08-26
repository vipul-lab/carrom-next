import 'server-only'
import { Game } from '../models/Game'
import { Player } from '../models/Player'
import { Team } from '../models/Team'
import { periodMatch, type StatsPeriod } from '../stats-period'
import { topPlayers, topTeams, type PlayerWithStats, type TeamWithStats } from './stats'
import { listGames, type GameView } from './games'
import { formatShortDate } from '../format'

/**
 * Assembles everything the dashboard needs. Kept out of the page component so
 * the same figures can be reused by the reports module and tested in isolation.
 */

export interface HeadlineStats {
  totalPlayers: number
  activePlayers: number
  totalTeams: number
  activeTeams: number
  totalGames: number
  completedGames: number
  totalPoints: number
  topPlayer: PlayerWithStats | null
  topTeam: TeamWithStats | null
}

export interface ChartPayload {
  pointsByPlayer: { labels: string[]; values: number[] }
  pointsByTeam: { labels: string[]; values: number[]; colors: string[] }
  gamesOverTime: { labels: string[]; values: number[] }
  winsLosses: { labels: string[]; wins: number[]; losses: number[] }
}

export interface DashboardData {
  stats: HeadlineStats
  topPlayers: PlayerWithStats[]
  topTeams: TeamWithStats[]
  recentGames: GameView[]
  charts: ChartPayload
}

/** Completed games per day, most recent `days` match days. */
async function gamesOverTime(period: StatsPeriod, days = 14) {
  const rows = await Game.aggregate([
    { $match: { status: 'completed', ...periodMatch(period) } },
    { $group: { _id: '$gameDate', total: { $sum: 1 } } },
    { $sort: { _id: -1 } },
    { $limit: days },
    { $sort: { _id: 1 } },
  ])

  return {
    labels: rows.map((r: { _id: Date }) => formatShortDate(r._id)),
    values: rows.map((r: { total: number }) => r.total),
  }
}

/** One round-trip per figure, all issued together. */
export async function getDashboardData(period: StatsPeriod): Promise<DashboardData> {
  const [
    totalPlayers,
    activePlayers,
    totalTeams,
    activeTeams,
    totalGames,
    completedGames,
    pointsAgg,
    players,
    teams,
    recentGames,
    overTime,
  ] = await Promise.all([
    Player.countDocuments({}),
    Player.countDocuments({ status: 'active' }),
    Team.countDocuments({}),
    Team.countDocuments({ status: 'active' }),
    Game.countDocuments({}),
    Game.countDocuments({ status: 'completed' }),
    Game.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: { $add: ['$teamAScore', '$teamBScore'] } } } },
    ]),
    topPlayers(10, period),
    topTeams(8, period),
    listGames({}, 8),
    gamesOverTime(period),
  ])

  const chartPlayers = players.slice(0, 8)

  return {
    stats: {
      totalPlayers,
      activePlayers,
      totalTeams,
      activeTeams,
      totalGames,
      completedGames,
      totalPoints: pointsAgg[0]?.total ?? 0,
      topPlayer: players[0] ?? null,
      topTeam: teams[0] ?? null,
    },
    topPlayers: players,
    topTeams: teams.slice(0, 5),
    recentGames,
    charts: {
      pointsByPlayer: {
        labels: chartPlayers.map((p) => p.name),
        values: chartPlayers.map((p) => p.totalPoints),
      },
      pointsByTeam: {
        labels: teams.map((t) => t.name),
        values: teams.map((t) => t.totalPoints),
        colors: teams.map((t) => t.color),
      },
      gamesOverTime: overTime,
      winsLosses: {
        labels: teams.map((t) => t.name),
        wins: teams.map((t) => t.winsCount),
        losses: teams.map((t) => t.lossesCount),
      },
    },
  }
}
