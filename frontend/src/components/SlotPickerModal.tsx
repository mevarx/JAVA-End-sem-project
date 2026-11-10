import { useEffect, useState } from 'react'
import { slotApi } from '../api/endpoints'
import type { Appointment, Slot } from '../api/types'
import { formatDate, formatTime, todayIso } from '../lib/format'
import { Alert, Button, Field, Modal, Spinner, inputClass } from './ui'
import { Cell, EmptyRow, Row, Table } from './Table'

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

  useEffect(() => {
    if (!appointment) return
    setSelected(null)
    setLoading(true)
    setError(null)
    slotApi
      .available(null, appointment.doctorId > 0 ? appointment.doctorId : null, date)
      .then(setSlots)
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

  return (
    <Modal
      open={appointment !== null}
      title={appointment ? `Choose a new slot for ${appointment.patientName}` : 'Choose a slot'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!selected || busy}>
            {busy ? 'Moving…' : 'Use this slot'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <Field label="Date">
          <input
            type="date"
            className={inputClass}
            value={date}
            min={todayIso()}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        {loading ? (
          <Spinner label="Loading free slots…" />
        ) : (
          <Table head={['Time', 'Doctor', 'Department']}>
            {slots.length === 0 ? (
              <EmptyRow colSpan={3} message="No free slots for this doctor on that date." />
            ) : (
              slots.map((slot) => (
                <Row key={slot.id} selected={selected?.id === slot.id} onClick={() => setSelected(slot)}>
                  <Cell>
                    <span className="font-bold">{formatTime(slot.start)}</span>
                    <span className="text-muted-foreground"> – {formatTime(slot.end)}</span>
                  </Cell>
                  <Cell>{slot.doctorName}</Cell>
                  <Cell>{slot.departmentName || '—'}</Cell>
                </Row>
              ))
            )}
          </Table>
        )}
        {selected && (
          <p className="text-sm text-muted-foreground">
            Selected {formatDate(selected.start)} at {formatTime(selected.start)} with {selected.doctorName}.
          </p>
        )}
      </div>
    </Modal>
  )
}
