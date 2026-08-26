'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/db'
import { User } from '@/lib/models/User'
import {
  clearAttempts,
  createSession,
  destroySession,
  recordAttempt,
  throttleStatus,
  verifyPassword,
} from '@/lib/auth'
import type { ActionState } from '@/lib/action-state'

const LoginSchema = z.object({
  email: z.string().min(1, 'The email field is required.').email('Enter a valid email address.'),
  password: z.string().min(1, 'The password field is required.'),
  remember: z.coerce.boolean().optional(),
})

/** Rate-limit key: the email being tried plus the caller's IP. */
async function throttleKey(email: string): Promise<string> {
  const headerList = await headers()
  const ip =
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerList.get('x-real-ip') ??
    'unknown'

  return `${email.toLowerCase()}|${ip}`
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    remember: formData.get('remember') === '1',
  })

  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors }
  }

  const { email, password, remember } = parsed.data
  const key = await throttleKey(email)

  const throttle = throttleStatus(key)
  if (throttle.blocked) {
    return {
      ok: false,
      errors: {
        email: [`Too many login attempts. Please try again in ${throttle.retryAfter} seconds.`],
      },
    }
  }

  await connectToDatabase()
  const user = await User.findOne({ email: email.toLowerCase() })

  if (!user || !(await verifyPassword(password, user.password))) {
    recordAttempt(key)
    return { ok: false, errors: { email: ['Those credentials do not match our records.'] } }
  }

  clearAttempts(key)

  await createSession(
    { id: String(user._id), name: user.name, email: user.email },
    Boolean(remember),
  )

  const next = String(formData.get('next') ?? '')
  // Only ever redirect to a path inside this app.
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard')
}

export async function logoutAction(): Promise<void> {
  await destroySession()
  redirect('/login?ok=You+have+been+signed+out.')
}
