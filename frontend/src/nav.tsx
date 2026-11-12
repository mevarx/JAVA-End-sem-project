import type { ComponentType, SVGProps } from 'react'
import type { Role } from './api/types'
import {
  AlertIcon,
  BuildingIcon,
  CalendarIcon,
  ClipboardIcon,
  ClockIcon,
  LayoutDashboardIcon,
  ReportIcon,
  UsersIcon,
} from './components/icons'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  roles: Role[]
  group: string
  labelsByRole?: Partial<Record<Role, string>>
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboardIcon,
    roles: ['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ER_STAFF', 'ADMIN'],
    group: 'Overview',
  },
  {
    to: '/book',
    label: 'Book appointment',
    icon: CalendarIcon,
    roles: ['PATIENT', 'RECEPTIONIST'],
    group: 'Scheduling',
    labelsByRole: { RECEPTIONIST: 'Book for patient' },
  },
  {
    to: '/appointments',
    label: 'My appointments',
    icon: ClipboardIcon,
    roles: ['PATIENT'],
    group: 'My care',
  },
  {
    to: '/emergencies',
    label: 'My emergencies',
    icon: AlertIcon,
    roles: ['PATIENT'],
    group: 'My care',
  },
  {
    to: '/schedule',
    label: 'My schedule',
    icon: CalendarIcon,
    roles: ['DOCTOR'],
    group: 'Clinical',
  },
  {
    to: '/availability',
    label: 'Availability',
    icon: ClockIcon,
    roles: ['DOCTOR'],
    group: 'Clinical',
  },
  {
    to: '/all-appointments',
    label: 'All appointments',
    icon: ClipboardIcon,
    roles: ['RECEPTIONIST', 'ER_STAFF', 'ADMIN'],
    group: 'Scheduling',
  },
  {
    to: '/waitlist',
    label: 'Re-booking queue',
    icon: ClockIcon,
    roles: ['RECEPTIONIST', 'ADMIN'],
    group: 'Scheduling',
  },
  {
    to: '/board',
    label: 'Emergency board',
    icon: AlertIcon,
    roles: ['DOCTOR', 'RECEPTIONIST', 'ER_STAFF', 'ADMIN'],
    group: 'Emergency',
    labelsByRole: { DOCTOR: 'My emergencies' },
  },
  {
    to: '/users',
    label: 'Users',
    icon: UsersIcon,
    roles: ['ADMIN'],
    group: 'Administration',
  },
  {
    to: '/departments',
    label: 'Departments',
    icon: BuildingIcon,
    roles: ['ADMIN'],
    group: 'Administration',
  },
  {
    to: '/reports',
    label: 'Reports',
    icon: ReportIcon,
    roles: ['ADMIN'],
    group: 'Administration',
  },
]

const GROUP_ORDER = [
  'Overview',
  'My care',
  'Clinical',
  'Scheduling',
  'Emergency',
  'Administration',
] as const

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const ROLE_HOME: Record<Role, string> = {
  PATIENT: '/dashboard',
  DOCTOR: '/dashboard',
  RECEPTIONIST: '/dashboard',
  ER_STAFF: '/dashboard',
  ADMIN: '/dashboard',
}

export const ROLE_WORKSPACE: Record<Role, string> = {
  PATIENT: 'Patient portal',
  DOCTOR: 'Clinician workspace',
  RECEPTIONIST: 'Front desk',
  ER_STAFF: 'Emergency operations',
  ADMIN: 'Administration',
}

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function navGroupsForRole(role: Role): NavGroup[] {
  const items = navForRole(role)
  return GROUP_ORDER.map((label) => ({
    label,
    items: items.filter((item) => item.group === label),
  })).filter((group) => group.items.length > 0)
}

export function labelForRole(item: NavItem, role: Role): string {
  return item.labelsByRole?.[role] ?? item.label
}

export function navItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  )
}
