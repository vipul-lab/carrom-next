import bcrypt from 'bcryptjs'

/**
 * Password hashing, kept free of any Next.js import so the seed script and the
 * verification harness can use it outside a request context.
 */

const COST = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
