'use client'

import { useState } from 'react'
import { Field } from './Field'
import { Checkbox } from './Checkbox'
import { Avatar } from '@/components/ui/Avatar'

/**
 * Team logos and player photos. The chosen file is previewed locally before it
 * is uploaded, so the admin sees what they picked without a round-trip.
 */
export function ImageUpload({
  name,
  label = 'Image',
  current,
  initials = '?',
  removeName,
  hint = 'JPG, PNG or WebP up to 2 MB.',
  error,
}: {
  name: string
  label?: string
  current?: string | null
  initials?: string
  removeName?: string
  hint?: string
  error?: string | null
}) {
  const [preview, setPreview] = useState<string | null>(null)

  return (
    <Field label={label} name={name} hint={hint} error={error}>
      <div className="flex items-center gap-4">
        <Avatar src={preview ?? current} initials={initials} size="lg" />

        <div className="min-w-0 flex-1 space-y-2">
          <input
            type="file"
            name={name}
            id={name}
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0]
              setPreview(file ? URL.createObjectURL(file) : null)
            }}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0
                       file:bg-navy-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-navy-700
                       hover:file:bg-navy-200"
          />

          {current && removeName && (
            <Checkbox name={removeName} label="Remove the current image" />
          )}
        </div>
      </div>
    </Field>
  )
}
