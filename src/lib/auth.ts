import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifyPassword } from '@/lib/password'

interface Editor {
  email: string
  salt: string
  hash: string
}

/**
 * The editor roster, as `email:salt:hash` entries separated by commas.
 *
 * Read at call time rather than module load so the roster can be changed on the
 * host without a rebuild — and so removing someone takes effect on their very
 * next request instead of whenever their existing session happens to expire.
 */
function editors(): Editor[] {
  return (process.env.EDITORS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [email, salt, hash] = entry.split(':')
      return { email: (email ?? '').toLowerCase(), salt: salt ?? '', hash: hash ?? '' }
    })
    .filter((editor) => editor.email && editor.salt && editor.hash)
}

export function isEditorEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const wanted = email.toLowerCase()
  return editors().some((editor) => editor.email === wanted)
}

/** Auth.js turns anything thrown in `authorize` into a generic failure. */
class BadCredentials extends CredentialsSignin {
  code = 'credentials'
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const email = String(raw?.email ?? '')
          .trim()
          .toLowerCase()
        const password = String(raw?.password ?? '')

        if (!email || !password) throw new BadCredentials()

        const editor = editors().find((candidate) => candidate.email === email)

        // Hash even when the address is unknown, so that "no such editor" and
        // "wrong password" take the same time to answer.
        const { salt, hash } = editor ?? { salt: 'unknown', hash: '00'.repeat(64) }
        const ok = await verifyPassword(password, salt, hash)

        if (!editor || !ok) throw new BadCredentials()

        return { id: editor.email, email: editor.email }
      },
    }),
  ],
  // Self-hosted deployments need this; Vercel sets it implicitly.
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
})
