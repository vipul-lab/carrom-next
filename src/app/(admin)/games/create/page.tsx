import type { Metadata } from 'next'
import { connectToDatabase } from '@/lib/db'
import { todayInput } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { GameForm } from '../GameFormFields'
import { loadGameFormData } from '../form-data'
import { requireEditorPage } from '@/lib/authz'

export const metadata: Metadata = { title: 'Create Game' }
export const dynamic = 'force-dynamic'

export default async function CreateGamePage({
  searchParams,
}: {
  searchParams: Promise<{ tournament?: string }>
}) {
  await requireEditorPage('/games/create')

  const { tournament } = await searchParams

  await connectToDatabase()
  const { teams, rosters, tournaments } = await loadGameFormData()

  // Arriving from a tournament page preselects it; an unknown id falls back to
  // a friendly rather than pointing the form at something that does not exist.
  const preselected = tournaments.some((t) => t.id === tournament) ? tournament! : ''

  return (
    <>
      <PageHeader
        title="Create New Game"
        subtitle="Set up a 1 vs 1 or 2 vs 2 fixture and pick both line-ups"
        breadcrumbs={[{ label: 'Games', href: '/games' }, { label: 'Create Game' }]}
      />

      <GameForm
        teams={teams}
        rosters={rosters}
        tournaments={tournaments}
        defaults={{
          format: '2v2',
          tournamentId: preselected,
          gameDate: todayInput(),
          teamAId: '',
          teamBId: '',
          teamAPlayers: [],
          teamBPlayers: [],
        }}
      />
    </>
  )
}
