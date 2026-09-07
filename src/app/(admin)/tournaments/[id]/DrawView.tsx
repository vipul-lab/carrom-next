import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Table, HEAD_ROW } from '@/components/ui/Table'
import { TeamChip } from '@/components/ui/TeamChip'
import { RankBadge } from '@/components/ui/RankBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/format'
import { capitalise, gameStatusVariant, stageLabel, stageVariant } from '@/lib/enums'
import { sourceLabel, type GroupStanding } from '@/lib/services/draw'
import type { GameView } from '@/lib/services/games'

/**
 * One side of a fixture: the pair once it is known, otherwise where it will
 * come from. A knockout tie is real before its teams are — showing "Group A —
 * 1st" is the whole point of the bracket.
 */
function Side({ team, from }: { team: GameView['teamA']; from: GameView['teamAFrom'] }) {
  if (team) return <TeamChip team={team} />
  return <span className="text-sm text-slate-500 italic">{sourceLabel(from)}</span>
}

/** The four group tables, each with the qualifying places marked. */
export function GroupTables({ standings }: { standings: GroupStanding[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {standings.map((group) => (
        <Card key={group.name} padding="p-0">
          <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-900 text-xs font-bold text-white">
                {group.name}
              </span>
              <span className="text-sm font-semibold text-navy-900">Group {group.name}</span>
            </span>
            <Badge variant={group.complete ? 'success' : 'muted'}>
              {group.complete ? 'Final' : 'In progress'}
            </Badge>
          </div>

          <div className="px-4 py-3">
            <Table>
              <thead>
                <tr className={HEAD_ROW}>
                  <th scope="col" className="py-2 pr-2">#</th>
                  <th scope="col" className="px-2 py-2">Pair</th>
                  <th scope="col" className="px-2 py-2 text-center">P</th>
                  <th scope="col" className="px-2 py-2 text-center">W</th>
                  <th scope="col" className="py-2 pl-2 text-center">L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {group.rows.map((row) => (
                  <tr
                    key={row.team.id}
                    // Top two go through, so they are the rows that matter.
                    className={row.position <= 2 ? 'bg-green-50/40' : ''}
                  >
                    <td className="py-2.5 pr-2">
                      <RankBadge rank={row.position} />
                    </td>
                    <td className="px-2 py-2.5">
                      <TeamChip team={row.team} />
                    </td>
                    <td className="px-2 py-2.5 text-center text-sm text-slate-600">{row.played}</td>
                    <td className="px-2 py-2.5 text-center text-sm font-semibold text-green-600">
                      {row.won}
                    </td>
                    <td className="py-2.5 pl-2 text-center text-sm font-semibold text-red-500">
                      {row.lost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      ))}
    </div>
  )
}

/** Group fixtures, grouped by their group letter and shown in draw order. */
export function GroupFixtures({ games }: { games: GameView[] }) {
  const letters = [...new Set(games.map((g) => g.groupName).filter(Boolean))].sort() as string[]

  if (!letters.length) {
    return (
      <Card>
        <EmptyState icon="board" title="No group fixtures" description="This draw has no group games." />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {letters.map((letter) => {
        const fixtures = games
          .filter((g) => g.groupName === letter)
          .sort((a, b) => (a.slot ?? '').localeCompare(b.slot ?? ''))

        return (
          <Card
            key={letter}
            padding="p-0"
            title={`Group ${letter}`}
            subtitle={fixtures[0] ? formatDate(fixtures[0].gameDate) : undefined}
          >
            <div className="divide-y divide-navy-50">
              {fixtures.map((game) => (
                <div key={game.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Link
                    href={`/games/${game.id}`}
                    className="w-14 shrink-0 font-mono text-xs font-semibold text-blue-600 hover:underline"
                  >
                    {game.slot}
                  </Link>
                  <div className="min-w-0 flex-1"><Side team={game.teamA} from={game.teamAFrom} /></div>
                  <span className="text-xs font-semibold tracking-wide text-slate-400">VS</span>
                  <div className="min-w-0 flex-1"><Side team={game.teamB} from={game.teamBFrom} /></div>
                  {game.status === 'completed' && game.winner ? (
                    <Badge variant="gold" icon="trophy">{game.winner.name}</Badge>
                  ) : (
                    <Badge variant={gameStatusVariant(game.status)}>{capitalise(game.status)}</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

const ROUND_ORDER = ['quarter', 'semi', 'final'] as const

/** Quarters, semis and the final, in the order they are played. */
export function KnockoutBracket({ games }: { games: GameView[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {ROUND_ORDER.map((stage) => {
        const ties = games
          .filter((g) => g.stage === stage)
          .sort((a, b) => (a.slot ?? '').localeCompare(b.slot ?? ''))

        if (!ties.length) return null

        return (
          <Card key={stage} padding="p-0" title={stageLabel(stage)}>
            <div className="divide-y divide-navy-50">
              {ties.map((tie) => (
                <div key={tie.id} className="px-5 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Link
                      href={`/games/${tie.id}`}
                      className="font-mono text-xs font-semibold text-blue-600 hover:underline"
                    >
                      {tie.slot}
                    </Link>
                    <Badge variant={stageVariant(tie.stage)}>{stageLabel(tie.stage)}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    <Side team={tie.teamA} from={tie.teamAFrom} />
                    <div className="text-[11px] font-semibold tracking-wide text-slate-400">VS</div>
                    <Side team={tie.teamB} from={tie.teamBFrom} />
                  </div>
                  {tie.status === 'completed' && tie.winner && (
                    <div className="mt-2">
                      <Badge variant="gold" icon="trophy">{tie.winner.name}</Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
