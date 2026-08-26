import type { ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  action,
  padding = 'p-5 sm:p-6',
  className = '',
  children,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  padding?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card ${className}`}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-navy-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}

      <div className={padding}>{children}</div>
    </section>
  )
}
