import type { Metadata } from 'next'
import Link from 'next/link'
import { connectToDatabase } from '@/lib/db'
import { getDashboardData } from '@/lib/services/dashboard'
import { periodFromKey, periodLabel, PERIOD_OPTIONS } from '@/lib/stats-period'
import { formatDate, initialsOf, numberFormat, teamInitials } from '@/lib/format'
import { gameStatusVariant, capitalise } from '@/lib/enums'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { RankBadge, podiumClass } from '@/components/ui/RankBadge'
import { TeamChip } from '@/components/ui/TeamChip'
import { Table, HEAD_ROW } from '@/components/ui/Table'
import { AutoSubmitSelect } from '@/components/form/AutoSubmit'
import { DashboardCharts } from '@/components/charts/DashboardCharts'
import { isEditor } from '@/lib/authz'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const params = await searchParams
  const period = periodFromKey(params.period ?? 'all')

  await connectToDatabase()
  const { stats, topPlayers, topTeams, recentGames, charts } = await getDashboardData(period)

  const canEdit = await isEditor()
  return (
    <>
      <PageHeader
        title="Tournament Dashboard"
        subtitle={`Live standings and results — ${periodLabel(period).toLowerCase()}`}
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
              <LinkButton href="/games/create" icon="plus">
                New Game
              </LinkButton>
            )}
          </>
        }
      />

      {/* Headline statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Team Members"
          value={numberFormat(stats.totalPlayers)}
          hint={`${stats.activePlayers} active`}
          icon="users"
          tone="blue"
          href="/players"
        />
        <StatCard
          label="Teams"
          value={numberFormat(stats.totalTeams)}
          hint={`${stats.activeTeams} active`}
          icon="shield"
          tone="purple"
          href="/teams"
        />
        <StatCard
          label="Games"
          value={numberFormat(stats.totalGames)}
          hint={`${stats.completedGames} completed`}
          icon="board"
          tone="navy"
          href="/games"
        />
        <StatCard
          label="Games Completed"
          value={numberFormat(stats.completedGames)}
          hint={`${stats.totalGames - stats.completedGames} still to play`}
          icon="check-circle"
          tone="red"
        />
        <StatCard
          label="Top Player"
          value={stats.topPlayer?.name ?? '—'}
          hint={
            stats.topPlayer
              ? `${stats.topPlayer.winsCount} wins from ${stats.topPlayer.gamesCount} games`
              : 'No games played yet'
          }
          icon="trophy"
          tone="gold"
          href={stats.topPlayer ? `/players/${stats.topPlayer.id}` : null}
        />
        <StatCard
          label="Top Team"
          value={stats.topTeam?.name ?? '—'}
          hint={
            stats.topTeam
              ? `${stats.topTeam.winsCount} wins · ${stats.topTeam.winRate}% win rate`
              : 'No games played yet'
          }
          icon="star"
          tone="green"
          href={stats.topTeam ? `/teams/${stats.topTeam.id}` : null}
        />
      </div>

      {/* Leaderboards */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Top Players"
          subtitle="Ranked by games won"
          padding="p-0"
          action={
            <LinkButton href="/rankings/players" variant="secondary" size="sm" iconAfter="arrow-right">
              Full ranking
            </LinkButton>
          }
        >
          {topPlayers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="trophy"
                title="No player scores yet"
                description="Create a game and record its result — the leaderboard fills in automatically."
                action={
                  canEdit && (
                    <LinkButton href="/games/create" icon="plus">
                      Create the first game
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
                    <th scope="col" className="py-2 pr-3">Rank</th>
                    <th scope="col" className="px-3 py-2">Player</th>
                    <th scope="col" className="px-3 py-2">Team</th>
                    <th scope="col" className="px-3 py-2 text-right">Games</th>
                    <th scope="col" className="px-3 py-2 text-right">Wins</th>
                    <th scope="col" className="px-3 py-2 text-right">Losses</th>
                    <th scope="col" className="py-2 pl-3 text-right">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {topPlayers.map((player, index) => {
                    const rank = index + 1

                    return (
                      <tr
                        key={player.id}
                        className={`group transition hover:bg-navy-50/70 ${podiumClass(rank)}`}
                      >
                        <td data-label="Rank" className="py-3 pr-3">
                          <RankBadge rank={rank} />
                        </td>

                        <td data-label="Player" className="px-3 py-3">
                          <Link href={`/players/${player.id}`} className="flex items-center gap-3">
                            <Avatar src={player.photo} initials={initialsOf(player.name)} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-navy-900 group-hover:text-blue-600">
                                {player.name}
                              </span>
                              <span className="block text-xs text-slate-400">
                                {player.team?.name ?? 'Unassigned'}
                              </span>
                            </span>
                          </Link>
                        </td>

                        <td data-label="Team" className="px-3 py-3">
                          <TeamChip team={player.team} />
                        </td>

                        <td data-label="Games" className="px-3 py-3 text-right text-sm text-slate-600">
                          {player.gamesCount}
                        </td>

                        <td data-label="Wins" className="px-3 py-3 text-right">
                          <span
                            className={`text-sm font-bold ${rank === 1 ? 'text-gold-600' : 'text-navy-900'}`}
                          >
                            {numberFormat(player.winsCount)}
                          </span>
                        </td>

                        <td
                          data-label="Losses"
                          className="px-3 py-3 text-right text-sm font-semibold text-red-500"
                        >
                          {numberFormat(player.lossesCount)}
                        </td>

                        <td data-label="Win Rate" className="py-3 pl-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-navy-100 sm:block">
                              <span
                                className={`block h-full rounded-full ${player.winRate >= 50 ? 'bg-green-500' : 'bg-amber-400'}`}
                                style={{ width: `${Math.max(player.winRate, 2)}%` }}
                              />
                            </span>
                            <span className="text-sm font-semibold text-navy-800">
                              {player.winRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <Card
          title="Top Teams"
          subtitle="Ranked by games won"
          padding="p-0"
          action={
            <LinkButton href="/rankings/teams" variant="secondary" size="sm" iconAfter="arrow-right">
              All
            </LinkButton>
          }
        >
          {topTeams.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="shield"
                title="No teams ranked yet"
                description="Teams appear here once they have played a game."
              />
            </div>
          ) : (
            <ol className="divide-y divide-navy-50">
              {topTeams.map((team, index) => {
                const rank = index + 1

                return (
                  <li key={team.id} className={podiumClass(rank)}>
                    <Link
                      href={`/teams/${team.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-navy-50/70 sm:px-6"
                    >
                      <RankBadge rank={rank} />
                      <Avatar
                        src={team.logo}
                        initials={teamInitials(team.code, team.name)}
                        color={team.color}
                        size="sm"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy-900">
                          {team.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {team.playersCount} members ·{' '}
                          <span className="font-medium text-green-600">{team.winsCount}W</span>{' '}
                          <span className="font-medium text-red-500">{team.lossesCount}L</span>
                        </span>
                      </span>

                      <span className="shrink-0 text-right">
                        <span
                          className={`block text-sm font-bold ${rank === 1 ? 'text-gold-600' : 'text-navy-900'}`}
                        >
                          {numberFormat(team.winsCount)}
                        </span>
                        <span className="block text-[11px] text-slate-400">wins</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </Card>
      </div>

      <DashboardCharts charts={charts} />

      {/* Recent games */}
      <Card
        className="mt-6"
        title="Recent Games"
        subtitle="Latest fixtures and results"
        padding="p-0"
        action={
          <LinkButton href="/games" variant="secondary" size="sm" iconAfter="arrow-right">
            View All Games
          </LinkButton>
        }
      >
        {recentGames.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon="board"
              title="No games yet"
              description="Schedule a 1 vs 1 or 2 vs 2 game to get the tournament started."
              action={
                canEdit && (
                  <LinkButton href="/games/create" icon="plus">
                    Create New Game
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
                  <th scope="col" className="py-2 pr-3">Game</th>
                  <th scope="col" className="px-3 py-2">Format</th>
                  <th scope="col" className="px-3 py-2">Team A</th>
                  <th scope="col" className="px-3 py-2 text-center">Result</th>
                  <th scope="col" className="px-3 py-2">Team B</th>
                  <th scope="col" className="px-3 py-2">Winner</th>
                  <th scope="col" className="px-3 py-2">Date</th>
                  <th scope="col" className="py-2 pl-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {recentGames.map((game) => (
                  <tr key={game.id} className="transition hover:bg-navy-50/70">
                    <td data-label="Game" className="py-3 pr-3">
                      <Link
                        href={`/games/${game.id}`}
                        className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                      >
                        {game.label}
                      </Link>
                    </td>

                    <td data-label="Format" className="px-3 py-3">
                      <Badge variant="info">{game.formatLabel}</Badge>
                    </td>

                    <td data-label="Team A" className="px-3 py-3">
                      <TeamChip team={game.teamA} />
                    </td>

                    <td data-label="Result" className="px-3 py-3 text-center whitespace-nowrap">
                      {game.status === 'completed' ? (
                        <span className="text-xs font-bold tracking-wide">
                          <span className={game.teamAScore > 0 ? 'text-green-600' : 'text-slate-400'}>
                            {game.teamAScore > 0 ? 'W' : 'L'}
                          </span>
                          <span className="text-navy-300"> – </span>
                          <span className={game.teamBScore > 0 ? 'text-green-600' : 'text-slate-400'}>
                            {game.teamBScore > 0 ? 'W' : 'L'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>

                    <td data-label="Team B" className="px-3 py-3">
                      <TeamChip team={game.teamB} />
                    </td>

                    <td data-label="Winner" className="px-3 py-3">
                      {game.status === 'completed' && game.winner ? (
                        <Badge variant="gold" icon="trophy">
                          {game.winner.name}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>

                    <td
                      data-label="Date"
                      className="px-3 py-3 text-sm whitespace-nowrap text-slate-600"
                    >
                      {formatDate(game.gameDate)}
                    </td>

                    <td data-label="Status" className="py-3 pl-3 text-right">
                      <Badge variant={gameStatusVariant(game.status)}>
                        {capitalise(game.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </>
  )
}
