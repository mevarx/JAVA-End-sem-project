import type {
  AppointmentStatus,
  EmergencyStatus,
  Severity,
  SlotStatus,
} from '../api/types'
import {
  APPOINTMENT_STATUS_LABELS,
  appointmentStatusTone,
  emergencyStatusTone,
  severityTone,
  slotStatusTone,
} from '../lib/format'
import { Badge, cx } from './ui'

const EMERGENCY_STATUS_LABELS: Record<EmergencyStatus, string> = {
  WAITING: 'Waiting',
  ASSIGNED: 'Assigned',
  ACKNOWLEDGED: 'Acknowledged',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
}

const SLOT_STATUS_LABELS: Record<SlotStatus, string> = {
  FREE: 'Free',
  BOOKED: 'Booked',
}

const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
}

export function AppointmentStatusBadge({
  status,
  label,
  className,
}: {
  status: AppointmentStatus
  label?: string
  className?: string
}) {
  return (
    <Badge tone={appointmentStatusTone(status)} className={className}>
      {label ?? APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  )
}

export function EmergencyStatusBadge({
  status,
  label,
  className,
}: {
  status: EmergencyStatus
  label?: string
  className?: string
}) {
  return (
    <Badge tone={emergencyStatusTone(status)} className={className}>
      {label ?? EMERGENCY_STATUS_LABELS[status]}
    </Badge>
  )
}

export function SeverityBadge({
  severity,
  label,
  className,
}: {
  severity: Severity
  label?: string
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.08em]',
        severityTone(severity),
        severity === 'CRITICAL' && 'font-bold',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          severity === 'CRITICAL'
            ? 'bg-critical'
            : severity === 'HIGH'
              ? 'bg-warning'
              : 'bg-muted',
        )}
      />
      {label ?? SEVERITY_LABELS[severity]}
    </span>
  )
}

export function SlotStatusBadge({
  status,
  label,
  className,
}: {
  status: SlotStatus
  label?: string
  className?: string
}) {
  return (
    <Badge tone={slotStatusTone(status)} className={cx('gap-1.5', className)}>
      <span
        aria-hidden="true"
        className={cx(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          status === 'FREE' ? 'bg-accent' : 'bg-info',
        )}
      />
      {label ?? SLOT_STATUS_LABELS[status]}
    </Badge>
  )
}

export function PriorityRail({
  severity,
  className,
}: {
  severity: Severity
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'block h-full w-[3px] shrink-0 self-stretch rounded-full',
        severity === 'CRITICAL'
          ? 'bg-critical'
          : severity === 'HIGH'
            ? 'bg-warning'
            : 'bg-line',
        className,
      )}
    />
  )
}

export function LiveDot({
  label,
  tone = 'live',
  className,
}: {
  label?: string
  tone?: 'live' | 'critical' | 'idle'
  className?: string
}) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className={cx(
          'h-2 w-2 shrink-0 rounded-full',
          tone === 'live'
            ? 'bg-accent ring-2 ring-accent/15'
            : tone === 'critical'
              ? 'bg-critical ring-2 ring-critical/15'
              : 'bg-muted ring-2 ring-line',
        )}
      />
      {label && <span className="text-xs font-medium text-ink-soft">{label}</span>}
    </span>
  )
}
