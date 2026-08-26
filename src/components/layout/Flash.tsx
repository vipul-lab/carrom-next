'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'

/**
 * Server actions redirect with `?ok=` or `?err=` instead of Laravel's session
 * flash bag. This reads the message once, shows it, then strips the parameter
 * so a refresh does not replay it.
 */
export function Flash({ className = '' }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const ok = searchParams.get('ok')
  const err = searchParams.get('err')
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!ok && !err) {
      setMessage(null)
      return
    }

    setMessage(ok ? { tone: 'success', text: ok } : { tone: 'error', text: err! })

    const next = new URLSearchParams(searchParams.toString())
    next.delete('ok')
    next.delete('err')
    const qs = next.toString()

    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [ok, err, pathname, router, searchParams])

  if (!message) return null

  return (
    <div className={className}>
      <Alert
        variant={message.tone}
        autoDismiss={message.tone === 'success'}
        dismissible
      >
        {message.text}
      </Alert>
    </div>
  )
}
