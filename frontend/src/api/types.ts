export type Role = 'PATIENT' | 'DOCTOR' | 'RECEPTIONIST' | 'ER_STAFF' | 'ADMIN'

export interface User {
  id: number
  username: string
  fullName: string
  phone: string | null
  departmentId: number | null
  active: boolean
  role: Role
  specialization: string | null
  onCall: boolean | null
}

export interface Department {
  id: number
  name: string
}

export type SlotStatus = 'FREE' | 'BOOKED'

export interface Slot {
  id: number
  doctorId: number
  doctorName: string
  departmentId: number | null
  departmentName: string
  start: string
  end: string
  status: SlotStatus
}

export type AppointmentStatus =
  | 'BOOKED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'RESCHEDULED'
  | 'PRE_EMPTED'

export interface Appointment {
  id: number
  slotId: number | null
  patientId: number
  patientName: string
  doctorId: number
  doctorName: string
  start: string
  end: string
  reason: string | null
  status: AppointmentStatus
  statusLabel: string
  createdAt: string
}

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM'
export type EmergencyType = 'CARDIAC' | 'TRAUMA' | 'RESPIRATORY' | 'STROKE' | 'OTHER'
export type EmergencyStatus = 'WAITING' | 'ASSIGNED' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED'

export interface EmergencyCase {
  id: number
  patientId: number | null
  patientLabel: string | null
  type: EmergencyType
  typeLabel: string
  severity: Severity
  severityLabel: string
  location: string
  status: EmergencyStatus
  statusLabel: string
  assignedTo: number | null
  assignedToName: string | null
  bedNo: number | null
  raisedAt: string
  dispatchedAt: string | null
  acknowledgedAt: string | null
  escalatedAt: string | null
  resolvedAt: string | null
  escalationCount: number
}

export interface EmergencyEvent {
  id: number
  emergencyId: number
  eventType: string
  eventTime: string
  note: string | null
}

export interface Board {
  cases: EmergencyCase[]
  queueSize: number
  availableBeds: number
  bedCapacity: number
  averageDispatchMillis: number | null
}

export interface Stats {
  queueSize: number
  availableBeds: number
  bedCapacity: number
  averageDispatchMillis: number | null
}

export type NotificationLevel = 'CRITICAL' | 'WARNING' | 'SUCCESS' | 'INFO'

export interface NotificationItem {
  id: number
  targetUserId: number
  message: string
  level: NotificationLevel
  timestamp: string
}

export interface ReportResult {
  success: boolean
  imported: number
  error: string | null
}

export interface AuditLog {
  path: string
  content: string
}
