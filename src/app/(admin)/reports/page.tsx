import type { Metadata } from 'next'
import Link from 'next/link'
import { connectToDatabase } from '@/lib/db'
import { buildReport } from '@/lib/services/reports'
import { customPeriod, periodFromKey, periodLabel, PERIOD_OPTIONS } from '@/lib/stats-period'
import { formatLongDate, initialsOf, numberFormat } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button, LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/ui/StatCard'
import { RankBadge } from '@/components/ui/RankBadge'
import { Table, HEAD_ROW } from '@/components/ui/Table'
import { Input } from '@/components/form/Input'
import { Select } from '@/components/form/Select'
import type { IconName } from '@/components/ui/Icon'
import type { PlayerWithStats } from '@/lib/services/stats'

export const metadata: Metadata = { title: 'Reports' }
export const dynamic = 'force-dynamic'

interface Params {
  period?: string
  from?: string
  to?: string
}

/** The query string carried through to every export link. */
function exportQuery(params: Params): string {
  const query = new URLSearchParams()
  if (params.period) query.set('period', params.period)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams

  // A custom date range overrides the preset period.
  const period =
    params.from || params.to
      ? customPeriod(params.from, params.to)
      : periodFromKey(params.period ?? 'all')

  await connectToDatabase()
  const report = await buildReport(period)

  const query = exportQuery(params)

  const highlights: {
    label: string
    icon: IconName
    tone: string
    player: PlayerWithStats | null
    detail: (p: PlayerWithStats) => string
  }[] = [
    {
      label: 'Most games played',
      icon: 'board',
      tone: 'bg-blue-50 text-blue-600',
      player: report.mostPlayedPlayer,
      detail: (p) => `${p.gamesCount} games · ${p.winsCount} wins`,
    },
    {
      label: 'Most wins',
      icon: 'trophy',
      tone: 'bg-gold-500/10 text-gold-600',
      player: report.mostWinsPlayer,
      detail: (p) => `${p.winsCount} wins · ${p.winRate}% win rate`,
    },
    {
      label: 'Best win rate',
      icon: 'fire',
      tone: 'bg-red-50 text-red-600',
      player: report.bestWinRatePlayer,
      detail: (p) => `${p.winRate}% from ${p.gamesCount} games`,
    },
  ]

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Tournament summary — ${periodLabel(period)}`}
        actions={
          <>
            <LinkButton
              href={`/reports/print${query}`}
              target="_blank"
              variant="secondary"
              icon="print"
            >
              PDF
            </LinkButton>
            <LinkButton
              href={`/api/reports/export/players${query}`}
              variant="secondary"
              icon="download"
            >
              Players CSV
            </LinkButton>
            <LinkButton
              href={`/api/reports/export/teams${query}`}
              variant="secondary"
              icon="download"
            >
              Teams CSV
            </LinkButton>
            <LinkButton href={`/api/reports/export/games${query}`} icon="download">
              Games CSV
            </LinkButton>
          </>
        }
      />

      {/* Date filters */}
      <form method="GET" className="mb-6 rounded-2xl border border-navy-100 bg-white p-4 shadow-card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="period" className="mb-1 block text-xs font-medium text-slate-500">
              Preset period
            </label>
            <Select
              name="period"
              id="period"
              options={PERIOD_OPTIONS}
              defaultValue={params.period ?? 'all'}
            />
          </div>

          <div>
            <label htmlFor="from" className="mb-1 block text-xs font-medium text-slate-500">
              From date
            </label>
            <Input name="from" id="from" type="date" defaultValue={params.from ?? ''} />
          </div>

          <div>
            <label htmlFor="to" className="mb-1 block text-xs font-medium text-slate-500">
              To date
            </label>
            <Input name="to" id="to" type="date" defaultValue={params.to ?? ''} />
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit" icon="filter" className="flex-1">
              Apply
            </Button>
            {(params.from || params.to || (params.period && params.period !== 'all')) && (
              <LinkButton href="/reports" variant="secondary" icon="refresh">
                <span className="sr-only">Reset</span>
              </LinkButton>
            )}
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          A custom date range overrides the preset period. Currently reporting on{' '}
          <strong className="text-navy-800">{periodLabel(period)}</strong>.
        </p>
      </form>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Games Completed"
          value={numberFormat(report.summary.totalGames)}
          hint="Finished games in this period"
          icon="board"
          tone="navy"
        />
        <StatCard
          label="Results Recorded"
          value={numberFormat(report.summary.decisiveGames)}
          hint="One winner per completed game"
          icon="check-circle"
          tone="red"
        />
        <StatCard
          label="Still To Play"
          value={numberFormat(report.summary.scheduledGames)}
          hint="Scheduled but not yet resolved"
          icon="clock"
          tone="purple"
        />
        <StatCard
          label="Players Involved"
          value={numberFormat(report.summary.playersInvolved)}
          hint={`${report.summary.oneVsOne} × 1v1 · ${report.summary.twoVsTwo} × 2v2`}
          icon="users"
          tone="blue"
        />
      </div>

      {/* Highlights */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {highlights.map((highlight) => (
          <Card key={highlight.label}>
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {highlight.label}
            </p>

            {highlight.player ? (
              <Link
                href={`/players/${highlight.player.id}`}
                className="mt-3 flex items-center gap-3 transition hover:opacity-80"
              >
                <Avatar
                  src={highlight.player.photo}
                  initials={initialsOf(highlight.player.name)}
                  size="lg"
                />
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold text-navy-900">
                    {highlight.player.name}
                  </span>
                  <span className="block text-sm text-slate-500">
                    {highlight.detail(highlight.player)}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-slate-400 italic">No data in this period.</p>
            )}
          </Card>
        ))}
      </div>

      {/* Leaderboards */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Top Players" subtitle={`Best scorers — ${periodLabel(period)}`} padding="p-0">
          {report.topPlayers.length === 0 ? (
            <div className="p-6">
              <EmptyState icon="trophy" title="No players scored in this period" />
            </div>
          ) : (
            <div className="px-5 py-4 sm:px-6">
              <Table>
                <thead>
                  <tr className={HEAD_ROW}>
                    <th scope="col" className="py-2 pr-3">#</th>
                    <th scope="col" className="px-3 py-2">Player</th>
                    <th scope="col" className="px-3 py-2 text-right">Games</th>
                    <th scope="col" className="px-3 py-2 text-right">Wins</th>
                    <th scope="col" className="py-2 pl-3 text-right">Win %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {report.topPlayers.map((player, index) => (
                    <tr key={player.id} className={index === 0 ? 'podium-gold' : ''}>
                      <td data-label="#" className="py-2.5 pr-3">
                        <RankBadge rank={index + 1} />
                      </td>
                      <td data-label="Player" className="px-3 py-2.5">
                        <Link
                          href={`/players/${player.id}`}
                          className="text-sm font-semibold text-navy-900 hover:text-blue-600"
                        >
                          {player.name}
                        </Link>
                        <span className="block text-xs text-slate-400">
                          {player.team?.name ?? 'Unassigned'}
                        </span>
                      </td>
                      <td
                        data-label="Games"
                        className="px-3 py-2.5 text-right text-sm text-slate-600"
                      >
                        {player.gamesCount}
                      </td>
                      <td
                        data-label="Wins"
                        className="px-3 py-2.5 text-right text-sm font-semibold text-green-600"
                      >
                        {player.winsCount}
                      </td>
                      <td
                        data-label="Win %"
                        className="py-2.5 pl-3 text-right text-sm font-bold text-navy-900"
                      >
                        {player.winRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <Card title="Top Teams" subtitle={`League table — ${periodLabel(period)}`} padding="p-0">
          {report.topTeams.length === 0 ? (
            <div className="p-6">
              <EmptyState icon="shield" title="No teams played in this period" />
            </div>
          ) : (
            <div className="px-5 py-4 sm:px-6">
              <Table>
                <thead>
                  <tr className={HEAD_ROW}>
                    <th scope="col" className="py-2 pr-3">#</th>
                    <th scope="col" className="px-3 py-2">Team</th>
                    <th scope="col" className="px-3 py-2 text-right">Games</th>
                    <th scope="col" className="px-3 py-2 text-right">W / L</th>
                    <th scope="col" className="py-2 pl-3 text-right">Win %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {report.topTeams.map((team, index) => (
                    <tr key={team.id} className={index === 0 ? 'podium-gold' : ''}>
                      <td data-label="#" className="py-2.5 pr-3">
                        <RankBadge rank={index + 1} />
                      </td>
                      <td data-label="Team" className="px-3 py-2.5">
                        <Link
                          href={`/teams/${team.id}`}
                          className="text-sm font-semibold text-navy-900 hover:text-blue-600"
                        >
                          {team.name}
                        </Link>
                        <span className="block text-xs text-slate-400">
                          {team.winRate}% win rate
                        </span>
                      </td>
                      <td
                        data-label="Games"
                        className="px-3 py-2.5 text-right text-sm text-slate-600"
                      >
                        {team.gamesCount}
                      </td>
                      <td
                        data-label="W / L"
                        className="px-3 py-2.5 text-right text-sm font-semibold whitespace-nowrap"
                      >
                        <span className="text-green-600">{team.winsCount}</span>
                        <span className="text-navy-300">/</span>
                        <span className="text-red-500">{team.lossesCount}</span>
                      </td>
                      <td
                        data-label="Win %"
                        className="py-2.5 pl-3 text-right text-sm font-bold text-navy-900"
                      >
                        {team.winRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Games by date */}
      <Card
        className="mt-6"
        title="Games by Date"
        subtitle="Completed match days in this period"
        padding="p-0"
      >
        {report.gamesByDate.length === 0 ? (
          <div className="p-6">
            <EmptyState icon="calendar" title="No completed games in this period" />
          </div>
        ) : (
          <div className="px-5 py-4 sm:px-6">
            <Table>
              <thead>
                <tr className={HEAD_ROW}>
                  <th scope="col" className="py-2 pr-3">Date</th>
                  <th scope="col" className="px-3 py-2 text-right">Games</th>
                  <th scope="col" className="py-2 pl-3 text-right">Results recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {report.gamesByDate.map((row) => {
                  const day = row.date.slice(0, 10)

                  return (
                    <tr key={row.date} className="transition hover:bg-navy-50/70">
                      <td
                        data-label="Date"
                        className="py-3 pr-3 text-sm font-medium text-navy-900"
                      >
                        <Link href={`/games?from=${day}&to=${day}`} className="hover:text-blue-600">
                          {formatLongDate(row.date)}
                        </Link>
                      </td>
                      <td data-label="Games" className="px-3 py-3 text-right text-sm text-slate-600">
                        {row.games}
                      </td>
                      <td
                        data-label="Results recorded"
                        className="py-3 pl-3 text-right text-sm font-semibold text-navy-900"
                      >
                        {numberFormat(row.points)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </>
  )
}
