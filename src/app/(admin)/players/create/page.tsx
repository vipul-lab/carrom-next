import type { Metadata } from 'next'
import { connectToDatabase } from '@/lib/db'
import { PageHeader } from '@/components/ui/PageHeader'
import { PlayerForm } from '../PlayerForm'
import { requireEditorPage } from '@/lib/authz'

export const metadata: Metadata = { title: 'Add Member' }
export const dynamic = 'force-dynamic'

export default async function CreatePlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>
}) {
  const { teamId } = await searchParams
  await requireEditorPage('/players/create')

  await connectToDatabase()

  return (
    <>
      <PageHeader
        title="Add Team Member"
        subtitle="Add a player to the roster — you can put them in a team afterwards"
        breadcrumbs={[{ label: 'Team Members', href: '/players' }, { label: 'Add Member' }]}
      />
      {/* The team picker is edit-only, so the list is not needed here. */}
      <PlayerForm teams={[]} defaultTeamId={teamId} />
    </>
  )
}
