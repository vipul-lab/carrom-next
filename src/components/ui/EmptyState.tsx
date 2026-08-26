import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function EmptyState({
  icon = 'inbox',
  title = 'Nothing here yet',
  description,
  action,
  className = '',
}: {
  icon?: IconName
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-navy-200 bg-navy-50/60 px-6 py-12 text-center ${className}`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-navy-400 shadow-card">
        <Icon name={icon} className="h-6 w-6" />
      </span>

      <h3 className="mt-4 text-sm font-semibold text-navy-900">{title}</h3>

      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}

      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
