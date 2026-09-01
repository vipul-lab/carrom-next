'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Types } from 'mongoose'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/db'
import { Player } from '@/lib/models/Player'
import { Team } from '@/lib/models/Team'
import { playerAppearanceCount } from '@/lib/services/deletion'
import { deleteImage, hasFile, storeImage, UploadError, validateImage } from '@/lib/blob'
import { RECORD_STATUSES } from '@/lib/enums'
import type { ActionState } from '@/lib/action-state'
import { FORBIDDEN, isEditor, requireEditorOrRedirect } from '@/lib/authz'

/** Mirrors the Laravel `PlayerRequest` rules, messages included. */
const PlayerSchema = z.object({
  name: z.string().trim().min(1, 'The full name field is required.').max(120),
  // Optional: a member joins the roster first and is given a team later.
  teamId: z.string().trim().nullable().optional(),
  mobile: z
    .string()
    .trim()
    .regex(
      /^[0-9+\-\s()]{6,20}$/,
      'Enter a valid mobile number (digits, spaces, +, - and brackets only).',
    )
    .nullable()
    .optional(),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(190)
    .nullable()
    .optional(),
  status: z.enum(RECORD_STATUSES),
})

function readPlayerForm(formData: FormData) {
  return PlayerSchema.safeParse({
    name: formData.get('name'),
    teamId: (formData.get('teamId') as string)?.trim() || null,
    mobile: (formData.get('mobile') as string)?.trim() || null,
    email: (formData.get('email') as string)?.trim().toLowerCase() || null,
    status: formData.get('status'),
  })
}

async function validateReferences(
  teamId: string | null | undefined,
  email: string | null | undefined,
  ignoreId?: string,
): Promise<Record<string, string[]>> {
  const errors: Record<string, string[]> = {}

  // No team is a valid state — but a named team must actually exist.
  if (teamId && (!Types.ObjectId.isValid(teamId) || !(await Team.exists({ _id: teamId })))) {
    errors.teamId = ['Select a team that exists.']
  }

  if (email) {
    const not = ignoreId ? { _id: { $ne: new Types.ObjectId(ignoreId) } } : {}
    if (await Player.exists({ email, ...not })) {
      errors.email = ['Another member already uses this email address.']
    }
  }

  return errors
}

export async function createPlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await isEditor())) return FORBIDDEN

  const parsed = readPlayerForm(formData)
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  await connectToDatabase()

  const problems = await validateReferences(parsed.data.teamId, parsed.data.email)
  if (Object.keys(problems).length) return { ok: false, errors: problems }

  let photo: string | null = null
  const file = formData.get('photo')

  if (hasFile(file)) {
    const problem = validateImage(file)
    if (problem) return { ok: false, errors: { photo: [problem] } }

    try {
      photo = await storeImage(file, 'players')
    } catch (error) {
      if (error instanceof UploadError) return { ok: false, errors: { photo: [error.message] } }
      throw error
    }
  }

  const player = await Player.create({
    name: parsed.data.name,
    teamId: parsed.data.teamId ? new Types.ObjectId(parsed.data.teamId) : null,
    mobile: parsed.data.mobile ?? null,
    email: parsed.data.email ?? null,
    status: parsed.data.status,
    photo,
  })

  revalidatePath('/players')
  redirect(
    `/players/${player._id}?ok=${encodeURIComponent(`${player.name} was added to the roster.`)}`,
  )
}

export async function updatePlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await isEditor())) return FORBIDDEN

  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) return { ok: false, message: 'That member no longer exists.' }

  const parsed = readPlayerForm(formData)
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  await connectToDatabase()

  const player = await Player.findById(id)
  if (!player) return { ok: false, message: 'That member no longer exists.' }

  const problems = await validateReferences(parsed.data.teamId, parsed.data.email, id)
  if (Object.keys(problems).length) return { ok: false, errors: problems }

  const file = formData.get('photo')

  if (hasFile(file)) {
    const problem = validateImage(file)
    if (problem) return { ok: false, errors: { photo: [problem] } }

    try {
      player.photo = await storeImage(file, 'players', player.photo)
    } catch (error) {
      if (error instanceof UploadError) return { ok: false, errors: { photo: [error.message] } }
      throw error
    }
  } else if (formData.get('remove_photo') === '1') {
    await deleteImage(player.photo)
    player.photo = null
  }

  player.name = parsed.data.name
  player.teamId = parsed.data.teamId ? new Types.ObjectId(parsed.data.teamId) : null
  player.mobile = parsed.data.mobile ?? null
  player.email = parsed.data.email ?? null
  player.status = parsed.data.status
  await player.save()

  revalidatePath('/players')
  revalidatePath(`/players/${id}`)
  redirect(
    `/players/${id}?ok=${encodeURIComponent(`${player.name}'s profile was updated.`)}`,
  )
}

export async function deletePlayerAction(formData: FormData): Promise<void> {
  await requireEditorOrRedirect('/players')

  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) redirect('/players?err=That+member+no+longer+exists.')

  await connectToDatabase()

  const player = await Player.findById(id)
  if (!player) redirect('/players?err=That+member+no+longer+exists.')

  // Removing a player who appears in recorded games would rewrite history, so
  // those members are retired via the status flag instead.
  const appearances = await playerAppearanceCount(id)

  if (appearances > 0) {
    redirect(
      `/players/${id}?err=${encodeURIComponent(
        `${player.name} has played ${appearances} game(s) and cannot be deleted. Set the member to inactive instead.`,
      )}`,
    )
  }

  const name = player.name
  await deleteImage(player.photo)
  await player.deleteOne()

  revalidatePath('/players')
  redirect(`/players?ok=${encodeURIComponent(`${name} was removed from the roster.`)}`)
}
