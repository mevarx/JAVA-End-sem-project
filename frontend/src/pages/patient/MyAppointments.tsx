import { useCallback, useEffect, useState } from 'react'
import { appointmentApi } from '../../api/endpoints'
import type { Appointment, AppointmentStatus, Slot } from '../../api/types'
import { APPOINTMENT_STATUS_LABELS, appointmentStatusTone, formatDate, formatTime } from '../../lib/format'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { Alert, Badge, Button, Card, Field, PageHeader, Spinner, inputClass } from '../../components/ui'
import { Cell, EmptyRow, Row, Table } from '../../components/Table'
import { SlotPickerModal } from '../../components/SlotPickerModal'

export function MyAppointmentsPage() {
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
    if (!window.confirm(`Cancel appointment #${selected.id} on ${formatDate(selected.start)}?`)) return
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

  const canCancel = selected && (selected.status === 'BOOKED')
  const canReschedule = selected && (selected.status === 'BOOKED' || selected.status === 'PRE_EMPTED')

  return (
    <div className="space-y-5">
      <PageHeader
        title="My appointments"
        subtitle="Cancel or move an active booking. Pre-empted bookings can be re-booked here."
        actions={
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full min-w-0 flex-1 basis-60 sm:max-w-xs sm:flex-none">
            <Field label="Status filter">
              <select
                className={inputClass}
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
          </div>
          <p className="pb-2 text-sm text-muted-foreground">{visible.length} appointment(s)</p>
        </div>
      </Card>

      <div className="space-y-2">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      {loading ? (
        <Spinner label="Loading appointments…" />
      ) : (
        <Card className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Bookings</h2>
            {selected && (
              <p className="text-sm text-muted-foreground">
                Selected #{selected.id} · {selected.statusLabel}
              </p>
            )}
          </div>
          <div className="mt-3 overflow-x-auto">
            <Table head={['Date', 'Time', 'Doctor', 'Department', 'Reason', 'Status']}>
              {visible.length === 0 ? (
                <EmptyRow colSpan={6} message="No appointments match this filter." />
              ) : (
                visible.map((appointment) => (
                  <Row
                    key={appointment.id}
                    selected={selected?.id === appointment.id}
                    onClick={() => setSelected(appointment)}
                  >
                    <Cell>{formatDate(appointment.start)}</Cell>
                    <Cell>{formatTime(appointment.start)}</Cell>
                    <Cell>{appointment.doctorName}</Cell>
                    <Cell className="text-muted-foreground">#{appointment.doctorId}</Cell>
                    <Cell>{appointment.reason || '—'}</Cell>
                    <Cell>
                      <Badge tone={appointmentStatusTone(appointment.status)}>{appointment.statusLabel}</Badge>
                    </Cell>
                  </Row>
                ))
              )}
            </Table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => setRescheduling(selected)} disabled={!canReschedule}>
              Reschedule / rebook
            </Button>
            <Button variant="danger" onClick={cancel} disabled={!canCancel}>
              Cancel appointment
            </Button>
          </div>
        </Card>
      )}

      <SlotPickerModal
        appointment={rescheduling}
        onClose={() => setRescheduling(null)}
        onPick={reschedule}
      />
    </div>
  )
}
