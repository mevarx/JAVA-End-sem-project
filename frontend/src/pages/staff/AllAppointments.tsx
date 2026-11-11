import { useCallback, useEffect, useState } from 'react'
import { appointmentApi } from '../../api/endpoints'
import type { Appointment, AppointmentStatus, Slot } from '../../api/types'
import { APPOINTMENT_STATUS_LABELS, appointmentStatusTone, formatDate, formatTime } from '../../lib/format'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { Alert, Badge, Button, Card, Field, PageHeader, Spinner, inputClass } from '../../components/ui'
import { Cell, EmptyRow, Row, Table } from '../../components/Table'
import { SlotPickerModal } from '../../components/SlotPickerModal'

export function AllAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filter, setFilter] = useState<'ALL' | AppointmentStatus>('ALL')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    appointmentApi
      .list()
      .then(setAppointments)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load appointments.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(load)

  const visible = appointments.filter(
    (appointment) => filter === 'ALL' || appointment.status === filter,
  )

  async function cancel() {
    if (!selected) return
    if (!window.confirm(`Cancel appointment #${selected.id} for ${selected.patientName}?`)) return
    setError(null)
    setNotice(null)
    try {
      await appointmentApi.cancel(selected.id)
      setNotice(`Appointment #${selected.id} cancelled.`)
      setSelected(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel the appointment.')
    }
  }

  async function reschedule(slot: Slot) {
    if (!rescheduling) return
    await appointmentApi.reschedule(rescheduling.id, slot.id)
    setNotice(`Appointment #${rescheduling.id} moved to ${formatDate(slot.start)} at ${formatTime(slot.start)}.`)
    setSelected(null)
    load()
  }

  const canAct = selected && (selected.status === 'BOOKED' || selected.status === 'PRE_EMPTED')

  return (
    <div>
      <PageHeader
        title="All appointments"
        subtitle="Every booking across the hospital, with the patient and doctor in one view."
        actions={
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-end gap-4 p-4">
        <Field label="Status filter">
          <select
            aria-label="Status filter"
            className={`${inputClass} min-h-[44px] max-w-xs`}
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'ALL' | AppointmentStatus)}
          >
            <option value="ALL">All statuses</option>
            {Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <p aria-live="polite" className="pb-2.5 text-sm tabular-nums text-muted-foreground">
          {visible.length} appointment(s)
        </p>
      </Card>

      <div className="mb-3 space-y-2">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      {loading ? (
        <Card className="p-0">
          <Spinner label="Loading appointments…" />
        </Card>
      ) : (
        <Table head={['#', 'Date', 'Time', 'Patient', 'Doctor', 'Reason', 'Status']}>
          {visible.length === 0 ? (
            <EmptyRow colSpan={7} message="No appointments match this filter." />
          ) : (
            visible.map((appointment) => (
              <Row
                key={appointment.id}
                selected={selected?.id === appointment.id}
                onClick={() => setSelected(appointment)}
              >
                <Cell className="whitespace-nowrap tabular-nums">#{appointment.id}</Cell>
                <Cell className="whitespace-nowrap">{formatDate(appointment.start)}</Cell>
                <Cell className="whitespace-nowrap tabular-nums">{formatTime(appointment.start)}</Cell>
                <Cell className="font-medium">{appointment.patientName}</Cell>
                <Cell>{appointment.doctorName}</Cell>
                <Cell className="max-w-56 truncate" title={appointment.reason || undefined}>{appointment.reason || '—'}</Cell>
                <Cell>
                  <Badge tone={appointmentStatusTone(appointment.status)}>{appointment.statusLabel}</Badge>
                </Cell>
              </Row>
            ))
          )}
        </Table>
      )}

      <Card className="mt-5 flex flex-wrap items-center gap-3 p-4">
        <Button className="min-h-[44px]" onClick={() => setRescheduling(selected)} disabled={!canAct}>
          Reschedule
        </Button>
        <Button className="min-h-[44px]" variant="danger" onClick={cancel} disabled={!canAct}>
          Cancel
        </Button>
        {selected && (
          <p aria-live="polite" className="self-center text-sm text-muted-foreground">Selected #{selected.id} · {selected.patientName}</p>
        )}
      </Card>

      <SlotPickerModal
        appointment={rescheduling}
        onClose={() => setRescheduling(null)}
        onPick={reschedule}
      />
    </div>
  )
}
