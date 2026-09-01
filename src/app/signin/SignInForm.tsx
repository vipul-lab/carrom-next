'use client'

import { useActionState } from 'react'
import { signInAction } from '@/actions/auth'
import { EMPTY_STATE } from '@/lib/action-state'
import { Field } from '@/components/form/Field'
import { Input } from '@/components/form/Input'
import { SubmitButton } from '@/components/form/SubmitButton'
import { Icon } from '@/components/ui/Icon'

export function SignInForm({ returnTo, disabled }: { returnTo: string; disabled: boolean }) {
  const [state, formAction] = useActionState(signInAction, EMPTY_STATE)

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} />

      {state.message && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </p>
      )}

      <Field label="Email address" name="email">
        <Input
          type="email"
          name="email"
          autoComplete="username"
          required
          disabled={disabled}
          placeholder="you@example.com"
          icon="user"
        />
      </Field>

      <Field label="Password" name="password">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={disabled}
          placeholder="••••••••"
        />
      </Field>

      <SubmitButton pendingText="Signing in…" className="w-full justify-center">
        Sign in
      </SubmitButton>
    </form>
  )
}
