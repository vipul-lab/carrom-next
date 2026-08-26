import mongoose, { Schema, type Model, type Types } from 'mongoose'
import { RECORD_STATUSES, type RecordStatus } from '../enums'

export interface TeamDoc {
  _id: Types.ObjectId
  name: string
  code: string
  logo: string | null
  color: string
  description: string | null
  status: RecordStatus
  createdAt: Date
  updatedAt: Date
}

const TeamSchema = new Schema<TeamDoc>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 12 },
    logo: { type: String, default: null },
    color: { type: String, default: '#3b82f6' },
    description: { type: String, default: null },
    status: { type: String, enum: RECORD_STATUSES, default: 'active' },
  },
  { timestamps: true, collection: 'teams' },
)

TeamSchema.index({ status: 1 })
TeamSchema.index({ name: 1 })

export const Team: Model<TeamDoc> =
  (mongoose.models.Team as Model<TeamDoc>) ?? mongoose.model<TeamDoc>('Team', TeamSchema)
