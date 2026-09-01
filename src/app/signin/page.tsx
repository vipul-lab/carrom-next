import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { isEditor, safeReturnTo } from '@/lib/authz'
import { SignInForm } from './SignInForm'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const returnTo = safeReturnTo(params.from)

  // Already an editor — nothing to do here.
  if (await isEditor()) redirect(returnTo)

  // With no roster nobody can possibly sign in; say so rather than letting
  // every attempt fail as though the password were wrong.
  const configured = Boolean(process.env.EDITORS?.trim() && process.env.AUTH_SECRET?.trim())

  return (
    <main className="flex min-h-full items-center justify-center bg-navy-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <Icon name="board" className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-bold text-white">Editor sign-in</h1>
          <p className="mt-2 text-sm text-navy-300">
            Browsing is open to everyone. Sign in only to add or change records.
          </p>
        </div>

        <div className="rounded-2xl border border-navy-800 bg-navy-900 p-6 shadow-raised">
          {!configured && (
            <p
              role="alert"
              className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            >
              No editor accounts are configured on this server yet. Set{' '}
              <code className="font-mono text-amber-200">EDITORS</code> and{' '}
              <code className="font-mono text-amber-200">AUTH_SECRET</code> in{' '}
              <code className="font-mono text-amber-200">.env.local</code>, then restart the
              server.
            </p>
          )}

          <SignInForm returnTo={returnTo} disabled={!configured} />
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href={returnTo} className="text-navy-300 transition hover:text-white">
            ← Back to {returnTo === '/' ? 'the dashboard' : 'browsing'}
          </Link>
        </p>
      </div>
    </main>
  )
}
