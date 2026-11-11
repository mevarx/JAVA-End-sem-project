import { useCallback, useEffect, useState } from 'react'
import { appointmentApi } from '../../api/endpoints'
import type { Appointment, AppointmentStatus } from '../../api/types'
import { APPOINTMENT_STATUS_LABELS, appointmentStatusTone, formatDate, formatTime } from '../../lib/format'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { Alert, Badge, Button, Card, Field, PageHeader, Spinner, inputClass } from '../../components/ui'
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

  const groups = visible.reduce<{ day: string; items: Appointment[] }[]>((acc, appointment) => {
    const day = formatDate(appointment.start)
    const group = acc.find((entry) => entry.day === day)
    if (group) {
      group.items.push(appointment)
    } else {
      acc.push({ day, items: [appointment] })
    }
    return acc
  }, [])

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
          <Button variant="secondary" onClick={load} className="min-h-[44px] cursor-pointer">
            Refresh
          </Button>
        }
      />

      <div className="mb-4 space-y-2">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      <Card className="mb-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
          <Field label="Status">
            <select
              className={`${inputClass} min-h-[44px] cursor-pointer`}
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
          <p className="text-sm text-muted-foreground sm:pb-3">{visible.length} appointment(s)</p>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Upcoming consultations
          </h2>
        </div>
        {loading ? (
          <Spinner label="Loading schedule…" />
        ) : visible.length === 0 ? (
          <Table head={['Date', 'Time', 'Patient', 'Reason', 'Status']}>
            <EmptyRow colSpan={5} message="No appointments in your schedule yet." />
          </Table>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.day} aria-label={group.day}>
                <h3 className="mb-2 text-sm font-bold text-foreground">{group.day}</h3>
                <Table head={['Time', 'Patient', 'Reason', 'Status']}>
                  {group.items.map((appointment) => (
                    <Row
                      key={appointment.id}
                      selected={selected?.id === appointment.id}
                      onClick={() => setSelected(appointment)}
                    >
                      <Cell className="whitespace-nowrap">{formatTime(appointment.start)}</Cell>
                      <Cell>{appointment.patientName}</Cell>
                      <Cell className="min-w-0 break-words">{appointment.reason || '—'}</Cell>
                      <Cell>
                        <Badge tone={appointmentStatusTone(appointment.status)}>{appointment.statusLabel}</Badge>
                      </Cell>
                    </Row>
                  ))}
                </Table>
              </section>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => mark('COMPLETED')}
            disabled={!active}
            className="min-h-[44px] w-full cursor-pointer sm:w-auto"
          >
            Mark completed
          </Button>
          <Button
            variant="danger"
            onClick={() => mark('NO_SHOW')}
            disabled={!active}
            className="min-h-[44px] w-full cursor-pointer sm:w-auto"
          >
            Mark no-show
          </Button>
          {selected && (
            <p className="text-sm text-muted-foreground">
              Selected #{selected.id} · {selected.statusLabel}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
