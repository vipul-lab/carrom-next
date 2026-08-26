import type { Metadata } from 'next'
import Link from 'next/link'
import { connectToDatabase } from '@/lib/db'
import { listPlayers, listTeams } from '@/lib/services/stats'
import { listGames, resultLabel, scoreline } from '@/lib/services/games'
import { ALL_TIME } from '@/lib/stats-period'
import { formatDate, initialsOf, teamInitials } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button, LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/form/Input'

export const metadata: Metadata = { title: 'Search' }
export const dynamic = 'force-dynamic'

/**
 * The header search box. Looks across members, teams and games in one pass so
 * the admin can jump straight to a record from anywhere in the app.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const term = (q ?? '').trim()

  let players: Awaited<ReturnType<typeof listPlayers>> = []
  let teams: Awaited<ReturnType<typeof listTeams>> = []
  let games: Awaited<ReturnType<typeof listGames>> = []

  if (term !== '') {
    await connectToDatabase()
    ;[players, teams, games] = await Promise.all([
      listPlayers(ALL_TIME, { search: term }, 10),
      listTeams(ALL_TIME, { search: term }, 10),
      listGames({ search: term }, 10),
    ])
  }

  const total = players.length + teams.length + games.length

  return (
    <>
      <PageHeader
        title="Search"
        subtitle={
          term !== ''
            ? `${total} result(s) for “${term}”`
            : 'Find members, teams and games'
        }
      />

      <form method="GET" className="mb-6 flex gap-2">
        <div className="flex-1">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <Input
            name="q"
            id="q"
            icon="search"
            defaultValue={term}
            autoFocus
            placeholder="Search members, teams, games…"
          />
        </div>
        <Button type="submit" icon="search">
          Search
        </Button>
      </form>

      {term === '' ? (
        <Card>
          <EmptyState
            icon="search"
            title="Type something to search"
            description="Search across team members, teams and games in one place."
          />
        </Card>
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon="search"
            title="No results"
            description={`Nothing matched “${term}”. Try a shorter or different term.`}
            action={
              <LinkButton href="/dashboard" variant="secondary">
                Back to dashboard
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {players.length > 0 && (
            <Card title="Team Members" subtitle={`${players.length} match(es)`} padding="p-0">
              <ul className="divide-y divide-navy-50">
                {players.map((player) => (
                  <li key={player.id}>
                    <Link
                      href={`/players/${player.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-navy-50/70 sm:px-6"
                    >
                      <Avatar src={player.photo} initials={initialsOf(player.name)} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy-900">
                          {player.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {player.team?.name ?? 'Unassigned'} · {player.winsCount} wins
                        </span>
                      </span>
                      <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-navy-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {teams.length > 0 && (
            <Card title="Teams" subtitle={`${teams.length} match(es)`} padding="p-0">
              <ul className="divide-y divide-navy-50">
                {teams.map((team) => (
                  <li key={team.id}>
                    <Link
                      href={`/teams/${team.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-navy-50/70 sm:px-6"
                    >
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
                          {team.code} · {team.playersCount} members · {team.winsCount} wins
                        </span>
                      </span>
                      <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-navy-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {games.length > 0 && (
            <Card title="Games" subtitle={`${games.length} match(es)`} padding="p-0">
              <ul className="divide-y divide-navy-50">
                {games.map((game) => (
                  <li key={game.id}>
                    <Link
                      href={`/games/${game.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-navy-50/70 sm:px-6"
                    >
                      <span className="font-mono text-xs font-bold text-blue-600">{game.label}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy-900">
                          {game.teamA?.name} vs {game.teamB?.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {game.formatLabel} · {formatDate(game.gameDate)} · {resultLabel(game)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm font-bold text-navy-900">
                        {scoreline(game)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
