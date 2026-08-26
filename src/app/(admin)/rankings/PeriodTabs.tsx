import Link from 'next/link'
import { PERIOD_OPTIONS } from '@/lib/stats-period'

/** The all-time / month / week / year switcher above each ladder. */
export function PeriodTabs({
  basePath,
  current,
  params,
}: {
  basePath: string
  current: string
  params: Record<string, string | undefined>
}) {
  const href = (key: string) => {
    const query = new URLSearchParams()

    Object.entries(params).forEach(([name, value]) => {
      // The page number and the period itself are always replaced.
      if (value && name !== 'page' && name !== 'period') query.set(name, value)
    })

    query.set('period', key)
    return `${basePath}?${query.toString()}`
  }

  return (
    <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-navy-100 bg-white p-1 shadow-card sm:inline-flex">
      {Object.entries(PERIOD_OPTIONS).map(([key, label]) => (
        <Link
          key={key}
          href={href(key)}
          className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
            current === key ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-600 hover:bg-navy-100'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
