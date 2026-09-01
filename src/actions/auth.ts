'use server'

import { AuthError } from 'next-auth'
import { signIn, signOut } from '@/lib/auth'
import { safeReturnTo } from '@/lib/authz'
import type { ActionState } from '@/lib/action-state'

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const returnTo = safeReturnTo(String(formData.get('returnTo') ?? '/'))

  if (!email || !password) {
    return { ok: false, message: 'Enter your email address and password.' }
  }

  try {
    // On success this throws NEXT_REDIRECT, which must reach Next untouched.
    await signIn('credentials', { email, password, redirectTo: returnTo })
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately vague: never reveal which of the two was wrong.
      return { ok: false, message: 'That email address and password do not match an editor.' }
    }
    throw error
  }

  return {}
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' })
}
