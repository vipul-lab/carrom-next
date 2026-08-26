import { Icon } from './Icon'

const STYLES: Record<number, string> = {
  1: 'bg-gradient-to-br from-gold-300 to-gold-500 text-white shadow-sm ring-gold-500/30',
  2: 'bg-gradient-to-br from-slate-200 to-slate-400 text-white shadow-sm ring-slate-400/30',
  3: 'bg-gradient-to-br from-orange-300 to-orange-500 text-white shadow-sm ring-orange-500/30',
}

export function RankBadge({ rank, className = '' }: { rank: number; className?: string }) {
  const style = STYLES[rank] ?? 'bg-navy-100 text-navy-600 ring-navy-500/10'

  return (
    <span
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold ring-1 ring-inset ${style} ${className}`}
    >
      {rank <= 3 && <Icon name="trophy" className="mr-0.5 h-3 w-3" />}
      {rank}
    </span>
  )
}

/** The subtle gradient stripe the top three ladder rows get. */
export function podiumClass(rank: number): string {
  return rank === 1 ? 'podium-gold' : rank === 2 ? 'podium-silver' : rank === 3 ? 'podium-bronze' : ''
}
