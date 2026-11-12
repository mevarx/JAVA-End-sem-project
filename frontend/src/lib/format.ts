import type {
  AppointmentStatus,
  EmergencyStatus,
  NotificationLevel,
  Role,
  Severity,
  SlotStatus,
} from '../api/types'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})
const shortDateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const weekdayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const longWeekdayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'short' })
const monthLongFormatter = new Intl.DateTimeFormat('en-GB', { month: 'long' })
const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null
  // A date-only value is a civil date, not a UTC instant.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toDate(iso: string | null | undefined): Date | null {
  return parse(iso)
}

export function formatDate(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? dateFormatter.format(date) : '—'
}

export function formatShortDate(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? shortDateFormatter.format(date) : '—'
}

export function formatTime(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? timeFormatter.format(date) : '—'
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? dateTimeFormatter.format(date) : '—'
}

export function formatWeekday(iso: string | null | undefined, long = false): string {
  const date = parse(iso)
  if (!date) return '—'
  return (long ? longWeekdayFormatter : weekdayFormatter).format(date)
}

export function formatMonth(iso: string | null | undefined, long = false): string {
  const date = parse(iso)
  if (!date) return '—'
  return (long ? monthLongFormatter : monthFormatter).format(date)
}

export interface DateParts {
  day: string
  month: string
  weekday: string
  year: string
}

export function dateParts(iso: string | null | undefined): DateParts {
  const date = parse(iso)
  if (!date) return { day: '—', month: '—', weekday: '—', year: '—' }
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: monthFormatter.format(date),
    weekday: weekdayFormatter.format(date),
    year: String(date.getFullYear()),
  }
}

export function dayKey(iso: string | null | undefined): string {
  const date = parse(iso)
  if (!date) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function isToday(iso: string | null | undefined): boolean {
  return dayKey(iso) === todayIso()
}

export function isFuture(iso: string | null | undefined): boolean {
  const date = parse(iso)
  return date ? date.getTime() > Date.now() : false
}

export function formatWait(raisedAt: string, resolvedAt: string | null): string {
  const start = parse(raisedAt)
  if (!start) return '—'
  const end = parse(resolvedAt) ?? new Date()
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours ? `${days}d ${restHours}h` : `${days}d`
}

/** Kept for existing call sites; the label now scales to hours and days. */
export function waitedFor(raisedAt: string, resolvedAt: string | null): string {
  return formatWait(raisedAt, resolvedAt)
}

export function formatRelative(iso: string | null | undefined): string {
  const date = parse(iso)
  if (!date) return '—'
  const diffMs = date.getTime() - Date.now()
  const abs = Math.abs(diffMs)
  if (abs < 60_000) return 'now'
  const minutes = Math.round(diffMs / 60_000)
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return relativeFormatter.format(days, 'day')
  const months = Math.round(days / 30)
  return relativeFormatter.format(months, 'month')
}

export function todayIso(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10)
}

export function addDaysIso(iso: string, days: number): string {
  const date = parse(iso) ?? new Date()
  date.setDate(date.getDate() + days)
  return dayKey(date.toISOString())
}

export function initials(name: string | null | undefined): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export const ROLE_LABELS: Record<Role, string> = {
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  RECEPTIONIST: 'Receptionist',
  ER_STAFF: 'ER staff',
  ADMIN: 'Administrator',
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  BOOKED: 'Booked',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
  RESCHEDULED: 'Rescheduled',
  PRE_EMPTED: 'Pre-empted',
}

export function severityTone(severity: Severity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-critical-soft text-critical-ink ring-1 ring-critical/25'
    case 'HIGH':
      return 'bg-warning-soft text-warning-ink ring-1 ring-warning/25'
    default:
      return 'bg-subtle text-ink-soft ring-1 ring-line'
  }
}

export function emergencyStatusTone(status: EmergencyStatus): string {
  switch (status) {
    case 'WAITING':
      return 'bg-warning-soft text-warning-ink'
    case 'ASSIGNED':
      return 'bg-accent-soft text-accent-ink'
    case 'ACKNOWLEDGED':
      return 'bg-success-soft text-success-ink'
    case 'ESCALATED':
      return 'bg-critical-soft text-critical-ink'
    case 'RESOLVED':
      return 'bg-subtle text-ink-soft'
  }
}

export function appointmentStatusTone(status: AppointmentStatus): string {
  switch (status) {
    case 'BOOKED':
      return 'bg-accent-soft text-accent-ink'
    case 'COMPLETED':
      return 'bg-success-soft text-success-ink'
    case 'NO_SHOW':
      return 'bg-warning-soft text-warning-ink'
    case 'RESCHEDULED':
      return 'bg-info-soft text-info-ink'
    case 'PRE_EMPTED':
      return 'bg-critical-soft text-critical-ink'
    case 'CANCELLED':
      return 'bg-subtle text-ink-soft'
  }
}

export function slotStatusTone(status: SlotStatus): string {
  return status === 'FREE'
    ? 'bg-accent-soft text-accent-ink'
    : 'bg-info-soft text-info-ink'
}

export function notificationTone(level: NotificationLevel): string {
  switch (level) {
    case 'CRITICAL':
      return 'border-critical/35 bg-critical-soft text-critical-ink'
    case 'WARNING':
      return 'border-warning/35 bg-warning-soft text-warning-ink'
    case 'SUCCESS':
      return 'border-success/30 bg-success-soft text-success-ink'
    default:
      return 'border-line bg-surface text-ink'
  }
}
