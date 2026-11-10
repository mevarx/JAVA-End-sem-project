import type { ComponentType, SVGProps } from 'react'
import type { Role } from './api/types'
import {
  AlertIcon,
  BuildingIcon,
  CalendarIcon,
  ClipboardIcon,
  ClockIcon,
  ReportIcon,
  UsersIcon,
} from './components/icons'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  roles: Role[]
  labelsByRole?: Partial<Record<Role, string>>
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/book',
    label: 'Book appointment',
    icon: CalendarIcon,
    roles: ['PATIENT', 'RECEPTIONIST'],
    labelsByRole: { RECEPTIONIST: 'Book for patient' },
  },
  { to: '/appointments', label: 'My appointments', icon: ClipboardIcon, roles: ['PATIENT'] },
  { to: '/emergencies', label: 'My emergencies', icon: AlertIcon, roles: ['PATIENT'] },
  { to: '/schedule', label: 'My schedule', icon: CalendarIcon, roles: ['DOCTOR'] },
  { to: '/availability', label: 'Availability', icon: ClockIcon, roles: ['DOCTOR'] },
  {
    to: '/all-appointments',
    label: 'All appointments',
    icon: ClipboardIcon,
    roles: ['RECEPTIONIST', 'ER_STAFF', 'ADMIN'],
  },
  { to: '/waitlist', label: 'Re-booking queue', icon: ClockIcon, roles: ['RECEPTIONIST', 'ADMIN'] },
  {
    to: '/board',
    label: 'Emergency board',
    icon: AlertIcon,
    roles: ['DOCTOR', 'RECEPTIONIST', 'ER_STAFF', 'ADMIN'],
    labelsByRole: { DOCTOR: 'My emergencies' },
  },
  { to: '/users', label: 'Users', icon: UsersIcon, roles: ['ADMIN'] },
  { to: '/departments', label: 'Departments', icon: BuildingIcon, roles: ['ADMIN'] },
  { to: '/reports', label: 'Reports', icon: ReportIcon, roles: ['ADMIN'] },
]

export const ROLE_HOME: Record<Role, string> = {
  PATIENT: '/book',
  DOCTOR: '/schedule',
  RECEPTIONIST: '/book',
  ER_STAFF: '/board',
  ADMIN: '/users',
}

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function labelForRole(item: NavItem, role: Role): string {
  return item.labelsByRole?.[role] ?? item.label
}

export function rolesForPath(path: string): Role[] | null {
  const item = NAV_ITEMS.find((candidate) => candidate.to === path)
  return item ? item.roles : null
}
