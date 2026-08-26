import type { Metadata } from 'next'
import { connectToDatabase } from '@/lib/db'
import { Game } from '@/lib/models/Game'
import { Player } from '@/lib/models/Player'
import { Team } from '@/lib/models/Team'
import { numberFormat } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

const RULES = [
  'Each player is marked as a win (1) or a loss (0) for the game.',
  'Partners win or lose together — a side is marked as a whole.',
  'Exactly one team wins every game; there are no draws.',
  'A 1 vs 1 win counts the same as a 2 vs 2 win.',
  '1 vs 1 needs exactly 1 player a side; 2 vs 2 needs exactly 2.',
  'Only active members of the selected team can be picked.',
  'Rankings are recalculated from game data on every page load — deleting a game removes its result everywhere.',
]

export default async function SettingsPage() {
  await connectToDatabase()

  const [teams, players, games, appearances] = await Promise.all([
    Team.countDocuments({}),
    Player.countDocuments({}),
    Game.countDocuments({}),
    Game.aggregate([{ $unwind: '$lineup' }, { $count: 'total' }]),
  ])

  const rows: [string, string][] = [
    ['Teams', numberFormat(teams)],
    ['Team members', numberFormat(players)],
    ['Games', numberFormat(games)],
    ['Player appearances', numberFormat(appearances[0]?.total ?? 0)],
    ['Runtime', `Node ${process.version}`],
    ['Database', 'MongoDB'],
    ['Environment', process.env.NODE_ENV],
  ]

  return (
    <>
      <PageHeader title="Settings" subtitle="A snapshot of the system and how scoring works" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="System">
          <dl className="divide-y divide-navy-50 text-sm">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
              >
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-semibold text-navy-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Scoring rules" subtitle="How the system calculates results">
          <ul className="space-y-3 text-sm text-slate-600">
            {RULES.map((rule) => (
              <li key={rule} className="flex gap-2">
                <Icon name="check-circle" className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
