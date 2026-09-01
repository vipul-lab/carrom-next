import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

const KEY_LENGTH = 64
const SALT_LENGTH = 16

/**
 * Passwords are stored as scrypt hashes, never in the clear — the env file is
 * the kind of thing that ends up committed by accident.
 *
 * Everything is hex on purpose. Next expands `$VAR` when it reads .env files,
 * so a bcrypt-style `$2b$10$…` hash would be silently mangled; hex has no
 * character that dotenv treats as special.
 */
export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = randomBytes(SALT_LENGTH).toString('hex')
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer

  return { salt, hash: derived.toString('hex') }
}

/** Constant-time: a wrong password must not be distinguishable by timing. */
export async function verifyPassword(
  password: string,
  salt: string,
  hash: string,
): Promise<boolean> {
  let expected: Buffer

  try {
    expected = Buffer.from(hash, 'hex')
  } catch {
    return false
  }

  if (expected.length !== KEY_LENGTH) return false

  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer

  return timingSafeEqual(derived, expected)
}
