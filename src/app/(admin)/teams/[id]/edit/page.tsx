import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/db'
import { findTeamWithStats } from '@/lib/services/stats'
import { ALL_TIME } from '@/lib/stats-period'
import { PageHeader } from '@/components/ui/PageHeader'
import { TeamForm } from '../../TeamForm'

export const metadata: Metadata = { title: 'Edit Team' }

export default async function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await connectToDatabase()
  const team = await findTeamWithStats(id, ALL_TIME)
  if (!team) notFound()

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
      <TeamForm team={team} />
    </>
  )
}
