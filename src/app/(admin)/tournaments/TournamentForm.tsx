'use client'

import { useActionState } from 'react'
import {
  createTournamentAction,
  deleteTournamentAction,
  updateTournamentAction,
} from '@/actions/tournaments'
import { EMPTY_STATE, fieldError } from '@/lib/action-state'
import { TOURNAMENT_STATUS_OPTIONS } from '@/lib/enums'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field } from '@/components/form/Field'
import { Input } from '@/components/form/Input'
import { Select } from '@/components/form/Select'
import { Textarea } from '@/components/form/Textarea'
import { SubmitButton } from '@/components/form/SubmitButton'
import { FormErrors } from '@/components/form/FormErrors'
import type { TournamentView } from '@/lib/services/tournaments'

/** Shared by tournaments/create and tournaments/[id]/edit. */
export function TournamentForm({
  tournament,
  today,
}: {
  tournament?: TournamentView
  /** Today as YYYY-MM-DD, resolved on the server so it matches the server clock. */
  today: string
}) {
  const editing = Boolean(tournament)
  const [state, formAction] = useActionState(
    editing ? updateTournamentAction : createTournamentAction,
    EMPTY_STATE,
  )

  const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

  return (
    <>
      <FormErrors state={state} />

      <form action={formAction}>
        {editing && <input type="hidden" name="id" value={tournament!.id} />}

        <Card title="Tournament details">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Tournament name"
              name="name"
              required
              className="sm:col-span-2"
              error={fieldError(state, 'name')}
            >
              <Input
                name="name"
                defaultValue={tournament?.name ?? ''}
                required
                maxLength={120}
                placeholder="e.g. Summer Championship 2026"
                invalid={!!fieldError(state, 'name')}
              />
            </Field>

            <Field label="Start date" name="startDate" required error={fieldError(state, 'startDate')}>
              <Input
                name="startDate"
                type="date"
                defaultValue={dateInput(tournament?.startDate ?? null) || today}
                required
                invalid={!!fieldError(state, 'startDate')}
              />
            </Field>

            <Field
              label="End date"
              name="endDate"
              hint="Leave blank while the tournament is still running."
              error={fieldError(state, 'endDate')}
            >
              <Input
                name="endDate"
                type="date"
                defaultValue={dateInput(tournament?.endDate ?? null)}
                invalid={!!fieldError(state, 'endDate')}
              />
            </Field>

            <Field
              label="Status"
              name="status"
              required
              hint="Only upcoming and active tournaments can be picked on the game form."
              error={fieldError(state, 'status')}
            >
              <Select
                name="status"
                options={TOURNAMENT_STATUS_OPTIONS}
                defaultValue={tournament?.status ?? 'upcoming'}
              />
            </Field>

            <Field
              label="Description"
              name="description"
              className="sm:col-span-2"
              hint="Optional — format, venue, anything useful."
              error={fieldError(state, 'description')}
            >
              <Textarea
                name="description"
                defaultValue={tournament?.description ?? ''}
                rows={4}
                placeholder="What is this tournament?"
              />
            </Field>
          </div>
        </Card>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <ConfirmDialog
              title="Delete this tournament?"
              triggerLabel="Delete Tournament"
              confirmLabel="Yes, delete tournament"
              action={deleteTournamentAction}
              hiddenFields={{ id: tournament!.id }}
            >
              Deleting <strong className="text-navy-900">{tournament!.name}</strong> is only possible
              while it has no games. A tournament that has been played is cancelled instead, so its
              results stay attached to it.
            </ConfirmDialog>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <LinkButton
              href={editing ? `/tournaments/${tournament!.id}` : '/tournaments'}
              variant="secondary"
            >
              Cancel
            </LinkButton>
            <SubmitButton icon="check" pendingText={editing ? 'Saving…' : 'Creating…'}>
              {editing ? 'Save Changes' : 'Create Tournament'}
            </SubmitButton>
          </div>
        </div>
      </form>
    </>
  )
}
