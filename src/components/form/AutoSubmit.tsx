'use client'

import type { ComponentProps, ReactNode } from 'react'
import { Select, type Options } from './Select'

/**
 * A select that submits its surrounding form the moment it changes, so the
 * filter bars behave the way they did with the old `data-auto-submit` hook.
 */
export function AutoSubmitSelect({
  options,
  placeholder,
  className = '',
  children,
  onChange,
  ...rest
}: { options?: Options; placeholder?: string; children?: ReactNode } & ComponentProps<'select'>) {
  return (
    <Select
      options={options}
      placeholder={placeholder}
      className={className}
      onChange={(event) => {
        onChange?.(event)
        event.currentTarget.form?.requestSubmit()
      }}
      {...rest}
    >
      {children}
    </Select>
  )
}
