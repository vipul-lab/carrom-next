'use client'

import { useActionState } from 'react'
import { createGameAction, deleteGameAction, updateGameAction } from '@/actions/games'
import { EMPTY_STATE } from '@/lib/action-state'
import { LinkButton } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SubmitButton } from '@/components/form/SubmitButton'
import { FormErrors } from '@/components/form/FormErrors'
import {
  LineupPicker,
  type LineupDefaults,
  type RosterPlayer,
  type TeamOption,
  type TournamentOption,
} from '@/components/games/LineupPicker'

/** Shared by games/create and games/[id]/edit. */
export function GameForm({
  teams,
  rosters,
  tournaments,
  defaults,
  game,
}: {
  teams: TeamOption[]
  rosters: Record<string, RosterPlayer[]>
  tournaments: TournamentOption[]
  defaults: LineupDefaults
  /** Present when editing an existing fixture. */
  game?: { id: string; label: string; completed: boolean }
}) {
  const editing = Boolean(game)
  const [state, formAction] = useActionState(
    editing ? updateGameAction : createGameAction,
    EMPTY_STATE,
  )

  return (
    <>
      {editing && game!.completed && (
        <Alert variant="warning" dismissible={false} className="mb-6" title="This game is already scored">
          Changing the line-up recalculates the team result from the remaining players&apos; marks.
          Any player you remove loses their result for this game.
        </Alert>
      )}

      <FormErrors state={state} />

      <form action={formAction}>
        {editing && <input type="hidden" name="id" value={game!.id} />}

        <LineupPicker
          teams={teams}
          rosters={rosters}
          tournaments={tournaments}
          defaults={defaults}
          showStatus={editing}
          state={state}
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <ConfirmDialog
              title="Delete this game?"
              triggerLabel="Delete Game"
              confirmLabel="Yes, delete game"
              action={deleteGameAction}
              hiddenFields={{ id: game!.id }}
            >
              Deleting <strong className="text-navy-900">{game!.label}</strong> removes its result as
              well. Every player and team ranking is recalculated from the remaining games, so all
              statistics stay correct.
            </ConfirmDialog>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href={editing ? `/games/${game!.id}` : '/games'} variant="secondary">
              Cancel
            </LinkButton>
            {editing && (
              <LinkButton href={`/games/${game!.id}/score`} variant="accent" icon="board">
                Score Game
              </LinkButton>
            )}
            <SubmitButton icon="check" pendingText={editing ? 'Saving…' : 'Creating…'}>
              {editing ? 'Save Changes' : 'Create Game & Score'}
            </SubmitButton>
          </div>
        </div>
      </form>
    </>
  )
}
