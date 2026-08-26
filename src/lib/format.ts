/** Display helpers shared by the server components and the client widgets. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Dates are stored at UTC midnight; read them back in UTC so the day never shifts. */
export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function formatLongDate(date: Date | string): string {
  const d = new Date(date)
  return `${DAYS[d.getUTCDay()]}, ${formatDate(d)}`
}

export function formatShortDate(date: Date | string): string {
  const d = new Date(date)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`
}

/** Timestamps (createdAt/updatedAt) are real instants, so render them locally. */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`
}

export function formatTimestampDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '—'

  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'

  const units: [string, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]

  for (const [name, size] of units) {
    const value = Math.floor(seconds / size)
    if (value >= 1) return `${value} ${name}${value === 1 ? '' : 's'} ago`
  }

  return 'just now'
}

/** The YYYY-MM-DD form an <input type="date"> expects. */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toISOString().slice(0, 10)
}

export function todayInput(): string {
  return new Date().toISOString().slice(0, 10)
}

export function numberFormat(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-US').format(Number(value ?? 0))
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

/** "Arjun Mehta" → "AM". Falls back to a single letter, then to "P". */
export function initialsOf(name: string | null | undefined, fallback = 'P'): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((p) => p[0]).join('')
  return (initials || fallback).toUpperCase()
}

export function teamInitials(code: string | null | undefined, name: string | null | undefined): string {
  return String(code || name || '?').slice(0, 2).toUpperCase()
}
