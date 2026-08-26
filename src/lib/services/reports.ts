import 'server-only'
import { Game } from '../models/Game'
import { periodMatch, periodLabel, type StatsPeriod } from '../stats-period'
import { listPlayers, listTeams, type PlayerWithStats, type TeamWithStats } from './stats'
import { listGames, resultLabel } from './games'
import { formatDate, formatLongDate } from '../format'
import { capitalise, formatLabel } from '../enums'

/**
 * Aggregates the tournament-wide figures shown on the Reports page and the rows
 * used by the CSV and printable exports.
 */

export interface ReportSummary {
  totalGames: number
  scheduledGames: number
  totalPoints: number
  /** Every completed game awards exactly one point, to its winner. */
  decisiveGames: number
  oneVsOne: number
  twoVsTwo: number
  playersInvolved: number
}

export interface GamesByDateRow {
  date: string
  games: number
  points: number
}

export interface ReportData {
  period: StatsPeriod
  periodLabel: string
  summary: ReportSummary
  topPlayers: PlayerWithStats[]
  topTeams: TeamWithStats[]
  mostPlayedPlayer: PlayerWithStats | null
  mostWinsPlayer: PlayerWithStats | null
  bestWinRatePlayer: PlayerWithStats | null
  gamesByDate: GamesByDateRow[]
}

async function summary(period: StatsPeriod): Promise<ReportSummary> {
  const window = periodMatch(period)

  const [agg, scheduledGames, involved] = await Promise.all([
    Game.aggregate([
      { $match: { status: 'completed', ...window } },
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          totalPoints: { $sum: { $add: ['$teamAScore', '$teamBScore'] } },
          oneVsOne: { $sum: { $cond: [{ $eq: ['$format', '1v1'] }, 1, 0] } },
          twoVsTwo: { $sum: { $cond: [{ $eq: ['$format', '2v2'] }, 1, 0] } },
        },
      },
    ]),
    Game.countDocuments({ status: 'scheduled', ...window }),
    Game.aggregate([
      { $match: { status: 'completed', ...window } },
      { $unwind: '$lineup' },
      { $group: { _id: '$lineup.playerId' } },
      { $count: 'total' },
    ]),
  ])

  const row = agg[0] ?? { totalGames: 0, totalPoints: 0, oneVsOne: 0, twoVsTwo: 0 }

  return {
    totalGames: row.totalGames,
    scheduledGames,
    totalPoints: row.totalPoints,
    decisiveGames: row.totalPoints,
    oneVsOne: row.oneVsOne,
    twoVsTwo: row.twoVsTwo,
    playersInvolved: involved[0]?.total ?? 0,
  }
}

async function gamesByDate(period: StatsPeriod): Promise<GamesByDateRow[]> {
  const rows = await Game.aggregate([
    { $match: { status: 'completed', ...periodMatch(period) } },
    {
      $group: {
        _id: '$gameDate',
        games: { $sum: 1 },
        points: { $sum: { $add: ['$teamAScore', '$teamBScore'] } },
      },
    },
    { $sort: { _id: -1 } },
  ])

  return rows.map((r: { _id: Date; games: number; points: number }) => ({
    date: new Date(r._id).toISOString(),
    games: r.games,
    points: r.points,
  }))
}

/**
 * The strongest win percentage in the period. A minimum of three games keeps a
 * single lucky result from topping the table; below that we fall back to the
 * player with the most wins.
 */
function bestWinRate(players: PlayerWithStats[], mostWins: PlayerWithStats | null) {
  const eligible = players
    .filter((p) => p.gamesCount >= 3)
    .sort((a, b) => b.winRate - a.winRate || b.winsCount - a.winsCount)

  return eligible[0] ?? mostWins
}

export async function buildReport(period: StatsPeriod, limit = 10): Promise<ReportData> {
  const [reportSummary, allPlayers, allTeams, byDate] = await Promise.all([
    summary(period),
    listPlayers(period),
    listTeams(period),
    gamesByDate(period),
  ])

  const mostPlayed =
    [...allPlayers].sort((a, b) => b.gamesCount - a.gamesCount || b.totalPoints - a.totalPoints)[0] ??
    null

  const mostWins =
    [...allPlayers].sort((a, b) => b.winsCount - a.winsCount || b.totalPoints - a.totalPoints)[0] ??
    null

  return {
    period,
    periodLabel: periodLabel(period),
    summary: reportSummary,
    topPlayers: allPlayers.slice(0, limit),
    topTeams: allTeams.slice(0, limit),
    mostPlayedPlayer: mostPlayed,
    mostWinsPlayer: mostWins,
    bestWinRatePlayer: bestWinRate(allPlayers, mostWins),
    gamesByDate: byDate,
  }
}

export async function teamStandings(period: StatsPeriod): Promise<TeamWithStats[]> {
  return listTeams(period)
}

/* -------------------------------------------------------------------------
 | Export rows
 |------------------------------------------------------------------------*/

export type ExportRow = (string | number)[]

export async function playerExportRows(period: StatsPeriod): Promise<ExportRow[]> {
  const players = await listPlayers(period)
  const rows: ExportRow[] = [['Rank', 'Player', 'Team', 'Games', 'Wins', 'Losses', 'Win %']]

  players.forEach((player, index) => {
    rows.push([
      index + 1,
      player.name,
      player.team?.name ?? 'Unassigned',
      player.gamesCount,
      player.winsCount,
      player.lossesCount,
      player.winRate,
    ])
  })

  return rows
}

export async function teamExportRows(period: StatsPeriod): Promise<ExportRow[]> {
  const teams = await listTeams(period)
  const rows: ExportRow[] = [
    ['Rank', 'Team', 'Code', 'Members', 'Games', 'Wins', 'Losses', 'Win %'],
  ]

  teams.forEach((team, index) => {
    rows.push([
      index + 1,
      team.name,
      team.code,
      team.playersCount,
      team.gamesCount,
      team.winsCount,
      team.lossesCount,
      team.winRate,
    ])
  })

  return rows
}

export async function gameExportRows(period: StatsPeriod): Promise<ExportRow[]> {
  const games = await listGames({ from: period.from, to: period.to })
  const rows: ExportRow[] = [
    ['Game', 'Date', 'Format', 'Team A', 'Score A', 'Team B', 'Score B', 'Result', 'Status'],
  ]

  for (const game of games) {
    rows.push([
      game.label,
      game.gameDate.slice(0, 10),
      formatLabel(game.format),
      game.teamA?.name ?? '',
      game.teamAScore,
      game.teamB?.name ?? '',
      game.teamBScore,
      resultLabel(game),
      capitalise(game.status),
    ])
  }

  return rows
}

/** RFC 4180 CSV: quote every field, double any embedded quote. */
export function toCsv(rows: ExportRow[]): string {
  return rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
}

export { formatDate, formatLongDate }
