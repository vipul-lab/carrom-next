import 'server-only'
import { Types } from 'mongoose'
import { Game, type GameSource } from '../models/Game'
import { Tournament } from '../models/Tournament'
import { Team } from '../models/Team'
import type { TeamRef } from './stats'

/**
 * The group-and-knockout draw.
 *
 * Standings are derived from the group's games every time they are asked for —
 * the same rule the rest of the app follows, so re-scoring a game reorders the
 * table with nothing stored to correct. The knockout ties then read their sides
 * out of those standings rather than holding a copy.
 */

export interface StandingRow {
  team: TeamRef
  played: number
  won: number
  lost: number
  /** 1-based position once the table is ordered. */
  position: number
}

export interface GroupStanding {
  name: string
  rows: StandingRow[]
  /** Every group game has a result, so the top two are final. */
  complete: boolean
}

/** "Group A — 1st", "Winner QF-1" — the label shown while a side is unknown. */
export function sourceLabel(source: GameSource | null | undefined): string {
  if (!source) return 'To be decided'

  if (source.kind === 'winner') return `Winner ${source.slot ?? '—'}`

  const ordinal = source.position === 1 ? '1st' : source.position === 2 ? '2nd' : `${source.position}`
  return `Group ${source.group} — ${ordinal}`
}

function teamRef(doc: {
  _id: Types.ObjectId
  name: string
  code: string
  color: string
  logo?: string | null
}): TeamRef {
  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code,
    color: doc.color,
    logo: doc.logo ?? null,
  }
}

/**
 * One table per group, ordered by wins then fewest losses then name.
 *
 * With three pairs playing each other once, wins alone separate the field in
 * all but an exact three-way tie; name is the final tie-break so the order is
 * at least stable rather than arbitrary.
 */
export async function groupStandings(tournamentId: string): Promise<GroupStanding[]> {
  if (!Types.ObjectId.isValid(tournamentId)) return []

  const tournament = await Tournament.findById(tournamentId).lean()
  if (!tournament?.groups?.length) return []

  const allTeamIds = tournament.groups.flatMap((g) => g.teamIds)
  const teams = new Map(
    (await Team.find({ _id: { $in: allTeamIds } }).lean()).map((t) => [String(t._id), t]),
  )

  const games = await Game.find({
    tournamentId: new Types.ObjectId(tournamentId),
    stage: 'group',
  }).lean()

  return tournament.groups.map((group) => {
    const inGroup = group.teamIds.map(String)
    const played = games.filter((g) => g.groupName === group.name)

    const rows = inGroup.map((id) => {
      const appearances = played.filter(
        (g) => String(g.teamAId) === id || String(g.teamBId) === id,
      )
      const finished = appearances.filter((g) => g.status === 'completed')

      return {
        team: teamRef(teams.get(id)!),
        played: finished.length,
        won: finished.filter((g) => String(g.winnerTeamId) === id).length,
        lost: finished.filter((g) => g.winnerTeamId && String(g.winnerTeamId) !== id).length,
        position: 0,
      }
    })

    rows.sort((a, b) => b.won - a.won || a.lost - b.lost || a.team.name.localeCompare(b.team.name))
    rows.forEach((row, i) => (row.position = i + 1))

    return {
      name: group.name,
      rows,
      complete: played.length > 0 && played.every((g) => g.status === 'completed'),
    }
  })
}

/**
 * Fill in every knockout side whose origin is now decided, and clear any that
 * is not. Re-running is safe and is how a corrected group result propagates:
 * the ties are rewritten from the current standings rather than patched.
 *
 * Returns the number of sides that changed.
 */
export async function resolveDraw(tournamentId: string): Promise<number> {
  if (!Types.ObjectId.isValid(tournamentId)) return 0

  const standings = await groupStandings(tournamentId)
  const byGroup = new Map(standings.map((s) => [s.name, s]))

  const knockouts = await Game.find({
    tournamentId: new Types.ObjectId(tournamentId),
    stage: { $ne: 'group' },
  }).sort({ gameDate: 1, number: 1 })

  const winnerOf = new Map<string, Types.ObjectId | null>()
  for (const tie of knockouts) {
    if (tie.slot) winnerOf.set(tie.slot, tie.status === 'completed' ? tie.winnerTeamId : null)
  }

  const resolve = (source: GameSource | null | undefined): Types.ObjectId | null => {
    if (!source) return null

    if (source.kind === 'winner') return source.slot ? (winnerOf.get(source.slot) ?? null) : null

    const group = source.group ? byGroup.get(source.group) : undefined
    // A position is only real once every game in that group has been played.
    if (!group?.complete) return null

    const row = group.rows.find((r) => r.position === source.position)
    return row ? new Types.ObjectId(row.team.id) : null
  }

  let changed = 0

  // Earliest first, so a quarter-final resolved in this pass feeds the semi.
  for (const tie of knockouts) {
    for (const side of ['A', 'B'] as const) {
      const idField = side === 'A' ? 'teamAId' : 'teamBId'
      const fromField = side === 'A' ? 'teamAFrom' : 'teamBFrom'

      const next = resolve(tie[fromField])
      const current = tie[idField]

      if (String(next ?? '') === String(current ?? '')) continue

      // Never overwrite a tie that has already been played.
      if (tie.status === 'completed') continue

      tie[idField] = next
      changed++
    }

    if (tie.isModified()) {
      await tie.save()
      if (tie.slot) winnerOf.set(tie.slot, tie.status === 'completed' ? tie.winnerTeamId : null)
    }
  }

  return changed
}
