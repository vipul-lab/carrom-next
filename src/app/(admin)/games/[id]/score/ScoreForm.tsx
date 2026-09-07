'use client'

import { useActionState } from 'react'
import { recordScoreAction } from '@/actions/games'
import { EMPTY_STATE, fieldError } from '@/lib/action-state'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { SubmitButton } from '@/components/form/SubmitButton'
import { FormErrors } from '@/components/form/FormErrors'
import { teamInitials } from '@/lib/format'
import type { LineupView } from '@/lib/services/games'
import type { TeamRef } from '@/lib/services/stats'

/** One side: who played, and the single points box for that team. */
function SideScore({
  team,
  lineup,
  name,
  defaultValue,
  error,
}: {
  team: TeamRef | null
  lineup: LineupView[]
  name: string
  defaultValue: number | null
  error: string | null
}) {
  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <Avatar
        src={team?.logo}
        initials={teamInitials(team?.code ?? '', team?.name ?? '?')}
        color={team?.color}
        size="lg"
      />

      <div>
        <p className="text-base font-bold text-navy-900">{team?.name ?? 'Unassigned'}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {lineup.map((entry) => entry.player?.name ?? 'Unknown').join(' & ')}
        </p>
      </div>

      <div className="w-full max-w-40">
        <label htmlFor={name} className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Points
        </label>
        <input
          type="number"
          name={name}
          id={name}
          inputMode="numeric"
          min={0}
          max={9999}
          step={1}
          required
          defaultValue={defaultValue ?? ''}
          aria-invalid={error ? true : undefined}
          className={`block w-full rounded-xl border-0 bg-white py-4 text-center text-3xl font-bold text-navy-900 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset ${
            error ? 'ring-red-300 focus:ring-red-500' : 'ring-navy-200 focus:ring-blue-500'
          }`}
        />
        {error && (
          <p className="mt-1.5 flex items-start gap-1 text-left text-xs font-medium text-red-600">
            <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  )
}

export function ScoreForm({
  gameId,
  teamA,
  teamB,
  teamALineup,
  teamBLineup,
  teamAScore,
  teamBScore,
  knockout,
}: {
  gameId: string
  teamA: TeamRef | null
  teamB: TeamRef | null
  teamALineup: LineupView[]
  teamBLineup: LineupView[]
  /** Pre-filled when correcting an already-scored game. */
  teamAScore: number | null
  teamBScore: number | null
  /** Knockout ties cannot end level — somebody has to go through. */
  knockout: boolean
}) {
  const [state, formAction] = useActionState(recordScoreAction, EMPTY_STATE)

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={gameId} />

      <FormErrors state={state} />

      <Card padding="p-0">
        <div className="grid grid-cols-1 divide-y divide-navy-100 sm:grid-cols-[1fr_auto_1fr] sm:divide-x sm:divide-y-0">
          <SideScore
            team={teamA}
            lineup={teamALineup}
            name="teamAScore"
            defaultValue={teamAScore}
            error={fieldError(state, 'teamAScore')}
          />

          <div className="flex items-center justify-center bg-navy-50/60 px-6 py-3">
            <span className="text-xs font-bold tracking-widest text-slate-400">VS</span>
          </div>

          <SideScore
            team={teamB}
            lineup={teamBLineup}
            name="teamBScore"
            defaultValue={teamBScore}
            error={fieldError(state, 'teamBScore')}
          />
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs text-slate-500">
          Enter the points each team finished on. The higher score wins, and every ranking is
          derived from the scoreline on the server.
          {knockout
            ? ' This is a knockout tie, so it cannot end level.'
            : ' A level score is recorded as a draw.'}
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
