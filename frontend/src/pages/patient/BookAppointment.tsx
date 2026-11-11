import { useCallback, useEffect, useState } from 'react'
import { appointmentApi, departmentApi, slotApi, userApi } from '../../api/endpoints'
import type { Department, Slot, User } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Alert, Button, Card, EmptyState, Field, PageHeader, Spinner, inputClass } from '../../components/ui'
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
    <div className="space-y-5">
      <PageHeader
        title={isPatient ? 'Find and book an appointment' : 'Book an appointment for a patient'}
        subtitle="Only free slots are listed. Overlapping bookings are rejected by the database transaction."
        actions={
          <Button variant="secondary" onClick={loadSlots}>
            Refresh
          </Button>
        }
      />

      <Card className="p-4">
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

      <div className="space-y-2">
        {error && <Alert>{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Available slots</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `${slots.length} free slot(s) · ${formatDate(date)}`}
          </p>
        </div>
        <div className="mt-3">
          {loading ? (
            <Spinner label="Loading free slots…" />
          ) : slots.length === 0 ? (
            <EmptyState
              title="No free slots"
              hint="No free slots for these filters. Try another date."
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot) => {
                const isSelected = selected?.id === slot.id
                return (
                  <li key={slot.id} className="min-w-0">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelected(slot)}
                      className={`min-h-11 w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors duration-150 ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-surface hover:border-primary/50'
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {formatTime(slot.start)}
                        <span className="font-normal text-muted-foreground"> – {formatTime(slot.end)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {slot.doctorName} · {slot.departmentName || 'General'}
                      </span>
                      <span className="block text-xs text-muted-foreground">{formatDate(slot.start)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-60">
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
        {selected && (
          <p className="mt-2 text-sm text-muted-foreground">
            Selected {formatDate(selected.start)} at {formatTime(selected.start)} with {selected.doctorName}.
          </p>
        )}
      </Card>
    </div>
  )
}
