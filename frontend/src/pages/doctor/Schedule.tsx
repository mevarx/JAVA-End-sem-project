import { useCallback, useEffect, useState } from 'react'
import { appointmentApi } from '../../api/endpoints'
import type { Appointment, AppointmentStatus } from '../../api/types'
import { APPOINTMENT_STATUS_LABELS, appointmentStatusTone, formatDate, formatTime } from '../../lib/format'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { Alert, Badge, Button, Card, PageHeader, Spinner, inputClass } from '../../components/ui'
import { Cell, EmptyRow, Row, Table } from '../../components/Table'

export function SchedulePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filter, setFilter] = useState<'ALL' | AppointmentStatus>('ALL')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    appointmentApi
      .list()
      .then(setAppointments)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your schedule.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(load)

  const visible = appointments.filter(
    (appointment) => filter === 'ALL' || appointment.status === filter,
  )

  async function mark(status: AppointmentStatus) {
    if (!selected) return
    setError(null)
    setNotice(null)
    try {
      await appointmentApi.changeStatus(selected.id, status)
      setNotice(`Appointment #${selected.id} marked ${status === 'COMPLETED' ? 'completed' : 'no-show'}.`)
      setSelected(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the appointment.')
    }
  }

  const active = selected?.status === 'BOOKED'

  return (
    <div>
      <PageHeader
        title="My schedule"
        subtitle="Mark consultations completed or no-show. The slot is released for rebooking."
        actions={
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          className={`${inputClass} max-w-xs`}
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
        <span className="text-sm text-muted-foreground">{visible.length} appointment(s)</span>
      </div>

      <div className="mb-3 space-y-2">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      {loading ? (
        <Spinner label="Loading schedule…" />
      ) : (
        <Table head={['Date', 'Time', 'Patient', 'Reason', 'Status']}>
          {visible.length === 0 ? (
            <EmptyRow colSpan={5} message="No appointments in your schedule yet." />
          ) : (
            visible.map((appointment) => (
              <Row
                key={appointment.id}
                selected={selected?.id === appointment.id}
                onClick={() => setSelected(appointment)}
              >
                <Cell>{formatDate(appointment.start)}</Cell>
                <Cell>{formatTime(appointment.start)}</Cell>
                <Cell>{appointment.patientName}</Cell>
                <Cell>{appointment.reason || '—'}</Cell>
                <Cell>
                  <Badge tone={appointmentStatusTone(appointment.status)}>{appointment.statusLabel}</Badge>
                </Cell>
              </Row>
            ))
          )}
        </Table>
      )}

      <Card className="mt-5 flex flex-wrap gap-3 p-4">
        <Button onClick={() => mark('COMPLETED')} disabled={!active}>
          Mark completed
        </Button>
        <Button variant="danger" onClick={() => mark('NO_SHOW')} disabled={!active}>
          Mark no-show
        </Button>
        {selected && (
          <p className="self-center text-sm text-muted-foreground">
            Selected #{selected.id} · {selected.statusLabel}
          </p>
        )}
      </Card>
    </div>
  )
}
