'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Avatar } from '@/components/ui/Avatar'
import { logoutAction } from '@/actions/auth'
import type { Notification } from '@/lib/services/notifications'
import type { SessionUser } from '@/lib/auth'

const TONES: Record<Notification['tone'], string> = {
  warning: 'bg-amber-50 text-amber-600',
  error: 'bg-red-50 text-red-600',
  info: 'bg-blue-50 text-blue-600',
}

/** A dropdown that closes on an outside click or Escape. */
function useDismissable() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return { open, setOpen, ref }
}

export function Header({
  notifications,
  user,
  onOpenSidebar,
}: {
  notifications: Notification[]
  user: SessionUser
  onOpenSidebar: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bell = useDismissable()
  const profile = useDismissable()

  return (
    <header className="no-print sticky top-0 z-30 border-b border-navy-100 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="rounded-lg p-2 text-navy-600 transition hover:bg-navy-100 lg:hidden"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>

        {/* Global search */}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const term = new FormData(event.currentTarget).get('q')
            router.push(`/search?q=${encodeURIComponent(String(term ?? ''))}`)
          }}
          className="min-w-0 flex-1 sm:max-w-md"
        >
          <label htmlFor="global-search" className="sr-only">
            Search members, teams and games
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              type="search"
              name="q"
              id="global-search"
              defaultValue={searchParams.get('q') ?? ''}
              placeholder="Search members, teams, games…"
              className="block w-full rounded-lg border-0 bg-navy-50 py-2 pr-3 pl-9 text-sm text-navy-900
                         ring-1 ring-navy-100 ring-inset placeholder:text-slate-400
                         focus:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-inset"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Notifications */}
          <div className="relative" ref={bell.ref}>
            <button
              type="button"
              onClick={() => bell.setOpen(!bell.open)}
              aria-expanded={bell.open}
              aria-haspopup="true"
              className="relative rounded-lg p-2 text-navy-600 transition hover:bg-navy-100"
            >
              <span className="sr-only">Notifications</span>
              <Icon name="bell" className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {bell.open && (
              <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-navy-100 bg-white shadow-raised">
                <div className="border-b border-navy-100 px-4 py-3">
                  <p className="text-sm font-semibold text-navy-900">Needs attention</p>
                  <p className="text-xs text-slate-500">
                    {notifications.length} open item{notifications.length === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-500">
                      All caught up — every game is scored.
                    </p>
                  ) : (
                    notifications.map((note, index) => (
                      <Link
                        key={`${note.url}-${index}`}
                        href={note.url}
                        onClick={() => bell.setOpen(false)}
                        className="flex gap-3 border-b border-navy-50 px-4 py-3 transition last:border-0 hover:bg-navy-50"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONES[note.tone]}`}
                        >
                          <Icon name={note.icon} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-navy-900">
                            {note.title}
                          </span>
                          <span className="block text-xs text-slate-500">{note.body}</span>
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Admin profile */}
          <div className="relative" ref={profile.ref}>
            <button
              type="button"
              onClick={() => profile.setOpen(!profile.open)}
              aria-expanded={profile.open}
              aria-haspopup="true"
              className="flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-1.5 transition hover:bg-navy-100"
            >
              <Avatar initials={(user.name || 'A').charAt(0).toUpperCase()} size="sm" />
              <span className="hidden text-left sm:block">
                <span className="block max-w-32 truncate text-sm font-semibold text-navy-900">
                  {user.name}
                </span>
                <span className="block text-[11px] text-slate-500">Administrator</span>
              </span>
              <Icon name="chevron-down" className="h-4 w-4 text-navy-400" />
            </button>

            {profile.open && (
              <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-raised">
                <div className="border-b border-navy-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-navy-900">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>

                <Link
                  href="/settings"
                  onClick={() => profile.setOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-navy-700 transition hover:bg-navy-50"
                >
                  <Icon name="cog" className="h-4 w-4 text-navy-400" />
                  Settings
                </Link>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <Icon name="logout" className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
