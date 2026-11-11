import { useCallback, useEffect, useState } from 'react'
import { appointmentApi } from '../../api/endpoints'
import type { Appointment, Slot } from '../../api/types'
import { appointmentStatusTone, formatDate, formatTime } from '../../lib/format'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { Cell, Row, Table } from '../../components/Table'
import { SlotPickerModal } from '../../components/SlotPickerModal'

export function WaitlistPage() {
  const [waitlist, setWaitlist] = useState<Appointment[]>([])
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [picking, setPicking] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    appointmentApi
      .waitlist()
      .then(setWaitlist)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the waitlist.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(load)

  async function rebook(slot: Slot) {
    if (!picking) return
    await appointmentApi.reschedule(picking.id, slot.id)
    setNotice(
      `${picking.patientName} re-booked for ${formatDate(slot.start)} at ${formatTime(slot.start)} with ${slot.doctorName}.`,
    )
    setSelected(null)
    load()
  }

  return (
    <div>
      <PageHeader
        title="Re-booking queue"
        subtitle="Appointments displaced by a Critical emergency. Re-book them into any free slot."
        actions={
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-4 p-4">
        <p aria-live="polite" className="text-sm tabular-nums text-muted-foreground">
          {waitlist.length} appointment(s) waiting for re-booking
        </p>
      </Card>

      <div className="mb-3 space-y-2">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>
      {loading ? (
        <Card className="p-0">
          <Spinner label="Loading the re-booking queue…" />
        </Card>
      ) : waitlist.length === 0 ? (
        <Card className="p-4">
          <EmptyState title="Nothing in the re-booking queue" hint="Routine bookings are intact." />
        </Card>
      ) : (
        <Table head={['Patient', 'Doctor', 'Original date', 'Original time', 'Reason', 'Status']}>
          {waitlist.map((appointment) => (
            <Row
              key={appointment.id}
              selected={selected?.id === appointment.id}
              onClick={() => setSelected(appointment)}
            >
              <Cell className="font-medium">{appointment.patientName}</Cell>
              <Cell>{appointment.doctorName}</Cell>
              <Cell className="whitespace-nowrap">{formatDate(appointment.start)}</Cell>
              <Cell className="whitespace-nowrap tabular-nums">{formatTime(appointment.start)}</Cell>
              <Cell className="max-w-56 truncate" title={appointment.reason || undefined}>{appointment.reason || '—'}</Cell>
              <Cell>
                <Badge tone={appointmentStatusTone(appointment.status)}>{appointment.statusLabel}</Badge>
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      <Card className="mt-5 flex flex-wrap items-center gap-3 p-4">
        <Button className="min-h-[44px]" onClick={() => setPicking(selected)} disabled={!selected}>
          Re-book selected patient
        </Button>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {selected ? `Selected ${selected.patientName} (#${selected.id})` : 'Select a waitlisted appointment.'}
        </p>
      </Card>


      <SlotPickerModal
        appointment={picking}
        onClose={() => setPicking(null)}
        onPick={rebook}
      />
    </div>
  )
}
