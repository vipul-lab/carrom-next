'use client'

import { useActionState } from 'react'
import { recordScoreAction } from '@/actions/games'
import { EMPTY_STATE } from '@/lib/action-state'
import { LinkButton } from '@/components/ui/Button'
import { SubmitButton } from '@/components/form/SubmitButton'
import { FormErrors } from '@/components/form/FormErrors'
import { Scoreboard } from '@/components/games/Scoreboard'
import type { LineupView } from '@/lib/services/games'
import type { TeamRef } from '@/lib/services/stats'

export function ScoreForm({
  gameId,
  teamA,
  teamB,
  teamALineup,
  teamBLineup,
  initialMarks,
}: {
  gameId: string
  teamA: TeamRef | null
  teamB: TeamRef | null
  teamALineup: LineupView[]
  teamBLineup: LineupView[]
  initialMarks: Record<string, number>
}) {
  const [state, formAction] = useActionState(recordScoreAction, EMPTY_STATE)

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={gameId} />

      <FormErrors state={state} />

      <Scoreboard
        teamA={teamA}
        teamB={teamB}
        teamALineup={teamALineup}
        teamBLineup={teamBLineup}
        initialMarks={initialMarks}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs text-slate-500">
          Partners win or lose together, and exactly one team must win — there are no draws. The
          winner and every ranking are derived on the server from these marks.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`/games/${gameId}`} variant="secondary">
            Cancel
          </LinkButton>
          <SubmitButton variant="success" icon="check" size="lg" pendingText="Saving result…">
            Save Result
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
