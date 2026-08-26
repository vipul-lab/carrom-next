import mongoose from 'mongoose'

/**
 * A single, cached Mongoose connection.
 *
 * Serverless functions are re-invoked constantly and each invocation would
 * otherwise open its own socket, exhausting the Atlas connection limit. The
 * promise is stashed on `globalThis` so warm lambdas — and Next's dev-mode
 * module reloads — reuse the connection they already have.
 */

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }

const globalForMongoose = globalThis as unknown as { _mongoose?: Cache }

const cached: Cache = globalForMongoose._mongoose ?? { conn: null, promise: null }
globalForMongoose._mongoose = cached

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  // Read at call time, not module load, so a script that configures dotenv
  // after importing this module still sees the value.
  const uri = process.env.MONGODB_URI

  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.')
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      // Keep the pool small — many concurrent lambdas each hold their own.
      maxPoolSize: 10,
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (error) {
    cached.promise = null
    throw error
  }

  return cached.conn
}
