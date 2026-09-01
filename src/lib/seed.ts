/**
 * Seeds the database with a believable demo season:
 * 4 teams · 24 members (2 deliberately inactive) · 36 games across 1v1 and 2v2,
 * spread over the last ~10 weeks, with the 3 most recent left unplayed.
 *
 * Every game is created and scored through the same service the UI uses,
 * so the seeded data goes through exactly the same rules — team results and
 * winners are derived, never invented.
 *
 * Invoked by `npm run seed` (scripts/seed.ts) and by the verification harness.
 */

import { Team } from './models/Team'
import { Player } from './models/Player'
import { Game } from './models/Game'
import { Tournament } from './models/Tournament'
import { Counter } from './models/Counter'
import { createGame, recordScores } from './services/game-score'
import { GAME_FORMATS, playersPerTeam, type GameFormat } from './enums'

const TEAMS = [
  {
    name: 'Striker Falcons',
    code: 'FAL',
    color: '#2563eb',
    description:
      'Aggressive front-line strikers who open the board fast and rarely leave a second chance.',
  },
  {
    name: 'Queen Chasers',
    code: 'QCH',
    color: '#16a34a',
    description:
      'Patient board readers built around covering the queen and grinding out long boards.',
  },
  {
    name: 'Board Warriors',
    code: 'BWR',
    color: '#9333ea',
    description: 'The most experienced roster in the league — defensive play and clinical rebounds.',
  },
  {
    name: 'Pocket Rockets',
    code: 'PKR',
    color: '#f59e0b',
    description: 'Young, fast and fearless. Known for high-scoring boards and streaky finishes.',
  },
]

const ROSTERS: Record<string, string[]> = {
  FAL: ['Arjun Mehta', 'Rohit Sharma', 'Kavya Nair', 'Imran Sheikh', 'Deepak Rao', 'Sneha Patil'],
  QCH: ['Priya Iyer', 'Vikram Desai', 'Ananya Bose', 'Suresh Kumar', 'Meera Joshi', 'Farhan Qureshi'],
  BWR: ['Rajesh Pillai', 'Nisha Verma', 'Aditya Kulkarni', 'Zoya Khan', 'Manoj Gupta', 'Ritika Shah'],
  PKR: ['Karthik Menon', 'Sana Ahmed', 'Yash Chauhan', 'Divya Reddy', 'Naveen Thomas', 'Pooja Bhatt'],
}

/** Two members sit out the league entirely, to exercise the status filter. */
const INACTIVE = ['Sneha Patil', 'Pooja Bhatt']

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '.')
}

/** A deterministic shuffle so re-seeding produces the same league. */
function pick<T>(items: T[], count: number, offset: number): T[] {
  const rotated = [...items.slice(offset % items.length), ...items.slice(0, offset % items.length)]
  return rotated.slice(0, count)
}

function daysAgo(days: number): string {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

async function seedTeams() {
  for (const team of TEAMS) {
    await Team.findOneAndUpdate(
      { code: team.code },
      { ...team, status: 'active', logo: null },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  }

  console.log(`✓ ${TEAMS.length} teams`)
}

async function seedPlayers() {
  let counter = 90000

  for (const [code, names] of Object.entries(ROSTERS)) {
    const team = await Team.findOne({ code })
    if (!team) continue

    for (const name of names) {
      counter++

      await Player.findOneAndUpdate(
        { name },
        {
          name,
          teamId: team._id,
          mobile: `+91 ${String(counter).slice(0, 5)} ${String(counter % 100000).padStart(5, '0')}`,
          email: `${slug(name)}@carrom.test`,
          photo: null,
          status: INACTIVE.includes(name) ? 'inactive' : 'active',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    }
  }

  const total = Object.values(ROSTERS).flat().length
  console.log(`✓ ${total} members (${INACTIVE.length} inactive)`)
}

/**
 * Two tournaments plus a run of friendlies, so the scope filters have something
 * to separate. Games created outside a tournament stay friendlies.
 */
async function seedTournaments() {
  await Tournament.deleteMany({})

  const created = await Tournament.create([
    {
      name: 'Spring Championship',
      description: 'The opening competition of the season.',
      startDate: new Date(`${daysAgo(80)}T00:00:00.000Z`),
      endDate: new Date(`${daysAgo(40)}T00:00:00.000Z`),
      status: 'completed',
    },
    {
      name: 'Club Masters Cup',
      description: 'Ongoing knockout running alongside the league.',
      startDate: new Date(`${daysAgo(35)}T00:00:00.000Z`),
      endDate: null,
      status: 'active',
    },
  ])

  console.log(`✓ ${created.length} tournaments`)
  return created
}

async function seedGames() {
  // Start from a clean slate so re-seeding does not stack up fixtures.
  await Game.deleteMany({})
  await Counter.findByIdAndUpdate('games', { seq: 0 }, { upsert: true })

  // The biggest format sets the bar for who can be scheduled at all.
  const largestSquad = Math.max(...GAME_FORMATS.map(playersPerTeam))

  const tournaments = await Tournament.find({}).sort({ startDate: 1 }).lean()
  const teams = await Team.find({ status: 'active' }).sort({ _id: 1 }).lean()

  const squads = await Promise.all(
    teams.map(async (team) => ({
      team,
      players: await Player.find({ teamId: team._id, status: 'active' }).sort({ _id: 1 }).lean(),
    })),
  )

  const eligible = squads.filter((s) => s.players.length >= largestSquad)

  if (eligible.length < 2) {
    console.warn(`! Not enough teams with ${largestSquad} active members — skipping game seeding.`)
    return
  }

  // A double round-robin, repeated so every pairing is played several times.
  const fixtures: { a: (typeof eligible)[number]; b: (typeof eligible)[number] }[] = []

  for (let round = 1; round <= 3; round++) {
    for (let i = 0; i < eligible.length; i++) {
      for (let j = 0; j < eligible.length; j++) {
        if (i === j) continue

        // Alternate home/away so neither side is always Team A.
        fixtures.push(
          round % 2 === 0
            ? { a: eligible[j], b: eligible[i] }
            : { a: eligible[i], b: eligible[j] },
        )
      }
    }
  }

  let created = 0
  let completed = 0
  let friendlies = 0

  for (const [index, fixture] of fixtures.entries()) {
    // Roughly one singles board for every two doubles boards.
    const format: GameFormat = index % 3 === 2 ? '1v1' : '2v2'
    const perTeam = playersPerTeam(format)

    const lineupA = pick(fixture.a.players, perTeam, index)
    const lineupB = pick(fixture.b.players, perTeam, index + 1)

    if (lineupA.length < perTeam || lineupB.length < perTeam) continue

    // Two in every five fixtures are friendlies; the rest alternate between the
    // two tournaments, so every scope filter has data behind it.
    const isFriendly = index % 5 >= 3
    const tournament = isFriendly ? null : tournaments[index % 2]
    if (isFriendly) friendlies++

    const game = await createGame({
      format,
      tournamentId: tournament ? String(tournament._id) : null,
      teamAId: String(fixture.a.team._id),
      teamBId: String(fixture.b.team._id),
      gameDate: daysAgo(70 - index * 2),
      teamAPlayers: lineupA.map((p) => String(p._id)),
      teamBPlayers: lineupB.map((p) => String(p._id)),
    })

    created++

    // The three most recent fixtures stay unplayed so the dashboard shows
    // upcoming games alongside finished ones.
    if (index >= fixtures.length - 3) continue

    // Alternate the winning side so neither team runs away with the league.
    const teamAWins = (index * 7 + (index % 5)) % 2 === 0

    const points: Record<string, number> = {}
    lineupA.forEach((p) => (points[String(p._id)] = teamAWins ? 1 : 0))
    lineupB.forEach((p) => (points[String(p._id)] = teamAWins ? 0 : 1))

    await recordScores(String(game._id), points)
    completed++
  }

  console.log(
    `✓ ${created} games (${completed} completed, ${friendlies} friendlies, ${created - friendlies} in tournaments)`,
  )
}

/** Runs every seeder in order. The caller owns the database connection. */
export async function seedAll(): Promise<void> {
  await seedTeams()
  await seedPlayers()
  await seedTournaments()
  await seedGames()

  // Index definitions only reach the server when they are explicitly synced.
  await Promise.all([
    Team.syncIndexes(),
    Player.syncIndexes(),
    Game.syncIndexes(),
    Tournament.syncIndexes(),
  ])
}
