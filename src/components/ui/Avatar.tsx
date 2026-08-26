/* eslint-disable @next/next/no-img-element */

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZES: Record<AvatarSize, string> = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
}

export function Avatar({
  src,
  initials = '?',
  size = 'md',
  color,
  ring = false,
  className = '',
}: {
  src?: string | null
  initials?: string
  size?: AvatarSize
  color?: string | null
  ring?: boolean
  className?: string
}) {
  const dimension = SIZES[size]
  const ringClass = ring ? 'ring-2 ring-white' : ''

  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        className={`shrink-0 rounded-full bg-navy-100 object-cover ${dimension} ${ringClass} ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      style={color ? { backgroundColor: `${color}1a`, color } : undefined}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${dimension} ${ringClass} ${color ? '' : 'bg-navy-100 text-navy-700'} ${className}`}
    >
      {initials}
    </span>
  )
}
