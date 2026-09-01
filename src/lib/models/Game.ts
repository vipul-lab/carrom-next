import mongoose, { Schema, type Model, type Types } from 'mongoose'
import { GAME_FORMATS, GAME_STATUSES, type GameFormat, type GameStatus } from '../enums'

/**
 * One player's appearance in a game. In the SQL version this was the
 * `game_players` join table; embedding it here keeps a fixture atomic — the
 * line-up and the result are written in a single document update, which removes
 * the need for the transactions the Laravel service wrapped every write in.
 *
 * `points` is 1 when the player was on the winning side and 0 otherwise.
 */
export interface LineupEntry {
  playerId: Types.ObjectId
  teamId: Types.ObjectId
  points: number
}

export interface GameDoc {
  _id: Types.ObjectId
  number: number
  /** null means this was a friendly, played outside any tournament. */
  tournamentId: Types.ObjectId | null
  format: GameFormat
  teamAId: Types.ObjectId
  teamBId: Types.ObjectId
  teamAScore: number
  teamBScore: number
  winnerTeamId: Types.ObjectId | null
  gameDate: Date
  status: GameStatus
  lineup: LineupEntry[]
  createdAt: Date
  updatedAt: Date
}

const LineupSchema = new Schema<LineupEntry>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    points: { type: Number, default: 0, min: 0, max: 1 },
  },
  { _id: false },
)

const GameSchema = new Schema<GameDoc>(
  {
    number: { type: Number, required: true, unique: true },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', default: null },
    format: { type: String, enum: GAME_FORMATS, default: '2v2' },
    teamAId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    teamBId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    // 1 = won, 0 = lost. Derived from the line-up, never client-supplied.
    teamAScore: { type: Number, default: 0 },
    teamBScore: { type: Number, default: 0 },
    winnerTeamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    gameDate: { type: Date, required: true },
    status: { type: String, enum: GAME_STATUSES, default: 'scheduled' },
    lineup: { type: [LineupSchema], default: [] },
  },
  { timestamps: true, collection: 'games' },
)

GameSchema.index({ gameDate: -1 })
GameSchema.index({ tournamentId: 1, gameDate: -1 })
GameSchema.index({ status: 1, gameDate: -1 })
GameSchema.index({ format: 1 })
GameSchema.index({ teamAId: 1 })
GameSchema.index({ teamBId: 1 })
GameSchema.index({ 'lineup.playerId': 1 })

export const Game: Model<GameDoc> =
  (mongoose.models.Game as Model<GameDoc>) ?? mongoose.model<GameDoc>('Game', GameSchema)

/** "#GM-0042" — the label the UI shows everywhere a game is referenced. */
export function gameLabel(number: number): string {
  return '#GM-' + String(number).padStart(4, '0')
}
