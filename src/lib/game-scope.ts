import { Types } from 'mongoose'

/**
 * Which games a statistic is derived from.
 *
 * This is the companion to `StatsPeriod`: a period narrows *when*, a scope
 * narrows *what counts*. Both are threaded through the same ranking, dashboard
 * and report services and both end up as a fragment of the same Mongo `$match`,
 * so "this week's tournament ladder" is one object per axis rather than a
 * special-cased query.
 */

export type ScopeKey = 'all' | 'tournament' | 'friendly' | 'one'

export interface GameScope {
  key: ScopeKey
  /** Only meaningful when `key` is 'one'. */
  tournamentId: string | null
}

export const ALL_GAMES: GameScope = { key: 'all', tournamentId: null }

/** The three choices offered as a toggle on the ranking pages. */
export const SCOPE_OPTIONS: Record<Exclude<ScopeKey, 'one'>, string> = {
  all: 'All games',
  tournament: 'Tournament only',
  friendly: 'Friendlies only',
}

/**
 * Resolve a scope from query-string values. A specific tournament id wins over
 * the coarse key, so `?scope=friendly&tournament=<id>` still means that one
 * tournament rather than a contradiction.
 */
export function scopeFromParams(
  key: string | null | undefined,
  tournamentId?: string | null,
): GameScope {
  if (tournamentId && Types.ObjectId.isValid(tournamentId)) {
    return { key: 'one', tournamentId }
  }

  if (key === 'tournament' || key === 'friendly') return { key, tournamentId: null }

  return ALL_GAMES
}

export function isAllGames(scope: GameScope): boolean {
  return scope.key === 'all'
}

/**
 * The scope as a Mongo match fragment on `tournamentId`.
 *
 * Games created before tournaments existed have no `tournamentId` field at all,
 * so "friendly" has to match a missing field as well as an explicit null —
 * which `{ $eq: null }` does, and `{ tournamentId: null }` alone would not for
 * every driver version.
 */
export function scopeMatch(scope: GameScope): Record<string, unknown> {
  switch (scope.key) {
    case 'friendly':
      return { tournamentId: { $eq: null } }
    case 'tournament':
      return { tournamentId: { $ne: null } }
    case 'one':
      return scope.tournamentId && Types.ObjectId.isValid(scope.tournamentId)
        ? { tournamentId: new Types.ObjectId(scope.tournamentId) }
        : {}
    default:
      return {}
  }
}

export function scopeLabel(scope: GameScope, tournamentName?: string | null): string {
  if (scope.key === 'one') return tournamentName ?? 'One tournament'
  return SCOPE_OPTIONS[scope.key]
}
