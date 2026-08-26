import type { Metadata } from 'next'
import { connectToDatabase } from '@/lib/db'
import { buildReport, teamStandings } from '@/lib/services/reports'
import { customPeriod, periodFromKey, periodLabel } from '@/lib/stats-period'
import { formatDateTime, formatLongDate, numberFormat } from '@/lib/format'
import { PrintTrigger } from './PrintTrigger'

export const metadata: Metadata = { title: 'Tournament Report' }
export const dynamic = 'force-dynamic'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Carrom Arena'

/**
 * The printable report.
 *
 * Laravel rendered this server-side with dompdf. On Vercel a headless PDF
 * renderer is a heavy dependency for one page, so this is a print-optimised
 * document that opens the browser's print dialog — "Save as PDF" there produces
 * the same A4 document, with selectable text and no extra runtime.
 */
export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {

  const params = await searchParams
  const period =
    params.from || params.to
      ? customPeriod(params.from, params.to)
      : periodFromKey(params.period ?? 'all')

  await connectToDatabase()

  const [report, standings] = await Promise.all([buildReport(period, 15), teamStandings(period)])

  const summaryTiles: [string, string][] = [
    ['Games completed', numberFormat(report.summary.totalGames)],
    ['Results recorded', numberFormat(report.summary.decisiveGames)],
    ['Still to play', numberFormat(report.summary.scheduledGames)],
    ['Players involved', numberFormat(report.summary.playersInvolved)],
    ['1 vs 1 games', numberFormat(report.summary.oneVsOne)],
    ['2 vs 2 games', numberFormat(report.summary.twoVsTwo)],
  ]

  return (
    <div className="min-h-full bg-white">
      <PrintTrigger />

      <div className="mx-auto max-w-4xl px-8 py-10 print-full">
        <header className="flex items-end justify-between gap-6 border-b-2 border-navy-900 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">{APP_NAME}</h1>
            <p className="mt-0.5 text-sm text-slate-500">Tournament report</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="text-sm font-semibold text-navy-900">{periodLabel(period)}</p>
            <p>Generated {formatDateTime(new Date())}</p>
          </div>
        </header>

        <section className="mt-8">
          <h2 className="text-sm font-bold tracking-wide text-navy-900 uppercase">Summary</h2>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            {summaryTiles.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-navy-100 bg-navy-50 px-3 py-2.5">
                <dt className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                  {label}
                </dt>
                <dd className="mt-0.5 text-lg font-bold text-navy-900">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8 break-inside-avoid">
          <h2 className="text-sm font-bold tracking-wide text-navy-900 uppercase">Top Players</h2>
          {report.topPlayers.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 italic">No players scored in this period.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200 text-left text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="py-2 pr-3">#</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2 text-right">Games</th>
                  <th className="px-3 py-2 text-right">Wins</th>
                  <th className="px-3 py-2 text-right">Losses</th>
                  <th className="py-2 pl-3 text-right">Win %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {report.topPlayers.map((player, index) => (
                  <tr key={player.id}>
                    <td className="py-1.5 pr-3 font-semibold text-slate-500">{index + 1}</td>
                    <td className="px-3 py-1.5 font-medium text-navy-900">{player.name}</td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {player.team?.name ?? 'Unassigned'}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-600">{player.gamesCount}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{player.winsCount}</td>
                    <td className="px-3 py-1.5 text-right text-slate-600">{player.lossesCount}</td>
                    <td className="py-1.5 pl-3 text-right font-semibold">{player.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-8 break-inside-avoid">
          <h2 className="text-sm font-bold tracking-wide text-navy-900 uppercase">
            Team Standings
          </h2>
          {standings.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 italic">No teams played in this period.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200 text-left text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="py-2 pr-3">#</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2 text-right">Members</th>
                  <th className="px-3 py-2 text-right">Games</th>
                  <th className="px-3 py-2 text-right">Wins</th>
                  <th className="px-3 py-2 text-right">Losses</th>
                  <th className="py-2 pl-3 text-right">Win %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {standings.map((team, index) => (
                  <tr key={team.id}>
                    <td className="py-1.5 pr-3 font-semibold text-slate-500">{index + 1}</td>
                    <td className="px-3 py-1.5 font-medium text-navy-900">{team.name}</td>
                    <td className="px-3 py-1.5 text-slate-600">{team.code}</td>
                    <td className="px-3 py-1.5 text-right text-slate-600">{team.playersCount}</td>
                    <td className="px-3 py-1.5 text-right text-slate-600">{team.gamesCount}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{team.winsCount}</td>
                    <td className="px-3 py-1.5 text-right text-slate-600">{team.lossesCount}</td>
                    <td className="py-1.5 pl-3 text-right font-semibold">{team.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-8 break-inside-avoid">
          <h2 className="text-sm font-bold tracking-wide text-navy-900 uppercase">Match Days</h2>
          {report.gamesByDate.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 italic">
              No completed games in this period.
            </p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200 text-left text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="py-2 pr-3">Date</th>
                  <th className="px-3 py-2 text-right">Games</th>
                  <th className="py-2 pl-3 text-right">Results recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {report.gamesByDate.map((row) => (
                  <tr key={row.date}>
                    <td className="py-1.5 pr-3 text-navy-900">{formatLongDate(row.date)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-600">{row.games}</td>
                    <td className="py-1.5 pl-3 text-right font-semibold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-10 border-t border-navy-200 pt-3 text-[10px] text-slate-400">
          Every figure in this report is derived from recorded games — nothing is stored as a
          running total.
        </footer>
      </div>
    </div>
  )
}
