'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Types } from 'mongoose'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/db'
import { Tournament } from '@/lib/models/Tournament'
import { tournamentGameCount } from '@/lib/services/tournaments'
import { TOURNAMENT_STATUSES } from '@/lib/enums'
import type { ActionState } from '@/lib/action-state'
import { FORBIDDEN, isEditor, requireEditorOrRedirect } from '@/lib/authz'

const TournamentSchema = z
  .object({
    name: z.string().trim().min(1, 'The tournament name is required.').max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    startDate: z.string().min(1, 'The start date is required.'),
    endDate: z.string().nullable().optional(),
    status: z.enum(TOURNAMENT_STATUSES),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: 'The end date cannot be before the start date.',
    path: ['endDate'],
  })

function readForm(formData: FormData) {
  return TournamentSchema.safeParse({
    name: formData.get('name'),
    description: (formData.get('description') as string)?.trim() || null,
    startDate: formData.get('startDate'),
    endDate: (formData.get('endDate') as string)?.trim() || null,
    status: formData.get('status'),
  })
}

/** Day-precision dates, stored at UTC midnight so they never shift. */
function toUtcDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

export async function createTournamentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await isEditor())) return FORBIDDEN

  const parsed = readForm(formData)
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  await connectToDatabase()

  if (await Tournament.exists({ name: parsed.data.name })) {
    return { ok: false, errors: { name: ['A tournament with that name already exists.'] } }
  }

  const tournament = await Tournament.create({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    startDate: toUtcDate(parsed.data.startDate),
    endDate: parsed.data.endDate ? toUtcDate(parsed.data.endDate) : null,
    status: parsed.data.status,
  })

  revalidatePath('/tournaments')
  redirect(
    `/tournaments/${tournament._id}?ok=${encodeURIComponent(`${tournament.name} was created.`)}`,
  )
}

export async function updateTournamentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await isEditor())) return FORBIDDEN

  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) {
    return { ok: false, message: 'That tournament no longer exists.' }
  }

  const parsed = readForm(formData)
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  await connectToDatabase()

  const tournament = await Tournament.findById(id)
  if (!tournament) return { ok: false, message: 'That tournament no longer exists.' }

  const clash = await Tournament.exists({
    name: parsed.data.name,
    _id: { $ne: new Types.ObjectId(id) },
  })
  if (clash) return { ok: false, errors: { name: ['A tournament with that name already exists.'] } }

  tournament.name = parsed.data.name
  tournament.description = parsed.data.description ?? null
  tournament.startDate = toUtcDate(parsed.data.startDate)
  tournament.endDate = parsed.data.endDate ? toUtcDate(parsed.data.endDate) : null
  tournament.status = parsed.data.status
  await tournament.save()

  revalidatePath('/tournaments')
  revalidatePath(`/tournaments/${id}`)
  redirect(`/tournaments/${id}?ok=${encodeURIComponent(`${tournament.name} was updated.`)}`)
}

export async function deleteTournamentAction(formData: FormData): Promise<void> {
  await requireEditorOrRedirect('/tournaments')

  const id = String(formData.get('id') ?? '')
  if (!Types.ObjectId.isValid(id)) {
    redirect('/tournaments?err=That+tournament+no+longer+exists.')
  }

  await connectToDatabase()

  const tournament = await Tournament.findById(id)
  if (!tournament) redirect('/tournaments?err=That+tournament+no+longer+exists.')

  // Deleting would silently reclassify every one of its games as a friendly and
  // rewrite the rankings, so a tournament with games is cancelled, not removed.
  const games = await tournamentGameCount(id)

  if (games > 0) {
    redirect(
      `/tournaments/${id}?err=${encodeURIComponent(
        `${tournament.name} has ${games} game(s) and cannot be deleted. Set it to cancelled instead, or move its games first.`,
      )}`,
    )
  }

  const name = tournament.name
  await tournament.deleteOne()

  revalidatePath('/tournaments')
  redirect(`/tournaments?ok=${encodeURIComponent(`${name} was deleted.`)}`)
}
