import 'server-only'
import { Types } from 'mongoose'
import { Game } from '../models/Game'

/**
 * Delete guards.
 *
 * Deletes are deliberately asymmetric: a game can be deleted (its result goes
 * with it), but a team or member that appears in a recorded game cannot — that
 * would rewrite match history. The UI offers "set to inactive" instead.
 */

/** How many games this team has taken part in, on either side of the board. */
export async function teamGameCount(teamId: string): Promise<number> {
  if (!Types.ObjectId.isValid(teamId)) return 0

  const id = new Types.ObjectId(teamId)
  return Game.countDocuments({ $or: [{ teamAId: id }, { teamBId: id }] })
}

/** How many games this member has been fielded in. */
export async function playerAppearanceCount(playerId: string): Promise<number> {
  if (!Types.ObjectId.isValid(playerId)) return 0

  return Game.countDocuments({ 'lineup.playerId': new Types.ObjectId(playerId) })
}
