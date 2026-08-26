import { connectToDatabase } from '@/lib/db'
import { getNotifications } from '@/lib/services/notifications'
import { AppShell } from '@/components/layout/AppShell'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Carrom Arena'

/**
 * Every admin page is rendered on demand, so the layout is too. Rendering it
 * eagerly (rather than behind a Suspense boundary) keeps the response
 * uncommitted until the page resolves, which is what lets a page's notFound()
 * still set a 404 status instead of streaming a 200 shell first.
 */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connectToDatabase()
  // The header's "needs attention" list is derived on every admin page.
  const notifications = await getNotifications()

  return (
    <AppShell notifications={notifications} appName={APP_NAME}>
      {children}
    </AppShell>
  )
}
