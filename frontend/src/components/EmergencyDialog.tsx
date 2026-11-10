import { useEffect, useState } from 'react'
import { emergencyApi, userApi } from '../api/endpoints'
import type { EmergencyType, Severity, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, Field, Modal, inputClass } from './ui'

const TYPES: { value: EmergencyType; label: string }[] = [
  { value: 'CARDIAC', label: 'Cardiac' },
  { value: 'TRAUMA', label: 'Trauma' },
  { value: 'RESPIRATORY', label: 'Respiratory' },
  { value: 'STROKE', label: 'Stroke' },
  { value: 'OTHER', label: 'Other' },
]

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
]

export function EmergencyDialog({
  open,
  onClose,
  onRaised,
}: {
  open: boolean
  onClose: () => void
  onRaised: () => void
}) {
  const { user } = useAuth()
  const [type, setType] = useState<EmergencyType>('CARDIAC')
  const [severity, setSeverity] = useState<Severity>('HIGH')
  const [location, setLocation] = useState('ER Gate')
  const [patientId, setPatientId] = useState<string>('')
  const [walkIn, setWalkIn] = useState('Walk-in 01')
  const [patients, setPatients] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isPatient = user?.role === 'PATIENT'

  useEffect(() => {
    if (!open || isPatient) return
    userApi
      .patients()
      .then(setPatients)
      .catch(() => setPatients([]))
  }, [open, isPatient])

  useEffect(() => {
    if (open) {
      setError(null)
      setType('CARDIAC')
      setSeverity('HIGH')
      setLocation('ER Gate')
      setPatientId('')
      setWalkIn('Walk-in 01')
    }
  }, [open])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await emergencyApi.raise({
        type,
        severity,
        location,
        patientId: isPatient ? undefined : patientId ? Number(patientId) : null,
        patientLabel: isPatient ? undefined : patientId ? null : walkIn,
      })
      onRaised()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not raise the emergency.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Raise emergency"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="emergency" onClick={submit} disabled={busy}>
            {busy ? 'Raising…' : 'Raise emergency'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The case enters the priority queue immediately. A Critical case may pre-empt a routine
          appointment.
        </p>
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as EmergencyType)}>
              {TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <select
              className={inputClass}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
            >
              {SEVERITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Location">
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        {!isPatient && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Existing patient" hint="Leave empty for a walk-in.">
              <select className={inputClass} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">Walk-in / unregistered</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Walk-in label">
              <input
                className={inputClass}
                value={walkIn}
                disabled={patientId !== ''}
                onChange={(e) => setWalkIn(e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  )
}
