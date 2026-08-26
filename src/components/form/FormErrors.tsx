'use client'

import { Alert } from '@/components/ui/Alert'
import { allErrors, type ActionState } from '@/lib/action-state'

/** The validation summary Laravel rendered from `$errors`, plus any flash error. */
export function FormErrors({ state, className = 'mb-6' }: { state?: ActionState; className?: string }) {
  const errors = allErrors(state)

  if (state?.message && errors.length === 0) {
    return (
      <Alert variant="error" className={className} dismissible={false}>
        {state.message}
      </Alert>
    )
  }

  if (errors.length === 0) return null

  return (
    <Alert
      variant="error"
      className={className}
      dismissible={false}
      title={`Please fix the ${errors.length} problem${errors.length === 1 ? '' : 's'} below`}
    >
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {errors.map((message, index) => (
          <li key={`${message}-${index}`}>{message}</li>
        ))}
      </ul>
    </Alert>
  )
}
