import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/db'
import { findPlayerWithStats, playerRank } from '@/lib/services/stats'
import { opponentOf, playerAppearances, upcomingGamesForPlayer } from '@/lib/services/games'
import { periodFromKey, periodLabel, PERIOD_OPTIONS } from '@/lib/stats-period'
import { capitalise, recordStatusVariant } from '@/lib/enums'
import { formatDate, formatTimestampDate, initialsOf, numberFormat } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { StatCard } from '@/components/ui/StatCard'
import { TeamChip } from '@/components/ui/TeamChip'
import { Table, HEAD_ROW } from '@/components/ui/Table'
import { AutoSubmitSelect } from '@/components/form/AutoSubmit'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  await connectToDatabase()
  const player = await findPlayerWithStats(id, { from: null, to: null, key: 'all' })

  return { title: player?.name ?? 'Member' }
}

export default async function PlayerShowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { id } = await params
  const { period: periodKey } = await searchParams
  const period = periodFromKey(periodKey ?? 'all')

  await connectToDatabase()

  const player = await findPlayerWithStats(id, period)
  if (!player) notFound()

  const [appearances, upcoming, rank] = await Promise.all([
    playerAppearances(id, period),
    upcomingGamesForPlayer(id),
    playerRank(id, period),
  ])

  const details: [string, string][] = [
    ['Mobile', player.mobile || '—'],
    ['Email', player.email || '—'],
    ['Joined', formatTimestampDate(player.createdAt)],
  ]

  return (
    <>
      <PageHeader
        title={player.name}
        subtitle="Player profile, record and full game history"
        breadcrumbs={[{ label: 'Team Members', href: '/players' }, { label: player.name }]}
        actions={
          <>
            <form className="flex items-center gap-2">
              <label htmlFor="period" className="sr-only">
                Period
              </label>
              <AutoSubmitSelect
                name="period"
                id="period"
                options={PERIOD_OPTIONS}
                defaultValue={period.key}
                className="w-40"
              />
            </form>
            <LinkButton href={`/players/${player.id}/edit`} icon="pencil">
              Edit Member
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Profile card */}
        <div className="space-y-6">
          <Card padding="p-0">
            <div className="flex flex-col items-center border-b border-navy-100 px-6 py-7 text-center">
              <Avatar src={player.photo} initials={initialsOf(player.name)} size="xl" ring />

              <h2 className="mt-4 text-lg font-bold text-navy-900">{player.name}</h2>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Badge variant={recordStatusVariant(player.status)}>
                  {capitalise(player.status)}
                </Badge>
                {rank && (
                  <Badge variant={rank === 1 ? 'gold' : 'info'} icon="trophy">
                    Rank #{rank}
                  </Badge>
                )}
              </div>

              <div className="mt-4">
                <TeamChip team={player.team} size="sm" />
              </div>
            </div>

            <dl className="divide-y divide-navy-50 text-sm">
              {details.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6"
                >
                  <dt className="shrink-0 text-slate-500">{label}</dt>
                  <dd className="truncate font-medium text-navy-900">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
                <dt className="text-slate-500">Win rate</dt>
                <dd className="font-bold text-blue-600">{player.winRate}%</dd>
              </div>
            </dl>
          </Card>

          {upcoming.length > 0 && (
            <Card title="Upcoming Games" padding="p-0">
              <ul className="divide-y divide-navy-50">
                {upcoming.map((game) => (
                  <li key={game.id}>
                    <Link
                      href={`/games/${game.id}/score`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-navy-50/70 sm:px-6"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <Icon name="clock" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy-900">
                          {game.teamA?.name} vs {game.teamB?.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {formatDate(game.gameDate)} · {game.formatLabel}
                        </span>
                      </span>
                      <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-navy-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Stats + history */}
        <div className="space-y-6 xl:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Games Played"
              value={numberFormat(player.gamesCount)}
              icon="board"
              tone="navy"
            />
            <StatCard label="Wins" value={numberFormat(player.winsCount)} icon="trophy" tone="green" />
            <StatCard
              label="Losses"
              value={numberFormat(player.lossesCount)}
              icon="alert"
              tone="red"
            />
            <StatCard label="Win Rate" value={`${player.winRate}%`} icon="star" tone="gold" />
          </div>

          <Card
            title="Game History"
            subtitle={`${appearances.length} completed games · ${periodLabel(period)}`}
            padding="p-0"
          >
            {appearances.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon="board"
                  title="No completed games"
                  description="Once this member plays a scored game it will show up here."
                />
              </div>
            ) : (
              <div className="px-5 py-4 sm:px-6">
                <Table>
                  <thead>
                    <tr className={HEAD_ROW}>
                      <th scope="col" className="py-2 pr-3">Game</th>
                      <th scope="col" className="px-3 py-2">Opponent</th>
                      <th scope="col" className="px-3 py-2 text-center">Result</th>
                      <th scope="col" className="py-2 pl-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50">
                    {appearances.map((game) => {
                      const entry = game.lineup.find((l) => l.playerId === player.id)
                      const side = entry?.teamId ?? ''
                      const opponent = opponentOf(game, side)
                      const won = game.winnerTeamId === side

                      return (
                        <tr key={game.id} className="transition hover:bg-navy-50/70">
                          <td data-label="Game" className="py-3 pr-3">
                            <Link
                              href={`/games/${game.id}`}
                              className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                            >
                              {game.label}
                            </Link>
                            <span className="block text-xs text-slate-400">{game.formatLabel}</span>
                          </td>
                          <td data-label="Opponent" className="px-3 py-3">
                            <TeamChip team={opponent} />
                          </td>
                          <td data-label="Result" className="px-3 py-3 text-center">
                            <Badge variant={won ? 'success' : 'danger'}>{won ? 'Win' : 'Loss'}</Badge>
                          </td>
                          <td
                            data-label="Date"
                            className="py-3 pl-3 text-right text-sm whitespace-nowrap text-slate-600"
                          >
                            {formatDate(game.gameDate)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
