import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { appointmentApi } from '../../api/endpoints'
import type { Appointment, AppointmentStatus, Slot } from '../../api/types'
import {
  APPOINTMENT_STATUS_LABELS,
  dateParts,
  dayKey,
  formatDate,
  formatTime,
  formatWeekday,
  todayIso,
} from '../../lib/format'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { fadeUp, fadeUpSmall, staggerContainer } from '../../lib/motion'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  SegmentedControl,
  SearchInput,
  cx,
  selectClass,
} from '../../components/ui'
import { AppointmentStatusBadge } from '../../components/status'
import { DataList, type Column } from '../../components/DataList'
import { ConfirmDialog, TableSkeleton, useToast } from '../../components/feedback'
import { CalendarMonth } from '../../components/CalendarMonth'
import { AppointmentDetailPanel } from '../../components/AppointmentDetailPanel'
import { SlotPickerModal } from '../../components/SlotPickerModal'
import {
  AlertCircleIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ClockIcon,
  InboxIcon,
  PlusIcon,
  RefreshIcon,
} from '../../components/icons'

type ViewMode = 'list' | 'calendar'

const STATUS_ORDER: AppointmentStatus[] = [
  'BOOKED',
  'COMPLETED',
  'PRE_EMPTED',
  'NO_SHOW',
  'CANCELLED',
  'RESCHEDULED',
]

function matchesQuery(appointment: Appointment, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [
    appointment.doctorName,
    appointment.reason ?? '',
    appointment.statusLabel,
    formatDate(appointment.start),
    formatWeekday(appointment.start),
    appointment.start.slice(0, 10),
    `#${appointment.id}`,
    String(appointment.id),
  ]
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

function DateBlock({ iso }: { iso: string }) {
  const parts = dateParts(iso)
  return (
    <span className="flex w-14 shrink-0 flex-col items-center rounded-lg border border-line bg-subtle px-2 py-1.5">
      <span className="font-display text-lg font-semibold leading-none text-ink tabular-nums">
        {parts.day}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-muted">
        {parts.month} · {parts.weekday}
      </span>
    </span>
  )
}

function AppointmentMobileCard({ appointment }: { appointment: Appointment }) {
  return (
    <span className="flex items-start gap-3">
      <DateBlock iso={appointment.start} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <span className="min-w-0 truncate text-sm font-semibold text-ink">
            {appointment.doctorName}
          </span>
          <AppointmentStatusBadge status={appointment.status} label={appointment.statusLabel} />
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-muted">
          <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {formatTime(appointment.start)}–{formatTime(appointment.end)}
        </span>
        <span className="mt-1.5 line-clamp-2 text-sm leading-snug text-ink-soft">
          {appointment.reason?.trim() || 'No reason provided'}
        </span>
      </span>
    </span>
  )
}

function AgendaCard({
  appointment,
  selected,
  onSelect,
}: {
  appointment: Appointment
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Card
      className={cx(
        'p-0 transition-colors duration-150',
        selected ? 'border-accent/40 ring-1 ring-accent/20' : 'hover:border-line-strong',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full cursor-pointer items-start gap-3 rounded-card p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <DateBlock iso={appointment.start} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <span className="min-w-0 truncate text-sm font-semibold text-ink">
              {appointment.doctorName}
            </span>
            <AppointmentStatusBadge status={appointment.status} label={appointment.statusLabel} />
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-muted">
            <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {formatTime(appointment.start)}–{formatTime(appointment.end)}
          </span>
          <span className="mt-1.5 block line-clamp-2 text-sm leading-snug text-ink-soft">
            {appointment.reason?.trim() || 'No reason provided'}
          </span>
        </span>
      </button>
    </Card>
  )
}

export function MyAppointmentsPage() {
  const navigate = useNavigate()
  const { push } = useToast()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | AppointmentStatus>('ALL')
  const [view, setView] = useState<ViewMode>('list')

  const [month, setMonth] = useState(() => todayIso().slice(0, 7))
  const [selectedDay, setSelectedDay] = useState(() => todayIso())

  const [selected, setSelected] = useState<Appointment | null>(null)
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    appointmentApi
      .list()
      .then((data) => {
        setAppointments(data)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load appointments.'))
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

  const detailRef = useRef<HTMLElement | null>(null)
  const [revealToken, setRevealToken] = useState(0)

  const selectAppointment = useCallback((appointment: Appointment | null) => {
    setSelected(appointment)
    if (appointment) setRevealToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (revealToken === 0) return
    const panel = detailRef.current
    if (!panel) return
    if (window.matchMedia('(min-width: 1280px)').matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }, [revealToken])

  const searched = useMemo(
    () => appointments.filter((appointment) => matchesQuery(appointment, query)),
    [appointments, query],
  )

  const statusCounts = useMemo(() => {
    const counts = new Map<AppointmentStatus, number>()
    searched.forEach((appointment) => {
      counts.set(appointment.status, (counts.get(appointment.status) ?? 0) + 1)
    })
    return counts
  }, [searched])

  const statusOptions = useMemo(
    () => [
      { value: 'ALL' as const, label: 'All', count: searched.length },
      ...STATUS_ORDER.map((status) => ({
        value: status,
        label: APPOINTMENT_STATUS_LABELS[status],
        count: statusCounts.get(status) ?? 0,
      })),
    ],
    [searched.length, statusCounts],
  )

  const visible = useMemo(
    () =>
      statusFilter === 'ALL'
        ? searched
        : searched.filter((appointment) => appointment.status === statusFilter),
    [searched, statusFilter],
  )

  const dayAppointments = useMemo(
    () =>
      visible
        .filter((appointment) => dayKey(appointment.start) === selectedDay)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [visible, selectedDay],
  )

  const canCancel = selected?.status === 'BOOKED'
  const canReschedule = selected?.status === 'BOOKED' || selected?.status === 'PRE_EMPTED'

  const columns: Column<Appointment>[] = [
    {
      key: 'when',
      header: 'When',
      render: (appointment) => (
        <span className="whitespace-nowrap">
          {formatDate(appointment.start)}
          <span className="text-muted" aria-hidden="true">
            {' · '}
          </span>
          <span className="tabular-nums">{formatTime(appointment.start)}</span>
        </span>
      ),
    },
    {
      key: 'doctor',
      header: 'Doctor',
      render: (appointment) => (
        <span className="whitespace-nowrap font-medium text-ink">{appointment.doctorName}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (appointment) => (
        <span
          className="block max-w-[12rem] truncate text-ink-soft xl:max-w-[16rem]"
          title={appointment.reason || undefined}
        >
          {appointment.reason?.trim() || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (appointment) => (
        <AppointmentStatusBadge status={appointment.status} label={appointment.statusLabel} />
      ),
    },
  ]

  async function reschedule(slot: Slot) {
    if (!rescheduling) return
    await appointmentApi.reschedule(rescheduling.id, slot.id)
    push({
      tone: 'success',
      title: 'Appointment moved',
      description: `#${rescheduling.id} is now ${formatDate(slot.start)} at ${formatTime(slot.start)} with ${slot.doctorName}.`,
    })
    setSelected(null)
    setRescheduling(null)
    load()
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    setCancelBusy(true)
    setError(null)
    try {
      await appointmentApi.cancel(cancelTarget.id)
      push({
        tone: 'success',
        title: 'Appointment cancelled',
        description: `#${cancelTarget.id} with ${cancelTarget.doctorName} on ${formatDate(
          cancelTarget.start,
        )} was cancelled.`,
      })
      setSelected((current) => (current?.id === cancelTarget.id ? null : current))
      setCancelTarget(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel the appointment.')
      setCancelTarget(null)
    } finally {
      setCancelBusy(false)
    }
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <PageHeader
          eyebrow="Patient portal"
          title="My appointments"
          subtitle="Review your bookings, move an appointment or release a slot you no longer need."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={load}>
                <RefreshIcon aria-hidden="true" className="h-4 w-4" />
                Refresh
              </Button>
              <Button onClick={() => navigate('/book')}>
                <PlusIcon aria-hidden="true" className="h-4 w-4" />
                Book appointment
              </Button>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpSmall} className="space-y-4">
        {error && (
          <Alert tone="error" title="Something went wrong" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card className="p-4 sm:p-5">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search doctor, reason, date or #id"
                label="Search appointments"
                className="w-full flex-1"
              />
              <SegmentedControl
                ariaLabel="Choose view"
                options={[
                  { value: 'list' as const, label: 'List' },
                  { value: 'calendar' as const, label: 'Calendar' },
                ]}
                value={view}
                onChange={setView}
                className="sm:w-auto"
              />
            </div>
            <div className="xl:hidden">
              <Field label="Status">
                <select
                  className={selectClass}
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'ALL' | AppointmentStatus)
                  }
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value === 'ALL' ? 'All statuses' : option.label}
                      {` (${option.count})`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="hidden xl:block">
              <SegmentedControl
                ariaLabel="Filter by status"
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
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
                title="Could not load your appointments"
                hint="Check your connection, then try again."
                action={
                  <Button variant="secondary" onClick={load}>
                    <RefreshIcon aria-hidden="true" className="h-4 w-4" />
                    Try again
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<InboxIcon aria-hidden="true" className="h-5 w-5" />}
                title="No appointments yet"
                hint="Book a consultation and it will appear here with everything you need to prepare."
                action={
                  <Button onClick={() => navigate('/book')}>
                    <PlusIcon aria-hidden="true" className="h-4 w-4" />
                    Book appointment
                  </Button>
                }
              />
            )
          ) : view === 'list' ? (
            visible.length === 0 ? (
              <EmptyState
                icon={<InboxIcon aria-hidden="true" className="h-5 w-5" />}
                title="No bookings match these filters"
                hint="Try a different status or clear the search to see your full history."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('')
                      setStatusFilter('ALL')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <DataList
                items={visible}
                columns={columns}
                rowKey={(appointment) => appointment.id}
                selectedKey={selected?.id ?? null}
                onSelect={selectAppointment}
                mobileCard={(appointment) => <AppointmentMobileCard appointment={appointment} />}
                ariaLabel="My appointments"
              />
            )
          ) : (
            <div className="space-y-4">
              <CalendarMonth
                appointments={visible}
                month={month}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onMonthChange={setMonth}
              />
              <Card className="min-w-0 p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-ink">
                    {formatWeekday(selectedDay, true)} {formatDate(selectedDay)}
                  </h2>
                  <span className="text-xs tabular-nums text-muted">
                    {dayAppointments.length} appointment{dayAppointments.length === 1 ? '' : 's'}
                  </span>
                </div>
                {dayAppointments.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line bg-subtle/60 px-4 py-8 text-center text-sm text-muted">
                    Nothing scheduled for this day.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {dayAppointments.map((appointment) => (
                      <AgendaCard
                        key={appointment.id}
                        appointment={appointment}
                        selected={selected?.id === appointment.id}
                        onSelect={() => selectAppointment(appointment)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>

        <aside
          ref={detailRef}
          aria-label="Appointment details"
          className={cx(
            'order-1 min-w-0 scroll-mt-4 xl:order-2 xl:sticky xl:top-6',
            !selected && 'hidden xl:block',
          )}
        >
          <AppointmentDetailPanel
            appointment={selected}
            context="patient"
            canReschedule={Boolean(canReschedule)}
            canCancel={Boolean(canCancel)}
            onReschedule={() => selected && setRescheduling(selected)}
            onCancel={() => selected && setCancelTarget(selected)}
            emptyTitle="Select an appointment to see its details"
          />
          {!selected && (
            <p className="mt-3 hidden items-start gap-2 px-1 text-xs leading-relaxed text-muted xl:flex">
              <CalendarDaysIcon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Choose a booking from the list or pick a day in the calendar. Rescheduling is open for
              booked and pre-empted visits; cancelling is available for active bookings.
            </p>
          )}
          {selected && (
            <p className="mt-3 flex items-start gap-2 px-1 text-xs leading-relaxed text-muted">
              <CalendarIcon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Cancelling releases your slot. Pre-empted visits were displaced by an emergency and can
              be re-booked here.
            </p>
          )}
        </aside>
      </div>

      <SlotPickerModal
        appointment={rescheduling}
        onClose={() => setRescheduling(null)}
        onPick={reschedule}
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel this appointment?"
        description={
          cancelTarget
            ? `Appointment #${cancelTarget.id} with ${cancelTarget.doctorName} on ${formatDate(
                cancelTarget.start,
              )} at ${formatTime(cancelTarget.start)} will be released.`
            : undefined
        }
        confirmLabel="Cancel appointment"
        tone="danger"
        busy={cancelBusy}
        onConfirm={confirmCancel}
        onClose={() => {
          if (!cancelBusy) setCancelTarget(null)
        }}
      />
    </motion.div>
  )
}
