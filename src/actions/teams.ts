'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Types } from 'mongoose'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/db'
import { Team } from '@/lib/models/Team'
import { Player } from '@/lib/models/Player'
import { teamGameCount } from '@/lib/services/deletion'
import { deleteImage, hasFile, storeImage, UploadError, validateImage } from '@/lib/blob'
import { RECORD_STATUSES } from '@/lib/enums'
import type { ActionState } from '@/lib/action-state'

/**
 * Team create/update/delete. The Zod schema carries the same rules the Laravel
 * `TeamRequest` did, including the messages, so the UI reads identically.
 */
const TeamSchema = z.object({
  name: z.string().trim().min(1, 'The team name field is required.').max(120),
  code: z
    .string()
    .trim()
    .min(1, 'The team code field is required.')
    .max(12, 'The team code may not be greater than 12 characters.')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'The team code may only contain letters, numbers, dashes and underscores.',
    ),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour using the colour picker (for example #2563eb).'),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(RECORD_STATUSES),
})

function readTeamForm(formData: FormData) {
  return TeamSchema.safeParse({
    name: formData.get('name'),
    // The old prepareForValidation() upper-cased the code before validating.
    code: String(formData.get('code') ?? '').trim().toUpperCase(),
    color: formData.get('color'),
    description: (formData.get('description') as string) || null,
    status: formData.get('status'),
  })
}

/** Name and code are unique across teams; `ignoreId` excludes the row being edited. */
async function uniquenessErrors(
  name: string,
  code: string,
  ignoreId?: string,
): Promise<Record<string, string[]>> {
  const errors: Record<string, string[]> = {}
  const not = ignoreId ? { _id: { $ne: new Types.ObjectId(ignoreId) } } : {}

  const [nameTaken, codeTaken] = await Promise.all([
    Team.exists({ name, ...not }),
    Team.exists({ code, ...not }),
  ])

  if (nameTaken) errors.name = ['Another team already uses this name.']
  if (codeTaken) errors.code = ['Another team already uses this code.']

  return errors
}

export async function createTeamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = readTeamForm(formData)
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  await connectToDatabase()

  const clashes = await uniquenessErrors(parsed.data.name, parsed.data.code)
  if (Object.keys(clashes).length) return { ok: false, errors: clashes }

  let logo: string | null = null
  const file = formData.get('logo')

  if (hasFile(file)) {
    const problem = validateImage(file)
    if (problem) return { ok: false, errors: { logo: [problem] } }

    try {
      logo = await storeImage(file, 'teams')
    } catch (error) {
      if (error instanceof UploadError) return { ok: false, errors: { logo: [error.message] } }
      throw error
    }
  }

  const team = await Team.create({ ...parsed.data, logo })

  revalidatePath('/teams')
  redirect(`/teams/${team._id}?ok=${encodeURIComponent(`Team "${team.name}" was created.`)}`)
}

export async function updateTeamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) return { ok: false, message: 'That team no longer exists.' }

  const parsed = readTeamForm(formData)
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  await connectToDatabase()

  const team = await Team.findById(id)
  if (!team) return { ok: false, message: 'That team no longer exists.' }

  const clashes = await uniquenessErrors(parsed.data.name, parsed.data.code, id)
  if (Object.keys(clashes).length) return { ok: false, errors: clashes }

  const file = formData.get('logo')

  if (hasFile(file)) {
    const problem = validateImage(file)
    if (problem) return { ok: false, errors: { logo: [problem] } }

    try {
      team.logo = await storeImage(file, 'teams', team.logo)
    } catch (error) {
      if (error instanceof UploadError) return { ok: false, errors: { logo: [error.message] } }
      throw error
    }
  } else if (formData.get('remove_logo') === '1') {
    await deleteImage(team.logo)
    team.logo = null
  }

  Object.assign(team, parsed.data)
  await team.save()

  revalidatePath('/teams')
  revalidatePath(`/teams/${id}`)
  redirect(`/teams/${id}?ok=${encodeURIComponent(`Team "${team.name}" was updated.`)}`)
}

export async function deleteTeamAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) redirect('/teams?err=That+team+no+longer+exists.')

  await connectToDatabase()

  const team = await Team.findById(id)
  if (!team) redirect('/teams?err=That+team+no+longer+exists.')

  // A team that has played cannot be removed without destroying match history.
  const gameCount = await teamGameCount(id)

  if (gameCount > 0) {
    redirect(
      `/teams/${id}?err=${encodeURIComponent(
        `"${team.name}" has played ${gameCount} game(s) and cannot be deleted. Set it to inactive instead.`,
      )}`,
    )
  }

  const name = team.name
  await deleteImage(team.logo)
  // Deleting a team unassigns its members rather than deleting them.
  await Player.updateMany({ teamId: new Types.ObjectId(id) }, { $set: { teamId: null } })
  await team.deleteOne()

  revalidatePath('/teams')
  redirect(`/teams?ok=${encodeURIComponent(`Team "${name}" was deleted.`)}`)
}
