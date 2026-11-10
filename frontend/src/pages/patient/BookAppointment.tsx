import { useCallback, useEffect, useState } from 'react'
import { appointmentApi, departmentApi, slotApi, userApi } from '../../api/endpoints'
import type { Department, Slot, User } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Alert, Button, Card, Field, PageHeader, Spinner, inputClass } from '../../components/ui'
import { Cell, EmptyRow, Row, Table } from '../../components/Table'
import { formatDate, formatTime, todayIso } from '../../lib/format'

export function BookAppointmentPage() {
  const { user } = useAuth()
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
        setSlots(list)
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
      setSuccess(
        `Appointment #${appointment.id} booked for ${appointment.patientName} on ${formatDate(
          appointment.start,
        )} at ${formatTime(appointment.start)} with ${appointment.doctorName}.`,
      )
      loadSlots()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book the slot.')
      loadSlots()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isPatient ? 'Find and book an appointment' : 'Book an appointment for a patient'}
        subtitle="Only free slots are listed. Overlapping bookings are rejected by the database transaction."
        actions={
          <Button variant="secondary" onClick={loadSlots}>
            Refresh
          </Button>
        }
      />

      <Card className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Department">
            <select
              className={inputClass}
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
            <select className={inputClass} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
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
              min={todayIso()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          {!isPatient && (
            <Field label="Patient">
              <select className={inputClass} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
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

      <div className="mb-3 space-y-2">
        {error && <Alert>{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}
      </div>

      {loading ? (
        <Spinner label="Loading free slots…" />
      ) : (
        <Table head={['Date', 'Time', 'Doctor', 'Department']}>
          {slots.length === 0 ? (
            <EmptyRow colSpan={4} message="No free slots for these filters. Try another date." />
          ) : (
            slots.map((slot) => (
              <Row
                key={slot.id}
                selected={selected?.id === slot.id}
                onClick={() => setSelected(slot)}
              >
                <Cell>{formatDate(slot.start)}</Cell>
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

      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Field label="Reason for visit">
              <input
                className={inputClass}
                value={reason}
                placeholder="e.g. follow-up consultation"
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </div>
          <Button onClick={() => book()} disabled={busy || !selected}>
            {busy ? 'Booking…' : selected ? `Book ${formatTime(selected.start)} with ${selected.doctorName}` : 'Book selected slot'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
