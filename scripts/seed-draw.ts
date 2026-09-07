/**
 * Builds the twelve-pair draw: 12 pairs in 4 groups, a round-robin inside each
 * group, and the seven knockout ties that follow.
 *
 * Run with: npm run seed:draw
 *
 * Idempotent — pairs, the tournament and every fixture are matched on a stable
 * key, so re-running updates rather than duplicating.
 */

import { config } from 'dotenv'
import mongoose from 'mongoose'

config({ path: '.env.local' })
config({ path: '.env' })

import { connectToDatabase } from '../src/lib/db'
import { Player } from '../src/lib/models/Player'
import { Team } from '../src/lib/models/Team'
import { Tournament } from '../src/lib/models/Tournament'
import { Game, type GameSource } from '../src/lib/models/Game'
import { nextSequence } from '../src/lib/models/Counter'
import { resolveDraw } from '../src/lib/services/draw'

const TOURNAMENT = 'The Twelve-Pair Draw'

/** Image name -> roster name, where the two differ. */
const ALIASES: Record<string, string> = {
  Abhishek: 'Abhishek Koshti',
  Vipul: 'Vipul Khandhar',
  Keval: 'Keval Patel',
  Krunal: 'Krunal Patel',
  Birju: 'Birju Chauhan',
  Adnan: 'Adnan',
  Wasim: 'Vasim Ansari',
  Govind: 'Govind Ravaliya',
  Jaimin: 'Jaimin Pethani',
  Meet: 'Meet Ladani',
  Arjun: 'Arjun Parikh',
  Tehsil: 'Tehsil Shaikh',
  Asif: 'Aasif Shaikh',
  Dipam: 'Dipam Bhatt',
  Ajay: 'Ajay Sangani',
  Sarfaraz: 'Sarfaraj Makvana',
  Akshay: 'Akshay Shihora',
  Nikul: 'Nikul Kumbhani',
  Vishal: 'Vishal Patel',
  Kavin: 'Kavin Soni',
  Mayank: 'Mayank Pethani',
  // Not previously on the roster — created by this script.
  Darshan: 'Darshan',
  'Asif D': 'Asif D',
  Saka: 'Saka',
}

const COLORS = ['#2563eb', '#16a34a', '#b45309', '#9d174d']

const GROUPS = [
  { name: 'A', date: '2026-09-08', color: COLORS[0],
    pairs: [['Adnan', 'Wasim'], ['Govind', 'Jaimin'], ['Meet', 'Arjun']] },
  { name: 'B', date: '2026-09-09', color: COLORS[1],
    pairs: [['Tehsil', 'Asif'], ['Dipam', 'Ajay'], ['Sarfaraz', 'Akshay']] },
  { name: 'C', date: '2026-09-10', color: COLORS[2],
    pairs: [['Asif D', 'Nikul'], ['Saka', 'Vishal'], ['Kavin', 'Mayank']] },
  { name: 'D', date: '2026-09-07', color: COLORS[3],
    pairs: [['Abhishek', 'Vipul'], ['Keval', 'Krunal'], ['Birju', 'Darshan']] },
] as const

/** Round-robin for three pairs: 1v2, 3v1, 2v3 — the order shown in the draw. */
const ROUND_ROBIN: [number, number][] = [
  [0, 1],
  [2, 0],
  [1, 2],
]

const KNOCKOUT_DATE = '2026-09-11'

const KNOCKOUTS: { slot: string; stage: 'quarter' | 'semi' | 'final'; a: GameSource; b: GameSource }[] = [
  { slot: 'QF-1', stage: 'quarter', a: { kind: 'group', group: 'A', position: 1 }, b: { kind: 'group', group: 'D', position: 2 } },
  { slot: 'QF-2', stage: 'quarter', a: { kind: 'group', group: 'D', position: 1 }, b: { kind: 'group', group: 'A', position: 2 } },
  { slot: 'QF-3', stage: 'quarter', a: { kind: 'group', group: 'B', position: 1 }, b: { kind: 'group', group: 'C', position: 2 } },
  { slot: 'QF-4', stage: 'quarter', a: { kind: 'group', group: 'C', position: 1 }, b: { kind: 'group', group: 'B', position: 2 } },
  { slot: 'SF-1', stage: 'semi', a: { kind: 'winner', slot: 'QF-1' }, b: { kind: 'winner', slot: 'QF-2' } },
  { slot: 'SF-2', stage: 'semi', a: { kind: 'winner', slot: 'QF-3' }, b: { kind: 'winner', slot: 'QF-4' } },
  { slot: 'FINAL', stage: 'final', a: { kind: 'winner', slot: 'SF-1' }, b: { kind: 'winner', slot: 'SF-2' } },
]

const utc = (day: string) => new Date(`${day}T00:00:00.000Z`)

async function main() {
  await connectToDatabase()

  // 1. Every player named in the draw must exist.
  const playerIds = new Map<string, mongoose.Types.ObjectId>()
  let created = 0

  for (const [short, full] of Object.entries(ALIASES)) {
    let player = await Player.findOne({ name: full })
    if (!player) {
      player = await Player.create({ name: full, teamId: null, status: 'active' })
      created++
    }
    playerIds.set(short, player._id)
  }
  console.log(`✓ 24 players (${created} created)`)

  // 2. One team per pair, its two members moved onto it.
  const teamIds = new Map<string, mongoose.Types.ObjectId>()

  for (const group of GROUPS) {
    for (const [index, pair] of group.pairs.entries()) {
      const code = `${group.name}${index + 1}`
      const name = `${pair[0]} & ${pair[1]}`

      const team = await Team.findOneAndUpdate(
        { code },
        { name, code, color: group.color, status: 'active' },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )

      teamIds.set(code, team._id)
      await Player.updateMany(
        { _id: { $in: pair.map((p) => playerIds.get(p)!) } },
        { $set: { teamId: team._id } },
      )
    }
  }
  console.log(`✓ 12 pairs`)

  // 3. The tournament and its groups.
  const tournament = await Tournament.findOneAndUpdate(
    { name: TOURNAMENT },
    {
      name: TOURNAMENT,
      description: 'Twelve pairs, four groups of three, top two into the knockouts.',
      startDate: utc('2026-09-07'),
      endDate: utc(KNOCKOUT_DATE),
      status: 'upcoming',
      groups: GROUPS.map((g) => ({
        name: g.name,
        teamIds: g.pairs.map((_, i) => teamIds.get(`${g.name}${i + 1}`)!),
      })),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  console.log(`✓ tournament with ${tournament.groups.length} groups`)

  // 4. Fixtures. A slot is unique within the tournament, so it is the key.
  const upsertGame = async (slot: string, fields: Record<string, unknown>) => {
    const existing = await Game.findOne({ tournamentId: tournament._id, slot })
    if (existing) {
      existing.set(fields)
      await existing.save()
      return
    }
    await Game.create({ ...fields, tournamentId: tournament._id, slot, number: await nextSequence('games') })
  }

  for (const group of GROUPS) {
    for (const [i, [home, away]] of ROUND_ROBIN.entries()) {
      const a = teamIds.get(`${group.name}${home + 1}`)!
      const b = teamIds.get(`${group.name}${away + 1}`)!
      const members = async (teamId: mongoose.Types.ObjectId) =>
        (await Player.find({ teamId }).select('_id').lean()).map((p) => p._id)

      await upsertGame(`${group.name}-${i + 1}`, {
        stage: 'group',
        groupName: group.name,
        format: '2v2',
        teamAId: a,
        teamBId: b,
        gameDate: utc(group.date),
        status: 'scheduled',
        lineup: [
          ...(await members(a)).map((playerId) => ({ playerId, teamId: a, points: 0 })),
          ...(await members(b)).map((playerId) => ({ playerId, teamId: b, points: 0 })),
        ],
      })
    }
  }
  console.log(`✓ 12 group fixtures`)

  for (const tie of KNOCKOUTS) {
    await upsertGame(tie.slot, {
      stage: tie.stage,
      groupName: null,
      format: '2v2',
      teamAId: null,
      teamBId: null,
      teamAFrom: tie.a,
      teamBFrom: tie.b,
      gameDate: utc(KNOCKOUT_DATE),
      status: 'scheduled',
      lineup: [],
    })
  }
  console.log(`✓ 7 knockout ties`)

  await resolveDraw(String(tournament._id))
  await Promise.all([Team.syncIndexes(), Player.syncIndexes(), Game.syncIndexes(), Tournament.syncIndexes()])

  const total = await Game.countDocuments({ tournamentId: tournament._id })
  console.log(`\nDraw complete — ${total} matches.`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
