import 'server-only'
import { Player } from '@/lib/models/Player'
import { Team } from '@/lib/models/Team'
import { selectableTournaments } from '@/lib/services/tournaments'
import type {
  RosterPlayer,
  TeamOption,
  TournamentOption,
} from '@/components/games/LineupPicker'

/**
 * The two lists the line-up picker needs: the teams that can actually field a
 * side, and every active member grouped by team.
 */
export async function loadGameFormData(): Promise<{
  teams: TeamOption[]
  rosters: Record<string, RosterPlayer[]>
  tournaments: TournamentOption[]
}> {
  const [teams, players, tournaments] = await Promise.all([
    Team.find({ status: 'active' }).sort({ name: 1 }).select('name').lean(),
    Player.find({ status: 'active', teamId: { $ne: null } })
      .sort({ name: 1 })
      .select('name photo teamId')
      .lean(),
    selectableTournaments(),
  ])

  const rosters: Record<string, RosterPlayer[]> = {}

  for (const player of players) {
    const key = String(player.teamId)
    ;(rosters[key] ??= []).push({
      id: String(player._id),
      name: player.name,
      photo: player.photo ?? null,
    })
  }

  return {
    teams: teams.map((team) => ({ id: String(team._id), name: team.name })),
    rosters,
    tournaments,
  }
}
