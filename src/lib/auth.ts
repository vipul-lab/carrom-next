import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
// Deep imports keep JWE (and its Edge-unsupported CompressionStream) out of the
// middleware bundle — this app only ever signs and verifies, never encrypts.
import { SignJWT } from 'jose/jwt/sign'
import { jwtVerify } from 'jose/jwt/verify'
import { connectToDatabase } from './db'
import { User, type UserDoc } from './models/User'

/**
 * Session handling.
 *
 * Laravel kept sessions in a database table; on Vercel a stateless signed
 * cookie is both cheaper and simpler — every request verifies the JWT locally
 * with no round-trip. The cookie is httpOnly, SameSite=Lax and Secure in
 * production, so it is not readable from JavaScript and does not ride along on
 * cross-site requests.
 */

const COOKIE_NAME = 'carrom_session'
const DEFAULT_LIFETIME_SECONDS = 120 * 60 // matches SESSION_LIFETIME=120 minutes
const REMEMBER_LIFETIME_SECONDS = 30 * 24 * 60 * 60

export interface SessionUser {
  id: string
  name: string
  email: string
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set — the session cookie cannot be signed.')
  return new TextEncoder().encode(secret)
}

export async function createSession(user: SessionUser, remember = false): Promise<void> {
  const maxAge = remember ? REMEMBER_LIFETIME_SECONDS : DEFAULT_LIFETIME_SECONDS

  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secretKey())

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** The signed-in admin, or null. Never throws on a tampered or expired cookie. */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secretKey())
    return { id: String(payload.id), name: String(payload.name), email: String(payload.email) }
  } catch {
    return null
  }
}

/** Guard for every admin page and server action. Redirects a guest to /login. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/** The full user record behind the current session, re-read from the database. */
export async function currentUser(): Promise<UserDoc | null> {
  const session = await getSession()
  if (!session) return null

  await connectToDatabase()
  return User.findById(session.id).lean<UserDoc>()
}

export { hashPassword, verifyPassword } from './password'

/**
 * Login throttling — six attempts per email+IP per minute, mirroring
 * LoginRequest::ensureIsNotRateLimited().
 *
 * The counters live in memory, so on Vercel they are per-instance rather than
 * global: a determined attacker spread across many cold lambdas gets more than
 * six tries. It raises the cost of naive credential stuffing without pretending
 * to be a complete defence — see the README for the Redis/Upstash upgrade.
 */
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 6
const DECAY_MS = 60_000

export function throttleStatus(key: string): { blocked: boolean; retryAfter: number } {
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < Date.now()) return { blocked: false, retryAfter: 0 }

  return {
    blocked: entry.count >= MAX_ATTEMPTS,
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)),
  }
}

export function recordAttempt(key: string): void {
  const entry = attempts.get(key)

  if (!entry || entry.resetAt < Date.now()) {
    attempts.set(key, { count: 1, resetAt: Date.now() + DECAY_MS })
    return
  }

  entry.count += 1
}

export function clearAttempts(key: string): void {
  attempts.delete(key)
}
