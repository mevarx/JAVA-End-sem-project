import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type {
  Appointment,
  Board,
  EmergencyCase,
  EmergencyEvent,
  Role,
  Severity,
} from '../../api/types'
import {
  dateParts,
  formatDateTime,
  formatRelative,
  formatShortDate,
  formatTime,
  formatWait,
  formatWeekday,
} from '../../lib/format'
import {
  AlertCircleIcon,
  AlertIcon,
  ArrowRightIcon,
  BuildingIcon,
  CalendarDaysIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardIcon,
  ClockIcon,
  HistoryIcon,
  ReportIcon,
  UsersIcon,
  type IconComponent,
} from '../../components/icons'
import {
  AppointmentStatusBadge,
  EmergencyStatusBadge,
  SeverityBadge,
} from '../../components/status'
import { Button, Card, SectionHeader, Skeleton } from '../../components/ui'

/* -------------------------------------------------------------------------- */
/* Shared presentation helpers                                               */
/* -------------------------------------------------------------------------- */

const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
}

const textLinkClass =
  'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function sortCases(cases: EmergencyCase[]): EmergencyCase[] {
  return [...cases].sort((left, right) => {
    const severity = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]
    if (severity !== 0) return severity
    return new Date(left.raisedAt).getTime() - new Date(right.raisedAt).getTime()
  })
}

function eventLabel(eventType: string): string {
  const words = eventType.replace(/[_-]+/g, ' ').toLowerCase().trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function CalmEmpty({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-subtle/60 px-4 py-8 text-center">
      <span
        aria-hidden="true"
        className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted ring-1 ring-line"
      >
        {icon}
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function CalmError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-critical/25 bg-critical-soft/60 p-3 text-critical-ink sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2 text-xs leading-relaxed">
        <AlertCircleIcon className="mt-px h-4 w-4 shrink-0" />
        {message}
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRetry}
        className="min-h-11 self-start sm:min-h-9 sm:self-auto"
      >
        Retry
      </Button>
    </div>
  )
}

export function StatSkeletons() {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <Card key={index} className="p-5">
          <Skeleton className="h-2.5 w-20 rounded-sm" />
          <Skeleton className="mt-4 h-8 w-14 rounded-md" />
          <Skeleton className="mt-3 h-2.5 w-24 max-w-full rounded-sm" />
        </Card>
      ))}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Schedule                                                                   */
/* -------------------------------------------------------------------------- */

export function ScheduleCard({
  role,
  upcoming,
  loading,
  error,
  onRetry,
}: {
  role: Role
  upcoming: Appointment[]
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const route =
    role === 'PATIENT' ? '/appointments' : role === 'DOCTOR' ? '/schedule' : '/all-appointments'
  const routeLabel =
    role === 'PATIENT' ? 'My appointments' : role === 'DOCTOR' ? 'My schedule' : 'All appointments'
  const visible = upcoming.slice(0, 5)
  const isBooker = role === 'PATIENT' || role === 'RECEPTIONIST'

  return (
    <Card className="h-full min-w-0 overflow-hidden">
      <div className="border-b border-line p-4 sm:p-5">
        <SectionHeader
          title="Upcoming schedule"
          description="The next five confirmed appointments."
          actions={
            <Link to={route} className={textLinkClass}>
              {routeLabel}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          }
        />
      </div>

      {loading ? (
        <div className="space-y-4 p-4 sm:p-5">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/5 rounded-md" />
                <Skeleton className="h-2.5 w-1/3 rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 sm:p-5">
          <CalmError message={error} onRetry={onRetry} />
        </div>
      ) : visible.length === 0 ? (
        <div className="p-4 sm:p-5">
          <CalmEmpty
            icon={<CalendarDaysIcon />}
            title="No upcoming appointments"
            hint={
              isBooker
                ? 'Book a visit and it will appear here with its date, time and status.'
                : 'Confirmed bookings will appear here as soon as they are created.'
            }
            action={
              isBooker ? (
                <Link
                  to="/book"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CalendarIcon className="h-4 w-4" />
                  {role === 'RECEPTIONIST' ? 'Book for patient' : 'Book appointment'}
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul>
          {visible.map((appointment) => {
            const parts = dateParts(appointment.start)
            return (
              <li key={appointment.id} className="border-b border-line last:border-b-0">
                <Link
                  to={route}
                  className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-subtle/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                >
                  <span className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-line bg-subtle px-1 py-1.5">
                    <span className="font-display text-base font-semibold leading-none text-ink">
                      {parts.day}
                    </span>
                    <span className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-muted">
                      {parts.month}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 truncate text-sm font-semibold text-ink">
                        {role === 'PATIENT' ? appointment.doctorName : appointment.patientName}
                      </span>
                      <AppointmentStatusBadge
                        status={appointment.status}
                        label={appointment.statusLabel}
                      />
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {formatTime(appointment.start)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatWeekday(appointment.start, true)}, {formatShortDate(appointment.start)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-ink-soft">
                        {formatRelative(appointment.start)}
                      </span>
                    </span>
                    {appointment.reason && (
                      <span className="mt-1 block truncate text-xs text-ink-soft">
                        {appointment.reason}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Emergency snapshot                                                         */
/* -------------------------------------------------------------------------- */

export function EmergencySnapshot({
  role,
  board,
  mine,
  loading,
  error,
  onRetry,
}: {
  role: Role
  board: Board | null
  mine: EmergencyCase[]
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const isPatient = role === 'PATIENT'
  const source = isPatient ? mine : (board?.cases ?? [])
  const active = sortCases(source.filter((item) => item.status !== 'RESOLVED'))
  const visible = active.slice(0, 3)
  const criticalCount = active.filter((item) => item.severity === 'CRITICAL').length
  const route = isPatient ? '/emergencies' : '/board'

  return (
    <Card className="h-full min-w-0 p-4 sm:p-5">
      <SectionHeader
        title={isPatient ? 'Your emergency cases' : 'Emergency snapshot'}
        description={
          isPatient
            ? 'Open cases raised in your name.'
            : 'The highest-severity cases on the active board.'
        }
        actions={
          <Link to={route} className={textLinkClass}>
            {isPatient ? 'My emergencies' : 'Open board'}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        }
      />

      <div className="mt-4">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-5 w-32 rounded-full" />
                <Skeleton className="h-3 w-3/5 rounded-md" />
                <Skeleton className="h-2.5 w-2/5 rounded-sm" />
              </div>
            ))}
          </div>
        ) : error ? (
          <CalmError message={error} onRetry={onRetry} />
        ) : active.length === 0 ? (
          <CalmEmpty
            icon={<CheckCircleIcon />}
            title={isPatient ? 'No open emergency cases' : 'No active emergencies'}
            hint={
              isPatient
                ? 'Cases you raise will show their severity, status and wait time here.'
                : 'New emergency cases will appear here the moment they are raised.'
            }
          />
        ) : (
          <div className="space-y-3">
            {!isPatient && criticalCount > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-critical/30 bg-critical-soft p-3 text-critical-ink">
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {criticalCount} critical {criticalCount === 1 ? 'case' : 'cases'} active
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed">
                    Critical cases are listed first and need prompt acknowledgement.
                  </p>
                </div>
              </div>
            )}

            <ul className="space-y-3">
              {visible.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-line bg-subtle/40 p-3 transition-colors hover:border-line-strong hover:bg-subtle"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={item.severity} label={item.severityLabel} />
                    <EmergencyStatusBadge status={item.status} label={item.statusLabel} />
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-muted">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {formatWait(item.raisedAt, item.resolvedAt)} wait
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-ink">
                    {item.typeLabel}
                    <span className="font-normal text-muted"> · {item.location}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {item.patientLabel ?? 'Unidentified patient'}
                    {item.assignedToName ? ` · ${item.assignedToName}` : ' · Awaiting assignment'}
                  </p>
                </li>
              ))}
            </ul>

            {active.length > visible.length && (
              <p className="text-xs text-muted">
                +{active.length - visible.length} more on the{' '}
                {isPatient ? 'case list' : 'active board'}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Quick actions and recent activity                                          */
/* -------------------------------------------------------------------------- */

interface QuickAction {
  to: string
  label: string
  icon: IconComponent
}

const QUICK_ACTIONS: Record<Role, QuickAction[]> = {
  PATIENT: [
    { to: '/book', label: 'Book appointment', icon: CalendarIcon },
    { to: '/appointments', label: 'My appointments', icon: ClipboardIcon },
    { to: '/emergencies', label: 'My emergencies', icon: AlertIcon },
  ],
  DOCTOR: [
    { to: '/schedule', label: 'My schedule', icon: CalendarIcon },
    { to: '/availability', label: 'Availability', icon: ClockIcon },
    { to: '/board', label: 'Emergency board', icon: AlertIcon },
  ],
  RECEPTIONIST: [
    { to: '/book', label: 'Book for patient', icon: CalendarIcon },
    { to: '/all-appointments', label: 'All appointments', icon: ClipboardIcon },
    { to: '/waitlist', label: 'Re-booking queue', icon: ClockIcon },
    { to: '/board', label: 'Emergency board', icon: AlertIcon },
  ],
  ER_STAFF: [
    { to: '/board', label: 'Emergency board', icon: AlertIcon },
    { to: '/all-appointments', label: 'All appointments', icon: ClipboardIcon },
  ],
  ADMIN: [
    { to: '/users', label: 'Users', icon: UsersIcon },
    { to: '/departments', label: 'Departments', icon: BuildingIcon },
    { to: '/reports', label: 'Reports', icon: ReportIcon },
    { to: '/all-appointments', label: 'All appointments', icon: ClipboardIcon },
    { to: '/waitlist', label: 'Re-booking queue', icon: ClockIcon },
    { to: '/board', label: 'Emergency board', icon: AlertIcon },
  ],
}

export function QuickActions({ role }: { role: Role }) {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <SectionHeader
        title="Quick actions"
        description="The tools your role uses most, one tap away."
      />
      <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS[role].map((action) => {
          const Icon = action.icon
          return (
            <li key={action.to} className="min-w-0">
              <Link
                to={action.to}
                className="group flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-line hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-subtle text-muted transition-colors group-hover:bg-surface group-hover:text-accent-ink"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 truncate">{action.label}</span>
                <ArrowRightIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

export function RecentEvents({
  events,
  loading,
  error,
  onRetry,
}: {
  events: EmergencyEvent[]
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const sorted = useMemo(
    () =>
      [...events].sort(
        (left, right) =>
          new Date(right.eventTime).getTime() - new Date(left.eventTime).getTime(),
      ),
    [events],
  )

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <SectionHeader
        title="Recent emergency activity"
        description="The latest movements across the emergency board."
      />
      <div className="mt-4">
        {loading ? (
          <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full" />
                <Skeleton className="h-2.5 w-2/5 rounded-sm" />
                <Skeleton className="ml-auto h-2.5 w-12 rounded-sm" />
              </div>
            ))}
          </div>
        ) : error ? (
          <CalmError message={error} onRetry={onRetry} />
        ) : sorted.length === 0 ? (
          <CalmEmpty
            icon={<HistoryIcon />}
            title="No board activity yet"
            hint="Raised, dispatched and resolved cases will be listed here."
          />
        ) : (
          <ol className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
            {sorted.slice(0, 8).map((event) => (
              <li key={event.id} className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent ring-2 ring-accent/15"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    <span className="font-medium">{eventLabel(event.eventType)}</span>{' '}
                    <span className="text-muted">#{event.emergencyId}</span>
                  </p>
                  {event.note && (
                    <p className="mt-0.5 truncate text-xs text-muted" title={event.note}>
                      {event.note}
                    </p>
                  )}
                </div>
                <time
                  dateTime={event.eventTime}
                  title={formatDateTime(event.eventTime)}
                  className="shrink-0 text-[11px] tabular-nums text-muted"
                >
                  {formatRelative(event.eventTime)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  )
}
