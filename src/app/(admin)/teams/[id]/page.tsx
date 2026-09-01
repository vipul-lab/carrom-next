import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/db'
import { findTeamWithStats, listPlayers, teamRank } from '@/lib/services/stats'
import { didTeamWin, listGames, opponentOf } from '@/lib/services/games'
import { periodFromKey, periodLabel, PERIOD_OPTIONS } from '@/lib/stats-period'
import { capitalise, gameStatusVariant, recordStatusVariant } from '@/lib/enums'
import { formatDate, formatTimestampDate, initialsOf, numberFormat, teamInitials } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Table, HEAD_ROW } from '@/components/ui/Table'
import { AutoSubmitSelect } from '@/components/form/AutoSubmit'
import { isEditor } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  await connectToDatabase()
  const team = await findTeamWithStats(id, { from: null, to: null, key: 'all' })

  return { title: team?.name ?? 'Team' }
}

export default async function TeamShowPage({
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

  const team = await findTeamWithStats(id, period)
  if (!team) notFound()

  const [players, recentGames, rank] = await Promise.all([
    listPlayers(period, { teamId: id }),
    listGames({ teamId: id }, 10),
    teamRank(id, period),
  ])

  const tiles: [string, string, string][] = [
    ['Games', numberFormat(team.gamesCount), 'text-navy-900'],
    ['Wins', numberFormat(team.winsCount), 'text-green-600'],
    ['Losses', numberFormat(team.lossesCount), 'text-red-500'],
    ['Win rate', `${team.winRate}%`, 'text-blue-600'],
  ]

  const meta: [string, string][] = [
    ['Win rate', `${team.winRate}%`],
    ['Games won', numberFormat(team.winsCount)],
    ['Period', periodLabel(period)],
    ['Created', formatTimestampDate(team.createdAt)],
  ]

  const canEdit = await isEditor()
  return (
    <>
      <PageHeader
        title={team.name}
        subtitle={team.description || 'Team profile, roster and results'}
        breadcrumbs={[{ label: 'Teams', href: '/teams' }, { label: team.name }]}
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
            {canEdit && (
              <>
                <LinkButton
                  href={`/players/create?teamId=${team.id}`}
                  variant="secondary"
                  icon="plus"
                >
                  Add Member
                </LinkButton>
                <LinkButton href={`/teams/${team.id}/edit`} icon="pencil">
                  Edit Team
                </LinkButton>
              </>
            )}
          </>
        }
      />

      {/* Team banner */}
      <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
        <div className="h-2 w-full" style={{ backgroundColor: team.color }} />

        <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <Avatar
              src={team.logo}
              initials={teamInitials(team.code, team.name)}
              color={team.color}
              size="xl"
            />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-navy-900">{team.name}</h2>
                <Badge variant="muted">{team.code}</Badge>
                <Badge variant={recordStatusVariant(team.status)}>{capitalise(team.status)}</Badge>
              </div>

              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                {rank && (
                  <span
                    className={`inline-flex items-center gap-1.5 font-semibold ${rank === 1 ? 'text-gold-600' : 'text-navy-700'}`}
                  >
                    <Icon name="trophy" className="h-4 w-4" />
                    Ranked #{rank}
                  </span>
                )}
                <span>
                  {team.activePlayersCount} active of {team.playersCount} members
                </span>
              </p>
            </div>
          </div>

          <dl className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map(([label, value, tone]) => (
              <div key={label} className="rounded-xl bg-navy-50 px-3 py-2.5 text-center">
                <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  {label}
                </dt>
                <dd className={`mt-0.5 text-lg font-bold ${tone}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-navy-100 bg-navy-100 sm:grid-cols-4">
          {meta.map(([label, value]) => (
            <div key={label} className="bg-white px-4 py-3">
              <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-navy-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Roster */}
        <Card
          className="xl:col-span-3"
          title="Team Members"
          subtitle={`${players.length} on the roster`}
          padding="p-0"
          action={
            canEdit && (
              <LinkButton
                href={`/players/create?teamId=${team.id}`}
                variant="secondary"
                size="sm"
                icon="plus"
              >
                Add
              </LinkButton>
            )
          }
        >
          {players.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="users"
                title="No members yet"
                description="A team needs at least one active member before it can be picked for a game."
                action={
                  canEdit && (
                    <LinkButton href={`/players/create?teamId=${team.id}`} icon="plus">
                      Add the first member
                    </LinkButton>
                  )
                }
              />
            </div>
          ) : (
            <div className="px-5 py-4 sm:px-6">
              <Table>
                <thead>
                  <tr className={HEAD_ROW}>
                    <th scope="col" className="py-2 pr-3">Member</th>
                    <th scope="col" className="px-3 py-2 text-right">Games</th>
                    <th scope="col" className="px-3 py-2 text-right">W / L</th>
                    <th scope="col" className="px-3 py-2 text-right">Win %</th>
                    <th scope="col" className="py-2 pl-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {players.map((player) => (
                    <tr key={player.id} className="group transition hover:bg-navy-50/70">
                      <td data-label="Member" className="py-3 pr-3">
                        <Link href={`/players/${player.id}`} className="flex items-center gap-3">
                          <Avatar src={player.photo} initials={initialsOf(player.name)} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-navy-900 group-hover:text-blue-600">
                              {player.name}
                            </span>
                            <span className="block text-xs text-slate-400">
                              {player.winRate}% win rate
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td data-label="Games" className="px-3 py-3 text-right text-sm text-slate-600">
                        {player.gamesCount}
                      </td>
                      <td
                        data-label="W / L"
                        className="px-3 py-3 text-right text-sm font-semibold whitespace-nowrap"
                      >
                        <span className="text-green-600">{player.winsCount}</span>
                        <span className="text-navy-300">/</span>
                        <span className="text-red-500">{player.lossesCount}</span>
                      </td>
                      <td
                        data-label="Win %"
                        className="px-3 py-3 text-right text-sm font-bold text-navy-900"
                      >
                        {player.winRate}%
                      </td>
                      <td data-label="Status" className="py-3 pl-3 text-right">
                        <Badge variant={recordStatusVariant(player.status)}>
                          {capitalise(player.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        {/* Recent games */}
        <Card
          className="xl:col-span-2"
          title="Recent Games"
          subtitle="Last 10 fixtures"
          padding="p-0"
          action={
            <LinkButton
              href={`/games?teamId=${team.id}`}
              variant="secondary"
              size="sm"
              iconAfter="arrow-right"
            >
              All
            </LinkButton>
          }
        >
          {recentGames.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="board"
                title="No games played"
                description="This team has not been picked for a game yet."
              />
            </div>
          ) : (
            <ul className="divide-y divide-navy-50">
              {recentGames.map((game) => {
                const opponent = opponentOf(game, team.id)
                const won = didTeamWin(game, team.id)
                const completed = game.status === 'completed'

                return (
                  <li key={game.id}>
                    <Link
                      href={`/games/${game.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-navy-50/70 sm:px-6"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          !completed
                            ? 'bg-amber-50 text-amber-600'
                            : won
                              ? 'bg-green-50 text-green-600'
                              : 'bg-red-50 text-red-500'
                        }`}
                      >
                        {!completed ? '—' : won ? 'W' : 'L'}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy-900">
                          vs {opponent?.name ?? 'Unknown'}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {game.formatLabel} · {formatDate(game.gameDate)}
                        </span>
                      </span>

                      <span className="shrink-0 text-right">
                        {completed ? (
                          <Badge variant={won ? 'success' : 'danger'}>{won ? 'Won' : 'Lost'}</Badge>
                        ) : (
                          <Badge variant={gameStatusVariant(game.status)}>
                            {capitalise(game.status)}
                          </Badge>
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
