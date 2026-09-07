import mongoose, { Schema, type Model, type Types } from 'mongoose'
import { RECORD_STATUSES, type RecordStatus } from '../enums'

export interface PlayerDoc {
  _id: Types.ObjectId
  teamId: Types.ObjectId | null
  name: string
  photo: string | null
  mobile: string | null
  email: string | null
  status: RecordStatus
  createdAt: Date
  updatedAt: Date
}

const PlayerSchema = new Schema<PlayerDoc>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    name: { type: String, required: true, trim: true },
    photo: { type: String, default: null },
    mobile: { type: String, default: null },
    email: { type: String, default: null, lowercase: true, trim: true },
    status: { type: String, enum: RECORD_STATUSES, default: 'active' },
  },
  { timestamps: true, collection: 'players' },
)

PlayerSchema.index({ teamId: 1, status: 1 })
PlayerSchema.index({ name: 1 })
// A given address is used at most once, but any number of members may have no
// email at all. It has to be a *partial* index rather than a sparse one: the
// schema defaults email to null, so the field is present on every document and
// `sparse` would exclude nothing — every member without an email would collide
// with every other. Indexing only actual strings is what makes both true.
PlayerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
)

export const Player: Model<PlayerDoc> =
  (mongoose.models.Player as Model<PlayerDoc>) ?? mongoose.model<PlayerDoc>('Player', PlayerSchema)
