import 'server-only'
import { Game, gameLabel } from '../models/Game'
import { Player } from '../models/Player'
import { Team } from '../models/Team'
import { smallestSquad } from '../enums'
import { formatDate } from '../format'
import type { IconName } from '@/components/ui/Icon'

/**
 * Derives the header notification list from the current state of the data.
 * These are real, actionable items — nothing is stored or faked.
 */

export interface Notification {
  icon: IconName
  tone: 'warning' | 'error' | 'info'
  title: string
  body: string
  url: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function gamesAwaitingScores(): Promise<Notification[]> {
  const games = await Game.aggregate([
    { $match: { status: 'scheduled', gameDate: { $lte: new Date() } } },
    { $sort: { gameDate: 1 } },
    { $limit: 5 },
    { $lookup: { from: 'teams', localField: 'teamAId', foreignField: '_id', as: 'a' } },
    { $lookup: { from: 'teams', localField: 'teamBId', foreignField: '_id', as: 'b' } },
  ])

  return games.map((game: any) => ({
    icon: 'board' as const,
    tone: 'warning' as const,
    title: `${gameLabel(game.number)} needs a score`,
    body: `${game.a?.[0]?.name ?? '—'} vs ${game.b?.[0]?.name ?? '—'} · ${formatDate(game.gameDate)}`,
    url: `/games/${game._id}/score`,
  }))
}

async function understaffedTeams(): Promise<Notification[]> {
  const minimum = smallestSquad()

  const teams = await Team.aggregate([
    { $match: { status: 'active' } },
    {
      $lookup: {
        from: 'players',
        let: { tid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$teamId', '$$tid'] }, status: 'active' } },
          { $count: 'total' },
        ],
        as: 'active',
      },
    },
    { $addFields: { activeCount: { $ifNull: [{ $first: '$active.total' }, 0] } } },
    { $match: { activeCount: { $lt: minimum } } },
    { $limit: 5 },
  ])

  return teams.map((team: any) => ({
    icon: 'shield' as const,
    tone: 'error' as const,
    title: `${team.name} cannot play`,
    body: `Only ${team.activeCount} active member(s) — a team needs at least ${minimum}.`,
    url: `/teams/${team._id}`,
  }))
}

async function unassignedPlayers(): Promise<Notification[]> {
  const count = await Player.countDocuments({ teamId: null, status: 'active' })
  if (count === 0) return []

  return [
    {
      icon: 'users' as const,
      tone: 'info' as const,
      title: `${count} member(s) have no team`,
      body: 'Assign them to a team so they can be picked for games.',
      url: '/players',
    },
  ]
}

export async function getNotifications(): Promise<Notification[]> {
  const [awaiting, understaffed, unassigned] = await Promise.all([
    gamesAwaitingScores(),
    understaffedTeams(),
    unassignedPlayers(),
  ])

  return [...awaiting, ...understaffed, ...unassigned]
}
