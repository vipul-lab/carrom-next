import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/db'
import { findTeamWithStats } from '@/lib/services/stats'
import { teamGameCounts } from '@/lib/services/deletion'
import { ALL_TIME } from '@/lib/stats-period'
import { PageHeader } from '@/components/ui/PageHeader'
import { TeamForm } from '../../TeamForm'
import { requireEditorPage } from '@/lib/authz'

export const metadata: Metadata = { title: 'Edit Team' }

export default async function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireEditorPage(`/teams/${id}/edit`)

  await connectToDatabase()
  const team = await findTeamWithStats(id, ALL_TIME)
  if (!team) notFound()

  // The delete dialog says exactly what will happen, so it needs the split.
  const counts = await teamGameCounts(id)

  return (
    <>
      <PageHeader
        title={`Edit ${team.name}`}
        subtitle="Update the team's details and branding"
        breadcrumbs={[
          { label: 'Teams', href: '/teams' },
          { label: team.name, href: `/teams/${team.id}` },
          { label: 'Edit' },
        ]}
      />
      <TeamForm team={team} played={counts.played} unplayed={counts.unplayed} />
    </>
  )
}
