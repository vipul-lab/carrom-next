import Link from 'next/link'
import { Icon, type IconName } from './Icon'

export type StatTone = 'blue' | 'green' | 'purple' | 'gold' | 'red' | 'navy'

const TONES: Record<StatTone, [string, string]> = {
  blue: ['bg-blue-50', 'text-blue-600'],
  green: ['bg-green-50', 'text-green-600'],
  purple: ['bg-purple-50', 'text-purple-600'],
  gold: ['bg-gold-500/10', 'text-gold-600'],
  red: ['bg-red-50', 'text-red-600'],
  navy: ['bg-navy-100', 'text-navy-700'],
}

export function StatCard({
  label,
  value,
  icon = 'chart',
  tone = 'blue',
  hint,
  href,
  className = '',
}: {
  label: string
  value: string | number
  icon?: IconName
  tone?: StatTone
  hint?: string | null
  href?: string | null
  className?: string
}) {
  const [iconBg, iconText] = TONES[tone]

  const body = (
    <>
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconText}`}
      >
        <Icon name={icon} className="h-5.5 w-5.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold text-navy-900" title={String(value)}>
          {value}
        </p>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
      </div>

      {href && (
        <Icon
          name="arrow-right"
          className="h-4 w-4 shrink-0 text-navy-200 transition group-hover:translate-x-0.5 group-hover:text-blue-500"
        />
      )}
    </>
  )

  const base = `group relative flex items-start gap-4 rounded-2xl border border-navy-100 bg-white p-5 shadow-card transition ${href ? 'hover:-translate-y-0.5 hover:shadow-raised' : ''} ${className}`

  return href ? (
    <Link href={href} className={base}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}
