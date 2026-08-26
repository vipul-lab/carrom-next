import mongoose, { Schema, type Model } from 'mongoose'

/**
 * MongoDB has no auto-increment, but games are referred to by a human label
 * (#GM-0042) throughout the UI. This collection hands out gap-free sequential
 * numbers via an atomic findOneAndUpdate, so two concurrent creates can never
 * receive the same one.
 */
export interface CounterDoc {
  _id: string
  seq: number
}

const CounterSchema = new Schema<CounterDoc>(
  { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
  { collection: 'counters', versionKey: false },
)

export const Counter: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc>) ?? mongoose.model<CounterDoc>('Counter', CounterSchema)

export async function nextSequence(key: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean()

  return doc!.seq
}
