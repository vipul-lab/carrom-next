/**
 * End-to-end verification against a real MongoDB instance.
 *
 * Boots an ephemeral mongod, seeds the demo league through the same services
 * the UI uses, then asserts the derived statistics and every business rule.
 * Run with: npx tsx scripts/verify.ts
 */

import { MongoMemoryServer } from 'mongodb-memory-server-core'

let failures = 0
let checks = 0

function check(label: string, condition: boolean, detail?: unknown) {
  checks++
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.log(`  ✗ ${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ''}`)
  }
}

async function main() {
  const mongod = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongod.getUri('carrom_test')
  process.env.AUTH_SECRET = 'test-secret-value-that-is-long-enough'
  process.env.ADMIN_EMAIL = 'admin@carrom.test'
  process.env.ADMIN_PASSWORD = 'seed-password-123'
  process.env.ADMIN_NAME = 'Tournament Admin'

  console.log(`mongod up at ${process.env.MONGODB_URI}\n`)

  const mongoose = (await import('mongoose')).default
  const { connectToDatabase } = await import('../src/lib/db')
  const { Team } = await import('../src/lib/models/Team')
  const { Player } = await import('../src/lib/models/Player')
  const { Game } = await import('../src/lib/models/Game')
  const { User } = await import('../src/lib/models/User')
  const { createGame, recordScores, reopenGame, deleteGame, updateGame } = await import(
    '../src/lib/services/game-score'
  )
  const stats = await import('../src/lib/services/stats')
  const games = await import('../src/lib/services/games')
  const { getDashboardData } = await import('../src/lib/services/dashboard')
  const { buildReport, playerExportRows, toCsv } = await import('../src/lib/services/reports')
  const { getNotifications } = await import('../src/lib/services/notifications')
  const { ALL_TIME, periodFromKey } = await import('../src/lib/stats-period')
  const { verifyPassword } = await import('../src/lib/password')

  await connectToDatabase()

  // ---- Seed -------------------------------------------------------------
  console.log('Seeding…')
  const { seedAll } = await import('../src/lib/seed')
  await seedAll()

  console.log('\nSeeded data')
  const teamCount = await Team.countDocuments({})
  const playerCount = await Player.countDocuments({})
  const inactiveCount = await Player.countDocuments({ status: 'inactive' })
  const gameCount = await Game.countDocuments({})
  const completedCount = await Game.countDocuments({ status: 'completed' })
  const scheduledCount = await Game.countDocuments({ status: 'scheduled' })

  check('4 teams', teamCount === 4, teamCount)
  check('24 members', playerCount === 24, playerCount)
  check('2 inactive members', inactiveCount === 2, inactiveCount)
  check('36 games', gameCount === 36, gameCount)
  check('33 completed', completedCount === 33, completedCount)
  check('3 scheduled', scheduledCount === 3, scheduledCount)

  // ---- Admin account ----------------------------------------------------
  console.log('\nAdmin account')
  const admin = await User.findOne({ email: 'admin@carrom.test' })
  check('admin exists', !!admin)
  check(
    'password verifies',
    !!admin && (await verifyPassword('seed-password-123', admin.password)),
  )
  check(
    'wrong password rejected',
    !!admin && !(await verifyPassword('not-the-password', admin.password)),
  )

  // ---- Core scoring invariants -----------------------------------------
  console.log('\nScoring invariants')
  const allCompleted = await Game.find({ status: 'completed' }).lean()

  check(
    'every completed game has exactly one winner',
    allCompleted.every((g) => g.winnerTeamId !== null),
  )
  check(
    'team scores are always 1–0',
    allCompleted.every((g) => g.teamAScore + g.teamBScore === 1),
  )
  check(
    'the winning side scored 1',
    allCompleted.every((g) =>
      String(g.winnerTeamId) === String(g.teamAId) ? g.teamAScore === 1 : g.teamBScore === 1,
    ),
  )
  check(
    'partners always share a result',
    allCompleted.every((g) => {
      const a = g.lineup.filter((l) => String(l.teamId) === String(g.teamAId))
      const b = g.lineup.filter((l) => String(l.teamId) === String(g.teamBId))
      return new Set(a.map((l) => l.points)).size === 1 && new Set(b.map((l) => l.points)).size === 1
    }),
  )
  check(
    'a 1v1 win scores the same as a 2v2 win',
    allCompleted
      .filter((g) => g.format === '1v1')
      .every((g) => g.teamAScore + g.teamBScore === 1),
  )
  check(
    'no player appears twice in a game',
    allCompleted.every((g) => new Set(g.lineup.map((l) => String(l.playerId))).size === g.lineup.length),
  )
  check(
    'scheduled games have no winner',
    (await Game.find({ status: 'scheduled' }).lean()).every(
      (g) => g.winnerTeamId === null && g.teamAScore === 0 && g.teamBScore === 0,
    ),
  )
  check(
    'lineup size matches the format',
    allCompleted.every((g) => g.lineup.length === (g.format === '1v1' ? 2 : 4)),
  )

  // ---- Derived player statistics ---------------------------------------
  console.log('\nDerived player statistics')
  const players = await stats.listPlayers(ALL_TIME)
  check('every member is listed', players.length === 24, players.length)

  // Cross-check the aggregation against a hand count from the raw documents.
  const sample = players.find((p) => p.gamesCount > 0)!
  const manual = allCompleted.filter((g) =>
    g.lineup.some((l) => String(l.playerId) === sample.id),
  )
  const manualWins = manual.filter((g) => {
    const entry = g.lineup.find((l) => String(l.playerId) === sample.id)!
    return String(g.winnerTeamId) === String(entry.teamId)
  }).length

  check(
    `games count matches a manual count for ${sample.name}`,
    sample.gamesCount === manual.length,
    { aggregate: sample.gamesCount, manual: manual.length },
  )
  check(
    `wins count matches a manual count for ${sample.name}`,
    sample.winsCount === manualWins,
    { aggregate: sample.winsCount, manual: manualWins },
  )
  check(
    'wins + losses = games for every member',
    players.every((p) => p.winsCount + p.lossesCount === p.gamesCount),
  )
  check(
    'total points equals wins (1 point per win)',
    players.every((p) => p.totalPoints === p.winsCount),
  )
  check(
    'win rate is consistent',
    players.every(
      (p) =>
        p.gamesCount === 0 ||
        Math.abs(p.winRate - Math.round((p.winsCount / p.gamesCount) * 1000) / 10) < 0.11,
    ),
  )
  check(
    'inactive members played no games',
    players.filter((p) => p.status === 'inactive').every((p) => p.gamesCount === 0),
  )
  check(
    'the ladder is sorted by wins descending',
    players.every((p, i) => i === 0 || players[i - 1].winsCount >= p.winsCount),
  )

  const totalPlayerWins = players.reduce((sum, p) => sum + p.winsCount, 0)
  const expectedPlayerWins = allCompleted.reduce(
    (sum, g) => sum + g.lineup.filter((l) => String(l.teamId) === String(g.winnerTeamId)).length,
    0,
  )
  check(
    'total member wins reconcile with the games',
    totalPlayerWins === expectedPlayerWins,
    { players: totalPlayerWins, games: expectedPlayerWins },
  )

  // ---- Derived team statistics -----------------------------------------
  console.log('\nDerived team statistics')
  const teams = await stats.listTeams(ALL_TIME)
  check('4 teams ranked', teams.length === 4, teams.length)
  check(
    'wins + losses = games for every team',
    teams.every((t) => t.winsCount + t.lossesCount === t.gamesCount),
  )
  check(
    'team points equal team wins',
    teams.every((t) => t.totalPoints === t.winsCount),
  )
  check(
    'every team has 6 members, 5 or 6 active',
    teams.every((t) => t.playersCount === 6 && t.activePlayersCount >= 5),
  )
  check(
    'total team wins equal the completed game count',
    teams.reduce((s, t) => s + t.winsCount, 0) === completedCount,
    teams.reduce((s, t) => s + t.winsCount, 0),
  )
  check(
    'total team games = 2 × completed games',
    teams.reduce((s, t) => s + t.gamesCount, 0) === completedCount * 2,
  )

  // ---- Filtering, sorting, paging --------------------------------------
  console.log('\nFiltering, sorting and paging')
  const page1 = await stats.paginatePlayers(ALL_TIME, {}, 1, 10)
  const page2 = await stats.paginatePlayers(ALL_TIME, {}, 2, 10)
  check('page 1 holds 10 rows', page1.items.length === 10, page1.items.length)
  check('total is 24', page1.total === 24, page1.total)
  check('3 pages', page1.lastPage === 3, page1.lastPage)
  check('firstItem numbers the ladder', page2.firstItem === 11, page2.firstItem)
  check(
    'pages do not overlap',
    !page1.items.some((p) => page2.items.some((q) => q.id === p.id)),
  )

  const searched = await stats.listPlayers(ALL_TIME, { search: 'Arjun' })
  check('search finds Arjun Mehta', searched.length === 1 && searched[0].name === 'Arjun Mehta')

  const regexSafe = await stats.listPlayers(ALL_TIME, { search: 'a.*z' })
  check('a regex-looking term is escaped, not executed', regexSafe.length === 0, regexSafe.length)

  const activeOnly = await stats.listPlayers(ALL_TIME, { status: 'active' })
  check('status filter works', activeOnly.length === 22, activeOnly.length)

  const falcons = await Team.findOne({ code: 'FAL' })
  const byTeam = await stats.listPlayers(ALL_TIME, { teamId: String(falcons!._id) })
  check('team filter works', byTeam.length === 6, byTeam.length)

  const byName = await stats.listPlayers(ALL_TIME, { sort: 'name' })
  check(
    'name sort is alphabetical',
    byName.every((p, i) => i === 0 || byName[i - 1].name.localeCompare(p.name) <= 0),
  )

  const byWinRate = await stats.listPlayers(ALL_TIME, { sort: 'win_rate' })
  check(
    'win-rate sort is descending',
    byWinRate.every((p, i) => i === 0 || byWinRate[i - 1].winRate >= p.winRate),
  )

  const rank = await stats.playerRank(players[0].id, ALL_TIME)
  check('the top player ranks #1', rank === 1, rank)

  // ---- Period windows ---------------------------------------------------
  console.log('\nPeriod windows')
  const weekly = await stats.listPlayers(periodFromKey('week'))
  const yearly = await stats.listPlayers(periodFromKey('year'))
  const weekGames = weekly.reduce((s, p) => s + p.gamesCount, 0)
  const yearGames = yearly.reduce((s, p) => s + p.gamesCount, 0)
  const allGames = players.reduce((s, p) => s + p.gamesCount, 0)

  check('the week window is a subset of all time', weekGames <= allGames, { weekGames, allGames })
  check('the year window is a subset of all time', yearGames <= allGames, { yearGames, allGames })
  check('the week window is within the year window', weekGames <= yearGames)

  // ---- Game queries -----------------------------------------------------
  console.log('\nGame queries')
  const gamePage = await games.paginateGames({}, 1, 12)
  check('12 games a page', gamePage.items.length === 12, gamePage.items.length)
  check('36 games total', gamePage.total === 36, gamePage.total)
  check(
    'both teams are resolved on every row',
    gamePage.items.every((g) => g.teamA !== null && g.teamB !== null),
  )
  check(
    'games are newest first',
    gamePage.items.every((g, i) => i === 0 || gamePage.items[i - 1].gameDate >= g.gameDate),
  )
  check('labels are formatted', /^#GM-\d{4}$/.test(gamePage.items[0].label), gamePage.items[0].label)

  const byFormat = await games.listGames({ format: '1v1' })
  check('format filter works', byFormat.every((g) => g.format === '1v1') && byFormat.length > 0)

  const byTeamGames = await games.listGames({ teamId: String(falcons!._id) })
  check(
    'team filter matches either side',
    byTeamGames.every(
      (g) => g.teamA?.id === String(falcons!._id) || g.teamB?.id === String(falcons!._id),
    ) && byTeamGames.length > 0,
  )

  const arjun = searched[0]
  const byPlayerGames = await games.listGames({ playerId: arjun.id })
  check(
    'player filter matches the line-up',
    byPlayerGames.every((g) => g.lineup.some((l) => l.playerId === arjun.id)) &&
      byPlayerGames.length > 0,
  )

  const numberSearch = await games.listGames({ search: '1' })
  check('a numeric search finds a game by number', numberSearch.length > 0, numberSearch.length)

  const teamSearch = await games.listGames({ search: 'Falcons' })
  check('a text search finds games by team name', teamSearch.length > 0, teamSearch.length)

  const detail = await games.findGame(gamePage.items[0].id)
  check('findGame resolves the line-up members', !!detail && detail.lineup.every((l) => l.player !== null))

  const dateFiltered = await games.listGames({ from: '2000-01-01', to: '2000-01-02' })
  check('a date range outside the season is empty', dateFiltered.length === 0, dateFiltered.length)

  // ---- Dashboard, reports, notifications --------------------------------
  console.log('\nDashboard, reports and notifications')
  const dashboard = await getDashboardData(ALL_TIME)
  check('headline counts match', dashboard.stats.totalGames === 36 && dashboard.stats.totalPlayers === 24)
  check('completed count matches', dashboard.stats.completedGames === completedCount)
  check('total points = completed games', dashboard.stats.totalPoints === completedCount)
  check('a top player is chosen', dashboard.stats.topPlayer !== null)
  check('a top team is chosen', dashboard.stats.topTeam !== null)
  check('8 recent games', dashboard.recentGames.length === 8, dashboard.recentGames.length)
  check(
    'chart series line up',
    dashboard.charts.pointsByPlayer.labels.length === dashboard.charts.pointsByPlayer.values.length &&
      dashboard.charts.winsLosses.labels.length === dashboard.charts.winsLosses.wins.length,
  )
  check('the time series has data', dashboard.charts.gamesOverTime.labels.length > 0)

  const report = await buildReport(ALL_TIME)
  check('report game count matches', report.summary.totalGames === completedCount)
  check(
    'format split adds up',
    report.summary.oneVsOne + report.summary.twoVsTwo === completedCount,
    { one: report.summary.oneVsOne, two: report.summary.twoVsTwo },
  )
  check('one result per completed game', report.summary.decisiveGames === completedCount)
  check('3 games still to play', report.summary.scheduledGames === 3)
  check('22 players involved', report.summary.playersInvolved === 22, report.summary.playersInvolved)
  check('highlights are populated', !!report.mostWinsPlayer && !!report.bestWinRatePlayer)
  check(
    'best win rate needs 3+ games',
    !report.bestWinRatePlayer || report.bestWinRatePlayer.gamesCount >= 3,
  )
  check(
    'match days sum to the completed games',
    report.gamesByDate.reduce((s, r) => s + r.games, 0) === completedCount,
  )

  const csv = toCsv(await playerExportRows(ALL_TIME))
  check('CSV has a header plus 24 rows', csv.split('\r\n').length === 25, csv.split('\r\n').length)
  check('CSV quotes its fields', csv.startsWith('"Rank","Player"'))

  const notes = await getNotifications()
  check('notifications are derived', Array.isArray(notes))
  check(
    'past scheduled games are flagged',
    notes.some((n) => n.title.includes('needs a score')),
    notes.map((n) => n.title),
  )

  // ---- Write path: score, reopen, edit, delete --------------------------
  console.log('\nWrite path')
  const scheduled = await Game.findOne({ status: 'scheduled' }).lean()
  const target = scheduled!
  const sideA = target.lineup.filter((l) => String(l.teamId) === String(target.teamAId))
  const sideB = target.lineup.filter((l) => String(l.teamId) === String(target.teamBId))

  const marks: Record<string, number> = {}
  sideA.forEach((l) => (marks[String(l.playerId)] = 1))
  sideB.forEach((l) => (marks[String(l.playerId)] = 0))

  const scored = await recordScores(String(target._id), marks)
  check('recording a result completes the game', scored!.status === 'completed')
  check('team A is the winner', String(scored!.winnerTeamId) === String(target.teamAId))
  check('the score is 1–0', scored!.teamAScore === 1 && scored!.teamBScore === 0)

  const afterScore = await stats.listTeams(ALL_TIME)
  check(
    'the ranking picked the new result up',
    afterScore.reduce((s, t) => s + t.winsCount, 0) === completedCount + 1,
  )

  const reopened = await reopenGame(String(target._id))
  check('reopening clears the winner', reopened!.winnerTeamId === null)
  // Reopening preserves the recorded marks so they can be corrected, exactly as
  // the Laravel service did — only the winner is withdrawn, and the game drops
  // out of every ranking because those count completed games only.
  check(
    'reopening keeps the marks for correction',
    reopened!.lineup.some((l) => l.points === 1),
  )
  check('reopening leaves the game out of the rankings', reopened!.status === 'scheduled')
  check(
    'reopening rolls the ranking back',
    (await stats.listTeams(ALL_TIME)).reduce((s, t) => s + t.winsCount, 0) === completedCount,
  )

  // Line-up edits preserve the marks of players who stay.
  await recordScores(String(target._id), marks)
  const swapped = await Player.findOne({
    teamId: target.teamAId,
    status: 'active',
    _id: { $nin: sideA.map((l) => l.playerId) },
  }).lean()

  if (swapped && target.format === '2v2') {
    const kept = String(sideA[0].playerId)
    const edited = await updateGame(String(target._id), {
      format: target.format,
      teamAId: String(target.teamAId),
      teamBId: String(target.teamBId),
      gameDate: target.gameDate.toISOString().slice(0, 10),
      status: 'completed',
      teamAPlayers: [kept, String(swapped._id)],
      teamBPlayers: sideB.map((l) => String(l.playerId)),
    })

    const keptEntry = edited!.lineup.find((l) => String(l.playerId) === kept)
    const newEntry = edited!.lineup.find((l) => String(l.playerId) === String(swapped._id))

    check('a retained player keeps their mark', keptEntry?.points === 1, keptEntry?.points)
    check('a swapped-in player starts at 0', newEntry?.points === 0, newEntry?.points)
    check('the winner is still resolved', edited!.winnerTeamId !== null)
  }

  const beforeDelete = (await stats.listTeams(ALL_TIME)).reduce((s, t) => s + t.gamesCount, 0)
  await deleteGame(String(target._id))
  const afterDelete = (await stats.listTeams(ALL_TIME)).reduce((s, t) => s + t.gamesCount, 0)

  check('deleting a game removes it from the rankings', afterDelete === beforeDelete - 2, {
    before: beforeDelete,
    after: afterDelete,
  })
  check('the game is gone', (await Game.findById(target._id)) === null)

  // ---- Delete guards ----------------------------------------------------
  console.log('\nDelete guards')
  const { teamGameCount, playerAppearanceCount } = await import('../src/lib/services/deletion')

  const playedTeam = await Team.findOne({ code: 'FAL' })
  const playedCount = await teamGameCount(String(playedTeam!._id))
  check('a team that has played reports its games', playedCount > 0, playedCount)

  const freshTeam = await Team.create({
    name: 'Corner Kings',
    code: 'CRK',
    color: '#0ea5e9',
    status: 'active',
  })
  check('a team with no games reports 0', (await teamGameCount(String(freshTeam._id))) === 0)

  const playedPlayer = await Player.findOne({ name: 'Arjun Mehta' })
  const appearanceCount = await playerAppearanceCount(String(playedPlayer!._id))
  check('a member who has played reports appearances', appearanceCount > 0, appearanceCount)

  const benched = await Player.findOne({ name: 'Sneha Patil' })
  check(
    'an inactive member who never played reports 0',
    (await playerAppearanceCount(String(benched!._id))) === 0,
  )
  check('an invalid id reports 0', (await teamGameCount('not-an-id')) === 0)

  await freshTeam.deleteOne()

  // ---- Sequential numbering --------------------------------------------
  console.log('\nGame numbering')
  const teamsForNew = await Team.find({ status: 'active' }).limit(2).lean()
  const rosterA = await Player.find({ teamId: teamsForNew[0]._id, status: 'active' }).limit(1).lean()
  const rosterB = await Player.find({ teamId: teamsForNew[1]._id, status: 'active' }).limit(1).lean()

  const created = await Promise.all(
    [0, 1, 2].map((i) =>
      createGame({
        format: '1v1',
        teamAId: String(teamsForNew[0]._id),
        teamBId: String(teamsForNew[1]._id),
        gameDate: `2025-0${i + 1}-15`,
        teamAPlayers: [String(rosterA[0]._id)],
        teamBPlayers: [String(rosterB[0]._id)],
      }),
    ),
  )

  const numbers = created.map((g) => g.number)
  check('concurrent creates get distinct numbers', new Set(numbers).size === 3, numbers)

  console.log(`\n${checks - failures}/${checks} checks passed`)

  await mongoose.disconnect()
  await mongod.stop()

  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (error) => {
  console.error('\nVerification crashed:', error)
  process.exit(1)
})
