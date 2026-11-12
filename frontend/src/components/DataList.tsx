import type { ReactNode } from 'react'
import { cx } from './ui'

export interface Column<T> {
  key: string
  header: string
  render: (item: T) => ReactNode
  className?: string
  headerClassName?: string
  align?: 'left' | 'right'
  width?: string
}

export interface DataListProps<T> {
  items: T[]
  columns: Column<T>[]
  rowKey: (item: T) => string | number
  selectedKey?: string | number | null
  onSelect?: (item: T) => void
  /**
   * Rendered inside each mobile card. When `onSelect` is supplied the whole
   * card becomes a button, so `mobileCard` must not contain nested interactive
   * controls (links, buttons, inputs, selects) — the browser cannot represent
   * interactive content inside a button.
   */
  mobileCard: (item: T) => ReactNode
  empty?: ReactNode
  ariaLabel?: string
  className?: string
}

/**
 * A responsive data presentation: a real table from `md` upward, and a stack of
 * cards below that breakpoint. Selection is shared between both presentations.
 */
export function DataList<T>({
  items,
  columns,
  rowKey,
  selectedKey,
  onSelect,
  mobileCard,
  empty,
  ariaLabel,
  className,
}: DataListProps<T>) {
  const emptyNode = empty ?? (
    <p className="px-4 py-12 text-center text-sm text-muted">No records to show.</p>
  )

  return (
    <div className={cx('min-w-0', className)}>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-xs md:block">
        <table aria-label={ariaLabel} className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cx(
                    'sticky top-0 z-10 border-b border-line bg-subtle px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted xl:px-4',
                    column.align === 'right' && 'text-right',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {items.length === 0 ? (
              <tr>
                <td colSpan={Math.max(columns.length, 1)}>{emptyNode}</td>
              </tr>
            ) : (
              items.map((item) => {
                const key = rowKey(item)
                const selected =
                  selectedKey !== undefined &&
                  selectedKey !== null &&
                  selectedKey === rowKey(item)
                const interactive = Boolean(onSelect)

                return (
                  <tr
                    key={key}
                    tabIndex={interactive ? 0 : undefined}
                    aria-selected={interactive ? selected : undefined}
                    onClick={
                      onSelect
                        ? (event) => {
                            if (
                              event.target instanceof Element &&
                              event.target.closest(
                                'a, button, input, select, textarea, [role="button"]',
                              ) !== null
                            ) {
                              return
                            }
                            onSelect(item)
                          }
                        : undefined
                    }
                    onKeyDown={
                      onSelect
                        ? (event) => {
                            if (event.target !== event.currentTarget) return
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onSelect(item)
                            }
                          }
                        : undefined
                    }
                    className={cx(
                      'transition-colors duration-150',
                      selected ? 'bg-accent-soft/60' : interactive && 'hover:bg-subtle/70',
                      interactive &&
                        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cx(
                          'border-b border-line/70 px-3 py-3.5 align-middle text-ink xl:px-4',
                          column.align === 'right' && 'text-right tabular-nums',
                          column.className,
                        )}
                      >
                        {column.render(item)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {items.length === 0 ? (
          <div className="rounded-card border border-line bg-surface shadow-xs">{emptyNode}</div>
        ) : (
          <ul aria-label={ariaLabel} className="flex flex-col gap-2.5">
            {items.map((item) => {
              const key = rowKey(item)
              const selected =
                selectedKey !== undefined &&
                selectedKey !== null &&
                selectedKey === rowKey(item)
              const cardClass = cx(
                'w-full rounded-card border bg-surface p-4 text-left shadow-xs',
                'transition-[border-color,background-color,box-shadow] duration-150',
                selected
                  ? 'border-accent/40 bg-accent-soft/30 ring-1 ring-accent/15'
                  : 'border-line',
                onSelect && 'cursor-pointer hover:border-line-strong hover:shadow-sm',
              )

              return (
                <li key={key}>
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      aria-pressed={selected}
                      className={cx(
                        cardClass,
                        'block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      )}
                    >
                      {mobileCard(item)}
                    </button>
                  ) : (
                    <div className={cardClass}>{mobileCard(item)}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
