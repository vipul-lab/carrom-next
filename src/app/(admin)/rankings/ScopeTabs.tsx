import Link from 'next/link'
import { SCOPE_OPTIONS } from '@/lib/game-scope'

/**
 * Which games feed the ladder: everything, tournament play only, or friendlies
 * only. Sits beside PeriodTabs — one control per axis, both driven by the query
 * string so a filtered ladder is a shareable URL.
 */
export function ScopeTabs({
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
      if (value && name !== 'page' && name !== 'scope') query.set(name, value)
    })

    if (key !== 'all') query.set('scope', key)
    const qs = query.toString()

    return qs ? `${basePath}?${qs}` : basePath
  }

  return (
    <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-navy-100 bg-white p-1 shadow-card sm:inline-flex">
      {Object.entries(SCOPE_OPTIONS).map(([key, label]) => (
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
