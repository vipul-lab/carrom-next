import type { Metadata } from 'next'
import { connectToDatabase } from '@/lib/db'
import { todayInput } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireEditorPage } from '@/lib/authz'
import { TournamentForm } from '../TournamentForm'

export const metadata: Metadata = { title: 'Create Tournament' }
export const dynamic = 'force-dynamic'

export default async function CreateTournamentPage() {
  await requireEditorPage('/tournaments/create')

  await connectToDatabase()

  return (
    <>
      <PageHeader
        title="Create Tournament"
        subtitle="Set up a competition, then assign games to it as you schedule them"
        breadcrumbs={[{ label: 'Tournaments', href: '/tournaments' }, { label: 'Create' }]}
      />

      <TournamentForm today={todayInput()} />
    </>
  )
}
