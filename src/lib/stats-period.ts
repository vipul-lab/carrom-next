/**
 * A resolved reporting window. Every statistic in the app is derived from game
 * data, so the same window object is threaded through the ranking, dashboard and
 * report services to keep "this week" meaning the same thing everywhere.
 */

export type PeriodKey = 'all' | 'month' | 'week' | 'year' | 'custom'

export interface StatsPeriod {
  /** Inclusive lower bound, as a YYYY-MM-DD string. */
  from: string | null
  /** Inclusive upper bound, as a YYYY-MM-DD string. */
  to: string | null
  key: PeriodKey
}

export const PERIOD_OPTIONS: Record<Exclude<PeriodKey, 'custom'>, string> = {
  all: 'All time',
  month: 'This month',
  week: 'This week',
  year: 'This year',
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Build a window from a preset key used by the ranking/report filters. */
export function periodFromKey(key: string | null | undefined): StatsPeriod {
  const now = new Date()

  switch (key) {
    case 'week': {
      // Weeks run Monday → Sunday, matching Carbon's startOfWeek default.
      const day = (now.getDay() + 6) % 7
      const start = new Date(now)
      start.setDate(now.getDate() - day)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { from: toDateString(start), to: toDateString(end), key: 'week' }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: toDateString(start), to: toDateString(end), key: 'month' }
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now.getFullYear(), 11, 31)
      return { from: toDateString(start), to: toDateString(end), key: 'year' }
    }
    default:
      return { from: null, to: null, key: 'all' }
  }
}

/** An explicit from/to range supplied by the reports filter. */
export function customPeriod(from?: string | null, to?: string | null): StatsPeriod {
  return { from: from || null, to: to || null, key: 'custom' }
}

export const ALL_TIME: StatsPeriod = { from: null, to: null, key: 'all' }

export function isAllTime(period: StatsPeriod): boolean {
  return period.from === null && period.to === null
}

export function periodLabel(period: StatsPeriod): string {
  if (period.key !== 'custom') {
    return PERIOD_OPTIONS[period.key as Exclude<PeriodKey, 'custom'>] ?? 'All time'
  }

  return `${period.from ?? '…'} → ${period.to ?? '…'}`
}

/**
 * The window as a Mongo match fragment on `gameDate`. Dates are stored at UTC
 * midnight, so the upper bound is expressed as "before the next day" to make
 * `to` inclusive.
 */
export function periodMatch(period: StatsPeriod): Record<string, unknown> {
  if (isAllTime(period)) return {}

  const range: Record<string, Date> = {}

  if (period.from) range.$gte = new Date(`${period.from}T00:00:00.000Z`)
  if (period.to) {
    const end = new Date(`${period.to}T00:00:00.000Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    range.$lt = end
  }

  return { gameDate: range }
}
