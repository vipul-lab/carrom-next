'use client'

import { useFormStatus } from 'react-dom'
import { buttonClasses, type ButtonSize, type ButtonVariant } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import type { ReactNode } from 'react'

/**
 * A submit button that disables itself and swaps in a spinner while the
 * surrounding server action is in flight — the same feedback the old
 * `data-loading` handler gave, but driven by React's own form status.
 */
export function SubmitButton({
  children,
  pendingText = 'Saving…',
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
}: {
  children: ReactNode
  pendingText?: string
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClasses(variant, size, `${pending ? 'cursor-wait opacity-70' : ''} ${className}`)}
    >
      {pending ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        icon && <Icon name={icon} className="h-4 w-4" />
      )}
      <span>{pending ? pendingText : children}</span>
    </button>
  )
}
