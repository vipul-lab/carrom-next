import type { Metadata } from 'next'
import { connectToDatabase } from '@/lib/db'
import { todayInput } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { GameForm } from '../GameFormFields'
import { loadGameFormData } from '../form-data'

export const metadata: Metadata = { title: 'Create Game' }
export const dynamic = 'force-dynamic'

export default async function CreateGamePage() {
  await connectToDatabase()
  const { teams, rosters } = await loadGameFormData()

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
        defaults={{
          format: '2v2',
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
