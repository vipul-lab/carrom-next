import type { Metadata } from 'next'
import Link from 'next/link'
import { connectToDatabase } from '@/lib/db'
import { paginateTeams, TEAM_SORTS, type SortKey } from '@/lib/services/stats'
import { periodFromKey, periodLabel } from '@/lib/stats-period'
import { RECORD_STATUS_OPTIONS } from '@/lib/enums'
import { teamInitials } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button, LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { RankBadge, podiumClass } from '@/components/ui/RankBadge'
import { Table, HEAD_ROW } from '@/components/ui/Table'
import { Input } from '@/components/form/Input'
import { AutoSubmitSelect } from '@/components/form/AutoSubmit'
import { PeriodTabs } from '../PeriodTabs'

export const metadata: Metadata = { title: 'Team Rankings' }
export const dynamic = 'force-dynamic'

interface Params {
  period?: string
  search?: string
  status?: string
  sort?: string
  page?: string
  [key: string]: string | undefined
}

export default async function TeamRankingsPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const params = await searchParams
  const period = periodFromKey(params.period ?? 'all')

  const filters = {
    search: params.search ?? null,
    status: params.status ?? null,
    sort: (params.sort as SortKey) ?? 'wins',
  }

  await connectToDatabase()
  const teams = await paginateTeams(period, filters, Number(params.page ?? 1), 25)

  return (
    <>
      <PageHeader
        title="Team Rankings"
        subtitle={`League table — ${periodLabel(period).toLowerCase()}`}
        actions={
          <>
            <LinkButton
              href={`/api/reports/export/teams?period=${period.key}`}
              variant="secondary"
              icon="download"
            >
              Export CSV
            </LinkButton>
            <LinkButton href="/rankings/players" icon="trophy">
              Player Rankings
            </LinkButton>
          </>
        }
      />

      <PeriodTabs basePath="/rankings/teams" current={period.key} params={params} />

      <form
        method="GET"
        className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4"
      >
        <input type="hidden" name="period" value={period.key} />

        <div className="lg:col-span-2">
          <label htmlFor="search" className="sr-only">
            Search teams
          </label>
          <Input
            name="search"
            id="search"
            icon="search"
            defaultValue={params.search ?? ''}
            placeholder="Search teams…"
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
            <span className="sr-only">Apply</span>
          </Button>
        </div>
      </form>

      <Card padding="p-0">
        {teams.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon="shield"
              title="No teams ranked yet"
              description="Teams enter the table once they have played a completed game."
            />
          </div>
        ) : (
          <div className="px-5 py-4 sm:px-6">
            <Table>
              <thead>
                <tr className={HEAD_ROW}>
                  <th scope="col" className="py-2 pr-3">Rank</th>
                  <th scope="col" className="px-3 py-2">Team</th>
                  <th scope="col" className="px-3 py-2 text-right">Games</th>
                  <th scope="col" className="px-3 py-2 text-right">Wins</th>
                  <th scope="col" className="px-3 py-2 text-right">Losses</th>
                  <th scope="col" className="py-2 pl-3 text-right">Win %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {teams.items.map((team, index) => {
                  const rank = teams.firstItem + index

                  return (
                    <tr
                      key={team.id}
                      className={`group transition hover:bg-navy-50/70 ${podiumClass(rank)}`}
                    >
                      <td data-label="Rank" className="py-3 pr-3">
                        <RankBadge rank={rank} />
                      </td>

                      <td data-label="Team" className="px-3 py-3">
                        <Link href={`/teams/${team.id}`} className="flex items-center gap-3">
                          <Avatar
                            src={team.logo}
                            initials={teamInitials(team.code, team.name)}
                            color={team.color}
                            size="sm"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-navy-900 group-hover:text-blue-600">
                              {team.name}
                            </span>
                            <span className="block text-xs text-slate-400">
                              {team.playersCount} members
                            </span>
                          </span>
                        </Link>
                      </td>

                      <td data-label="Games" className="px-3 py-3 text-right text-sm text-slate-600">
                        {team.gamesCount}
                      </td>
                      <td
                        data-label="Wins"
                        className={`px-3 py-3 text-right text-sm font-bold ${rank === 1 ? 'text-gold-600' : 'text-green-600'}`}
                      >
                        {team.winsCount}
                      </td>
                      <td
                        data-label="Losses"
                        className="px-3 py-3 text-right text-sm font-semibold text-red-500"
                      >
                        {team.lossesCount}
                      </td>
                      <td data-label="Win %" className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-navy-100 sm:block">
                            <span
                              className={`block h-full rounded-full ${team.winRate >= 50 ? 'bg-green-500' : 'bg-amber-400'}`}
                              style={{ width: `${Math.max(team.winRate, 2)}%` }}
                            />
                          </span>
                          <span
                            className={`text-sm font-bold ${rank === 1 ? 'text-gold-600' : 'text-navy-900'}`}
                          >
                            {team.winRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>

            <div className="mt-4">
              <Pagination
                page={teams.page}
                lastPage={teams.lastPage}
                total={teams.total}
                firstItem={teams.firstItem}
                perPage={teams.perPage}
                params={params}
                basePath="/rankings/teams"
              />
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
