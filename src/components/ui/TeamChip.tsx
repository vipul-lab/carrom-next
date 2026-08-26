import Link from 'next/link'
import { Avatar, type AvatarSize } from './Avatar'
import { teamInitials } from '@/lib/format'
import type { TeamRef } from '@/lib/services/stats'

export function TeamChip({
  team,
  link = true,
  size = 'sm',
  className = '',
}: {
  team: TeamRef | null | undefined
  link?: boolean
  size?: AvatarSize
  className?: string
}) {
  if (!team) {
    return <span className="text-sm text-slate-400 italic">Unassigned</span>
  }

  const inner = (
    <>
      <Avatar src={team.logo} initials={teamInitials(team.code, team.name)} color={team.color} size={size} />
      <span className="truncate text-sm font-medium text-navy-900">{team.name}</span>
    </>
  )

  const classes = `inline-flex max-w-full items-center gap-2 ${link ? 'transition hover:opacity-80' : ''} ${className}`

  return link ? (
    <Link href={`/teams/${team.id}`} className={classes}>
      {inner}
    </Link>
  ) : (
    <span className={classes}>{inner}</span>
  )
}
