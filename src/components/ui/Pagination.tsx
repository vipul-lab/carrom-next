import Link from 'next/link'
import { Icon } from './Icon'

/**
 * The Tailwind-styled pager shared by every listing. Page links carry the
 * current query string forward so a filter survives paging.
 */
export function Pagination({
  page,
  lastPage,
  total,
  firstItem,
  perPage,
  params,
  basePath,
}: {
  page: number
  lastPage: number
  total: number
  firstItem: number
  perPage: number
  params: Record<string, string | undefined>
  basePath: string
}) {
  if (lastPage <= 1) return null

  const href = (target: number) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && key !== 'page') query.set(key, value)
    })
    if (target > 1) query.set('page', String(target))
    const qs = query.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  // A sliding window of at most five numbered pages around the current one.
  const start = Math.max(1, Math.min(page - 2, lastPage - 4))
  const end = Math.min(lastPage, start + 4)
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  const lastItem = Math.min(firstItem + perPage - 1, total)

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-navy-800">{firstItem}</span>–
        <span className="font-semibold text-navy-800">{lastItem}</span> of{' '}
        <span className="font-semibold text-navy-800">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            className="rounded-lg p-2 text-navy-600 transition hover:bg-navy-100"
            aria-label="Previous page"
          >
            <Icon name="chevron-left" className="h-4 w-4" />
          </Link>
        ) : (
          <span className="rounded-lg p-2 text-navy-200">
            <Icon name="chevron-left" className="h-4 w-4" />
          </span>
        )}

        {pages.map((n) => (
          <Link
            key={n}
            href={href(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`min-w-9 rounded-lg px-3 py-1.5 text-center text-sm font-semibold transition ${
              n === page ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-600 hover:bg-navy-100'
            }`}
          >
            {n}
          </Link>
        ))}

        {page < lastPage ? (
          <Link
            href={href(page + 1)}
            className="rounded-lg p-2 text-navy-600 transition hover:bg-navy-100"
            aria-label="Next page"
          >
            <Icon name="chevron-right" className="h-4 w-4" />
          </Link>
        ) : (
          <span className="rounded-lg p-2 text-navy-200">
            <Icon name="chevron-right" className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  )
}
