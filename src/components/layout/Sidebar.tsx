'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from '@/components/ui/Icon'

interface NavItem {
  label: string
  icon: IconName
  href: string
  /** A path prefix that also lights this item up (e.g. /players/123/edit). */
  match: string
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', href: '/dashboard', match: '/dashboard' },
  { label: 'Team Members', icon: 'users', href: '/players', match: '/players' },
  { label: 'Teams', icon: 'shield', href: '/teams', match: '/teams' },
  { label: 'Games', icon: 'board', href: '/games', match: '/games' },
  { label: 'Player Rankings', icon: 'trophy', href: '/rankings/players', match: '/rankings/players' },
  { label: 'Team Rankings', icon: 'chart', href: '/rankings/teams', match: '/rankings/teams' },
  { label: 'Reports', icon: 'document', href: '/reports', match: '/reports' },
  { label: 'Settings', icon: 'cog', href: '/settings', match: '/settings' },
]

export function Sidebar({
  open,
  onClose,
  appName,
}: {
  open: boolean
  onClose: () => void
  appName: string
}) {
  const pathname = usePathname()

  const isActive = (item: NavItem) =>
    pathname === item.match || pathname.startsWith(`${item.match}/`)

  return (
    <>
      {/* Backdrop shown only while the mobile drawer is open */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm lg:hidden ${open ? '' : 'hidden'}`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-navy-950 transition-transform duration-200
                    lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 lg:shrink-0
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3" onClick={onClose}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg">
              <Icon name="board" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-white">{appName}</span>
              <span className="block truncate text-[11px] text-navy-400">Tournament Manager</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-navy-400 transition hover:bg-navy-800 hover:text-white lg:hidden"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.map((item) => {
            const active = isActive(item)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-navy-800 text-white shadow-inner'
                    : 'text-navy-300 hover:bg-navy-900 hover:text-white'
                }`}
              >
                {active && (
                  <span
                    className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-blue-500"
                    aria-hidden="true"
                  />
                )}

                <Icon
                  name={item.icon}
                  className={`h-5 w-5 shrink-0 ${active ? 'text-blue-400' : 'text-navy-500 group-hover:text-navy-300'}`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-navy-800/80 p-3">
          <Link
            href="/games/create"
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <Icon name="plus" className="h-4 w-4" />
            New Game
          </Link>
        </div>
      </aside>
    </>
  )
}
