import type { ReactNode } from 'react'

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {head.map((title) => (
              <th
                key={title}
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-muted">{children}</tbody>
      </table>
    </div>
  )
}

export function Row({
  children,
  onClick,
  selected = false,
}: {
  children: ReactNode
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors duration-200 ${
        onClick ? 'cursor-pointer' : ''
      } ${selected ? 'bg-background' : 'hover:bg-muted/60'}`}
    >
      {children}
    </tr>
  )
}

export function Cell({
  children,
  className = '',
  numeric = false,
  title,
}: {
  children: ReactNode
  className?: string
  numeric?: boolean
  title?: string
}) {
  return (
    <td
      title={title}
      className={`px-4 py-3 align-middle text-foreground ${numeric ? 'text-right tabular-nums' : ''} ${className}`}
    >
      {children}
    </td>
  )
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  )
}
