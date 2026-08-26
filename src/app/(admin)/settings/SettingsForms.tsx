'use client'

import { useActionState } from 'react'
import { updatePasswordAction, updateProfileAction } from '@/actions/settings'
import { EMPTY_STATE, fieldError } from '@/lib/action-state'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Field } from '@/components/form/Field'
import { Input } from '@/components/form/Input'
import { SubmitButton } from '@/components/form/SubmitButton'

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, formAction] = useActionState(updateProfileAction, EMPTY_STATE)

  return (
    <Card title="Admin profile" subtitle="The name and email used to sign in">
      {state.ok && state.message && (
        <Alert variant="success" className="mb-5" autoDismiss>
          {state.message}
        </Alert>
      )}
      {!state.ok && state.message && (
        <Alert variant="error" className="mb-5">
          {state.message}
        </Alert>
      )}

      <form action={formAction} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Name" name="name" required error={fieldError(state, 'name')}>
            <Input
              name="name"
              defaultValue={name}
              required
              maxLength={120}
              autoComplete="name"
              invalid={!!fieldError(state, 'name')}
            />
          </Field>

          <Field label="Email address" name="email" required error={fieldError(state, 'email')}>
            <Input
              name="email"
              type="email"
              defaultValue={email}
              required
              autoComplete="email"
              invalid={!!fieldError(state, 'email')}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <SubmitButton icon="check" pendingText="Saving…">
            Save Profile
          </SubmitButton>
        </div>
      </form>
    </Card>
  )
}

export function PasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, EMPTY_STATE)

  return (
    <Card title="Change password" subtitle="Use at least 8 characters">
      {state.ok && state.message && (
        <Alert variant="success" className="mb-5" autoDismiss>
          {state.message}
        </Alert>
      )}
      {!state.ok && state.message && (
        <Alert variant="error" className="mb-5">
          {state.message}
        </Alert>
      )}

      <form action={formAction} className="space-y-5">
        <Field
          label="Current password"
          name="currentPassword"
          required
          error={fieldError(state, 'currentPassword')}
        >
          <Input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            invalid={!!fieldError(state, 'currentPassword')}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="New password" name="password" required error={fieldError(state, 'password')}>
            <Input
              name="password"
              type="password"
              required
              autoComplete="new-password"
              invalid={!!fieldError(state, 'password')}
            />
          </Field>

          <Field
            label="Confirm new password"
            name="passwordConfirmation"
            required
            error={fieldError(state, 'passwordConfirmation')}
          >
            <Input
              name="passwordConfirmation"
              type="password"
              required
              autoComplete="new-password"
              invalid={!!fieldError(state, 'passwordConfirmation')}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <SubmitButton icon="check" pendingText="Updating…">
            Update Password
          </SubmitButton>
        </div>
      </form>
    </Card>
  )
}
