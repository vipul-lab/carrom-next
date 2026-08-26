import type { ComponentProps } from 'react'

export function Checkbox({
  name,
  label,
  value = '1',
  className = '',
  ...rest
}: { label?: string } & ComponentProps<'input'>) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-navy-800">
      <input
        type="checkbox"
        name={name}
        id={rest.id ?? name}
        value={value}
        className={`h-4 w-4 rounded border-navy-300 text-blue-600 focus:ring-blue-500 ${className}`}
        {...rest}
      />
      {label && <span>{label}</span>}
    </label>
  )
}
