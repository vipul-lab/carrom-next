import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/db'
import { findGame, lineupFor } from '@/lib/services/games'
import { formatDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ScoreForm } from './ScoreForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  await connectToDatabase()
  const game = await findGame(id)

  return { title: game ? `Result · ${game.label}` : 'Result' }
}

export default async function ScoreGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await connectToDatabase()
  const game = await findGame(id)
  if (!game) notFound()

  const teamALineup = lineupFor(game, game.teamA?.id)
  const teamBLineup = lineupFor(game, game.teamB?.id)
  const completed = game.status === 'completed'

  // Only a scored game has marks worth pre-filling.
  const initialMarks: Record<string, number> = completed
    ? Object.fromEntries(game.lineup.map((entry) => [entry.playerId, entry.points]))
    : {}

  return (
    <>
      <PageHeader
        title={`Record Result · ${game.label}`}
        subtitle={`${game.teamA?.name} vs ${game.teamB?.name} · ${game.formatLabel} · ${formatDate(game.gameDate)}`}
        breadcrumbs={[
          { label: 'Games', href: '/games' },
          { label: game.label, href: `/games/${game.id}` },
          { label: 'Result' },
        ]}
        actions={
          <LinkButton href={`/games/${game.id}/edit`} variant="secondary" icon="pencil">
            Edit Line-up
          </LinkButton>
        }
      />

      {teamALineup.length === 0 || teamBLineup.length === 0 ? (
        <Card>
          <EmptyState
            icon="users"
            title="This game has no line-up yet"
            description="Pick the players for both teams before recording a result."
            action={
              <LinkButton href={`/games/${game.id}/edit`} icon="pencil">
                Pick the line-ups
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <>
          {completed && (
            <Alert
              variant="info"
              className="mb-6"
              dismissible={false}
              title="This game already has a result"
            >
              Saving again overwrites it and recalculates every ranking.
            </Alert>
          )}

          <ScoreForm
            gameId={game.id}
            teamA={game.teamA}
            teamB={game.teamB}
            teamALineup={teamALineup}
            teamBLineup={teamBLineup}
            initialMarks={initialMarks}
          />
        </>
      )}
    </>
  )
}
