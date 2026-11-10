import type { AppointmentStatus, EmergencyStatus, NotificationLevel, Role, Severity } from '../api/types'

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? dateFormatter.format(date) : '—'
}

export function formatTime(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? timeFormatter.format(date) : '—'
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? dateTimeFormatter.format(date) : '—'
}

export function waitedFor(raisedAt: string, resolvedAt: string | null): string {
  const start = parse(raisedAt)
  if (!start) return '—'
  const end = parse(resolvedAt) ?? new Date()
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
  return `${minutes}m`
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
      return 'bg-red-100 text-red-700'
    case 'HIGH':
      return 'bg-orange-100 text-orange-700'
    default:
      return 'bg-yellow-100 text-yellow-800'
  }
}

export function emergencyStatusTone(status: EmergencyStatus): string {
  switch (status) {
    case 'WAITING':
      return 'bg-amber-100 text-amber-800'
    case 'ASSIGNED':
      return 'bg-cyan-100 text-cyan-800'
    case 'ACKNOWLEDGED':
      return 'bg-teal-100 text-teal-800'
    case 'ESCALATED':
      return 'bg-violet-100 text-violet-800'
    case 'RESOLVED':
      return 'bg-emerald-100 text-emerald-800'
  }
}

export function appointmentStatusTone(status: AppointmentStatus): string {
  switch (status) {
    case 'BOOKED':
      return 'bg-cyan-100 text-cyan-800'
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-800'
    case 'PRE_EMPTED':
      return 'bg-red-100 text-red-700'
    case 'RESCHEDULED':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export function notificationTone(level: NotificationLevel): string {
  switch (level) {
    case 'CRITICAL':
      return 'border-l-4 border-red-500 bg-red-50 text-red-900'
    case 'WARNING':
      return 'border-l-4 border-amber-500 bg-amber-50 text-amber-900'
    case 'SUCCESS':
      return 'border-l-4 border-emerald-500 bg-emerald-50 text-emerald-900'
    default:
      return 'border-l-4 border-cyan-400 bg-cyan-50 text-cyan-950'
  }
}

export function todayIso(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10)
}
