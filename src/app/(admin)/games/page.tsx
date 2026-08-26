import type { Metadata } from 'next'
import Link from 'next/link'
import { connectToDatabase } from '@/lib/db'
import { Player } from '@/lib/models/Player'
import { Team } from '@/lib/models/Team'
import { paginateGames } from '@/lib/services/games'
import { FORMAT_OPTIONS, STATUS_OPTIONS, capitalise, gameStatusVariant } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button, LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { TeamChip } from '@/components/ui/TeamChip'
import { Table, HEAD_ROW } from '@/components/ui/Table'
import { Input } from '@/components/form/Input'
import { Select } from '@/components/form/Select'

export const metadata: Metadata = { title: 'Games' }
export const dynamic = 'force-dynamic'

interface Params {
  search?: string
  teamId?: string
  playerId?: string
  format?: string
  winner?: string
  status?: string
  from?: string
  to?: string
  page?: string
  [key: string]: string | undefined
}

export default async function GamesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams

  const filters = {
    search: params.search ?? null,
    teamId: params.teamId ?? null,
    playerId: params.playerId ?? null,
    format: params.format ?? null,
    winner: params.winner ?? null,
    status: params.status ?? null,
    from: params.from ?? null,
    to: params.to ?? null,
  }

  await connectToDatabase()

  const [games, teams, players] = await Promise.all([
    paginateGames(filters, Number(params.page ?? 1), 12),
    Team.find({}).sort({ name: 1 }).select('name').lean(),
    Player.find({}).sort({ name: 1 }).select('name').lean(),
  ])

  const teamOptions = teams.map((t) => [String(t._id), t.name] as [string, string])
  const playerOptions = players.map((p) => [String(p._id), p.name] as [string, string])
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <>
      <PageHeader
        title="Game History"
        subtitle="Every fixture, filtered any way you need it"
        actions={
          <>
            <LinkButton href="/api/reports/export/games" variant="secondary" icon="download">
              Export CSV
            </LinkButton>
            <LinkButton href="/games/create" icon="plus">
              Create New Game
            </LinkButton>
          </>
        }
      />

      {/* Filters */}
      <form method="GET" className="mb-6 rounded-2xl border border-navy-100 bg-white p-4 shadow-card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="search" className="sr-only">
              Search games
            </label>
            <Input
              name="search"
              id="search"
              icon="search"
              defaultValue={params.search ?? ''}
              placeholder="Search by game number or team name…"
            />
          </div>

          <div>
            <label htmlFor="teamId" className="mb-1 block text-xs font-medium text-slate-500">
              Team
            </label>
            <Select
              name="teamId"
              id="teamId"
              options={teamOptions}
              defaultValue={params.teamId ?? ''}
              placeholder="Any team"
            />
          </div>

          <div>
            <label htmlFor="playerId" className="mb-1 block text-xs font-medium text-slate-500">
              Player
            </label>
            <Select
              name="playerId"
              id="playerId"
              options={playerOptions}
              defaultValue={params.playerId ?? ''}
              placeholder="Any player"
            />
          </div>

          <div>
            <label htmlFor="format" className="mb-1 block text-xs font-medium text-slate-500">
              Format
            </label>
            <Select
              name="format"
              id="format"
              options={FORMAT_OPTIONS}
              defaultValue={params.format ?? ''}
              placeholder="Any format"
            />
          </div>

          <div>
            <label htmlFor="winner" className="mb-1 block text-xs font-medium text-slate-500">
              Winner
            </label>
            <Select
              name="winner"
              id="winner"
              options={teamOptions}
              defaultValue={params.winner ?? ''}
              placeholder="Any result"
            />
          </div>

          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-medium text-slate-500">
              Status
            </label>
            <Select
              name="status"
              id="status"
              options={STATUS_OPTIONS}
              defaultValue={params.status ?? ''}
              placeholder="Any status"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="from" className="mb-1 block text-xs font-medium text-slate-500">
                From
              </label>
              <Input name="from" id="from" type="date" defaultValue={params.from ?? ''} />
            </div>
            <div>
              <label htmlFor="to" className="mb-1 block text-xs font-medium text-slate-500">
                To
              </label>
              <Input name="to" id="to" type="date" defaultValue={params.to ?? ''} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-navy-50 pt-4">
          {hasFilters && (
            <LinkButton href="/games" variant="ghost" icon="refresh">
              Clear filters
            </LinkButton>
          )}
          <Button type="submit" variant="secondary" icon="filter">
            Apply filters
          </Button>
        </div>
      </form>

      <Card padding="p-0">
        {games.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon="board"
              title={hasFilters ? 'No games match your filters' : 'No games yet'}
              description={
                hasFilters
                  ? 'Try widening the date range or clearing a filter.'
                  : 'Create a fixture, pick both line-ups, then record the result.'
              }
              action={
                hasFilters ? (
                  <LinkButton href="/games" variant="secondary" icon="refresh">
                    Clear filters
                  </LinkButton>
                ) : (
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
                  <th scope="col" className="px-3 py-2 text-center">Status</th>
                  <th scope="col" className="py-2 pl-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {games.items.map((game) => (
                  <tr key={game.id} className="transition hover:bg-navy-50/70">
                    <td data-label="Game" className="py-3 pr-3">
                      <Link
                        href={`/games/${game.id}`}
                        className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                      >
                        {game.label}
                      </Link>
                      <span className="block text-xs text-slate-400">
                        {game.playersCount} players
                      </span>
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

                    <td data-label="Status" className="px-3 py-3 text-center">
                      <Badge variant={gameStatusVariant(game.status)}>
                        {capitalise(game.status)}
                      </Badge>
                    </td>

                    <td data-label="" className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <LinkButton href={`/games/${game.id}`} variant="ghost" size="sm" icon="eye">
                          <span className="sr-only">View {game.label}</span>
                        </LinkButton>
                        <LinkButton
                          href={`/games/${game.id}/score`}
                          variant="ghost"
                          size="sm"
                          icon="board"
                        >
                          <span className="sr-only">Score {game.label}</span>
                        </LinkButton>
                        <LinkButton
                          href={`/games/${game.id}/edit`}
                          variant="ghost"
                          size="sm"
                          icon="pencil"
                        >
                          <span className="sr-only">Edit {game.label}</span>
                        </LinkButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="mt-4">
              <Pagination
                page={games.page}
                lastPage={games.lastPage}
                total={games.total}
                firstItem={games.firstItem}
                perPage={games.perPage}
                params={params}
                basePath="/games"
              />
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
