'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type AlertVariant = 'success' | 'error' | 'warning' | 'info'

const VARIANTS: Record<AlertVariant, [string, string, IconName]> = {
  success: ['bg-green-50 border-green-200 text-green-900', 'text-green-600', 'check-circle'],
  error: ['bg-red-50 border-red-200 text-red-900', 'text-red-600', 'alert'],
  warning: ['bg-amber-50 border-amber-200 text-amber-900', 'text-amber-600', 'alert'],
  info: ['bg-blue-50 border-blue-200 text-blue-900', 'text-blue-600', 'info'],
}

export function Alert({
  variant = 'info',
  title,
  dismissible = true,
  autoDismiss = false,
  className = '',
  children,
}: {
  variant?: AlertVariant
  title?: string
  dismissible?: boolean
  autoDismiss?: boolean
  className?: string
  children: ReactNode
}) {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  // Success toasts fade themselves out; errors stay until the admin closes them.
  useEffect(() => {
    if (!autoDismiss) return

    const fade = setTimeout(() => setFading(true), 6000)
    const remove = setTimeout(() => setVisible(false), 6500)

    return () => {
      clearTimeout(fade)
      clearTimeout(remove)
    }
  }, [autoDismiss])

  if (!visible) return null

  const [wrapper, iconTone, icon] = VARIANTS[variant]

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border p-4 shadow-card transition duration-500 ${wrapper} ${fading ? 'opacity-0' : ''} ${className}`}
    >
      <Icon name={icon} className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone}`} />

      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          className="-m-1 shrink-0 rounded p-1 opacity-60 transition hover:opacity-100"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
