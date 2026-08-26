import type { ComponentProps } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'

export function Input({
  name,
  icon,
  invalid = false,
  className = '',
  ...rest
}: { icon?: IconName; invalid?: boolean } & ComponentProps<'input'>) {
  const base = [
    'block w-full rounded-lg border-0 bg-white py-2 text-sm text-navy-900 shadow-sm ring-1 ring-inset',
    'placeholder:text-slate-400 focus:ring-2 focus:ring-inset disabled:bg-navy-50 disabled:text-slate-400',
    invalid ? 'ring-red-300 focus:ring-red-500' : 'ring-navy-200 focus:ring-blue-500',
    icon ? 'pl-9 pr-3' : 'px-3',
    className,
  ].join(' ')

  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      )}

      <input
        name={name}
        id={rest.id ?? name}
        aria-invalid={invalid || undefined}
        className={base}
        {...rest}
      />
    </div>
  )
}
