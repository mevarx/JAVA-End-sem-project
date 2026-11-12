import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { appointmentApi } from '../../api/endpoints'
import type { Appointment, AppointmentStatus } from '../../api/types'
import {
  APPOINTMENT_STATUS_LABELS,
  dayKey,
  formatDate,
  formatTime,
  formatWeekday,
  isToday,
  todayIso,
} from '../../lib/format'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { fadeUp, fadeUpSmall, staggerContainer } from '../../lib/motion'
import {
  Alert,
  Button,
  Card,
  CompactStatStrip,
  EmptyState,
  PageHeader,
  SegmentedControl,
  StatCard,
  cx,
} from '../../components/ui'
import { AppointmentStatusBadge } from '../../components/status'
import { ConfirmDialog, TableSkeleton, useToast } from '../../components/feedback'
import { AppointmentDetailPanel } from '../../components/AppointmentDetailPanel'
import {
  AlertCircleIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  InboxIcon,
  RefreshIcon,
  StethoscopeIcon,
  TimerIcon,
  XCircleIcon,
} from '../../components/icons'

type StatusFilter = 'ALL' | AppointmentStatus

const STATUS_ORDER: AppointmentStatus[] = [
  'BOOKED',
  'COMPLETED',
  'NO_SHOW',
  'PRE_EMPTED',
  'CANCELLED',
  'RESCHEDULED',
]

function AgendaRow({
  appointment,
  selected,
  onSelect,
}: {
  appointment: Appointment
  selected: boolean
  onSelect: () => void
}) {
  const active = appointment.status === 'BOOKED'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        'flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-accent/40 bg-accent-soft/40'
          : 'border-line bg-surface hover:border-line-strong hover:bg-subtle/60',
      )}
    >
      <span className="flex w-14 shrink-0 flex-col gap-0.5">
        <span className="text-sm font-semibold tabular-nums text-ink">
          {formatTime(appointment.start)}
        </span>
        <span className="text-[11px] tabular-nums text-muted">
          {formatTime(appointment.end)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">
          {appointment.patientName}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-soft">
          {appointment.reason?.trim() || 'No reason recorded'}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <AppointmentStatusBadge status={appointment.status} label={appointment.statusLabel} />
        {active && <span className="font-mono text-[10px] text-muted">#{appointment.id}</span>}
      </span>
    </button>
  )
}

export function SchedulePage() {
  const { push } = useToast()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [noShowTarget, setNoShowTarget] = useState<Appointment | null>(null)
  const [pending, setPending] = useState<'COMPLETED' | 'NO_SHOW' | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    appointmentApi
      .list()
      .then((data) => {
        setAppointments(data)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your schedule.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(load)

  useEffect(() => {
    setSelected((current) =>
      current ? (appointments.find((appointment) => appointment.id === current.id) ?? null) : current,
    )
  }, [appointments])

  const visible = useMemo(
    () =>
      filter === 'ALL'
        ? appointments
        : appointments.filter((appointment) => appointment.status === filter),
    [appointments, filter],
  )

  const statusCounts = useMemo(() => {
    const counts = new Map<AppointmentStatus, number>()
    appointments.forEach((appointment) => {
      counts.set(appointment.status, (counts.get(appointment.status) ?? 0) + 1)
    })
    return counts
  }, [appointments])

  const statusOptions = useMemo(
    () => [
      { value: 'ALL' as const, label: 'All', count: appointments.length },
      ...STATUS_ORDER.map((status) => ({
        value: status,
        label: APPOINTMENT_STATUS_LABELS[status],
        count: statusCounts.get(status) ?? 0,
      })),
    ],
    [appointments.length, statusCounts],
  )

  const groups = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    visible.forEach((appointment) => {
      const key = dayKey(appointment.start)
      const bucket = map.get(key)
      if (bucket) bucket.push(appointment)
      else map.set(key, [appointment])
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, items]) => ({
        day,
        items: items.slice().sort((a, b) => a.start.localeCompare(b.start)),
      }))
  }, [visible])

  const stats = useMemo(() => {
    let today = 0
    let remaining = 0
    let completedToday = 0
    appointments.forEach((appointment) => {
      if (!isToday(appointment.start)) return
      today += 1
      if (appointment.status === 'BOOKED') remaining += 1
      if (appointment.status === 'COMPLETED') completedToday += 1
    })
    return { today, remaining, completedToday }
  }, [appointments])

  const active = selected?.status === 'BOOKED'

  async function updateStatus(target: Appointment, status: 'COMPLETED' | 'NO_SHOW') {
    if (target.status !== 'BOOKED') return
    setPending(status)
    setError(null)
    try {
      await appointmentApi.changeStatus(target.id, status)
      push({
        tone: 'success',
        title: status === 'COMPLETED' ? 'Consultation completed' : 'Marked as no-show',
        description:
          status === 'COMPLETED'
            ? `#${target.id} for ${target.patientName} is closed.`
            : `#${target.id} for ${target.patientName} was released for re-booking.`,
      })
      setSelected((current) => (current?.id === target.id ? null : current))
      setNoShowTarget(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the appointment.')
      setNoShowTarget(null)
    } finally {
      setPending(null)
    }
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <PageHeader
          eyebrow="Doctor workspace"
          title="My schedule"
          subtitle="Your consultations grouped by day. Close a visit or release a slot when a patient does not attend."
          actions={
            <Button variant="secondary" onClick={load}>
              <RefreshIcon aria-hidden="true" className="h-4 w-4" />
              Refresh
            </Button>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpSmall}>
        <CompactStatStrip
          items={[
            { label: 'Today', value: stats.today },
            { label: 'Remaining', value: stats.remaining, tone: 'accent' },
            { label: 'Completed', value: stats.completedToday },
          ]}
        />
      </motion.div>

      <motion.div
        variants={fadeUpSmall}
        className="hidden gap-3 sm:grid sm:grid-cols-3"
      >
        <StatCard
          label="Today"
          value={stats.today}
          hint="Appointments dated today"
          icon={<CalendarDaysIcon aria-hidden="true" className="h-4 w-4" />}
        />
        <StatCard
          label="Remaining today"
          value={stats.remaining}
          hint="Still booked and awaiting a decision"
          tone="accent"
          icon={<TimerIcon aria-hidden="true" className="h-4 w-4" />}
        />
        <StatCard
          label="Completed today"
          value={stats.completedToday}
          hint="Closed consultations today"
          icon={<CheckCircleIcon aria-hidden="true" className="h-4 w-4" />}
        />
      </motion.div>

      <motion.div variants={fadeUpSmall} className="space-y-4">
        {error && (
          <Alert tone="error" title="Something went wrong" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              Showing <span className="font-semibold text-ink">{visible.length}</span> of{' '}
              {appointments.length} appointment{appointments.length === 1 ? '' : 's'}
            </p>
            <div className="min-w-0 flex-1">
              <SegmentedControl
                ariaLabel="Filter by status"
                options={statusOptions}
                value={filter}
                onChange={setFilter}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-start">
        <div className="order-2 min-w-0 space-y-4 xl:order-1">
          {loading ? (
            <TableSkeleton rows={6} columns={4} />
          ) : appointments.length === 0 ? (
            error ? (
              <EmptyState
                icon={<AlertCircleIcon aria-hidden="true" className="h-5 w-5" />}
                title="Could not load your schedule"
                hint="Check the connection to the hospital service, then try again."
                action={
                  <Button variant="secondary" onClick={load}>
                    <RefreshIcon aria-hidden="true" className="h-4 w-4" />
                    Try again
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<StethoscopeIcon aria-hidden="true" className="h-5 w-5" />}
                title="No consultations yet"
                hint="Once patients book one of your published slots, the consultation appears here."
              />
            )
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<InboxIcon aria-hidden="true" className="h-5 w-5" />}
              title="No appointments match this filter"
              hint={`Nothing is currently marked “${
                filter === 'ALL' ? 'All' : APPOINTMENT_STATUS_LABELS[filter]
              }”.`}
              action={
                <Button variant="secondary" onClick={() => setFilter('ALL')}>
                  Show all appointments
                </Button>
              }
            />
          ) : (
            <div className="space-y-5">
              {groups.map((group) => {
                const today = group.day === todayIso()
                return (
                  <section key={group.day} aria-label={formatDate(group.day)} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-semibold text-ink">
                        {formatWeekday(group.day, true)} {formatDate(group.day)}
                      </h2>
                      {today && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-ink">
                          Today
                        </span>
                      )}
                      <span className="text-xs tabular-nums text-muted">
                        {group.items.length} appointment{group.items.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <Card className="flex flex-col gap-2 p-2.5">
                      {group.items.map((appointment) => (
                        <AgendaRow
                          key={appointment.id}
                          appointment={appointment}
                          selected={selected?.id === appointment.id}
                          onSelect={() => setSelected(appointment)}
                        />
                      ))}
                    </Card>
                  </section>
                )
              })}
            </div>
          )}
        </div>

        <aside
          aria-label="Selected consultation"
          className={cx(
            'order-1 min-w-0 space-y-3 xl:order-2 xl:sticky xl:top-6',
            !selected && 'hidden xl:block',
          )}
        >
          <AppointmentDetailPanel
            appointment={selected}
            context="doctor"
            canReschedule={false}
            canCancel={false}
            onReschedule={() => undefined}
            onCancel={() => undefined}
            emptyTitle="Select a consultation to act on it"
          />

          <Card className="p-4 sm:p-5">
            <h2 className="font-display text-base font-semibold text-ink">Consultation outcome</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {selected
                ? active
                  ? `Selected #${selected.id} · ${selected.patientName}`
                  : `#${selected.id} is ${selected.statusLabel.toLowerCase()} and can no longer be updated.`
                : 'Only booked consultations can be completed or marked no-show.'}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row xl:flex-col">
              <Button
                onClick={() => selected && updateStatus(selected, 'COMPLETED')}
                disabled={!active || pending !== null}
                loading={pending === 'COMPLETED'}
                className="w-full"
              >
                <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
                Mark completed
              </Button>
              <Button
                variant="danger"
                onClick={() => selected && setNoShowTarget(selected)}
                disabled={!active || pending !== null}
                className="w-full"
              >
                <XCircleIcon aria-hidden="true" className="h-4 w-4" />
                Mark no-show
              </Button>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <ClockIcon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Marking no-show releases the slot so reception can re-book the patient.
            </p>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={noShowTarget !== null}
        title="Mark this consultation as no-show?"
        description={
          noShowTarget
            ? `#${noShowTarget.id} for ${noShowTarget.patientName} at ${formatTime(
                noShowTarget.start,
              )} on ${formatDate(noShowTarget.start)} will be released for re-booking.`
            : undefined
        }
        confirmLabel="Mark no-show"
        tone="danger"
        busy={pending === 'NO_SHOW'}
        onConfirm={() => noShowTarget && updateStatus(noShowTarget, 'NO_SHOW')}
        onClose={() => {
          if (pending === null) setNoShowTarget(null)
        }}
      />
    </motion.div>
  )
}
