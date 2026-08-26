import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export interface Crumb {
  label: string
  href?: string | null
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  actions,
}: {
  title: string
  subtitle?: ReactNode
  breadcrumbs?: Crumb[]
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumbs.length > 0 && (
          <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb) =>
              crumb.href ? (
                <span key={crumb.label} className="flex items-center gap-1.5">
                  <Link href={crumb.href} className="transition hover:text-blue-600">
                    {crumb.label}
                  </Link>
                  <Icon name="chevron-right" className="h-3 w-3 text-navy-300" />
                </span>
              ) : (
                <span key={crumb.label} className="text-navy-600">
                  {crumb.label}
                </span>
              ),
            )}
          </nav>
        )}

        <h1 className="truncate text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          {title}
        </h1>

        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
