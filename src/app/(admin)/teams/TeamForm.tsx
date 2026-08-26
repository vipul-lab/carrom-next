'use client'

import { useActionState } from 'react'
import { useState } from 'react'
import { createTeamAction, updateTeamAction } from '@/actions/teams'
import { EMPTY_STATE, fieldError } from '@/lib/action-state'
import { RECORD_STATUS_OPTIONS } from '@/lib/enums'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/Button'
import { Field } from '@/components/form/Field'
import { Input } from '@/components/form/Input'
import { Select } from '@/components/form/Select'
import { Textarea } from '@/components/form/Textarea'
import { ImageUpload } from '@/components/form/ImageUpload'
import { SubmitButton } from '@/components/form/SubmitButton'
import { FormErrors } from '@/components/form/FormErrors'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { deleteTeamAction } from '@/actions/teams'
import type { TeamWithStats } from '@/lib/services/stats'

/** Shared by teams/create and teams/[id]/edit. */
export function TeamForm({ team }: { team?: TeamWithStats }) {
  const editing = Boolean(team)
  const [state, formAction] = useActionState(
    editing ? updateTeamAction : createTeamAction,
    EMPTY_STATE,
  )

  const [color, setColor] = useState(team?.color ?? '#2563eb')

  return (
    <>
      <FormErrors state={state} />

      <form action={formAction} encType="multipart/form-data">
        {editing && <input type="hidden" name="id" value={team!.id} />}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="Team details">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  label="Team name"
                  name="name"
                  required
                  className="sm:col-span-2"
                  error={fieldError(state, 'name')}
                >
                  <Input
                    name="name"
                    defaultValue={team?.name ?? ''}
                    required
                    maxLength={120}
                    placeholder="e.g. Striker Falcons"
                    invalid={!!fieldError(state, 'name')}
                  />
                </Field>

                <Field
                  label="Team code"
                  name="code"
                  required
                  hint="A short unique tag shown on badges and tables."
                  error={fieldError(state, 'code')}
                >
                  <Input
                    name="code"
                    defaultValue={team?.code ?? ''}
                    required
                    maxLength={12}
                    placeholder="FAL"
                    className="uppercase"
                    invalid={!!fieldError(state, 'code')}
                  />
                </Field>

                <Field
                  label="Status"
                  name="status"
                  required
                  hint="Inactive teams cannot be picked for new games."
                  error={fieldError(state, 'status')}
                >
                  <Select
                    name="status"
                    options={RECORD_STATUS_OPTIONS}
                    defaultValue={team?.status ?? 'active'}
                  />
                </Field>

                <Field
                  label="Description"
                  name="description"
                  className="sm:col-span-2"
                  hint="Optional — playing style, history, anything useful."
                  error={fieldError(state, 'description')}
                >
                  <Textarea
                    name="description"
                    defaultValue={team?.description ?? ''}
                    rows={4}
                    placeholder="How does this team play?"
                  />
                </Field>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Branding">
              <div className="space-y-5">
                <Field
                  label="Team colour"
                  name="color"
                  required
                  hint="Used for the team badge and the dashboard charts."
                  error={fieldError(state, 'color')}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      name="color"
                      id="color"
                      value={color}
                      onChange={(event) => setColor(event.target.value)}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-navy-200 bg-white p-1"
                    />
                    <span className="font-mono text-sm text-slate-500">{color}</span>
                  </div>
                </Field>

                <ImageUpload
                  name="logo"
                  label="Team logo"
                  current={team?.logo}
                  initials={(team?.code || team?.name || '?').slice(0, 2).toUpperCase()}
                  removeName="remove_logo"
                  error={fieldError(state, 'logo')}
                />
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <ConfirmDialog
              title="Delete this team?"
              triggerLabel="Delete Team"
              confirmLabel="Yes, delete team"
              action={deleteTeamAction}
              hiddenFields={{ id: team!.id }}
            >
              Deleting <strong className="text-navy-900">{team!.name}</strong> also unassigns its
              members. Teams that have already played a game cannot be deleted — set them to inactive
              instead.
            </ConfirmDialog>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href={editing ? `/teams/${team!.id}` : '/teams'} variant="secondary">
              Cancel
            </LinkButton>
            <SubmitButton icon="check" pendingText={editing ? 'Saving…' : 'Creating…'}>
              {editing ? 'Save Changes' : 'Create Team'}
            </SubmitButton>
          </div>
        </div>
      </form>
    </>
  )
}
