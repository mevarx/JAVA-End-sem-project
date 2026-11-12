import { useMemo } from 'react'
import { motion } from 'motion/react'
import type { Appointment } from '../api/types'
import { dayKey, formatDate, formatMonth, todayIso } from '../lib/format'
import { fadeIn } from '../lib/motion'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { IconButton, cx } from './ui'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarMonth({
  appointments,
  month,
  selectedDay,
  onSelectDay,
  onMonthChange,
  className,
}: {
  appointments: Appointment[]
  month: string
  selectedDay: string
  onSelectDay: (day: string) => void
  onMonthChange: (month: string) => void
  className?: string
}) {
  const { year, monthIndex } = splitMonth(month)
  const today = todayIso()

  const anchor = `${year}-${pad(monthIndex + 1)}-01`
  const monthTitle = `${formatMonth(anchor, true)} ${year}`

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const appointment of appointments) {
      const key = dayKey(appointment.start)
      if (key) map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [appointments])

  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const cells: Array<{ day: string; date: number } | null> = Array.from(
    { length: cellCount },
    (_, index) => {
      const date = index - firstWeekday + 1
      if (date < 1 || date > daysInMonth) return null
      return { day: `${year}-${pad(monthIndex + 1)}-${pad(date)}`, date }
    },
  )

  return (
    <div
      className={cx(
        'min-w-0 rounded-card border border-line bg-surface p-3 shadow-xs sm:p-4',
        className,
      )}
      role="group"
      aria-label="Appointment calendar"
    >
      <div className="flex items-center justify-between gap-2">
        <IconButton
          label="Previous month"
          variant="secondary"
          onClick={() => onMonthChange(shiftMonth(year, monthIndex, -1))}
        >
          <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <p
          className="min-w-0 truncate text-center font-display text-base font-semibold tracking-tight text-ink"
          aria-live="polite"
        >
          {monthTitle}
        </p>
        <IconButton
          label="Next month"
          variant="secondary"
          onClick={() => onMonthChange(shiftMonth(year, monthIndex, 1))}
        >
          <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>

      <motion.div
        key={month}
        variants={fadeIn}
        initial="hidden"
        animate="show"
        className="mt-3"
      >
        <div className="grid grid-cols-7 gap-1" aria-hidden="true">
          {WEEKDAYS.map((weekday) => (
            <span
              key={weekday}
              className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
            >
              {weekday}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) =>
            cell ? (
              <DayCell
                key={cell.day}
                day={cell.day}
                date={cell.date}
                count={counts.get(cell.day) ?? 0}
                selected={cell.day === selectedDay}
                today={cell.day === today}
                onSelect={onSelectDay}
              />
            ) : (
              <span key={`blank-${index}`} aria-hidden="true" />
            ),
          )}
        </div>
      </motion.div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[11px] leading-none text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-accent" />
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-sm border border-accent/60 bg-accent-soft"
          />
          Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
          Appointments
        </span>
      </div>
    </div>
  )
}

function DayCell({
  day,
  date,
  count,
  selected,
  today,
  onSelect,
}: {
  day: string
  date: number
  count: number
  selected: boolean
  today: boolean
  onSelect: (day: string) => void
}) {
  const dots = Math.min(count, 3)

  return (
    <button
      type="button"
      onClick={() => onSelect(day)}
      aria-pressed={selected}
      aria-current={today ? 'date' : undefined}
      aria-label={`${formatDate(day)}, ${count === 0 ? 'no appointments' : `${count} appointment${count === 1 ? '' : 's'}`}`}
      className={cx(
        'flex min-h-11 w-full min-w-0 cursor-pointer flex-col items-center justify-center rounded-lg border px-0.5 py-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-accent bg-accent text-on-accent shadow-xs'
          : today
            ? 'border-accent/60 bg-accent-soft text-accent-ink hover:border-accent'
            : 'border-transparent text-ink-soft hover:border-line hover:bg-subtle hover:text-ink',
      )}
    >
      <span className="text-[13px] font-semibold leading-none tabular-nums">{date}</span>
      <span aria-hidden="true" className="mt-1 flex h-1.5 items-center gap-0.5">
        {Array.from({ length: dots }, (_, index) => (
          <span
            key={index}
            className={cx(
              'h-1.5 w-1.5 rounded-full',
              selected ? 'bg-on-accent/80' : 'bg-accent',
            )}
          />
        ))}
      </span>
    </button>
  )
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function splitMonth(month: string): { year: number; monthIndex: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) {
    const now = new Date()
    return { year: now.getFullYear(), monthIndex: now.getMonth() }
  }
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1 }
}

function shiftMonth(year: number, monthIndex: number, delta: number): string {
  const date = new Date(year, monthIndex + delta, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}
