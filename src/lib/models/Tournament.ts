import mongoose, { Schema, type Model, type Types } from 'mongoose'
import { TOURNAMENT_STATUSES, type TournamentStatus } from '../enums'

/**
 * A named competition that games can belong to.
 *
 * A game with no `tournamentId` is a friendly. That is the whole distinction —
 * there is no separate "friendly" record to keep in step, and a game can be
 * moved in or out of a tournament by changing one field.
 */
export interface TournamentDoc {
  _id: Types.ObjectId
  name: string
  description: string | null
  startDate: Date
  endDate: Date | null
  status: TournamentStatus
  createdAt: Date
  updatedAt: Date
}

const TournamentSchema = new Schema<TournamentDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: null },
    startDate: { type: Date, required: true },
    // Open-ended while a tournament is still running.
    endDate: { type: Date, default: null },
    status: { type: String, enum: TOURNAMENT_STATUSES, default: 'upcoming' },
  },
  { timestamps: true, collection: 'tournaments' },
)

TournamentSchema.index({ startDate: -1 })
TournamentSchema.index({ status: 1, startDate: -1 })
TournamentSchema.index({ name: 1 })

export const Tournament: Model<TournamentDoc> =
  (mongoose.models.Tournament as Model<TournamentDoc>) ??
  mongoose.model<TournamentDoc>('Tournament', TournamentSchema)
