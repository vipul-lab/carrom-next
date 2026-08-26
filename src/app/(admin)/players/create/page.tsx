import type { Metadata } from 'next'
import { connectToDatabase } from '@/lib/db'
import { Team } from '@/lib/models/Team'
import { PageHeader } from '@/components/ui/PageHeader'
import { PlayerForm } from '../PlayerForm'

export const metadata: Metadata = { title: 'Add Member' }
export const dynamic = 'force-dynamic'

export default async function CreatePlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>
}) {
  const { teamId } = await searchParams

  await connectToDatabase()
  const teams = await Team.find({ status: 'active' }).sort({ name: 1 }).select('name').lean()

  return (
    <>
      <PageHeader
        title="Add Team Member"
        subtitle="Add a player to the roster so they can be picked for games"
        breadcrumbs={[{ label: 'Team Members', href: '/players' }, { label: 'Add Member' }]}
      />
      <PlayerForm
        teams={teams.map((t) => ({ id: String(t._id), name: t.name }))}
        defaultTeamId={teamId}
      />
    </>
  )
}
