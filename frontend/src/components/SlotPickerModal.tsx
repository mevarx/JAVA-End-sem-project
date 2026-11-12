import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { slotApi } from '../api/endpoints'
import type { Appointment, Slot } from '../api/types'
import { addDaysIso, dayKey, formatDate, formatTime, formatWeekday, todayIso } from '../lib/format'
import { listItem, staggerContainer } from '../lib/motion'
import {
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from './icons'
import {
  Alert,
  Button,
  EmptyState,
  IconButton,
  Modal,
  Skeleton,
  cx,
  inputClass,
} from './ui'

/**
 * Chooses a free slot for a reschedule or a waitlist re-booking. When the appointment
 * still has a doctor, only that doctor's slots are offered.
 */
export function SlotPickerModal({
  appointment,
  onClose,
  onPick,
}: {
  appointment: Appointment | null
  onClose: () => void
  onPick: (slot: Slot) => Promise<void>
}) {
  const [date, setDate] = useState(todayIso())
  const [slots, setSlots] = useState<Slot[]>([])
  const [selected, setSelected] = useState<Slot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const today = todayIso()

  useEffect(() => {
    if (!appointment) return
    setSelected(null)
    setLoading(true)
    setError(null)
    slotApi
      .available(null, appointment.doctorId > 0 ? appointment.doctorId : null, date)
      .then((list) =>
        // The endpoint returns free slots up to the end of the selected date;
        // keep only the chosen civil day so labels and selection stay honest.
        setSlots(list.filter((slot) => dayKey(slot.start) === date)),
      )
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load free slots.'))
      .finally(() => setLoading(false))
  }, [appointment, date])

  async function confirm() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await onPick(selected)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move the appointment.')
    } finally {
      setBusy(false)
    }
  }

  function stepDate(delta: number) {
    setDate(addDaysIso(date || today, delta))
  }

  return (
    <Modal
      open={appointment !== null}
      title={appointment ? `Choose a new slot for ${appointment.patientName}` : 'Choose a slot'}
      description={
        appointment
          ? `${appointment.doctorName} · currently ${formatDate(appointment.start)} at ${formatTime(
              appointment.start,
            )}`
          : undefined
      }
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!selected || busy} loading={busy}>
            {busy ? 'Moving…' : 'Use this slot'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <div className="rounded-xl border border-line bg-subtle/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <IconButton
              label="Previous day"
              variant="secondary"
              onClick={() => stepDate(-1)}
              disabled={!date || date <= today}
            >
              <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            <div className="min-w-0 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                {formatWeekday(date, true)}
              </p>
              <p className="truncate font-display text-base font-semibold tracking-tight text-ink">
                {formatDate(date)}
              </p>
            </div>
            <IconButton label="Next day" variant="secondary" onClick={() => stepDate(1)}>
              <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="slot-picker-date" className="sr-only">
              Date
            </label>
            <input
              id="slot-picker-date"
              type="date"
              className={cx(inputClass, 'min-w-0 flex-1')}
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
            />
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => setDate(today)}
              disabled={date === today}
            >
              Today
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <EmptyState
            title="No free slots"
            hint="No free slots for this doctor on that date. Try another day."
            icon={<CalendarDaysIcon className="h-5 w-5" />}
            action={
              <Button variant="secondary" onClick={() => stepDate(1)}>
                Next day
                <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            }
          />
        ) : (
          <motion.ul
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid max-h-[42vh] grid-cols-1 gap-2 overflow-y-auto pr-1 min-[360px]:grid-cols-2 sm:grid-cols-3"
            aria-label="Available slots"
          >
            {slots.map((slot) => {
              const isSelected = selected?.id === slot.id
              return (
                <motion.li key={slot.id} variants={listItem} className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(slot)}
                    className={cx(
                      'flex min-h-16 w-full cursor-pointer flex-col justify-center rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected
                        ? 'border-accent bg-accent-soft shadow-xs'
                        : 'border-line bg-surface hover:border-accent/50 hover:bg-subtle',
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-1.5">
                      <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                        {formatTime(slot.start)}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                          isSelected
                            ? 'bg-accent text-on-accent'
                            : 'border border-line text-transparent',
                        )}
                      >
                        <CheckIcon className="h-2.5 w-2.5" />
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted">
                      until {formatTime(slot.end)}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {slot.departmentName || 'General'}
                    </span>
                  </button>
                </motion.li>
              )
            })}
          </motion.ul>
        )}

        {selected && (
          <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2.5 text-sm text-accent-ink">
            <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="min-w-0 leading-relaxed">
              <span className="font-semibold">
                {formatDate(selected.start)} · {formatTime(selected.start)} –{' '}
                {formatTime(selected.end)}
              </span>
              <span className="block truncate text-xs text-accent-ink/80">
                with {selected.doctorName}
                {selected.departmentName ? ` · ${selected.departmentName}` : ''}
              </span>
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
