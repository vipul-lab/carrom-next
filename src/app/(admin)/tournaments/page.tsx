import type { Metadata } from 'next'
import Link from 'next/link'
import { connectToDatabase } from '@/lib/db'
import { paginateTournaments } from '@/lib/services/tournaments'
import { TOURNAMENT_STATUS_OPTIONS, capitalise, tournamentStatusVariant } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { Button, LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Input } from '@/components/form/Input'
import { AutoSubmitSelect } from '@/components/form/AutoSubmit'
import { isEditor } from '@/lib/authz'

export const metadata: Metadata = { title: 'Tournaments' }
export const dynamic = 'force-dynamic'

interface Params {
  search?: string
  status?: string
  page?: string
  [key: string]: string | undefined
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const params = await searchParams

  const filters = { search: params.search ?? null, status: params.status ?? null }

  await connectToDatabase()
  const tournaments = await paginateTournaments(filters, Number(params.page ?? 1), 12)

  const hasFilters = Boolean(params.search || params.status)
  const canEdit = await isEditor()

  return (
    <>
      <PageHeader
        title="Tournaments"
        subtitle="Competitions you can assign games to — anything else is a friendly"
        actions={
          canEdit && (
            <LinkButton href="/tournaments/create" icon="plus">
              Create Tournament
            </LinkButton>
          )
        }
      />

      <form
        method="GET"
        className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-card sm:grid-cols-3"
      >
        <div className="sm:col-span-2">
          <label htmlFor="search" className="sr-only">
            Search tournaments
          </label>
          <Input
            name="search"
            id="search"
            icon="search"
            defaultValue={params.search ?? ''}
            placeholder="Search by name…"
          />
        </div>

        <div className="flex gap-2">
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <AutoSubmitSelect
            name="status"
            id="status"
            options={TOURNAMENT_STATUS_OPTIONS}
            defaultValue={params.status ?? ''}
            placeholder="All statuses"
            className="flex-1"
          />
          <Button type="submit" variant="secondary" icon="filter" className="shrink-0">
            <span className="sr-only sm:not-sr-only">Filter</span>
          </Button>
        </div>
      </form>

      {tournaments.items.length === 0 ? (
        <Card>
          <EmptyState
            icon="trophy"
            title={hasFilters ? 'No tournaments match your filters' : 'No tournaments yet'}
            description={
              hasFilters
                ? 'Try clearing the search or status filter.'
                : 'Create a tournament to group games together. Games left unassigned stay friendlies.'
            }
            action={
              hasFilters ? (
                <LinkButton href="/tournaments" variant="secondary" icon="refresh">
                  Clear filters
                </LinkButton>
              ) : (
                canEdit && (
                  <LinkButton href="/tournaments/create" icon="plus">
                    Create Tournament
                  </LinkButton>
                )
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {tournaments.items.map((tournament) => (
              <article
                key={tournament.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
              >
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 text-base font-bold text-navy-900">
                      <Link
                        href={`/tournaments/${tournament.id}`}
                        className="transition group-hover:text-blue-600"
                      >
                        {tournament.name}
                      </Link>
                    </h2>
                    <Badge variant={tournamentStatusVariant(tournament.status)}>
                      {capitalise(tournament.status)}
                    </Badge>
                  </div>

                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <Icon name="calendar" className="h-3.5 w-3.5" />
                    {formatDate(tournament.startDate)}
                    {tournament.endDate ? ` → ${formatDate(tournament.endDate)}` : ' → ongoing'}
                  </p>

                  {tournament.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                      {tournament.description}
                    </p>
                  )}

                  <dl className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-navy-50 p-3 text-center">
                    <div>
                      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        Games
                      </dt>
                      <dd className="text-sm font-bold text-navy-900">{tournament.gamesCount}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        Played
                      </dt>
                      <dd className="text-sm font-bold text-green-600">
                        {tournament.completedCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        To play
                      </dt>
                      <dd className="text-sm font-bold text-amber-600">
                        {tournament.scheduledCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        Teams
                      </dt>
                      <dd className="text-sm font-bold text-navy-900">{tournament.teamsCount}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex items-center gap-2 border-t border-navy-50 pt-4">
                    <LinkButton
                      href={`/tournaments/${tournament.id}`}
                      variant="secondary"
                      size="sm"
                      icon="eye"
                      className="flex-1"
                    >
                      View
                    </LinkButton>
                    {canEdit && (
                      <LinkButton
                        href={`/tournaments/${tournament.id}/edit`}
                        variant="ghost"
                        size="sm"
                        icon="pencil"
                      >
                        <span className="sr-only">Edit {tournament.name}</span>
                      </LinkButton>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6">
            <Pagination
              page={tournaments.page}
              lastPage={tournaments.lastPage}
              total={tournaments.total}
              firstItem={tournaments.firstItem}
              perPage={tournaments.perPage}
              params={params}
              basePath="/tournaments"
            />
          </div>
        </>
      )}
    </>
  )
}
