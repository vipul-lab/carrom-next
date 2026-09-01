import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/db'
import { findTournament } from '@/lib/services/tournaments'
import { todayInput } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireEditorPage } from '@/lib/authz'
import { TournamentForm } from '../../TournamentForm'

export const metadata: Metadata = { title: 'Edit Tournament' }
export const dynamic = 'force-dynamic'

export default async function EditTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireEditorPage(`/tournaments/${id}/edit`)

  await connectToDatabase()
  const tournament = await findTournament(id)
  if (!tournament) notFound()

  return (
    <>
      <PageHeader
        title={`Edit ${tournament.name}`}
        subtitle="Change the dates, status or description"
        breadcrumbs={[
          { label: 'Tournaments', href: '/tournaments' },
          { label: tournament.name, href: `/tournaments/${tournament.id}` },
          { label: 'Edit' },
        ]}
      />

      <TournamentForm tournament={tournament} today={todayInput()} />
    </>
  )
}
