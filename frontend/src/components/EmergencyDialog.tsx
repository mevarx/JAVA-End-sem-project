import { useEffect, useState } from 'react'
import { emergencyApi, userApi } from '../api/endpoints'
import type { EmergencyType, Severity, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import {
  ActivityIcon,
  AlertTriangleIcon,
  CircleDotIcon,
  HeartPulseIcon,
  SirenIcon,
  type IconComponent,
} from './icons'
import { Alert, Button, Field, Modal, cx, inputClass, selectClass } from './ui'
import { useToast } from './feedback'

const TYPE_OPTIONS: { value: EmergencyType; label: string; icon: IconComponent }[] = [
  { value: 'CARDIAC', label: 'Cardiac', icon: HeartPulseIcon },
  { value: 'TRAUMA', label: 'Trauma', icon: AlertTriangleIcon },
  { value: 'RESPIRATORY', label: 'Respiratory', icon: ActivityIcon },
  { value: 'STROKE', label: 'Stroke', icon: SirenIcon },
  { value: 'OTHER', label: 'Other', icon: CircleDotIcon },
]

const SEVERITY_OPTIONS: {
  value: Severity
  label: string
  hint: string
  icon: IconComponent
  dot: string
  selected: string
}[] = [
  {
    value: 'CRITICAL',
    label: 'Critical',
    hint: 'Life-threatening. Pre-empts routine care.',
    icon: SirenIcon,
    dot: 'bg-critical',
    selected: 'border-critical/60 bg-critical-soft',
  },
  {
    value: 'HIGH',
    label: 'High',
    hint: 'Urgent. Needs rapid triage.',
    icon: AlertTriangleIcon,
    dot: 'bg-warning',
    selected: 'border-warning/50 bg-warning-soft',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    hint: 'Stable. Standard queue order.',
    icon: ActivityIcon,
    dot: 'bg-accent',
    selected: 'border-accent/50 bg-accent-soft',
  },
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
  const toast = useToast()
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
      const raised = await emergencyApi.raise({
        type,
        severity,
        location,
        patientId: isPatient ? undefined : patientId ? Number(patientId) : null,
        patientLabel: isPatient ? undefined : patientId ? null : walkIn,
      })
      toast.push({
        title: 'Emergency raised',
        description: `#${raised.id} · ${raised.typeLabel} · ${raised.severityLabel}`,
        tone: 'success',
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
      description="The case enters the priority queue immediately."
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" className="min-h-11" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="emergency"
            className="min-h-11"
            onClick={submit}
            disabled={busy}
            loading={busy}
          >
            Raise emergency
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Alert tone="warning" title="Critical cases pre-empt routine care">
          A Critical case may pre-empt a routine appointment. Severity and arrival time decide queue
          order.
        </Alert>

        {error && (
          <Alert tone="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <fieldset className="min-w-0">
          <legend className="text-[13px] font-semibold leading-none text-ink">Type</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYPE_OPTIONS.map((option) => {
              const Icon = option.icon
              const active = type === option.value
              return (
                <label
                  key={option.value}
                  className={cx(
                    'relative flex min-h-[4.5rem] cursor-pointer select-none flex-col justify-between gap-2 rounded-lg border p-3 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                    active
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-subtle/40',
                  )}
                >
                  <input
                    type="radio"
                    name="emergency-type"
                    value={option.value}
                    checked={active}
                    onChange={() => setType(option.value)}
                    className="sr-only"
                  />
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="text-[13px] font-semibold leading-none">{option.label}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="text-[13px] font-semibold leading-none text-ink">Severity</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {SEVERITY_OPTIONS.map((option) => {
              const Icon = option.icon
              const active = severity === option.value
              return (
                <label
                  key={option.value}
                  className={cx(
                    'relative flex cursor-pointer select-none flex-col gap-1.5 rounded-lg border p-3 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                    active ? option.selected : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <input
                    type="radio"
                    name="emergency-severity"
                    value={option.value}
                    checked={active}
                    onChange={() => setSeverity(option.value)}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cx('h-2 w-2 shrink-0 rounded-full', option.dot)}
                    />
                    <span className="text-[13px] font-semibold leading-none text-ink">
                      {option.label}
                    </span>
                    <Icon className="ml-auto h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </span>
                  <span className="block text-xs leading-relaxed text-muted">{option.hint}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <Field label="Location" hint="Where the patient is right now.">
          <input
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </Field>

        {!isPatient && (
          <div className="rounded-lg border border-line bg-subtle/40 p-3.5">
            <p className="text-[13px] font-semibold leading-none text-ink">Patient</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Existing patient" hint="Leave empty for a walk-in.">
                <select
                  className={selectClass}
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                >
                  <option value="">Walk-in / unregistered</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.fullName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Walk-in label"
                hint={patientId ? 'Not used while an existing patient is selected.' : undefined}
              >
                <input
                  className={inputClass}
                  value={walkIn}
                  disabled={patientId !== ''}
                  onChange={(e) => setWalkIn(e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
