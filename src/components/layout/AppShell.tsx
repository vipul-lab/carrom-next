'use client'

import { useState, type ReactNode } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { Flash } from './Flash'
import type { Notification } from '@/lib/services/notifications'
import type { SessionUser } from '@/lib/authz'

/**
 * The admin chrome. Only the drawer's open/closed flag is client state — the
 * page content itself is streamed in from the server as `children`.
 */
export function AppShell({
  notifications,
  appName,
  user,
  children,
}: {
  notifications: Notification[]
  appName: string
  /** The signed-in editor, or null for the read-only public view. */
  user: SessionUser | null
  children: ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-full">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        appName={appName}
        canEdit={Boolean(user)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          notifications={notifications}
          user={user}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Flash className="mb-6" />
          {children}
        </main>

        <footer className="no-print border-t border-navy-100 px-4 py-4 text-xs text-slate-400 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{appName} — carrom tournament management</span>
            <span>Next.js · MongoDB</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
