import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import type { Appointment, AppointmentStatus } from '../api/types'
import {
  dateParts,
  formatDateTime,
  formatTime,
} from '../lib/format'
import { fadeUpSmall } from '../lib/motion'
import {
  CalendarDaysIcon,
  ClockIcon,
  FileTextIcon,
  StethoscopeIcon,
  TimerIcon,
  UserIcon,
  XCircleIcon,
} from './icons'
import { AppointmentStatusBadge } from './status'
import { Badge, Button, Card, cx } from './ui'

export function AppointmentDetailPanel({
  appointment,
  canReschedule,
  canCancel,
  onReschedule,
  onCancel,
  context = 'staff',
  emptyTitle,
  className,
}: {
  appointment: Appointment | null
  canReschedule: boolean
  canCancel: boolean
  onReschedule: () => void
  onCancel: () => void
  context?: 'patient' | 'staff' | 'doctor'
  emptyTitle?: string
  className?: string
}) {
  if (!appointment) {
    return (
      <Card className={cx('min-w-0 overflow-hidden', className)}>
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <span
            aria-hidden="true"
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted"
          >
            <CalendarDaysIcon className="h-5 w-5" />
          </span>
          <p className="font-display text-base font-semibold text-ink">
            {emptyTitle ?? 'No appointment selected'}
          </p>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
            Pick an appointment to review its details and available actions.
          </p>
        </div>
      </Card>
    )
  }

  const date = dateParts(appointment.start)
  const hasReason = Boolean(appointment.reason?.trim())
  const hint = actionsHint(appointment.status, canReschedule, canCancel)

  return (
    <Card
      className={cx(
        'min-w-0 self-start overflow-hidden xl:sticky xl:top-6',
        className,
      )}
    >
      <motion.div
        key={appointment.id}
        variants={fadeUpSmall}
        initial="hidden"
        animate="show"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Appointment #{appointment.id}
          </p>
          <AppointmentStatusBadge
            status={appointment.status}
            label={appointment.statusLabel}
          />
        </div>

        <div className="p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-accent-ink">
              <span className="font-display text-2xl font-semibold leading-none tabular-nums">
                {date.day}
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-[0.14em]">
                {date.month}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-ink">
                {date.weekday}, {date.day} {date.month} {date.year}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 font-mono text-sm tabular-nums text-ink-soft">
                <ClockIcon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                {formatTime(appointment.start)} – {formatTime(appointment.end)}
              </p>
              <p className="mt-1 truncate text-xs text-muted">
                with {appointment.doctorName}
              </p>
            </div>
          </div>

          <dl className="mt-4 divide-y divide-line border-t border-line">
            <DetailRow
              icon={<StethoscopeIcon className="h-3.5 w-3.5" />}
              label="Doctor"
              value={appointment.doctorName}
            />
            {context !== 'patient' && (
              <DetailRow
                icon={<UserIcon className="h-3.5 w-3.5" />}
                label="Patient"
                value={appointment.patientName}
              />
            )}
            <DetailRow
              icon={<FileTextIcon className="h-3.5 w-3.5" />}
              label="Reason"
              value={hasReason ? (appointment.reason ?? '') : 'No reason recorded'}
              muted={!hasReason}
            />
            <DetailRow
              icon={<TimerIcon className="h-3.5 w-3.5" />}
              label="Booked"
              value={formatDateTime(appointment.createdAt)}
            />
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <Badge>Appointment #{appointment.id}</Badge>
            <Badge>Slot #{appointment.slotId ?? '—'}</Badge>
          </div>
        </div>

        <div className="space-y-2 border-t border-line bg-subtle/50 px-4 py-3.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={onReschedule} disabled={!canReschedule}>
              <CalendarDaysIcon className="h-4 w-4" aria-hidden="true" />
              Reschedule
            </Button>
            <Button variant="danger" onClick={onCancel} disabled={!canCancel}>
              <XCircleIcon className="h-4 w-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
          {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
        </div>
      </motion.div>
    </Card>
  )
}

function DetailRow({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: ReactNode
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 py-2.5">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-muted">
        {icon}
      </span>
      <dt className="w-16 shrink-0 text-xs font-medium leading-relaxed text-muted">
        {label}
      </dt>
      <dd
        className={cx(
          'min-w-0 flex-1 break-words text-sm leading-relaxed',
          muted ? 'text-muted' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function actionsHint(
  status: AppointmentStatus,
  canReschedule: boolean,
  canCancel: boolean,
): string | null {
  if (canReschedule && canCancel) return null

  const blocked: string[] = []
  if (!canReschedule) blocked.push('rescheduled')
  if (!canCancel) blocked.push('cancelled')
  const verbList = blocked.join(' or ')

  if (status === 'COMPLETED') return 'Completed visits are read-only.'
  if (status === 'CANCELLED') return 'This appointment was cancelled and cannot be changed.'
  if (status === 'NO_SHOW') return 'Marked as no-show; this visit can no longer be changed.'
  if (status === 'RESCHEDULED') return 'This appointment was replaced by a newer booking.'
  if (status === 'PRE_EMPTED' && !canReschedule) {
    return 'Rebooking is not available for this pre-empted appointment.'
  }

  const editable = status === 'BOOKED' || status === 'PRE_EMPTED'
  if (!editable) return 'This appointment can no longer be changed.'
  return `This appointment cannot be ${verbList} in its current state.`
}
