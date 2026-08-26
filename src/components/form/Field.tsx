import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'

export function Field({
  label,
  name,
  hint,
  required = false,
  htmlFor,
  error,
  className = '',
  children,
}: {
  label?: string
  name?: string
  hint?: string
  required?: boolean
  htmlFor?: string
  error?: string | string[] | null
  className?: string
  children: ReactNode
}) {
  const id = htmlFor ?? name
  const message = Array.isArray(error) ? error[0] : error

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-navy-800">
          {label}
          {required && (
            <span className="text-red-500" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}

      {children}

      {hint && !message && <p className="text-xs text-slate-500">{hint}</p>}

      {message && (
        <p className="flex items-start gap-1 text-xs font-medium text-red-600">
          <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}
    </div>
  )
}
