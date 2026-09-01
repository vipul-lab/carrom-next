import 'server-only'
import { redirect } from 'next/navigation'
import { auth, isEditorEmail } from '@/lib/auth'
import type { ActionState } from '@/lib/action-state'

const NO_ACCESS = 'You need edit access to do that. Sign in with an approved account.'

/**
 * Only ever bounce back to somewhere inside this app — the target arrives in a
 * URL or a form field, so using it unchecked would be an open redirect.
 */
export function safeReturnTo(value: string | string[] | undefined): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

/** What the header needs to render the account control. */
export interface SessionUser {
  name: string | null
  email: string
  image: string | null
}

/**
 * The signed-in editor, or null. Type-only imports of `SessionUser` are erased,
 * so client components can name the shape without pulling this module in.
 */
export async function sessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  const email = session?.user?.email

  if (!isEditorEmail(email)) return null

  return {
    name: session?.user?.name ?? null,
    email: email as string,
    image: session?.user?.image ?? null,
  }
}

/**
 * The single authority on "may this request change data?".
 *
 * Everything else — hidden buttons, guarded pages — is convenience. The server
 * actions call this because a hidden button is not a permission check.
 */
export async function isEditor(): Promise<boolean> {
  const session = await auth()
  return isEditorEmail(session?.user?.email)
}

/** What a form-returning action hands back when the caller may not write. */
export const FORBIDDEN: ActionState = { ok: false, message: NO_ACCESS }

/**
 * Guard for a page that only makes sense for an editor (the create/edit forms).
 * Viewers are bounced to sign-in rather than shown a form that cannot submit.
 */
export async function requireEditorPage(returnTo: string): Promise<void> {
  if (await isEditor()) return
  redirect(`/signin?from=${encodeURIComponent(returnTo)}`)
}

/**
 * Guard for the delete/reopen actions, which navigate rather than return state.
 */
export async function requireEditorOrRedirect(fallbackPath: string): Promise<void> {
  if (await isEditor()) return
  redirect(`${fallbackPath}?err=${encodeURIComponent(NO_ACCESS)}`)
}
