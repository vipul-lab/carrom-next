'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { Field } from '@/components/form/Field'
import { Input } from '@/components/form/Input'
import { Select } from '@/components/form/Select'
import { FORMAT_OPTIONS, STATUS_OPTIONS, playersPerTeam, type GameFormat, type GameStatus } from '@/lib/enums'
import { initialsOf } from '@/lib/format'
import { fieldError, type ActionState } from '@/lib/action-state'

export interface RosterPlayer {
  id: string
  name: string
  photo: string | null
}

export interface TeamOption {
  id: string
  name: string
}

export interface LineupDefaults {
  format: GameFormat
  gameDate: string
  status?: GameStatus
  teamAId: string
  teamBId: string
  teamAPlayers: string[]
  teamBPlayers: string[]
}

type Side = 'a' | 'b'

/**
 * The line-up picker.
 *
 * It enforces the same rules the server enforces — exactly N players per side,
 * no player twice, active players only, Team A ≠ Team B — so the admin gets
 * immediate feedback. Everything is re-checked in `validateGameForm` on submit;
 * this is convenience, not the guarantee.
 */
export function LineupPicker({
  teams,
  rosters,
  defaults,
  showStatus = false,
  state,
}: {
  teams: TeamOption[]
  /** Active members grouped by team id. */
  rosters: Record<string, RosterPlayer[]>
  defaults: LineupDefaults
  showStatus?: boolean
  state?: ActionState
}) {
  const [format, setFormat] = useState<GameFormat>(defaults.format)
  const [teamIds, setTeamIds] = useState<Record<Side, string>>({
    a: defaults.teamAId,
    b: defaults.teamBId,
  })
  const [selected, setSelected] = useState<Record<Side, string[]>>({
    a: defaults.teamAPlayers,
    b: defaults.teamBPlayers,
  })

  const limit = playersPerTeam(format)
  function changeFormat(next: GameFormat) {
    setFormat(next)

    // Trim over-full line-ups when switching 2v2 → 1v1.
    const nextLimit = playersPerTeam(next)
    setSelected((current) => ({
      a: current.a.slice(0, nextLimit),
      b: current.b.slice(0, nextLimit),
    }))
  }

  function changeTeam(side: Side, teamId: string) {
    setTeamIds((current) => ({ ...current, [side]: teamId }))
    // The previous picks belong to a different roster now.
    setSelected((current) => ({ ...current, [side]: [] }))
  }

  function togglePlayer(side: Side, playerId: string) {
    setSelected((current) => {
      const chosen = current[side]

      if (chosen.includes(playerId)) {
        return { ...current, [side]: chosen.filter((id) => id !== playerId) }
      }

      if (chosen.length >= limit) return current

      return { ...current, [side]: [...chosen, playerId] }
    })
  }

  const panels: { side: Side; heading: string; tone: string }[] = [
    { side: 'a', heading: 'Team A', tone: 'bg-blue-50 text-blue-600' },
    { side: 'b', heading: 'Team B', tone: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <div className="space-y-6">
      <Card title="Game information" subtitle="The format and date of this fixture">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Game format"
            name="format"
            required
            hint="Sets how many players each side must field."
            error={fieldError(state, 'format')}
          >
            <Select
              name="format"
              id="format"
              options={FORMAT_OPTIONS}
              value={format}
              onChange={(event) => changeFormat(event.target.value as GameFormat)}
            />
          </Field>

          <Field label="Game date" name="gameDate" required error={fieldError(state, 'gameDate')}>
            <Input
              name="gameDate"
              type="date"
              defaultValue={defaults.gameDate}
              required
              invalid={!!fieldError(state, 'gameDate')}
            />
          </Field>

          {showStatus && (
            <Field
              label="Status"
              name="status"
              hint="Reopening a completed game clears its winner until it is scored again."
              error={fieldError(state, 'status')}
            >
              <Select name="status" options={STATUS_OPTIONS} defaultValue={defaults.status ?? 'scheduled'} />
            </Field>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {panels.map(({ side, heading, tone }) => {
          const otherSide: Side = side === 'a' ? 'b' : 'a'
          const teamId = teamIds[side]
          const roster = rosters[teamId] ?? []
          const chosen = selected[side]
          const error = fieldError(state, side === 'a' ? 'teamAPlayers' : 'teamBPlayers')
          const teamError = fieldError(state, side === 'a' ? 'teamAId' : 'teamBId')

          return (
            <div
              key={side}
              className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card"
            >
              <header className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${tone}`}
                  >
                    {side.toUpperCase()}
                  </span>
                  <h2 className="text-base font-semibold text-navy-900">{heading}</h2>
                </div>

                <span
                  className={`text-xs font-semibold ${chosen.length === limit ? 'text-green-600' : 'text-amber-600'}`}
                >
                  {chosen.length} of {limit} selected
                </span>
              </header>

              <div className="space-y-4 p-5">
                <Field
                  label={heading}
                  name={side === 'a' ? 'teamAId' : 'teamBId'}
                  required
                  error={teamError}
                >
                  <Select
                    name={side === 'a' ? 'teamAId' : 'teamBId'}
                    id={side === 'a' ? 'teamAId' : 'teamBId'}
                    value={teamId}
                    onChange={(event) => changeTeam(side, event.target.value)}
                    placeholder="Select a team"
                    invalid={!!teamError}
                  >
                    {/* The opponent is disabled so the same team cannot be picked twice. */}
                    {teams.map((team) => (
                      <option key={team.id} value={team.id} disabled={team.id === teamIds[otherSide]}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div>
                  <p className="mb-2 text-sm font-medium text-navy-800">
                    Pick {limit} active {limit === 1 ? 'player' : 'players'}
                  </p>

                  {!teamId || roster.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-navy-200 bg-navy-50/60 px-4 py-6 text-center text-sm text-slate-500">
                      {!teamId
                        ? 'Choose a team first to see its active members.'
                        : 'This team has no active members yet. Add members before scheduling a game.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {roster.map((player) => {
                        const isChecked = chosen.includes(player.id)
                        const takenByOther = selected[otherSide].includes(player.id)
                        const atLimit = !isChecked && chosen.length >= limit
                        const disabled = takenByOther || atLimit

                        return (
                          <label
                            key={player.id}
                            className={`group relative flex items-center gap-3 rounded-xl border bg-white p-3 transition
                              ${isChecked ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-navy-100 hover:border-blue-300 hover:bg-blue-50/40'}
                              ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={disabled}
                              onChange={() => togglePlayer(side, player.id)}
                              className="h-4 w-4 shrink-0 rounded border-navy-300 text-blue-600 focus:ring-blue-500"
                            />
                            <Avatar
                              src={player.photo}
                              initials={initialsOf(player.name)}
                              size="sm"
                              className="h-9 w-9"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy-900">
                              {player.name}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {/* The picks the server action actually reads. */}
                  {chosen.map((playerId) => (
                    <input
                      key={playerId}
                      type="hidden"
                      name={side === 'a' ? 'teamAPlayers' : 'teamBPlayers'}
                      value={playerId}
                    />
                  ))}

                  {error && (
                    <p className="mt-2 flex items-start gap-1 text-xs font-medium text-red-600">
                      <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />
                      <span>{error}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Alert variant="info" dismissible={false} title="How scoring works">
        Create the game first, then mark each player as a win or a loss on the result screen. The
        team result, the winner and every ranking are derived from those marks — a side scores 1 for
        a win regardless of format, and there are no draws.
      </Alert>
    </div>
  )
}
