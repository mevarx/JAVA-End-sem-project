import { useCallback, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { slotApi } from '../../api/endpoints'
import type { Slot } from '../../api/types'
import {
  formatDate,
  formatTime,
  formatWeekday,
  todayIso,
} from '../../lib/format'
import { fadeUp, staggerContainer } from '../../lib/motion'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { AnimatedNumber } from '../../components/charts'
import { DataList, type Column } from '../../components/DataList'
import { ConfirmDialog, useToast } from '../../components/feedback'
import { SlotStatusBadge } from '../../components/status'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  SectionHeader,
  TableSkeleton,
  inputClass,
  selectClass,
} from '../../components/ui'
import {
  CalendarDaysIcon,
  ClockIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from '../../components/icons'

const START_TIMES = Array.from({ length: 20 }, (_, index) => {
  const minutes = 8 * 60 + index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

const DURATIONS = [15, 30, 45, 60]

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function SummaryCell({
  label,
  value,
  className,
}: {
  label: string
  value: number | null
  className: string
}) {
  return (
    <div className="px-2 py-4 text-center sm:px-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p
        className={`mt-1.5 font-display text-2xl font-semibold leading-none tracking-tight tabular-nums ${className}`}
      >
        <AnimatedNumber value={value} />
      </p>
    </div>
  )
}

export function AvailabilityPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [date, setDate] = useState(todayIso())
  const [start, setStart] = useState('09:00')
  const [duration, setDuration] = useState(30)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback((quiet = false) => {
    if (!quiet) setLoading(true)
    slotApi
      .mine()
      .then((list) => {
        setSlots([...list].sort((a, b) => a.start.localeCompare(b.start)))
        setError(null)
      })
      .catch((e) => setError(messageOf(e, 'Could not load availability.')))
      .finally(() => {
        if (!quiet) setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(() => load(true))

  function endTime(): string {
    const [hours, minutes] = start.split(':').map(Number)
    const total = hours * 60 + minutes + duration
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  async function publish() {
    if (publishing) return
    setPublishing(true)
    setError(null)
    try {
      const end = endTime()
      await slotApi.publish(`${date}T${start}:00`, `${date}T${end}:00`)
      toast.push({
        title: 'Slot published',
        description: `${formatDate(`${date}T00:00:00`)} · ${start}–${end}.`,
        tone: 'success',
      })
      load(true)
    } catch (e) {
      setError(messageOf(e, 'Could not publish the slot.'))
    } finally {
      setPublishing(false)
    }
  }

  const selectedSlot = slots.find((slot) => slot.id === selectedId) ?? null

  async function removeSlot() {
    if (!selectedSlot || deleting) return
    setDeleting(true)
    setError(null)
    try {
      await slotApi.remove(selectedSlot.id)
      toast.push({
        title: 'Slot deleted',
        description: `${formatDate(selectedSlot.start)} · ${formatTime(selectedSlot.start)} was removed.`,
        tone: 'success',
      })
      setSelectedId(null)
      setConfirmOpen(false)
      load(true)
    } catch (e) {
      setError(messageOf(e, 'Could not delete the slot.'))
      setConfirmOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const freeCount = slots.filter((slot) => slot.status === 'FREE').length
  const bookedCount = slots.length - freeCount

  const columns: Column<Slot>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (slot) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap font-semibold text-ink">{formatDate(slot.start)}</p>
          <p className="text-xs text-muted">{formatWeekday(slot.start, true)}</p>
        </div>
      ),
    },
    {
      key: 'window',
      header: 'Window',
      render: (slot) => (
        <span className="whitespace-nowrap font-mono text-[13px] tabular-nums text-ink-soft">
          {formatTime(slot.start)} – {formatTime(slot.end)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '8rem',
      render: (slot) => <SlotStatusBadge status={slot.status} />,
    },
  ]

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          className="mb-0"
          eyebrow="Doctor workspace"
          title="My availability"
          subtitle="Publish free windows for patients. Overlaps with existing slots are rejected."
          actions={
            <Button variant="secondary" onClick={() => load()} loading={loading}>
              {!loading && <RefreshIcon className="h-4 w-4" aria-hidden="true" />}
              Refresh
            </Button>
          }
        />
      </motion.div>

      {error && (
        <motion.div variants={fadeUp}>
          <Alert title="Could not complete that request" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                Publish a slot
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                Choose a date, start time and duration. Patients can book the window as soon
                as it is published.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-accent/25 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-ink">
              <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Ends at <span className="font-mono tabular-nums">{endTime()}</span>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={date}
                min={todayIso()}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Start time">
              <select
                className={selectClass}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              >
                {START_TIMES.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Duration" hint={`Ends at ${endTime()}`}>
              <select
                className={selectClass}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </Field>
            <Button onClick={publish} loading={publishing} className="w-full">
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Publish slot
            </Button>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <div role="group" aria-label="Availability summary">
          <Card className="grid grid-cols-3 divide-x divide-line overflow-hidden p-0">
            <SummaryCell label="Total" value={loading ? null : slots.length} className="text-ink" />
            <SummaryCell label="Free" value={loading ? null : freeCount} className="text-accent-ink" />
            <SummaryCell
              label="Booked"
              value={loading ? null : bookedCount}
              className="text-info-ink"
            />
          </Card>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-3">
        <SectionHeader
          title="Published slots"
          description="Select a slot to remove it from your availability."
          actions={
            loading ? undefined : (
              <span className="font-mono text-xs tabular-nums text-muted">
                {slots.length} slot(s)
              </span>
            )
          }
        />

        {loading ? (
          <TableSkeleton rows={5} columns={3} />
        ) : slots.length === 0 ? (
          <EmptyState
            icon={<CalendarDaysIcon className="h-5 w-5" />}
            title="No slots published yet"
            hint="Set a date, start time and duration above to publish your first bookable window."
          />
        ) : (
          <DataList
            items={slots}
            columns={columns}
            rowKey={(slot) => slot.id}
            selectedKey={selectedId}
            onSelect={(slot) =>
              setSelectedId((current) => (current === slot.id ? null : slot.id))
            }
            ariaLabel="My published slots"
            empty={<p className="px-4 py-12 text-center text-sm text-muted">No slots yet.</p>}
            mobileCard={(slot) => (
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {formatWeekday(slot.start, true)} · {formatDate(slot.start)}
                    </p>
                    <p className="mt-1 font-mono text-sm tabular-nums text-ink-soft">
                      {formatTime(slot.start)} – {formatTime(slot.end)}
                    </p>
                    <p className="mt-1 text-xs text-muted">{slot.departmentName}</p>
                  </div>
                  <SlotStatusBadge status={slot.status} />
                </div>
                {selectedId === slot.id && (
                  <p className="mt-2 text-xs font-medium text-accent-ink">
                    Selected for deletion
                  </p>
                )}
              </div>
            )}
          />
        )}

        {!loading && slots.length > 0 && (
          <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {selectedSlot ? (
                <>
                  <span className="text-sm text-ink-soft">Selected</span>
                  <span className="font-mono text-xs tabular-nums text-ink">
                    {formatDate(selectedSlot.start)} · {formatTime(selectedSlot.start)} –{' '}
                    {formatTime(selectedSlot.end)}
                  </span>
                  <SlotStatusBadge status={selectedSlot.status} />
                </>
              ) : (
                <p className="text-sm text-muted">Select a slot above to delete it.</p>
              )}
            </div>
            <Button
              variant="danger"
              className="w-full sm:w-auto"
              disabled={!selectedSlot}
              onClick={() => setConfirmOpen(true)}
            >
              <TrashIcon className="h-4 w-4" aria-hidden="true" />
              Delete slot
            </Button>
          </div>
        )}
      </motion.div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this slot?"
        description={
          selectedSlot
            ? `${formatWeekday(selectedSlot.start, true)} ${formatDate(selectedSlot.start)} · ${formatTime(selectedSlot.start)}–${formatTime(selectedSlot.end)} will be removed from your availability.${
                selectedSlot.status === 'BOOKED'
                  ? ' It is currently booked.'
                  : ' The window will no longer be bookable.'
              }`
            : undefined
        }
        confirmLabel="Delete slot"
        tone="danger"
        busy={deleting}
        onConfirm={removeSlot}
        onClose={() => {
          if (!deleting) setConfirmOpen(false)
        }}
      />
    </motion.div>
  )
}
