'use server'

import { revalidatePath } from 'next/cache'
import { Types } from 'mongoose'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/db'
import { User } from '@/lib/models/User'
import { createSession, hashPassword, requireSession, verifyPassword } from '@/lib/auth'
import type { ActionState } from '@/lib/action-state'

const ProfileSchema = z.object({
  name: z.string().trim().min(1, 'The name field is required.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(190),
})

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = ProfileSchema.safeParse({
    name: formData.get('name'),
    email: String(formData.get('email') ?? '').toLowerCase(),
  })

  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  await connectToDatabase()

  const taken = await User.exists({
    email: parsed.data.email,
    _id: { $ne: new Types.ObjectId(session.id) },
  })

  if (taken) return { ok: false, errors: { email: ['Another account already uses this email.'] } }

  const user = await User.findById(session.id)
  if (!user) return { ok: false, message: 'Your account could not be found.' }

  // Changing the address invalidates the previous verification.
  if (user.email !== parsed.data.email) user.emailVerifiedAt = null

  user.name = parsed.data.name
  user.email = parsed.data.email
  await user.save()

  // The session carries the name and email shown in the header, so re-issue it.
  await createSession({ id: String(user._id), name: user.name, email: user.email })

  revalidatePath('/settings')
  return { ok: true, message: 'Your profile was updated.' }
}

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'The current password field is required.'),
    password: z.string().min(8, 'The new password must be at least 8 characters.'),
    passwordConfirmation: z.string().min(1, 'Please confirm the new password.'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'The password confirmation does not match.',
  })

export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = PasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  })

  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  await connectToDatabase()

  const user = await User.findById(session.id)
  if (!user) return { ok: false, message: 'Your account could not be found.' }

  if (!(await verifyPassword(parsed.data.currentPassword, user.password))) {
    return { ok: false, errors: { currentPassword: ['Your current password is incorrect.'] } }
  }

  user.password = await hashPassword(parsed.data.password)
  await user.save()

  return { ok: true, message: 'Your password was changed.' }
}
