import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { appointmentApi, departmentApi, slotApi, userApi } from '../../api/endpoints'
import type { Department, Slot, User } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  PageHeader,
  Skeleton,
  cx,
  inputClass,
  selectClass,
} from '../../components/ui'
import { useToast } from '../../components/feedback'
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
} from '../../components/icons'
import {
  addDaysIso,
  dayKey,
  formatDate,
  formatTime,
  formatWeekday,
  toDate,
  todayIso,
} from '../../lib/format'
import { listItem, staggerContainer } from '../../lib/motion'

export function BookAppointmentPage() {
  const { user } = useAuth()
  const toast = useToast()
  const isPatient = user?.role === 'PATIENT'

  const [departments, setDepartments] = useState<Department[]>([])
  const [doctors, setDoctors] = useState<User[]>([])
  const [patients, setPatients] = useState<User[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState(todayIso())
  const [patientId, setPatientId] = useState('')
  const [reason, setReason] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [selected, setSelected] = useState<Slot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const today = todayIso()

  useEffect(() => {
    departmentApi.list().then(setDepartments).catch(() => setDepartments([]))
    userApi.doctors().then(setDoctors).catch(() => setDoctors([]))
    if (!isPatient) {
      userApi
        .patients()
        .then((list) => {
          setPatients(list)
          if (list.length > 0) setPatientId(String(list[0].id))
        })
        .catch(() => setPatients([]))
    }
  }, [isPatient])

  const loadSlots = useCallback(() => {
    setLoading(true)
    setError(null)
    slotApi
      .available(departmentId ? Number(departmentId) : null, doctorId ? Number(doctorId) : null, date)
      .then((list) => {
        // The server returns free slots up to the end of the selected date, so
        // narrow the list to that civil day before counting or rendering.
        setSlots(list.filter((slot) => dayKey(slot.start) === date))
        setSelected(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load free slots.'))
      .finally(() => setLoading(false))
  }, [departmentId, doctorId, date])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  const filteredDoctors = departmentId
    ? doctors.filter((doctor) => doctor.departmentId === Number(departmentId))
    : doctors

  const groups = useMemo(() => groupSlots(slots), [slots])

  async function book(slot: Slot | null = selected) {
    if (!slot) {
      setError('Choose a free slot first.')
      return
    }
    if (!reason.trim()) {
      setError('Add a reason for the visit.')
      return
    }
    if (!isPatient && !patientId) {
      setError('Select the patient this appointment is for.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const appointment = await appointmentApi.book(
        slot.id,
        reason.trim(),
        isPatient ? undefined : Number(patientId),
      )
      setReason('')
      const message = `Appointment #${appointment.id} booked for ${appointment.patientName} on ${formatDate(
        appointment.start,
      )} at ${formatTime(appointment.start)} with ${appointment.doctorName}.`
      setSuccess(message)
      toast.push({
        title: 'Appointment booked',
        description: `#${appointment.id} · ${formatDate(appointment.start)} at ${formatTime(
          appointment.start,
        )}`,
        tone: 'success',
      })
      loadSlots()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not book the slot.'
      loadSlots()
      setError(message)
      toast.push({
        title: 'Booking failed',
        description: message,
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  function stepDate(delta: number) {
    setDate(addDaysIso(date || today, delta))
  }

  function reviewBooking() {
    summaryRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const selectedPatient = patients.find((patient) => String(patient.id) === patientId)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Appointments"
        title={isPatient ? 'Book an appointment' : 'Book for a patient'}
        subtitle="Only free slots for the selected day are listed. Overlapping bookings are rejected by the database transaction."
        actions={
          <Button variant="secondary" onClick={loadSlots}>
            <RefreshIcon className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Department">
            <select
              className={selectClass}
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value)
                setDoctorId('')
              }}
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Doctor">
            <select
              className={selectClass}
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              <option value="">Any doctor</option>
              {filteredDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          {!isPatient && (
            <Field label="Patient">
              <select
                className={selectClass}
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.fullName}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </Card>

      {(error || success) && (
        <div className="space-y-2">
          {error && <Alert>{error}</Alert>}
          {success && (
            <Alert tone="success" onDismiss={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <Card className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                Available slots
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {loading
                  ? 'Checking availability…'
                  : `${slots.length} free slot${slots.length === 1 ? '' : 's'}${
                      date ? ` · ${formatWeekday(date, true)} ${formatDate(date)}` : ''
                    }`}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <IconButton
                label="Previous day"
                variant="secondary"
                onClick={() => stepDate(-1)}
                disabled={!date || date <= today}
              >
                <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <Button
                variant="secondary"
                size="sm"
                className="min-h-11"
                onClick={() => setDate(today)}
                disabled={date === today}
              >
                Today
              </Button>
              <IconButton
                label="Next day"
                variant="secondary"
                onClick={() => stepDate(1)}
              >
                <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <EmptyState
                title="No free slots on this date"
                hint="Nothing is published for these filters. Try the next day or widen the department and doctor filters."
                icon={<CalendarDaysIcon className="h-5 w-5" />}
                action={
                  <Button variant="secondary" onClick={() => stepDate(1)}>
                    Try next day
                    <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                  </Button>
                }
              />
            ) : (
              <div className="space-y-5">
                {groups.map((group) => (
                  <section key={group.key} aria-label={`${group.label} slots`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                        {group.label}
                      </h3>
                      <span className="text-[11px] tabular-nums text-muted">
                        {group.slots.length} slot{group.slots.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <motion.ul
                      variants={staggerContainer}
                      initial="hidden"
                      animate="show"
                      className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3"
                    >
                      {group.slots.map((slot) => (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          selected={selected?.id === slot.id}
                          onSelect={setSelected}
                        />
                      ))}
                    </motion.ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </Card>

        <BookingSummary
          summaryRef={summaryRef}
          selected={selected}
          reason={reason}
          error={error}
          onReasonChange={setReason}
          onBook={() => book()}
          busy={busy}
          patientName={!isPatient ? selectedPatient?.fullName : undefined}
        />
      </div>

      {selected && (
        <div
          className="sticky bottom-0 z-30 pt-2 xl:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-float min-[360px]:flex-row min-[360px]:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-semibold tabular-nums text-ink">
                {formatTime(selected.start)} – {formatTime(selected.end)}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {selected.doctorName}
                {selected.departmentName ? ` · ${selected.departmentName}` : ''}
              </p>
            </div>
            <Button
              className="w-full shrink-0 min-[360px]:w-auto"
              onClick={reviewBooking}
            >
              Review booking
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SlotCard({
  slot,
  selected,
  onSelect,
}: {
  slot: Slot
  selected: boolean
  onSelect: (slot: Slot) => void
}) {
  return (
    <motion.li variants={listItem} className="min-w-0">
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(slot)}
        className={cx(
          'flex h-full min-h-24 w-full cursor-pointer flex-col rounded-xl border p-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected
            ? 'border-accent bg-accent-soft shadow-xs'
            : 'border-line bg-surface hover:border-accent/50 hover:bg-subtle',
        )}
      >
        <span className="flex w-full items-start justify-between gap-2">
          <span className="font-display text-lg font-semibold leading-none tabular-nums text-ink">
            {formatTime(slot.start)}
          </span>
          <span
            aria-hidden="true"
            className={cx(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
              selected
                ? 'border-accent bg-accent text-on-accent'
                : 'border-line bg-surface text-transparent',
            )}
          >
            <CheckIcon className="h-3 w-3" />
          </span>
        </span>
        <span className="mt-2 block truncate text-sm font-medium text-ink-soft">
          {slot.doctorName}
        </span>
        <span className="mt-auto flex w-full items-center justify-between gap-2 pt-2 text-xs text-muted">
          <span className="min-w-0 truncate">{slot.departmentName || 'General'}</span>
          <span className="shrink-0 tabular-nums">until {formatTime(slot.end)}</span>
        </span>
      </button>
    </motion.li>
  )
}

function BookingSummary({
  summaryRef,
  selected,
  reason,
  error,
  onReasonChange,
  onBook,
  busy,
  patientName,
}: {
  summaryRef: RefObject<HTMLDivElement | null>
  selected: Slot | null
  reason: string
  error?: string | null
  onReasonChange: (value: string) => void
  onBook: () => void
  busy: boolean
  patientName?: string
}) {
  return (
    <Card className="overflow-hidden xl:sticky xl:top-6">
      <div ref={summaryRef} className="scroll-mt-4 bg-panel px-4 py-4 text-panel-ink">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-panel-muted">
          Booking summary
        </p>
        <p className="mt-1.5 font-display text-lg font-semibold leading-tight">
          {selected ? formatWeekday(selected.start, true) : 'Pick a slot'}
        </p>
        <p className="mt-1 text-sm text-panel-muted">
          {selected ? formatDate(selected.start) : 'Free times for the selected day appear beside this panel.'}
        </p>
      </div>

      <div className="space-y-4 p-4">
        {selected ? (
          <div className="rounded-xl border border-accent/30 bg-accent-soft/70 p-3">
            <p className="flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-accent-ink">
              {formatTime(selected.start)} – {formatTime(selected.end)}
            </p>
            <p className="mt-1.5 truncate text-sm font-medium text-ink">{selected.doctorName}</p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {selected.departmentName || 'General'}
              {patientName ? ` · for ${patientName}` : ''}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line bg-subtle/50 p-3 text-sm leading-relaxed text-muted">
            Select a free time to review the visit before booking.
          </div>
        )}

        {error && <Alert>{error}</Alert>}

        <Field label="Reason for visit">
          <input
            className={inputClass}
            value={reason}
            placeholder="e.g. follow-up consultation"
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
          <span className="text-muted">Total time</span>
          <span className="font-semibold tabular-nums text-ink">
            {selected ? slotDuration(selected) : '—'}
          </span>
        </div>

        <Button className="w-full" onClick={onBook} disabled={busy || !selected} loading={busy}>
          {busy ? 'Booking…' : 'Book appointment'}
        </Button>
        {!selected && (
          <p className="text-center text-xs leading-relaxed text-muted">
            Choose a slot to enable booking.
          </p>
        )}
      </div>
    </Card>
  )
}

type SlotGroupKey = 'morning' | 'afternoon' | 'evening'

interface SlotGroup {
  key: SlotGroupKey
  label: string
  slots: Slot[]
}

function groupSlots(slots: Slot[]): SlotGroup[] {
  const groups: SlotGroup[] = [
    { key: 'morning', label: 'Morning', slots: [] },
    { key: 'afternoon', label: 'Afternoon', slots: [] },
    { key: 'evening', label: 'Evening', slots: [] },
  ]

  for (const slot of slots) {
    const hour = toDate(slot.start)?.getHours() ?? 0
    const target = hour < 12 ? groups[0] : hour < 17 ? groups[1] : groups[2]
    target.slots.push(slot)
  }

  return groups.filter((group) => group.slots.length > 0)
}

function slotDuration(slot: Slot): string {
  const start = toDate(slot.start)
  const end = toDate(slot.end)
  if (!start || !end) return '—'
  return `${Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))} min`
}
