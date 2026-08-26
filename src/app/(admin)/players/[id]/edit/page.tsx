import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/db'
import { Team } from '@/lib/models/Team'
import { findPlayerWithStats } from '@/lib/services/stats'
import { ALL_TIME } from '@/lib/stats-period'
import { PageHeader } from '@/components/ui/PageHeader'
import { PlayerForm } from '../../PlayerForm'

export const metadata: Metadata = { title: 'Edit Member' }
export const dynamic = 'force-dynamic'

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await connectToDatabase()

  const [player, teams] = await Promise.all([
    findPlayerWithStats(id, ALL_TIME),
    Team.find({}).sort({ name: 1 }).select('name').lean(),
  ])

  if (!player) notFound()

  return (
    <>
      <PageHeader
        title={`Edit ${player.name}`}
        subtitle="Update this member's details"
        breadcrumbs={[
          { label: 'Team Members', href: '/players' },
          { label: player.name, href: `/players/${player.id}` },
          { label: 'Edit' },
        ]}
      />
      <PlayerForm player={player} teams={teams.map((t) => ({ id: String(t._id), name: t.name }))} />
    </>
  )
}
