import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/db'
import { findTournament } from '@/lib/services/tournaments'
import { listGames } from '@/lib/services/games'
import { listTeams } from '@/lib/services/stats'
import { ALL_TIME } from '@/lib/stats-period'
import { capitalise, gameStatusVariant, tournamentStatusVariant } from '@/lib/enums'
import { formatDate, formatLongDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { StatCard } from '@/components/ui/StatCard'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, HEAD_ROW } from '@/components/ui/Table'
import { TeamChip } from '@/components/ui/TeamChip'
import { RankBadge } from '@/components/ui/RankBadge'
import { isEditor } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  await connectToDatabase()
  const tournament = await findTournament(id)

  return { title: tournament ? tournament.name : 'Tournament' }
}

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await connectToDatabase()
  const tournament = await findTournament(id)
  if (!tournament) notFound()

  // The ladder is the ordinary team ranking with the scope narrowed to this one
  // competition, so it stays consistent with every other table in the app.
  const scope = { key: 'one' as const, tournamentId: tournament.id }

  const [games, standings] = await Promise.all([
    listGames({ tournamentId: tournament.id }),
    listTeams(ALL_TIME, { sort: 'wins' }, undefined, scope),
  ])

  const contenders = standings.filter((team) => team.gamesCount > 0)
  const canEdit = await isEditor()

  return (
    <>
      <PageHeader
        title={tournament.name}
        subtitle={tournament.description || 'Tournament overview, fixtures and standings'}
        breadcrumbs={[
          { label: 'Tournaments', href: '/tournaments' },
          { label: tournament.name },
        ]}
        actions={
          canEdit && (
            <>
              <LinkButton
                href={`/games/create?tournament=${tournament.id}`}
                variant="secondary"
                icon="plus"
              >
                Add Game
              </LinkButton>
              <LinkButton href={`/tournaments/${tournament.id}/edit`} icon="pencil">
                Edit Tournament
              </LinkButton>
            </>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-navy-100 bg-white px-5 py-4 shadow-card">
        <Badge variant={tournamentStatusVariant(tournament.status)}>
          {capitalise(tournament.status)}
        </Badge>
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <Icon name="calendar" className="h-4 w-4 text-navy-400" />
          {formatLongDate(tournament.startDate)}
          {tournament.endDate ? ` → ${formatLongDate(tournament.endDate)}` : ' → ongoing'}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Games" value={tournament.gamesCount} icon="board" tone="blue" />
        <StatCard label="Played" value={tournament.completedCount} icon="check" tone="green" />
        <StatCard label="To play" value={tournament.scheduledCount} icon="clock" tone="gold" />
        <StatCard label="Teams" value={tournament.teamsCount} icon="shield" tone="navy" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Standings */}
        <Card
          className="xl:col-span-2"
          title="Standings"
          subtitle="Built from this tournament's completed games only"
          padding="p-0"
        >
          {contenders.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="trophy"
                title="No results yet"
                description="Standings appear once a game in this tournament has been scored."
              />
            </div>
          ) : (
            <div className="px-5 py-4 sm:px-6">
              <Table>
                <thead>
                  <tr className={HEAD_ROW}>
                    <th scope="col" className="py-2 pr-3">#</th>
                    <th scope="col" className="px-3 py-2">Team</th>
                    <th scope="col" className="px-3 py-2 text-center">P</th>
                    <th scope="col" className="px-3 py-2 text-center">W</th>
                    <th scope="col" className="px-3 py-2 text-center">L</th>
                    <th scope="col" className="py-2 pl-3 text-right">Win %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {contenders.map((team, index) => (
                    <tr key={team.id} className="transition hover:bg-navy-50/70">
                      <td data-label="#" className="py-3 pr-3">
                        <RankBadge rank={index + 1} />
                      </td>
                      <td data-label="Team" className="px-3 py-3">
                        <TeamChip team={team} />
                      </td>
                      <td data-label="P" className="px-3 py-3 text-center text-sm text-slate-600">
                        {team.gamesCount}
                      </td>
                      <td data-label="W" className="px-3 py-3 text-center text-sm font-semibold text-green-600">
                        {team.winsCount}
                      </td>
                      <td data-label="L" className="px-3 py-3 text-center text-sm font-semibold text-red-500">
                        {team.lossesCount}
                      </td>
                      <td data-label="Win %" className="py-3 pl-3 text-right text-sm font-bold text-blue-600">
                        {team.winRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        {/* Fixtures */}
        <Card
          className="xl:col-span-3"
          title="Fixtures"
          subtitle={`${games.length} game${games.length === 1 ? '' : 's'} in this tournament`}
          padding="p-0"
          action={
            <LinkButton
              href={`/games?tournament=${tournament.id}`}
              variant="secondary"
              size="sm"
              icon="eye"
            >
              All
            </LinkButton>
          }
        >
          {games.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="board"
                title="No games yet"
                description="Add a game and pick this tournament on the form to attach it here."
                action={
                  canEdit && (
                    <LinkButton href={`/games/create?tournament=${tournament.id}`} icon="plus">
                      Add the first game
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
                    <th scope="col" className="px-3 py-2">Team A</th>
                    <th scope="col" className="px-3 py-2">Team B</th>
                    <th scope="col" className="px-3 py-2">Winner</th>
                    <th scope="col" className="px-3 py-2">Date</th>
                    <th scope="col" className="py-2 pl-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {games.map((game) => (
                    <tr key={game.id} className="transition hover:bg-navy-50/70">
                      <td data-label="Game" className="py-3 pr-3">
                        <Link
                          href={`/games/${game.id}`}
                          className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                        >
                          {game.label}
                        </Link>
                      </td>
                      <td data-label="Team A" className="px-3 py-3">
                        <TeamChip team={game.teamA} />
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
                      <td data-label="Status" className="py-3 pl-3 text-center">
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
      </div>
    </>
  )
}
