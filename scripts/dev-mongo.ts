/**
 * Boots an ephemeral mongod on a fixed port for local development, seeds it,
 * and keeps it running. Not used in production — Atlas provides the database
 * there. Run with: npx tsx --conditions=react-server scripts/dev-mongo.ts
 */

import { MongoMemoryServer } from 'mongodb-memory-server-core'
import { writeFileSync } from 'node:fs'

const PORT = Number(process.env.DEV_MONGO_PORT ?? 27099)

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { port: PORT, dbName: 'carrom_game' } })
  const uri = mongod.getUri('carrom_game')

  writeFileSync('.dev-mongo-uri', uri)
  console.log(`mongod listening on ${uri}`)

  process.on('SIGINT', async () => {
    await mongod.stop()
    process.exit(0)
  })

  // Keep the process alive.
  await new Promise(() => {})
}

main()
