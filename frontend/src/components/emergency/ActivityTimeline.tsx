import { motion, useReducedMotion } from 'motion/react'
import type { EmergencyEvent } from '../../api/types'
import { formatDateTime } from '../../lib/format'
import { listItem, staggerContainer } from '../../lib/motion'
import {
  ActivityIcon,
  AlertIcon,
  CheckCheckIcon,
  CheckCircleIcon,
  ClipboardIcon,
  SendIcon,
  SirenIcon,
  type IconComponent,
} from '../icons'
import { cx } from '../ui'

interface EventVisual {
  icon: IconComponent
  tone: string
}

const EVENT_VISUALS: Record<string, EventVisual> = {
  RAISED: { icon: SirenIcon, tone: 'bg-critical-soft text-critical-ink' },
  CREATED: { icon: SirenIcon, tone: 'bg-critical-soft text-critical-ink' },
  DISPATCHED: { icon: SendIcon, tone: 'bg-info-soft text-info-ink' },
  ACKNOWLEDGED: { icon: CheckCheckIcon, tone: 'bg-accent-soft text-accent-ink' },
  ESCALATED: { icon: AlertIcon, tone: 'bg-critical-soft text-critical-ink' },
  RESOLVED: { icon: CheckCircleIcon, tone: 'bg-success-soft text-success-ink' },
  NOTE: { icon: ClipboardIcon, tone: 'bg-subtle text-muted' },
  NOTE_ADDED: { icon: ClipboardIcon, tone: 'bg-subtle text-muted' },
}

const FALLBACK_VISUAL: EventVisual = { icon: ActivityIcon, tone: 'bg-subtle text-muted' }

/**
 * Read-only vertical timeline for emergency lifecycle events.
 * Presentation only: callers own fetching, ordering and empty states.
 */
export function ActivityTimeline({
  events,
  emptyLabel,
  className,
}: {
  events: EmergencyEvent[]
  emptyLabel?: string
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  if (events.length === 0) {
    return (
      <p className={cx('py-3 text-sm leading-relaxed text-muted', className)}>
        {emptyLabel ?? 'No activity recorded yet.'}
      </p>
    )
  }

  return (
    <div
      className={cx(
        'max-h-80 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]',
        className,
      )}
    >
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute bottom-4 left-[13px] top-4 w-px bg-line"
        />
        <motion.ol
          aria-label="Case activity"
          variants={staggerContainer}
          initial={reduceMotion ? false : 'hidden'}
          animate="show"
          className="relative m-0 list-none p-0"
        >
          {events.map((event) => {
            const visual = EVENT_VISUALS[event.eventType.toUpperCase()] ?? FALLBACK_VISUAL
            const Icon = visual.icon
            const label = event.eventType.replace(/_/g, ' ').trim() || 'Event'
            return (
              <motion.li
                key={event.id}
                variants={listItem}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'relative z-10 mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full ring-4 ring-surface',
                    visual.tone,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.12em] text-ink-soft">
                      {label}
                    </p>
                    <time
                      dateTime={event.eventTime}
                      className="font-mono text-[11px] leading-none tabular-nums text-muted"
                    >
                      {formatDateTime(event.eventTime)}
                    </time>
                  </div>
                  {event.note && (
                    <p className="mt-1.5 break-words text-[13px] leading-relaxed text-ink-soft">
                      {event.note}
                    </p>
                  )}
                </div>
              </motion.li>
            )
          })}
        </motion.ol>
      </div>
    </div>
  )
}
