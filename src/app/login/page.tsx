import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Icon } from '@/components/ui/Icon'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Sign in' }

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Carrom Arena'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ok?: string }>
}) {
  const params = await searchParams

  return (
    <div className="min-h-full bg-navy-950">
      <div className="flex min-h-full flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-raised">
              <Icon name="board" className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-2xl font-bold text-white">{APP_NAME}</h1>
            <p className="mt-1 text-sm text-navy-400">Sign in to manage the tournament</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-raised sm:p-8">
            <Suspense>
              <LoginForm next={params.next ?? ''} flash={params.ok ?? null} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
