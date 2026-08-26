import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type BadgeVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'accent'
  | 'gold'
  | 'muted'

const VARIANTS: Record<BadgeVariant, string> = {
  success: 'bg-green-50 text-green-700 ring-green-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  accent: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  gold: 'bg-gold-500/10 text-gold-600 ring-gold-500/30',
  muted: 'bg-navy-100 text-navy-600 ring-navy-500/20',
}

export function Badge({
  variant = 'muted',
  icon,
  className = '',
  children,
}: {
  variant?: BadgeVariant
  icon?: IconName
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${VARIANTS[variant]} ${className}`}
    >
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </span>
  )
}
