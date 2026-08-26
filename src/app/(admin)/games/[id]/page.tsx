import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/db'
import { didTeamWin, findGame, lineupFor, resultLabel } from '@/lib/services/games'
import { reopenGameAction } from '@/actions/games'
import { capitalise, gameStatusVariant } from '@/lib/enums'
import { formatDateTime, formatLongDate, initialsOf, teamInitials, timeAgo } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Button, LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  await connectToDatabase()
  const game = await findGame(id)

  return { title: game?.label ?? 'Game' }
}

export default async function GameShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await connectToDatabase()
  const game = await findGame(id)
  if (!game) notFound()

  const completed = game.status === 'completed'
  const teamALineup = lineupFor(game, game.teamA?.id)
  const teamBLineup = lineupFor(game, game.teamB?.id)

  const sides = [
    { key: 'A', team: game.teamA, score: game.teamAScore, lineup: teamALineup },
    { key: 'B', team: game.teamB, score: game.teamBScore, lineup: teamBLineup },
  ]

  const details: [string, string][] = [
    ['Game ID', game.label],
    ['Format', game.formatLabel],
    ['Status', capitalise(game.status)],
    ['Date', formatLongDate(game.gameDate)],
    ['Result', resultLabel(game)],
    ['Recorded', formatDateTime(game.createdAt)],
    ['Last updated', timeAgo(game.updatedAt)],
  ]

  return (
    <>
      <PageHeader
        title={game.label}
        subtitle={`${game.teamA?.name} vs ${game.teamB?.name}`}
        breadcrumbs={[{ label: 'Games', href: '/games' }, { label: game.label }]}
        actions={
          <>
            {completed && (
              <form action={reopenGameAction}>
                <input type="hidden" name="id" value={game.id} />
                <Button type="submit" variant="secondary" icon="refresh">
                  Reopen
                </Button>
              </form>
            )}
            <LinkButton href={`/games/${game.id}/score`} variant="accent" icon="board">
              {completed ? 'Edit Result' : 'Record Result'}
            </LinkButton>
            <LinkButton href={`/games/${game.id}/edit`} icon="pencil">
              Edit Game
            </LinkButton>
          </>
        }
      />

      {/* Scoreboard */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 to-navy-950 shadow-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{game.formatLabel}</Badge>
            <Badge variant={gameStatusVariant(game.status)}>{capitalise(game.status)}</Badge>
          </div>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-300">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" className="h-3.5 w-3.5" />
              {formatLongDate(game.gameDate)}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 items-center gap-4 px-5 py-7 sm:grid-cols-3 sm:px-6">
          {sides.map(({ key, team }, index) => {
            const isWinner = didTeamWin(game, team?.id)

            return (
              <div key={key} className="contents">
                <div
                  className={`flex flex-col items-center gap-3 text-center ${index === 1 ? 'sm:order-3' : ''}`}
                >
                  <Avatar
                    src={team?.logo}
                    initials={teamInitials(team?.code, team?.name)}
                    color={team?.color}
                    size="lg"
                    ring
                  />

                  <div>
                    {team ? (
                      <Link
                        href={`/teams/${team.id}`}
                        className="block max-w-48 truncate text-base font-bold text-white transition hover:text-blue-300"
                      >
                        {team.name}
                      </Link>
                    ) : (
                      <span className="block text-base font-bold text-white">—</span>
                    )}
                    <p className="text-xs text-navy-400">Team {key}</p>
                  </div>

                  <p
                    className={`text-4xl font-extrabold tracking-tight ${isWinner ? 'text-gold-400' : 'text-navy-500'}`}
                  >
                    {completed ? (isWinner ? 'WON' : 'LOST') : '–'}
                  </p>

                  {isWinner ? (
                    <Badge variant="gold" icon="trophy">
                      Winner
                    </Badge>
                  ) : completed ? (
                    <Badge variant="danger">Lost</Badge>
                  ) : null}
                </div>

                {index === 0 && (
                  <div className="flex flex-col items-center gap-1 sm:order-2">
                    <span className="text-xs font-semibold tracking-widest text-navy-500 uppercase">
                      versus
                    </span>
                    <span className="text-3xl font-bold text-navy-600">VS</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!completed && (
          <div className="border-t border-white/10 bg-white/5 px-5 py-3 text-center sm:px-6">
            <p className="text-sm text-navy-300">
              This game has not been scored yet.{' '}
              <Link
                href={`/games/${game.id}/score`}
                className="font-semibold text-blue-300 underline-offset-2 hover:underline"
              >
                Record the result
              </Link>{' '}
              to add it to the rankings.
            </p>
          </div>
        )}
      </div>

      {/* Player breakdown */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {sides.map(({ key, team, score, lineup }) => (
          <Card key={key} padding="p-0">
            <header
              className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4"
              style={{ borderTop: `3px solid ${team?.color ?? '#94a3b8'}` }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  src={team?.logo}
                  initials={teamInitials(team?.code, team?.name)}
                  color={team?.color}
                  size="sm"
                />
                <h2 className="truncate text-base font-semibold text-navy-900">{team?.name}</h2>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Result
                </p>
                <p className={`text-base font-bold ${score > 0 ? 'text-green-600' : 'text-navy-400'}`}>
                  {completed ? (score > 0 ? 'Won' : 'Lost') : '—'}
                </p>
              </div>
            </header>

            {lineup.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon="users"
                  title="No line-up picked"
                  description="Edit this game to choose the players for this side."
                />
              </div>
            ) : (
              <ul className="divide-y divide-navy-50">
                {lineup.map((entry) => (
                  <li key={entry.playerId} className="flex items-center gap-3 px-5 py-3.5">
                    <Avatar
                      src={entry.player?.photo}
                      initials={initialsOf(entry.player?.name, '?')}
                      size="sm"
                    />

                    <div className="min-w-0 flex-1">
                      {entry.player ? (
                        <Link
                          href={`/players/${entry.player.id}`}
                          className="block truncate text-sm font-semibold text-navy-900 transition hover:text-blue-600"
                        >
                          {entry.player.name}
                        </Link>
                      ) : (
                        <span className="block text-sm font-semibold text-navy-900">
                          Unknown player
                        </span>
                      )}
                    </div>

                    {completed ? (
                      <Badge variant={entry.points > 0 ? 'success' : 'danger'}>
                        {entry.points > 0 ? 'Win' : 'Loss'}
                      </Badge>
                    ) : (
                      <span className="shrink-0 text-sm text-slate-300">—</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {/* Game details */}
      <Card className="mt-6" title="Game details">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                {label}
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-navy-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  )
}
