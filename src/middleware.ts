import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose/jwt/verify'

/**
 * Route guard. The middleware only checks that a valid session cookie is
 * present — every page and server action re-checks with requireSession(), so a
 * bypass here would still not expose data.
 */

const COOKIE_NAME = 'carrom_session'
const PUBLIC_PATHS = ['/login']

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token || !process.env.AUTH_SECRET) return false

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET))
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authenticated = await hasValidSession(request)

  if (PUBLIC_PATHS.includes(pathname)) {
    // A signed-in admin has no use for the login screen.
    return authenticated
      ? NextResponse.redirect(new URL('/dashboard', request.url))
      : NextResponse.next()
  }

  if (!authenticated) {
    const login = new URL('/login', request.url)
    // Remember where they were headed so login can send them back.
    if (pathname !== '/') login.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)'],
}
