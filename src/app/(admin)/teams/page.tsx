import type { Metadata } from 'next'
import Link from 'next/link'
import { connectToDatabase } from '@/lib/db'
import { paginateTeams, TEAM_SORTS, type SortKey } from '@/lib/services/stats'
import { ALL_TIME } from '@/lib/stats-period'
import { RECORD_STATUS_OPTIONS, capitalise, recordStatusVariant } from '@/lib/enums'
import { teamInitials } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Button, LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Input } from '@/components/form/Input'
import { AutoSubmitSelect } from '@/components/form/AutoSubmit'
import { isEditor } from '@/lib/authz'

export const metadata: Metadata = { title: 'Teams' }
export const dynamic = 'force-dynamic'

interface Params {
  search?: string
  status?: string
  sort?: string
  page?: string
  /** Anything else in the query string rides along into the pager links. */
  [key: string]: string | undefined
}

export default async function TeamsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams

  const filters = {
    search: params.search ?? null,
    status: params.status ?? null,
    sort: (params.sort as SortKey) ?? 'wins',
  }

  await connectToDatabase()
  const teams = await paginateTeams(ALL_TIME, filters, Number(params.page ?? 1), 12)

  const hasFilters = Boolean(params.search || params.status)

  const canEdit = await isEditor()
  return (
    <>
      <PageHeader
        title="Teams"
        subtitle="Every squad in the tournament and how they are performing"
        actions={
          <>
            <LinkButton href="/rankings/teams" variant="secondary" icon="trophy">
              Team Rankings
            </LinkButton>
            {canEdit && (
              <LinkButton href="/teams/create" icon="plus">
                Add Team
              </LinkButton>
            )}
          </>
        }
      />

      {/* Filters */}
      <form
        method="GET"
        className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="lg:col-span-2">
          <label htmlFor="search" className="sr-only">
            Search teams
          </label>
          <Input
            name="search"
            id="search"
            icon="search"
            defaultValue={params.search ?? ''}
            placeholder="Search by team name or code…"
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
            options={TEAM_SORTS}
            defaultValue={filters.sort}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" icon="filter" className="shrink-0">
            <span className="sr-only sm:not-sr-only">Filter</span>
          </Button>
        </div>
      </form>

      {teams.items.length === 0 ? (
        <Card>
          <EmptyState
            icon="shield"
            title={hasFilters ? 'No teams match your filters' : 'No teams yet'}
            description={
              hasFilters
                ? 'Try clearing the search or status filter.'
                : 'Create your first team, then add members to it.'
            }
            action={
              hasFilters ? (
                <LinkButton href="/teams" variant="secondary" icon="refresh">
                  Clear filters
                </LinkButton>
              ) : (
                canEdit && (
                  <LinkButton href="/teams/create" icon="plus">
                    Add Team
                  </LinkButton>
                )
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {teams.items.map((team) => (
              <article
                key={team.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: team.color }} />

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={team.logo}
                      initials={teamInitials(team.code, team.name)}
                      color={team.color}
                      size="lg"
                    />

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-bold text-navy-900">
                        <Link href={`/teams/${team.id}`} className="transition group-hover:text-blue-600">
                          {team.name}
                        </Link>
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="muted">{team.code}</Badge>
                        <Badge variant={recordStatusVariant(team.status)}>
                          {capitalise(team.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {team.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-slate-500">{team.description}</p>
                  )}

                  <dl className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-navy-50 p-3 text-center">
                    <div>
                      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        Members
                      </dt>
                      <dd className="text-sm font-bold text-navy-900">{team.playersCount}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        Games
                      </dt>
                      <dd className="text-sm font-bold text-navy-900">{team.gamesCount}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        W / L
                      </dt>
                      <dd className="text-sm font-bold">
                        <span className="text-green-600">{team.winsCount}</span>
                        <span className="text-navy-300">/</span>
                        <span className="text-red-500">{team.lossesCount}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        Win %
                      </dt>
                      <dd className="text-sm font-bold text-blue-600">{team.winRate}%</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex items-center gap-2 border-t border-navy-50 pt-4">
                    <LinkButton
                      href={`/teams/${team.id}`}
                      variant="secondary"
                      size="sm"
                      icon="eye"
                      className="flex-1"
                    >
                      View
                    </LinkButton>
                    <LinkButton
                      href={`/teams/${team.id}/edit`}
                      variant="ghost"
                      size="sm"
                      icon="pencil"
                    >
                      <span className="sr-only">Edit {team.name}</span>
                    </LinkButton>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6">
            <Pagination
              page={teams.page}
              lastPage={teams.lastPage}
              total={teams.total}
              firstItem={teams.firstItem}
              perPage={teams.perPage}
              params={params}
              basePath="/teams"
            />
          </div>
        </>
      )}
    </>
  )
}
