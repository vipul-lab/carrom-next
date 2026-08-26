'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { initialsOf, pluralise, teamInitials } from '@/lib/format'
import type { LineupView } from '@/lib/services/games'
import type { TeamRef } from '@/lib/services/stats'

type Side = 'a' | 'b'
const OTHER: Record<Side, Side> = { a: 'b', b: 'a' }

/**
 * Win/loss marking for the result screen.
 *
 * Partners win or lose together and exactly one team must win, so selecting any
 * mark propagates across both sides. This is convenience only —
 * `recordScoreAction` re-checks the same rules server-side and rejects an
 * inconsistent submission.
 */
export function Scoreboard({
  teamA,
  teamB,
  teamALineup,
  teamBLineup,
  initialMarks,
}: {
  teamA: TeamRef | null
  teamB: TeamRef | null
  teamALineup: LineupView[]
  teamBLineup: LineupView[]
  /** Existing marks when re-scoring a completed game, else empty. */
  initialMarks: Record<string, number>
}) {
  // `null` until the admin picks a side; then true for the winners.
  const [sides, setSides] = useState<Record<Side, boolean | null>>(() => {
    const first = (lineup: LineupView[]) => {
      const entry = lineup.find((l) => l.playerId in initialMarks)
      return entry ? initialMarks[entry.playerId] > 0 : null
    }

    return { a: first(teamALineup), b: first(teamBLineup) }
  })

  /** Marking one side always flips the other — there are no draws. */
  function markSide(side: Side, won: boolean) {
    setSides({ [side]: won, [OTHER[side]]: !won } as Record<Side, boolean | null>)
  }

  const decided = sides.a !== null && sides.b !== null && sides.a !== sides.b
  const nameA = teamA?.name ?? 'Team A'
  const nameB = teamB?.name ?? 'Team B'

  const panels: { side: Side; team: TeamRef | null; lineup: LineupView[] }[] = [
    { side: 'a', team: teamA, lineup: teamALineup },
    { side: 'b', team: teamB, lineup: teamBLineup },
  ]

  return (
    <>
      {/* Live result summary */}
      <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-navy-100 bg-gradient-to-br from-navy-900 to-navy-950 px-6 py-6 text-center shadow-raised sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gold-400">
            <Icon name="trophy" className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-lg font-bold text-white">
              {decided ? `${sides.a ? nameA : nameB} win` : 'Awaiting result'}
            </span>
            <span className="block text-sm text-navy-300">
              {decided
                ? `${sides.a ? nameB : nameA} take the loss.`
                : sides.a === null && sides.b === null
                  ? 'Mark each player as a win or a loss.'
                  : 'Exactly one team must win — pick the winning side.'}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-center">
            <p className="max-w-28 truncate text-[11px] font-semibold tracking-wide text-navy-400 uppercase">
              {nameA}
            </p>
            <p className="font-mono text-3xl font-extrabold text-white">{sides.a ? 1 : 0}</p>
          </div>
          <span className="text-2xl font-bold text-navy-600">–</span>
          <div className="text-center">
            <p className="max-w-28 truncate text-[11px] font-semibold tracking-wide text-navy-400 uppercase">
              {nameB}
            </p>
            <p className="font-mono text-3xl font-extrabold text-white">{sides.b ? 1 : 0}</p>
          </div>
        </div>
      </div>

      {/* Win / loss marking */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {panels.map(({ side, team, lineup }) => {
          const won = decided && sides[side]

          return (
            <div
              key={side}
              className={`overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card transition ${
                won ? 'ring-2 ring-green-500' : ''
              }`}
            >
              <header
                className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4"
                style={{ borderTop: `3px solid ${team?.color ?? '#94a3b8'}` }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    src={team?.logo}
                    initials={teamInitials(team?.code, team?.name)}
                    color={team?.color}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-navy-900">{team?.name}</h2>
                    <p className="text-xs text-slate-500">
                      {lineup.length} {pluralise(lineup.length, 'player')}
                    </p>
                  </div>
                </div>

                {/* Marks the whole side in one click; the other side flips automatically. */}
                <button
                  type="button"
                  onClick={() => markSide(side, true)}
                  className="shrink-0 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                >
                  This team won
                </button>
              </header>

              <ul className="divide-y divide-navy-50">
                {lineup.map((entry) => (
                  <li key={entry.playerId} className="flex items-center gap-3 px-5 py-3.5">
                    <Avatar
                      src={entry.player?.photo}
                      initials={initialsOf(entry.player?.name, '?')}
                      size="sm"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy-900">
                        {entry.player?.name ?? 'Unknown player'}
                      </span>
                      <span className="block text-xs text-slate-400">
                        Win scores 1, loss scores 0
                      </span>
                    </span>

                    {/* Every player carries the mark of their side. */}
                    <input
                      type="hidden"
                      name={`points[${entry.playerId}]`}
                      value={sides[side] ? 1 : 0}
                    />

                    {/* Segmented win/loss control */}
                    <div className="flex shrink-0 overflow-hidden rounded-lg ring-1 ring-navy-200 ring-inset">
                      <button
                        type="button"
                        onClick={() => markSide(side, true)}
                        aria-pressed={sides[side] === true}
                        className={`px-3.5 py-2 text-xs font-bold transition ${
                          sides[side] === true
                            ? 'bg-green-600 text-white'
                            : 'text-navy-500 hover:bg-navy-50'
                        }`}
                      >
                        WIN
                      </button>

                      <button
                        type="button"
                        onClick={() => markSide(side, false)}
                        aria-pressed={sides[side] === false}
                        className={`border-l border-navy-200 px-3.5 py-2 text-xs font-bold transition ${
                          sides[side] === false
                            ? 'bg-red-500 text-white'
                            : 'text-navy-500 hover:bg-navy-50'
                        }`}
                      >
                        LOSS
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </>
  )
}
