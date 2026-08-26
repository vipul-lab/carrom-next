/**
 * CLI entry point for the seeder: `npm run seed`.
 *
 * Reads MONGODB_URI from the environment.
 */

import { config } from 'dotenv'
import mongoose from 'mongoose'

// Match Next's own precedence: .env.local wins, .env fills in the rest.
config({ path: '.env.local' })
config({ path: '.env' })

import { connectToDatabase } from '../src/lib/db'
import { seedAll } from '../src/lib/seed'

async function main() {
  await connectToDatabase()
  await seedAll()

  console.log('\nSeed complete.')
  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect()
  process.exit(1)
})
