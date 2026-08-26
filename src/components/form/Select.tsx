import type { ComponentProps, ReactNode } from 'react'

export type Options = Record<string, string> | [string, string][]

export function Select({
  name,
  options = {},
  placeholder,
  invalid = false,
  className = '',
  children,
  ...rest
}: {
  options?: Options
  placeholder?: string
  invalid?: boolean
  children?: ReactNode
} & ComponentProps<'select'>) {
  const entries = Array.isArray(options) ? options : Object.entries(options)

  const classes = [
    'block w-full rounded-lg border-0 bg-white py-2 pr-9 pl-3 text-sm text-navy-900 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset',
    invalid ? 'ring-red-300 focus:ring-red-500' : 'ring-navy-200 focus:ring-blue-500',
    className,
  ].join(' ')

  return (
    <select
      name={name}
      id={rest.id ?? name}
      aria-invalid={invalid || undefined}
      className={classes}
      {...rest}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {entries.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
      {children}
    </select>
  )
}
