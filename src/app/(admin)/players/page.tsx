import type { Metadata } from 'next'
import Link from 'next/link'
import { connectToDatabase } from '@/lib/db'
import { Team } from '@/lib/models/Team'
import { paginatePlayers, PLAYER_SORTS, type SortKey } from '@/lib/services/stats'
import { ALL_TIME } from '@/lib/stats-period'
import { RECORD_STATUS_OPTIONS, capitalise, recordStatusVariant } from '@/lib/enums'
import { initialsOf } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Button, LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { TeamChip } from '@/components/ui/TeamChip'
import { Table, HEAD_ROW } from '@/components/ui/Table'
import { Input } from '@/components/form/Input'
import { AutoSubmitSelect } from '@/components/form/AutoSubmit'
import { isEditor } from '@/lib/authz'

export const metadata: Metadata = { title: 'Team Members' }
export const dynamic = 'force-dynamic'

interface Params {
  search?: string
  teamId?: string
  status?: string
  sort?: string
  page?: string
  [key: string]: string | undefined
}

export default async function PlayersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams

  const filters = {
    search: params.search ?? null,
    teamId: params.teamId ?? null,
    status: params.status ?? null,
    sort: (params.sort as SortKey) ?? 'wins',
  }

  await connectToDatabase()

  const [players, teams] = await Promise.all([
    paginatePlayers(ALL_TIME, filters, Number(params.page ?? 1), 15),
    Team.find({}).sort({ name: 1 }).select('name').lean(),
  ])

  const teamOptions = teams.map((t) => [String(t._id), t.name] as [string, string])
  const hasFilters = Boolean(params.search || params.teamId || params.status)

  const canEdit = await isEditor()
  return (
    <>
      <PageHeader
        title="Team Members"
        subtitle="Every player on the books, with their live tournament record"
        actions={
          <>
            <LinkButton href="/rankings/players" variant="secondary" icon="trophy">
              Player Rankings
            </LinkButton>
            {canEdit && (
              <LinkButton href="/players/create" icon="plus">
                Add Member
              </LinkButton>
            )}
          </>
        }
      />

      {/* Filters */}
      <form
        method="GET"
        className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="lg:col-span-2">
          <label htmlFor="search" className="sr-only">
            Search members
          </label>
          <Input
            name="search"
            id="search"
            icon="search"
            defaultValue={params.search ?? ''}
            placeholder="Search by name, mobile or email…"
          />
        </div>

        <div>
          <label htmlFor="teamId" className="sr-only">
            Team
          </label>
          <AutoSubmitSelect
            name="teamId"
            id="teamId"
            options={teamOptions}
            defaultValue={params.teamId ?? ''}
            placeholder="All teams"
          />
        </div>

        <div>
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <AutoSubmitSelect
            name="status"
            id="status"
            options={RECORD_STATUS_OPTIONS}
            defaultValue={params.status ?? ''}
            placeholder="All statuses"
          />
        </div>

        <div className="flex gap-2">
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <AutoSubmitSelect
            name="sort"
            id="sort"
            options={PLAYER_SORTS}
            defaultValue={filters.sort}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" icon="filter" className="shrink-0">
            <span className="sr-only">Apply filters</span>
          </Button>
        </div>
      </form>

      <Card padding="p-0">
        {players.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon="users"
              title={hasFilters ? 'No members match your filters' : 'No members yet'}
              description={
                hasFilters
                  ? 'Try a different search term, team or status.'
                  : 'Add your first team member to start tracking scores.'
              }
              action={
                hasFilters ? (
                  <LinkButton href="/players" variant="secondary" icon="refresh">
                    Clear filters
                  </LinkButton>
                ) : (
                  canEdit && (
                    <LinkButton href="/players/create" icon="plus">
                      Add Member
                    </LinkButton>
                  )
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
                  <th scope="col" className="px-3 py-2">Team</th>
                  <th scope="col" className="px-3 py-2">Contact</th>
                  <th scope="col" className="px-3 py-2 text-right">Games</th>
                  <th scope="col" className="px-3 py-2 text-right">W / L</th>
                  <th scope="col" className="px-3 py-2 text-right">Win %</th>
                  <th scope="col" className="px-3 py-2 text-center">Status</th>
                  <th scope="col" className="py-2 pl-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {players.items.map((player) => (
                  <tr key={player.id} className="group transition hover:bg-navy-50/70">
                    <td data-label="Member" className="py-3 pr-3">
                      <Link href={`/players/${player.id}`} className="flex items-center gap-3">
                        <Avatar src={player.photo} initials={initialsOf(player.name)} size="md" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-navy-900 group-hover:text-blue-600">
                            {player.name}
                          </span>
                          <span className="block text-xs text-slate-400">
                            {player.winsCount} of {player.gamesCount} games won
                          </span>
                        </span>
                      </Link>
                    </td>

                    <td data-label="Team" className="px-3 py-3">
                      <TeamChip team={player.team} />
                    </td>

                    <td data-label="Contact" className="px-3 py-3 text-sm text-slate-600">
                      <span className="block whitespace-nowrap">{player.mobile || '—'}</span>
                      {player.email && (
                        <span className="block max-w-44 truncate text-xs text-slate-400">
                          {player.email}
                        </span>
                      )}
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

                    <td data-label="Status" className="px-3 py-3 text-center">
                      <Badge variant={recordStatusVariant(player.status)}>
                        {capitalise(player.status)}
                      </Badge>
                    </td>

                    <td data-label="" className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <LinkButton
                          href={`/players/${player.id}`}
                          variant="ghost"
                          size="sm"
                          icon="eye"
                        >
                          <span className="sr-only">View {player.name}</span>
                        </LinkButton>
                        <LinkButton
                          href={`/players/${player.id}/edit`}
                          variant="ghost"
                          size="sm"
                          icon="pencil"
                        >
                          <span className="sr-only">Edit {player.name}</span>
                        </LinkButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="mt-4">
              <Pagination
                page={players.page}
                lastPage={players.lastPage}
                total={players.total}
                firstItem={players.firstItem}
                perPage={players.perPage}
                params={params}
                basePath="/players"
              />
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
