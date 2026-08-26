import type { ComponentProps } from 'react'

export function Textarea({
  name,
  invalid = false,
  rows = 3,
  className = '',
  ...rest
}: { invalid?: boolean } & ComponentProps<'textarea'>) {
  const classes = [
    'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-navy-900 shadow-sm ring-1 ring-inset',
    'placeholder:text-slate-400 focus:ring-2 focus:ring-inset',
    invalid ? 'ring-red-300 focus:ring-red-500' : 'ring-navy-200 focus:ring-blue-500',
    className,
  ].join(' ')

  return (
    <textarea name={name} id={rest.id ?? name} rows={rows} aria-invalid={invalid || undefined} className={classes} {...rest} />
  )
}
