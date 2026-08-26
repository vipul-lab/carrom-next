'use client'

import { useActionState } from 'react'
import { loginAction } from '@/actions/auth'
import { EMPTY_STATE, fieldError } from '@/lib/action-state'
import { Alert } from '@/components/ui/Alert'
import { Field } from '@/components/form/Field'
import { Input } from '@/components/form/Input'
import { Checkbox } from '@/components/form/Checkbox'
import { SubmitButton } from '@/components/form/SubmitButton'

export function LoginForm({ next, flash }: { next: string; flash: string | null }) {
  const [state, formAction] = useActionState(loginAction, EMPTY_STATE)

  const emailError = fieldError(state, 'email')
  const passwordError = fieldError(state, 'password')

  return (
    <>
      {flash && (
        <Alert variant="success" className="mb-5">
          {flash}
        </Alert>
      )}

      {(emailError || passwordError || state.message) && (
        <Alert variant="error" className="mb-5" dismissible={false}>
          {emailError ?? passwordError ?? state.message}
        </Alert>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="next" value={next} />

        <Field label="Email address" name="email" required error={emailError}>
          <Input
            name="email"
            type="email"
            icon="user"
            required
            autoFocus
            autoComplete="username"
            placeholder="you@example.com"
            invalid={!!emailError}
          />
        </Field>

        <Field label="Password" name="password" required error={passwordError}>
          <Input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={!!passwordError}
          />
        </Field>

        <div className="flex items-center justify-between">
          <Checkbox name="remember" label="Remember me" value="1" />
        </div>

        <SubmitButton size="lg" className="w-full" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>
    </>
  )
}
