import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'accent'
  | 'ghost'
  | 'dark'

export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:outline-blue-600',
  secondary: 'bg-white text-navy-800 ring-1 ring-inset ring-navy-200 shadow-sm hover:bg-navy-50',
  success: 'bg-green-600 text-white shadow-sm hover:bg-green-700',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  accent: 'bg-purple-600 text-white shadow-sm hover:bg-purple-700',
  ghost: 'text-navy-600 hover:bg-navy-100 hover:text-navy-900',
  dark: 'bg-navy-900 text-white shadow-sm hover:bg-navy-800',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') {
  return [
    'inline-flex items-center justify-center rounded-lg font-semibold transition',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconAfter?: IconName
  className?: string
  children?: ReactNode
}

type ButtonProps = CommonProps & Omit<ComponentProps<'button'>, 'className' | 'children'>
type LinkButtonProps = CommonProps & { href: string } & Omit<
    ComponentProps<typeof Link>,
    'className' | 'children' | 'href'
  >

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  className = '',
  children,
  type = 'submit',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} className="h-4 w-4" />}
      <span>{children}</span>
      {iconAfter && <Icon name={iconAfter} className="h-4 w-4" />}
    </button>
  )
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  className = '',
  children,
  href,
  ...rest
}: LinkButtonProps) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} className="h-4 w-4" />}
      <span>{children}</span>
      {iconAfter && <Icon name={iconAfter} className="h-4 w-4" />}
    </Link>
  )
}
