import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { TeamForm } from '../TeamForm'
import { requireEditorPage } from '@/lib/authz'

export const metadata: Metadata = { title: 'Add Team' }

export default async function CreateTeamPage() {
  await requireEditorPage('/teams/create')

  return (
    <>
      <PageHeader
        title="Add Team"
        subtitle="Create a squad, then assign members to it"
        breadcrumbs={[{ label: 'Teams', href: '/teams' }, { label: 'Add Team' }]}
      />
      <TeamForm />
    </>
  )
}
