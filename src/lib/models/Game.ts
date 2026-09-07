import mongoose, { Schema, type Model, type Types } from 'mongoose'
import {
  GAME_FORMATS,
  GAME_STAGES,
  GAME_STATUSES,
  type GameFormat,
  type GameStage,
  type GameStatus,
} from '../enums'

/**
 * One player's appearance in a game. In the SQL version this was the
 * `game_players` join table; embedding it here keeps a fixture atomic — the
 * line-up and the result are written in a single document update, which removes
 * the need for the transactions the Laravel service wrapped every write in.
 *
 * `points` carries the team's score for that game, copied onto each member of
 * the side. Storing it per appearance is what lets a player's career total be
 * derived by summing their own rows.
 */
export interface LineupEntry {
  playerId: Types.ObjectId
  teamId: Types.ObjectId
  points: number
}

/**
 * The origin of one side of a knockout tie: a finishing position in a group,
 * or the winner of an earlier fixture.
 */
export interface GameSource {
  kind: 'group' | 'winner'
  /** kind 'group': which group, and 1st or 2nd. */
  group?: string | null
  position?: number | null
  /** kind 'winner': the slot of the fixture it feeds from, e.g. 'QF-1'. */
  slot?: string | null
}

export interface GameDoc {
  _id: Types.ObjectId
  number: number
  /** null means this was a friendly, played outside any tournament. */
  tournamentId: Types.ObjectId | null
  stage: GameStage
  /** 'A'-'D' for a group game, null for a knockout tie. */
  groupName: string | null
  /** The fixture's label in the draw: 'A-1', 'QF-3', 'FINAL'. */
  slot: string | null
  format: GameFormat
  /**
   * Null until the tie has an opponent. A knockout fixture exists before its
   * teams are known — the placeholder below says where each side comes from.
   */
  teamAId: Types.ObjectId | null
  teamBId: Types.ObjectId | null
  /**
   * Where each side comes from while it is still undecided. Structured rather
   * than a display string so the draw can be resolved by looking it up, not by
   * parsing prose.
   */
  teamAFrom: GameSource | null
  teamBFrom: GameSource | null
  teamAScore: number
  teamBScore: number
  winnerTeamId: Types.ObjectId | null
  gameDate: Date
  status: GameStatus
  lineup: LineupEntry[]
  createdAt: Date
  updatedAt: Date
}

const SourceSchema = new Schema<GameSource>(
  {
    kind: { type: String, enum: ['group', 'winner'], required: true },
    group: { type: String, default: null },
    position: { type: Number, default: null },
    slot: { type: String, default: null },
  },
  { _id: false },
)

const LineupSchema = new Schema<LineupEntry>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    points: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
)

const GameSchema = new Schema<GameDoc>(
  {
    number: { type: Number, required: true, unique: true },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', default: null },
    stage: { type: String, enum: GAME_STAGES, default: 'group' },
    groupName: { type: String, default: null },
    slot: { type: String, default: null },
    format: { type: String, enum: GAME_FORMATS, default: '2v2' },
    teamAId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    teamBId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    teamAFrom: { type: SourceSchema, default: null },
    teamBFrom: { type: SourceSchema, default: null },
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
GameSchema.index({ tournamentId: 1, stage: 1, slot: 1 })
GameSchema.index({ tournamentId: 1, groupName: 1 })
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
