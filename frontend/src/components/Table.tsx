import type { ReactNode } from 'react'

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-muted/70">
          <tr>
            {head.map((title) => (
              <th
                key={title}
                scope="col"
                className="whitespace-nowrap px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
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
      className={`border-t border-border/70 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${selected ? 'bg-cyan-50' : 'hover:bg-muted/50'}`}
    >
      {children}
    </tr>
  )
}

export function Cell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  )
}
