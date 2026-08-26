'use client'

import { useActionState } from 'react'
import { createPlayerAction, deletePlayerAction, updatePlayerAction } from '@/actions/players'
import { EMPTY_STATE, fieldError } from '@/lib/action-state'
import { RECORD_STATUS_OPTIONS } from '@/lib/enums'
import { initialsOf } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field } from '@/components/form/Field'
import { Input } from '@/components/form/Input'
import { Select } from '@/components/form/Select'
import { ImageUpload } from '@/components/form/ImageUpload'
import { SubmitButton } from '@/components/form/SubmitButton'
import { FormErrors } from '@/components/form/FormErrors'
import type { PlayerWithStats } from '@/lib/services/stats'

export interface TeamOption {
  id: string
  name: string
}

/** Shared by players/create and players/[id]/edit. */
export function PlayerForm({
  player,
  teams,
  defaultTeamId,
}: {
  player?: PlayerWithStats
  teams: TeamOption[]
  defaultTeamId?: string
}) {
  const editing = Boolean(player)
  const [state, formAction] = useActionState(
    editing ? updatePlayerAction : createPlayerAction,
    EMPTY_STATE,
  )

  const teamOptions = teams.map((team) => [team.id, team.name] as [string, string])

  return (
    <>
      <FormErrors state={state} />

      <form action={formAction} encType="multipart/form-data">
        {editing && <input type="hidden" name="id" value={player!.id} />}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Member details">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  label="Full name"
                  name="name"
                  required
                  className="sm:col-span-2"
                  error={fieldError(state, 'name')}
                >
                  <Input
                    name="name"
                    defaultValue={player?.name ?? ''}
                    required
                    maxLength={120}
                    placeholder="e.g. Arjun Mehta"
                    invalid={!!fieldError(state, 'name')}
                  />
                </Field>

                <Field
                  label="Team"
                  name="teamId"
                  required
                  hint="Members can only be picked for games with their own team."
                  error={fieldError(state, 'teamId')}
                >
                  <Select
                    name="teamId"
                    options={teamOptions}
                    defaultValue={player?.team?.id ?? defaultTeamId ?? ''}
                    placeholder="Select a team"
                    invalid={!!fieldError(state, 'teamId')}
                  />
                </Field>

                <Field
                  label="Status"
                  name="status"
                  required
                  hint="Only active members can be selected for a game."
                  error={fieldError(state, 'status')}
                >
                  <Select
                    name="status"
                    options={RECORD_STATUS_OPTIONS}
                    defaultValue={player?.status ?? 'active'}
                  />
                </Field>

                <Field
                  label="Mobile number"
                  name="mobile"
                  hint="Optional."
                  error={fieldError(state, 'mobile')}
                >
                  <Input
                    name="mobile"
                    defaultValue={player?.mobile ?? ''}
                    maxLength={20}
                    placeholder="+91 98765 43210"
                    invalid={!!fieldError(state, 'mobile')}
                  />
                </Field>

                <Field
                  label="Email address"
                  name="email"
                  hint="Optional, but must be unique."
                  error={fieldError(state, 'email')}
                >
                  <Input
                    name="email"
                    type="email"
                    defaultValue={player?.email ?? ''}
                    maxLength={190}
                    placeholder="player@example.com"
                    invalid={!!fieldError(state, 'email')}
                  />
                </Field>
              </div>
            </Card>
          </div>

          <div>
            <Card title="Profile photo">
              <ImageUpload
                name="photo"
                label="Photo"
                current={player?.photo}
                initials={initialsOf(player?.name)}
                removeName="remove_photo"
                error={fieldError(state, 'photo')}
              />
            </Card>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <ConfirmDialog
              title="Delete this member?"
              triggerLabel="Delete Member"
              confirmLabel="Yes, delete member"
              action={deletePlayerAction}
              hiddenFields={{ id: player!.id }}
            >
              <strong className="text-navy-900">{player!.name}</strong> will be removed from the
              roster. Members who already appear in a recorded game cannot be deleted — set them to
              inactive instead, which keeps their results intact.
            </ConfirmDialog>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href={editing ? `/players/${player!.id}` : '/players'} variant="secondary">
              Cancel
            </LinkButton>
            <SubmitButton icon="check" pendingText={editing ? 'Saving…' : 'Adding…'}>
              {editing ? 'Save Changes' : 'Add Member'}
            </SubmitButton>
          </div>
        </div>
      </form>
    </>
  )
}
