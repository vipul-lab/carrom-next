import type { Metadata } from 'next'
import './globals.css'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Carrom Arena'

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: 'Tournament management for a carrom league — teams, members, games and rankings.',
}

export const viewport = {
  themeColor: '#0d1729',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full">{children}</body>
    </html>
  )
}
