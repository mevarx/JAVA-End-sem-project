import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { appointmentApi } from '../../api/endpoints'
import type { Appointment, Slot } from '../../api/types'
import { formatDate, formatDateTime, formatTime } from '../../lib/format'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { fadeUp, fadeUpSmall, staggerContainer } from '../../lib/motion'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  cx,
} from '../../components/ui'
import { AppointmentStatusBadge } from '../../components/status'
import { TableSkeleton, useToast } from '../../components/feedback'
import { SlotPickerModal } from '../../components/SlotPickerModal'
import {
  AlertCircleIcon,
  CalendarDaysIcon,
  ClockIcon,
  InboxIcon,
  RefreshIcon,
  StethoscopeIcon,
  UsersIcon,
} from '../../components/icons'

function QueueCard({
  appointment,
  position,
  selected,
  onSelect,
}: {
  appointment: Appointment
  position: number
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
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold tabular-nums text-accent-ink"
        >
          {position}
        </span>
        <span className="min-w-0 flex-1">
          <span className="sr-only">Queue position {position}. </span>
          <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <span className="min-w-0 truncate text-sm font-semibold text-ink">
              {appointment.patientName}
            </span>
            <AppointmentStatusBadge status={appointment.status} label={appointment.statusLabel} />
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
            <StethoscopeIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="min-w-0 truncate">{appointment.doctorName}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDaysIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {formatDate(appointment.start)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {formatTime(appointment.start)}
            </span>
          </span>
          <span className="mt-1.5 block line-clamp-2 text-sm leading-snug text-ink-soft">
            {appointment.reason?.trim() || 'No reason recorded'}
          </span>
        </span>
      </button>
    </Card>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line/70 py-2.5 last:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  )
}

export function WaitlistPage() {
  const { push } = useToast()

  const [waitlist, setWaitlist] = useState<Appointment[]>([])
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [picking, setPicking] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    appointmentApi
      .waitlist()
      .then((data) => {
        setWaitlist(data)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the waitlist.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(load)

  const selectedPosition = selected
    ? waitlist.findIndex((entry) => entry.id === selected.id) + 1
    : 0

  useEffect(() => {
    if (selected && !waitlist.some((entry) => entry.id === selected.id)) {
      setSelected(null)
    }
  }, [waitlist, selected])

  async function rebook(slot: Slot) {
    if (!picking) return
    await appointmentApi.reschedule(picking.id, slot.id)
    push({
      tone: 'success',
      title: 'Patient re-booked',
      description: `${picking.patientName} is now booked for ${formatDate(slot.start)} at ${formatTime(
        slot.start,
      )} with ${slot.doctorName}.`,
    })
    setSelected(null)
    setPicking(null)
    load()
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <PageHeader
          eyebrow="Front desk"
          title="Re-booking queue"
          subtitle="Appointments displaced by a critical emergency. Re-book each patient into any free slot."
          actions={
            <Button variant="secondary" onClick={load}>
              <RefreshIcon aria-hidden="true" className="h-4 w-4" />
              Refresh
            </Button>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpSmall} className="space-y-4">
        {error && (
          <Alert tone="error" title="Something went wrong" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <p className="inline-flex items-center gap-2 text-sm text-ink-soft">
            <UsersIcon aria-hidden="true" className="h-4 w-4 text-muted" />
            <span className="tabular-nums font-semibold text-ink">{waitlist.length}</span>
            appointment{waitlist.length === 1 ? '' : 's'} waiting for re-booking
          </p>
          <p className="text-xs text-muted">
            {waitlist.length === 0
              ? 'New displacements will appear here.'
              : 'Select a patient to re-book'}
          </p>
        </Card>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] xl:items-start">
        <div className="order-2 min-w-0 space-y-3 xl:order-1">
          {loading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : waitlist.length === 0 ? (
            error ? (
              <EmptyState
                icon={<AlertCircleIcon aria-hidden="true" className="h-5 w-5" />}
                title="Could not load the re-booking queue"
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
                title="Nothing in the re-booking queue"
                hint="Routine bookings are intact. Appointments displaced by a critical emergency will appear here."
              />
            )
          ) : (
            <>
              <SectionHeader
                title="Queue"
                description={`${waitlist.length} patient${waitlist.length === 1 ? '' : 's'} to re-book`}
              />
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-2.5"
              >
                {waitlist.map((appointment, index) => (
                  <motion.div key={appointment.id} variants={fadeUpSmall}>
                    <QueueCard
                      appointment={appointment}
                      position={index + 1}
                      selected={selected?.id === appointment.id}
                      onSelect={() => setSelected(appointment)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </>
          )}
        </div>

        <aside
          aria-label="Waitlisted appointment"
          className={cx(
            'order-1 min-w-0 xl:order-2 xl:sticky xl:top-6',
            !selected && 'hidden xl:block',
          )}
        >
          {selected ? (
            <Card className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Queue position
                  </p>
                  <p className="mt-1 font-display text-3xl font-semibold leading-none tabular-nums text-ink">
                    {selectedPosition > 0 ? selectedPosition : '—'}
                    <span className="ml-1 text-sm font-medium text-muted">
                      / {waitlist.length}
                    </span>
                  </p>
                </div>
                <AppointmentStatusBadge status={selected.status} label={selected.statusLabel} />
              </div>

              <p className="mt-4 font-display text-lg font-semibold text-ink">
                {selected.patientName}
              </p>

              <dl className="mt-2">
                <DetailRow label="Doctor">
                  <span className="inline-flex items-center gap-1.5">
                    <StethoscopeIcon aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                    {selected.doctorName}
                  </span>
                </DetailRow>
                <DetailRow label="Original slot">
                  <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDaysIcon aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                      {formatDate(selected.start)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                      {formatTime(selected.start)}–{formatTime(selected.end)}
                    </span>
                  </span>
                </DetailRow>
                <DetailRow label="Reason">
                  {selected.reason?.trim() || 'No reason recorded'}
                </DetailRow>
                <DetailRow label="Booked">
                  <span className="tabular-nums">{formatDateTime(selected.createdAt)}</span>
                </DetailRow>
                <DetailRow label="Appointment">
                  <span className="font-mono text-xs text-muted">#{selected.id}</span>
                </DetailRow>
              </dl>

              <Button className="mt-4 w-full" onClick={() => setPicking(selected)}>
                Re-book into a free slot
              </Button>
              <p className="mt-2 text-center text-xs leading-relaxed text-muted">
                The original slot stays released until a new one is chosen.
              </p>
            </Card>
          ) : (
            <EmptyState
              icon={<InboxIcon aria-hidden="true" className="h-5 w-5" />}
              title="Select a patient"
              hint="Pick a patient from the queue to see the displaced booking and re-book it."
            />
          )}
        </aside>
      </div>

      <SlotPickerModal
        appointment={picking}
        onClose={() => setPicking(null)}
        onPick={rebook}
      />
    </motion.div>
  )
}
