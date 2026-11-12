import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { appointmentApi } from '../../api/endpoints'
import type { Appointment, AppointmentStatus, Slot } from '../../api/types'
import {
  APPOINTMENT_STATUS_LABELS,
  dateParts,
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
  Field,
  PageHeader,
  Pagination,
  SegmentedControl,
  SearchInput,
  SectionHeader,
  StatCard,
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
  ClockIcon,
  InboxIcon,
  RefreshIcon,
  SearchIcon,
  TriangleAlertIcon,
} from '../../components/icons'

type ViewMode = 'list' | 'calendar'
type StatusFilter = 'ALL' | AppointmentStatus

const PAGE_SIZE = 10

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
    appointment.patientName,
    appointment.doctorName,
    appointment.reason ?? '',
    appointment.statusLabel,
    formatDate(appointment.start),
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
            {appointment.patientName}
          </span>
          <AppointmentStatusBadge status={appointment.status} label={appointment.statusLabel} />
        </span>
        <span className="mt-1 block truncate text-sm text-ink-soft">
          {appointment.doctorName}
          <span className="ml-2 font-mono text-[11px] text-muted">#{appointment.id}</span>
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-muted">
          <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {formatTime(appointment.start)}–{formatTime(appointment.end)}
        </span>
        <span className="mt-1.5 line-clamp-2 text-sm leading-snug text-ink-soft">
          {appointment.reason?.trim() || 'No reason recorded'}
        </span>
      </span>
    </span>
  )
}

function AgendaRow({
  appointment,
  selected,
  onSelect,
}: {
  appointment: Appointment
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-accent/40 bg-accent-soft/40'
          : 'border-line bg-surface hover:border-line-strong hover:bg-subtle/60',
      )}
    >
      <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-ink">
        {formatTime(appointment.start)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">
          {appointment.patientName}
        </span>
        <span className="block truncate text-xs text-muted">
          {appointment.doctorName} · {formatTime(appointment.end)}
        </span>
      </span>
      <AppointmentStatusBadge status={appointment.status} label={appointment.statusLabel} />
    </button>
  )
}

export function AllAppointmentsPage() {
  const { push } = useToast()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [view, setView] = useState<ViewMode>('list')
  const [page, setPage] = useState(1)

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

  const visible = useMemo(
    () =>
      statusFilter === 'ALL'
        ? searched
        : searched.filter((appointment) => appointment.status === statusFilter),
    [searched, statusFilter],
  )

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter])

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const stats = useMemo(() => {
    let today = 0
    let booked = 0
    let preEmpted = 0
    appointments.forEach((appointment) => {
      if (isToday(appointment.start)) today += 1
      if (appointment.status === 'BOOKED') booked += 1
      if (appointment.status === 'PRE_EMPTED') preEmpted += 1
    })
    return { today, booked, preEmpted }
  }, [appointments])

  const dayAppointments = useMemo(
    () =>
      visible
        .filter((appointment) => dayKey(appointment.start) === selectedDay)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [visible, selectedDay],
  )

  const canReschedule = selected?.status === 'BOOKED' || selected?.status === 'PRE_EMPTED'
  const canCancel = selected?.status === 'BOOKED'

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

  const columns: Column<Appointment>[] = [
    {
      key: 'id',
      header: '#',
      width: '5rem',
      render: (appointment) => (
        <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted">
          #{appointment.id}
        </span>
      ),
    },
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
      key: 'patient',
      header: 'Patient',
      render: (appointment) => (
        <span className="whitespace-nowrap font-medium text-ink">{appointment.patientName}</span>
      ),
    },
    {
      key: 'doctor',
      header: 'Doctor',
      render: (appointment) => (
        <span className="whitespace-nowrap text-ink-soft">{appointment.doctorName}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      headerClassName: 'hidden xl:table-cell',
      className: 'hidden xl:table-cell',
      render: (appointment) => (
        <span
          className="block max-w-[16rem] truncate text-ink-soft"
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
      description: `#${rescheduling.id} for ${rescheduling.patientName} is now ${formatDate(
        slot.start,
      )} at ${formatTime(slot.start)}.`,
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
        description: `#${cancelTarget.id} for ${cancelTarget.patientName} on ${formatDate(
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
          eyebrow="Front desk"
          title="All appointments"
          subtitle="Every booking across the hospital, with the patient and doctor in one view."
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
            { label: 'Booked', value: stats.booked, tone: 'accent' },
            { label: 'Pre-empted', value: stats.preEmpted, tone: 'warning' },
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
          hint="Appointments scheduled today"
          icon={<CalendarDaysIcon aria-hidden="true" className="h-4 w-4" />}
        />
        <StatCard
          label="Booked"
          value={stats.booked}
          hint="Active bookings across all days"
          tone="accent"
          icon={<ClockIcon aria-hidden="true" className="h-4 w-4" />}
        />
        <StatCard
          label="Pre-empted"
          value={stats.preEmpted}
          hint="Displaced by emergencies, awaiting re-booking"
          tone="warning"
          icon={<TriangleAlertIcon aria-hidden="true" className="h-4 w-4" />}
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
                placeholder="Patient, doctor, reason or #id"
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
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
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
            <TableSkeleton rows={6} columns={5} />
          ) : appointments.length === 0 ? (
            error ? (
              <EmptyState
                icon={<AlertCircleIcon aria-hidden="true" className="h-5 w-5" />}
                title="Could not load appointments"
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
                icon={<InboxIcon aria-hidden="true" className="h-5 w-5" />}
                title="No appointments yet"
                hint="Bookings made by reception or patients will appear here as soon as they are created."
              />
            )
          ) : view === 'list' ? (
            visible.length === 0 ? (
              <EmptyState
                icon={<SearchIcon aria-hidden="true" className="h-5 w-5" />}
                title="No appointments match these filters"
                hint="Try another patient, doctor, reason or status."
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
              <>
                <SectionHeader
                  title="Appointments"
                  description={`${visible.length} matching booking${visible.length === 1 ? '' : 's'}`}
                />
                <DataList
                  items={paged}
                  columns={columns}
                  rowKey={(appointment) => appointment.id}
                  selectedKey={selected?.id ?? null}
                  onSelect={selectAppointment}
                  mobileCard={(appointment) => <AppointmentMobileCard appointment={appointment} />}
                  ariaLabel="All appointments"
                />
                <Pagination
                  page={safePage}
                  pageCount={pageCount}
                  onChange={setPage}
                  totalItems={visible.length}
                  pageSize={PAGE_SIZE}
                />
              </>
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
                    {dayAppointments.length} booking{dayAppointments.length === 1 ? '' : 's'}
                  </span>
                </div>
                {dayAppointments.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line bg-subtle/60 px-4 py-8 text-center text-sm text-muted">
                    No appointments on this day.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayAppointments.map((appointment) => (
                      <AgendaRow
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
            context="staff"
            canReschedule={Boolean(canReschedule)}
            canCancel={Boolean(canCancel)}
            onReschedule={() => selected && setRescheduling(selected)}
            onCancel={() => selected && setCancelTarget(selected)}
            emptyTitle="Select an appointment to see its details"
          />
          <p className="mt-3 flex items-start gap-2 px-1 text-xs leading-relaxed text-muted">
            <CalendarDaysIcon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Booked appointments can be rescheduled or cancelled; pre-empted appointments can be
            rescheduled. Other statuses are read-only.
          </p>
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
            ? `Appointment #${cancelTarget.id} for ${cancelTarget.patientName} with ${
                cancelTarget.doctorName
              } on ${formatDate(cancelTarget.start)} at ${formatTime(
                cancelTarget.start,
              )} will be released.`
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
