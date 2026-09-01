import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/db'
import { findGame, lineupFor } from '@/lib/services/games'
import { toDateInput } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { GameForm } from '../../GameFormFields'
import { loadGameFormData } from '../../form-data'
import { requireEditorPage } from '@/lib/authz'

export const metadata: Metadata = { title: 'Edit Game' }
export const dynamic = 'force-dynamic'

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditorPage(`/games/${id}/edit`)

  await connectToDatabase()

  const [game, formData] = await Promise.all([findGame(id), loadGameFormData()])
  if (!game) notFound()

  return (
    <>
      <PageHeader
        title={`Edit ${game.label}`}
        subtitle="Change the fixture details or swap players in and out"
        breadcrumbs={[
          { label: 'Games', href: '/games' },
          { label: game.label, href: `/games/${game.id}` },
          { label: 'Edit' },
        ]}
      />

      <GameForm
        teams={formData.teams}
        rosters={formData.rosters}
        tournaments={formData.tournaments}
        game={{ id: game.id, label: game.label, completed: game.status === 'completed' }}
        defaults={{
          format: game.format,
          tournamentId: game.tournament?.id ?? '',
          gameDate: toDateInput(game.gameDate),
          status: game.status,
          teamAId: game.teamA?.id ?? '',
          teamBId: game.teamB?.id ?? '',
          teamAPlayers: lineupFor(game, game.teamA?.id).map((l) => l.playerId),
          teamBPlayers: lineupFor(game, game.teamB?.id).map((l) => l.playerId),
        }}
      />
    </>
  )
}
