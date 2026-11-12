import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { EASE_OUT } from '../lib/motion'
import { cx } from './ui'

const compactNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

const DONUT_COLORS = [
  'var(--color-accent)',
  'var(--color-info)',
  'var(--color-warning)',
  'var(--color-critical)',
  'var(--color-success)',
  'var(--color-line-strong)',
]

export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}: {
  value: number | null | undefined
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(0)
  const displayRef = useRef(0)

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [decimals],
  )

  useEffect(() => {
    if (value === null || value === undefined) {
      displayRef.current = 0
      setDisplay(0)
      return
    }

    if (reduceMotion || displayRef.current === value) {
      displayRef.current = value
      setDisplay(value)
      return
    }

    const controls = animate(displayRef.current, value, {
      duration: 0.8,
      ease: EASE_OUT,
      onUpdate: (latest) => {
        displayRef.current = latest
        setDisplay(latest)
      },
      onComplete: () => {
        displayRef.current = value
        setDisplay(value)
      },
    })

    return () => controls.stop()
  }, [value, reduceMotion])

  if (value === null || value === undefined) {
    return <span className={cx('tabular-nums', className)}>—</span>
  }

  return (
    <span className={cx('tabular-nums', className)}>
      {prefix}
      {formatter.format(display)}
      {suffix}
    </span>
  )
}

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  size = 180,
  className,
}: {
  data: { label: string; value: number; color?: string }[]
  centerValue?: ReactNode
  centerLabel?: string
  size?: number
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const total = data.reduce((sum, datum) => sum + Math.max(0, datum.value), 0)

  let offset = 0
  const segments = data.map((datum, index) => {
    const value = Math.max(0, datum.value)
    const fraction = total > 0 ? value / total : 0
    const length = fraction * circumference
    const segmentOffset = offset
    offset += length
    return {
      datum,
      value,
      length,
      offset: segmentOffset,
      color: datum.color ?? DONUT_COLORS[index % DONUT_COLORS.length],
    }
  })

  const summary =
    data.length === 0
      ? 'No data available.'
      : `${data
          .map((datum) => `${datum.label} ${compactNumber.format(Math.max(0, datum.value))}`)
          .join(', ')}. Total ${compactNumber.format(total)}.`

  return (
    <div
      className={cx(
        'flex flex-col items-center gap-5',
        className,
      )}
    >
      <div
        role="img"
        aria-label={summary}
        className="relative shrink-0"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
          {total <= 0 ? (
            <circle
              cx={50}
              cy={50}
              r={radius}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth={11}
            />
          ) : (
            segments.map((segment, index) => (
              <motion.circle
                key={`${segment.datum.label}-${index}`}
                cx={50}
                cy={50}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={11}
                strokeLinecap="butt"
                strokeDasharray={`${segment.length} ${circumference}`}
                strokeDashoffset={-segment.offset}
                transform="rotate(-90 50 50)"
                initial={
                  reduceMotion
                    ? false
                    : { strokeDasharray: `0 ${circumference}` }
                }
                animate={{
                  strokeDasharray: `${segment.length} ${circumference}`,
                }}
                transition={{
                  duration: 0.75,
                  ease: EASE_OUT,
                  delay: index * 0.07,
                }}
              />
            ))
          )}
        </svg>

        {(centerValue !== undefined && centerValue !== null) || centerLabel ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue !== undefined && centerValue !== null && (
              <div className="font-display text-2xl font-semibold leading-none tracking-tight text-ink">
                {centerValue}
              </div>
            )}
            {centerLabel && (
              <div className="mt-1.5 max-w-[7rem] text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                {centerLabel}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {data.length > 0 && (
        <ul className="mx-auto grid w-full max-w-sm grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {segments.map((segment, index) => (
            <li
              key={`${segment.datum.label}-${index}`}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="truncate text-ink-soft">{segment.datum.label}</span>
              </span>
              <span className="shrink-0 font-mono tabular-nums text-ink">
                {compactNumber.format(segment.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function BarChart({
  data,
  height = 160,
  className,
  ariaLabel,
}: {
  data: { label: string; value: number }[]
  height?: number
  className?: string
  ariaLabel?: string
}) {
  const reduceMotion = useReducedMotion()

  if (data.length === 0) {
    return (
      <p className={cx('py-10 text-center text-sm text-muted', className)}>
        No data available.
      </p>
    )
  }

  const max = data.reduce((peak, datum) => Math.max(peak, Math.max(0, datum.value)), 0)
  const gridTemplateColumns = `repeat(${data.length}, minmax(0, 1fr))`
  const summary = `Bar chart: ${data
    .map((datum) => `${datum.label} ${compactNumber.format(Math.max(0, datum.value))}`)
    .join(', ')}.`

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? summary}
      className={cx('w-full', className)}
    >
      <div className="pt-6">
        <div
          className="grid items-end gap-2 border-b border-line sm:gap-3"
          style={{ gridTemplateColumns, height }}
        >
          {data.map((datum, index) => {
            const value = Math.max(0, datum.value)
            const percent = max > 0 ? (value / max) * 100 : 0

            return (
              <div
                key={`${datum.label}-${index}`}
                className="relative flex h-full min-w-0 items-end justify-center"
              >
                <span
                  className="absolute inset-x-0 text-center text-[11px] font-mono tabular-nums text-ink-soft"
                  style={{ bottom: `calc(${percent}% + 0.4rem)` }}
                >
                  {compactNumber.format(value)}
                </span>

                {percent > 0 ? (
                  <motion.div
                    className="mx-auto w-full max-w-24 rounded-t-md bg-accent"
                    style={{ height: `${percent}%`, transformOrigin: 'bottom' }}
                    initial={reduceMotion ? { scaleY: 1 } : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      duration: 0.55,
                      ease: EASE_OUT,
                      delay: index * 0.05,
                    }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="mx-auto h-0.5 w-full max-w-24 rounded-full bg-line-strong"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:gap-3" style={{ gridTemplateColumns }}>
        {data.map((datum, index) => (
          <p
            key={`${datum.label}-${index}`}
            className="truncate text-center text-[11px] text-muted"
            title={datum.label}
          >
            {datum.label}
          </p>
        ))}
      </div>
    </div>
  )
}
