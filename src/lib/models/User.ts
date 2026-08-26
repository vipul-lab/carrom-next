import mongoose, { Schema, type Model, type Types } from 'mongoose'

export interface UserDoc {
  _id: Types.ObjectId
  name: string
  email: string
  password: string
  emailVerifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    emailVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' },
)

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>('User', UserSchema)
