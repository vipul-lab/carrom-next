import 'server-only'
import { put, del } from '@vercel/blob'

/**
 * The two image uploads in the app (team logos, player photos).
 *
 * Vercel's filesystem is read-only at runtime, so uploads go to Vercel Blob
 * instead of a local `public` disk. `addRandomSuffix` means the stored name is
 * generated rather than taken from the client, and the previous file is removed
 * so uploads do not accumulate.
 */

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export class UploadError extends Error {}

export function validateImage(file: File): string | null {
  if (file.size > MAX_BYTES) return 'The image must be 2 MB or smaller.'
  if (!ALLOWED.includes(file.type)) return 'The image must be a JPG, PNG or WebP file.'
  return null
}

export async function storeImage(
  file: File,
  directory: string,
  replacing?: string | null,
): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new UploadError(
      'Image uploads need a Vercel Blob store. Add BLOB_READ_WRITE_TOKEN to your environment, or save without an image.',
    )
  }

  const blob = await put(`${directory}/${file.name}`, file, {
    access: 'public',
    addRandomSuffix: true,
    contentType: file.type,
  })

  if (replacing) await deleteImage(replacing)

  return blob.url
}

export async function deleteImage(url: string | null | undefined): Promise<void> {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return

  try {
    await del(url)
  } catch {
    // A missing blob is not worth failing the surrounding save for.
  }
}

/** True when the request actually carried a file (an empty input still posts). */
export function hasFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0
}
