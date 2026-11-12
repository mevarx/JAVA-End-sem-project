import { http } from './client'
import type {
  Appointment,
  AppointmentStatus,
  AuditLog,
  Board,
  Department,
  EmergencyCase,
  EmergencyEvent,
  EmergencyType,
  NotificationItem,
  ReportResult,
  Severity,
  Slot,
  Stats,
  User,
} from './types'

export const authApi = {
  me: () => http.get<User>('/auth/me'),
  login: (username: string, password: string) =>
    http.post<{ user: User }>('/auth/login', { username, password }),
  register: (username: string, password: string, fullName: string, phone: string) =>
    http.post<{ user: User }>('/auth/register', { username, password, fullName, phone }),
  logout: () => http.post<void>('/auth/logout'),
}

export const userApi = {
  list: () => http.get<User[]>('/users'),
  patients: () => http.get<User[]>('/users/patients'),
  doctors: () => http.get<User[]>('/users/doctors'),
  create: (body: {
    username: string
    password: string
    role: string
    fullName: string
    phone: string
    departmentId: number | null
    specialization: string
    onCall: boolean
  }) => http.post<User>('/users', body),
  update: (
    id: number,
    body: {
      username: string
      newPassword: string
      role: string
      fullName: string
      phone: string
      departmentId: number | null
      specialization: string
      onCall: boolean
    },
  ) => http.put<User>(`/users/${id}`, body),
  remove: (id: number) => http.delete<void>(`/users/${id}`),
}

export const departmentApi = {
  list: () => http.get<Department[]>('/departments'),
  create: (name: string) => http.post<Department>('/departments', { name }),
  update: (id: number, name: string) => http.put<Department>(`/departments/${id}`, { name }),
  remove: (id: number) => http.delete<void>(`/departments/${id}`),
}

export const slotApi = {
  available: (departmentId: number | null, doctorId: number | null, date: string) => {
    const params = new URLSearchParams()
    if (departmentId) params.set('departmentId', String(departmentId))
    if (doctorId) params.set('doctorId', String(doctorId))
    params.set('date', date)
    return http.get<Slot[]>(`/slots/available?${params.toString()}`)
  },
  mine: () => http.get<Slot[]>('/slots/mine'),
  publish: (start: string, end: string) => http.post<Slot>('/slots', { start, end }),
  remove: (id: number) => http.delete<void>(`/slots/${id}`),
}

export const appointmentApi = {
  list: () => http.get<Appointment[]>('/appointments'),
  book: (slotId: number, reason: string, patientId?: number) =>
    http.post<Appointment>('/appointments', { slotId, reason, patientId }),
  reschedule: (id: number, newSlotId: number) =>
    http.post<Appointment>(`/appointments/${id}/reschedule`, { newSlotId }),
  cancel: (id: number) => http.post<void>(`/appointments/${id}/cancel`),
  changeStatus: (id: number, status: AppointmentStatus) =>
    http.post<void>(`/appointments/${id}/status`, { status }),
  waitlist: () => http.get<Appointment[]>('/appointments/waitlist'),
}

export const emergencyApi = {
  raise: (body: {
    type: EmergencyType
    severity: Severity
    location: string
    patientId?: number | null
    patientLabel?: string | null
  }) => http.post<EmergencyCase>('/emergencies', body),
  board: (scope: 'active' | 'all' = 'active') =>
    http.get<Board>(`/emergencies/board?scope=${scope}`),
  mine: () => http.get<EmergencyCase[]>('/emergencies/mine'),
  events: (id: number) => http.get<EmergencyEvent[]>(`/emergencies/${id}/events`),
  acknowledge: (id: number) => http.post<EmergencyCase>(`/emergencies/${id}/acknowledge`),
  resolve: (id: number, note: string) =>
    http.post<EmergencyCase>(`/emergencies/${id}/resolve`, { note }),
  dispatch: () => http.post<{ dispatched: number }>('/emergencies/dispatch'),
  stats: () => http.get<Stats>('/emergencies/stats'),
  recentEvents: (limit = 25) => http.get<EmergencyEvent[]>(`/emergencies/events/recent?limit=${limit}`),
}

export const notificationApi = {
  history: () => http.get<NotificationItem[]>('/notifications'),
}

export const reportApi = {
  appointmentsCsv: () => '/reports/appointments.csv',
  emergenciesCsv: () => '/reports/emergencies.csv',
  importSlots: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return http.upload<ReportResult>('/reports/slots/import', form)
  },
  auditLog: () => http.get<AuditLog>('/reports/audit-log'),
}
