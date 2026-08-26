import type { ReactNode } from 'react'

/** Horizontally scrollable on desktop, card-stacked on phones via .table-stack */
export function Table({
  stack = true,
  className = '',
  children,
}: {
  stack?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6 md:mx-0">
      <div className="inline-block min-w-full px-5 align-middle sm:px-6 md:px-0">
        <table className={`min-w-full ${stack ? 'table-stack' : ''} ${className}`}>{children}</table>
      </div>
    </div>
  )
}

export function Th({
  children,
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <th scope="col" className={className}>
      {children}
    </th>
  )
}

export const HEAD_ROW =
  'border-b border-navy-100 text-left text-xs font-semibold tracking-wide text-slate-400 uppercase'
