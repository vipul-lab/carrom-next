/**
 * The three enumerations that shape the domain. Ported straight from the
 * Laravel `App\Enums` classes so the stored values are byte-for-byte identical.
 */

export const GAME_FORMATS = ['1v1', '2v2'] as const
export type GameFormat = (typeof GAME_FORMATS)[number]

/** Number of players each side must field for this format. */
export function playersPerTeam(format: GameFormat): number {
  return format === '1v1' ? 1 : 2
}

export function formatLabel(format: GameFormat): string {
  return format === '1v1' ? '1 vs 1' : '2 vs 2'
}

/** The fewest active members a team needs to play any format at all. */
export function smallestSquad(): number {
  return Math.min(...GAME_FORMATS.map(playersPerTeam))
}

export const FORMAT_OPTIONS: Record<GameFormat, string> = {
  '1v1': '1 vs 1',
  '2v2': '2 vs 2',
}

export const GAME_STATUSES = ['scheduled', 'completed', 'cancelled'] as const
export type GameStatus = (typeof GAME_STATUSES)[number]

export const STATUS_OPTIONS: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/** Tailwind badge variant used by <Badge>. */
export function gameStatusVariant(status: GameStatus): 'warning' | 'success' | 'danger' {
  return status === 'scheduled' ? 'warning' : status === 'completed' ? 'success' : 'danger'
}

export const RECORD_STATUSES = ['active', 'inactive'] as const
export type RecordStatus = (typeof RECORD_STATUSES)[number]

export const RECORD_STATUS_OPTIONS: Record<RecordStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
}

export function recordStatusVariant(status: RecordStatus): 'success' | 'muted' {
  return status === 'active' ? 'success' : 'muted'
}

export function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
