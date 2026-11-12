import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  appointmentApi,
  departmentApi,
  emergencyApi,
  slotApi,
  userApi,
} from '../api/endpoints'
import type {
  Appointment,
  AppointmentStatus,
  Board,
  Department,
  EmergencyCase,
  EmergencyEvent,
  Role,
  Slot,
  Stats,
  User,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import {
  APPOINTMENT_STATUS_LABELS,
  addDaysIso,
  dayKey,
  formatRelative,
  formatShortDate,
  formatTime,
  formatWeekday,
  isFuture,
  isToday,
  todayIso,
} from '../lib/format'
import { fadeUp, staggerContainer } from '../lib/motion'
import { useLiveRefresh, usePoll } from '../lib/useLiveRefresh'
import { AnimatedNumber } from '../components/charts'
import {
  ActivityIcon,
  AlertIcon,
  BedIcon,
  BuildingIcon,
  CalendarDaysIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardIcon,
  ClockIcon,
  SirenIcon,
  UsersIcon,
} from '../components/icons'
import { LiveDot } from '../components/status'
import { StatCard } from '../components/ui'
import { PageSkeleton } from '../components/feedback'
import { DashboardHero, type HeroAction } from './dashboard/Hero'
import {
  StatusMixCard,
  WeeklyChartCard,
  type StatusChartDatum,
} from './dashboard/ChartsPanel'
import {
  EmergencySnapshot,
  QuickActions,
  RecentEvents,
  ScheduleCard,
  StatSkeletons,
  sortCases,
} from './dashboard/Widgets'

/* -------------------------------------------------------------------------- */
/* Constants and small formatters                                             */
/* -------------------------------------------------------------------------- */

const todayFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
})

const STATUS_CHART_COLORS: Record<AppointmentStatus, string> = {
  BOOKED: 'var(--color-accent)',
  COMPLETED: 'var(--color-info)',
  RESCHEDULED: 'var(--color-accent)',
  NO_SHOW: 'var(--color-warning)',
  PRE_EMPTED: 'var(--color-critical)',
  CANCELLED: 'var(--color-line-strong)',
}

const STATUS_CHART_ORDER: AppointmentStatus[] = [
  'BOOKED',
  'COMPLETED',
  'RESCHEDULED',
  'NO_SHOW',
  'PRE_EMPTED',
  'CANCELLED',
]

function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}

function joinContext(parts: Array<string | false | null | undefined>, fallback: string): string {
  const line = parts.filter(Boolean).join(' · ')
  return line || fallback
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

type Section =
  | 'appointments'
  | 'board'
  | 'stats'
  | 'mine'
  | 'slots'
  | 'waitlist'
  | 'users'
  | 'departments'
  | 'events'

interface DashboardData {
  appointments: Appointment[]
  board: Board | null
  stats: Stats | null
  mine: EmergencyCase[]
  slots: Slot[]
  waitlist: Appointment[]
  users: User[]
  departments: Department[]
  events: EmergencyEvent[]
}

const EMPTY_DATA: DashboardData = {
  appointments: [],
  board: null,
  stats: null,
  mine: [],
  slots: [],
  waitlist: [],
  users: [],
  departments: [],
  events: [],
}

interface StatSpec {
  label: string
  value: ReactNode
  hint?: string
  icon: ReactNode
  tone?: 'default' | 'accent' | 'critical' | 'warning'
}

export function DashboardPage() {
  const { user } = useAuth()
  const role = user?.role
  const navigate = useNavigate()

  const [data, setData] = useState<DashboardData>(EMPTY_DATA)
  const [errors, setErrors] = useState<Partial<Record<Section, string>>>({})
  const [ready, setReady] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!role) return

    const nextErrors: Partial<Record<Section, string>> = {}

    async function run<T>(
      key: Section,
      request: Promise<T>,
      apply: (value: T) => void,
    ): Promise<void> {
      try {
        apply(await request)
      } catch (error) {
        nextErrors[key] =
          error instanceof Error ? error.message : 'Could not load this section.'
      }
    }

    const tasks: Promise<void>[] = [
      run('appointments', appointmentApi.list(), (value) =>
        setData((current) => ({ ...current, appointments: value })),
      ),
    ]

    switch (role) {
      case 'PATIENT':
        tasks.push(
          run('mine', emergencyApi.mine(), (value) =>
            setData((current) => ({ ...current, mine: value })),
          ),
        )
        break
      case 'DOCTOR':
        tasks.push(
          run('board', emergencyApi.board('active'), (value) =>
            setData((current) => ({ ...current, board: value })),
          ),
          run('slots', slotApi.mine(), (value) =>
            setData((current) => ({ ...current, slots: value })),
          ),
        )
        break
      case 'RECEPTIONIST':
        tasks.push(
          run('board', emergencyApi.board('active'), (value) =>
            setData((current) => ({ ...current, board: value })),
          ),
          run('stats', emergencyApi.stats(), (value) =>
            setData((current) => ({ ...current, stats: value })),
          ),
          run('waitlist', appointmentApi.waitlist(), (value) =>
            setData((current) => ({ ...current, waitlist: value })),
          ),
        )
        break
      case 'ER_STAFF':
        tasks.push(
          run('board', emergencyApi.board('active'), (value) =>
            setData((current) => ({ ...current, board: value })),
          ),
          run('stats', emergencyApi.stats(), (value) =>
            setData((current) => ({ ...current, stats: value })),
          ),
          run('events', emergencyApi.recentEvents(8), (value) =>
            setData((current) => ({ ...current, events: value })),
          ),
        )
        break
      case 'ADMIN':
        tasks.push(
          run('board', emergencyApi.board('active'), (value) =>
            setData((current) => ({ ...current, board: value })),
          ),
          run('stats', emergencyApi.stats(), (value) =>
            setData((current) => ({ ...current, stats: value })),
          ),
          run('users', userApi.list(), (value) =>
            setData((current) => ({ ...current, users: value })),
          ),
          run('departments', departmentApi.list(), (value) =>
            setData((current) => ({ ...current, departments: value })),
          ),
          run('events', emergencyApi.recentEvents(8), (value) =>
            setData((current) => ({ ...current, events: value })),
          ),
        )
        break
    }

    await Promise.all(tasks)
    setErrors(nextErrors)
    setRefreshedAt(new Date())
    setReady(true)
  }, [role])

  useEffect(() => {
    void load()
  }, [load])
  useLiveRefresh(load)
  usePoll(load, 30000)

  const upcoming = useMemo(
    () =>
      data.appointments
        .filter((appointment) => appointment.status === 'BOOKED' && isFuture(appointment.start))
        .sort(
          (left, right) =>
            new Date(left.start).getTime() - new Date(right.start).getTime(),
        ),
    [data.appointments],
  )

  const todayBooked = useMemo(
    () =>
      data.appointments.filter(
        (appointment) => appointment.status === 'BOOKED' && isToday(appointment.start),
      ),
    [data.appointments],
  )

  const completedCount = useMemo(
    () => data.appointments.filter((appointment) => appointment.status === 'COMPLETED').length,
    [data.appointments],
  )

  const statusChartData = useMemo<StatusChartDatum[]>(() => {
    const counts = new Map<AppointmentStatus, number>()
    for (const appointment of data.appointments) {
      counts.set(appointment.status, (counts.get(appointment.status) ?? 0) + 1)
    }
    return STATUS_CHART_ORDER.filter((status) => (counts.get(status) ?? 0) > 0).map(
      (status) => ({
        label: APPOINTMENT_STATUS_LABELS[status],
        value: counts.get(status) ?? 0,
        color: STATUS_CHART_COLORS[status],
      }),
    )
  }, [data.appointments])

  const dayChartData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const appointment of data.appointments) {
      const key = dayKey(appointment.start)
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from({ length: 7 }, (_, index) => {
      const iso = addDaysIso(todayIso(), index)
      return { label: formatWeekday(iso), value: counts.get(iso) ?? 0 }
    })
  }, [data.appointments])

  if (!user || !role) {
    return <PageSkeleton />
  }

  const activeCases = sortCases(
    (data.board?.cases ?? []).filter((item) => item.status !== 'RESOLVED'),
  )
  const criticalCount = activeCases.filter((item) => item.severity === 'CRITICAL').length
  const assignedActive = activeCases.filter((item) => item.assignedTo === user.id)
  const myActive = data.mine.filter((item) => item.status !== 'RESOLVED')
  const freeSlots = data.slots.filter((slot) => slot.status === 'FREE' && isFuture(slot.start))
  const waitlistCount = data.waitlist.length
  const activeUsers = data.users.filter((item) => item.active).length

  const queueSize = data.board?.queueSize ?? data.stats?.queueSize ?? 0
  const bedCapacity = data.board?.bedCapacity ?? data.stats?.bedCapacity ?? 0
  const availableBeds = data.board?.availableBeds ?? data.stats?.availableBeds ?? 0
  const averageDispatch = data.board?.averageDispatchMillis ?? data.stats?.averageDispatchMillis
  const queueUnavailable = Boolean(errors.board && errors.stats)
  const bedsUnavailable = Boolean(errors.board && errors.stats)

  function counted(value: number, section?: Section): ReactNode {
    if (section && errors[section]) return <span className="text-muted">—</span>
    return <AnimatedNumber value={value} />
  }

  function buildStats(activeRole: Role): StatSpec[] {
    switch (activeRole) {
      case 'PATIENT':
        return [
          {
            label: 'Upcoming',
            value: counted(upcoming.length, 'appointments'),
            hint:
              errors.appointments || upcoming.length === 0
                ? 'Confirmed future visits'
                : `Next ${formatRelative(upcoming[0].start)}`,
            icon: <CalendarDaysIcon />,
            tone: 'accent',
          },
          {
            label: 'Visited',
            value: counted(completedCount, 'appointments'),
            hint: 'Visits marked completed',
            icon: <CheckCircleIcon />,
          },
          {
            label: 'Open cases',
            value: counted(myActive.length, 'mine'),
            hint: errors.mine
              ? 'Emergency cases unavailable'
              : myActive.length === 0
                ? 'No open emergency cases'
                : 'Emergency cases still open',
            icon: <SirenIcon />,
            tone: myActive.length > 0 ? 'critical' : 'default',
          },
          {
            label: 'Next visit',
            value:
              errors.appointments || !upcoming[0]
                ? '—'
                : formatShortDate(upcoming[0].start),
            hint: errors.appointments
              ? 'Appointment data unavailable'
              : upcoming[0]
                ? `${formatTime(upcoming[0].start)} · ${upcoming[0].doctorName}`
                : 'Book a visit to see it here',
            icon: <ClockIcon />,
          },
        ]

      case 'DOCTOR':
        return [
          {
            label: 'Today',
            value: counted(todayBooked.length, 'appointments'),
            hint: errors.slots
              ? 'Booked visits for today'
              : 'Confirmed visits dated today',
            icon: <CalendarDaysIcon />,
            tone: 'accent',
          },
          {
            label: 'Upcoming',
            value: counted(upcoming.length, 'appointments'),
            hint: 'Confirmed future bookings',
            icon: <CalendarIcon />,
          },
          {
            label: 'Completed',
            value: counted(completedCount, 'appointments'),
            hint: 'Visits marked completed',
            icon: <CheckCircleIcon />,
          },
          {
            label: 'Assigned active',
            value: counted(assignedActive.length, 'board'),
            hint: errors.board
              ? 'Emergency board unavailable'
              : assignedActive.length > 0
                ? 'Assigned to you on the active board'
                : 'No active emergency assignments',
            icon: <SirenIcon />,
            tone: assignedActive.length > 0 ? 'critical' : 'default',
          },
        ]

      case 'RECEPTIONIST':
        return [
          {
            label: 'Today',
            value: counted(todayBooked.length, 'appointments'),
            hint: 'Confirmed visits dated today',
            icon: <CalendarDaysIcon />,
            tone: 'accent',
          },
          {
            label: 'Awaiting re-booking',
            value: counted(waitlistCount, 'waitlist'),
            hint: errors.waitlist
              ? 'Queue unavailable'
              : 'Displaced by critical emergencies',
            icon: <ClipboardIcon />,
            tone: waitlistCount > 0 ? 'warning' : 'default',
          },
          {
            label: 'Emergency queue',
            value: counted(queueSize, 'board'),
            hint: queueUnavailable
              ? 'Emergency data unavailable'
              : `${activeCases.length} active · ${criticalCount} critical`,
            icon: <SirenIcon />,
            tone: criticalCount > 0 ? 'critical' : 'default',
          },
          {
            label: 'Free beds',
            value: counted(availableBeds, 'board'),
            hint: bedsUnavailable
              ? 'Bed capacity unavailable'
              : `of ${bedCapacity} beds${bedCapacity > 0 ? ` · ${Math.round((availableBeds / bedCapacity) * 100)}% free` : ''}`,
            icon: <BedIcon />,
          },
        ]

      case 'ER_STAFF':
        return [
          {
            label: 'Active cases',
            value: counted(activeCases.length, 'board'),
            hint: 'Open on the emergency board',
            icon: <ActivityIcon />,
            tone: 'accent',
          },
          {
            label: 'Critical',
            value: counted(criticalCount, 'board'),
            hint: criticalCount > 0 ? 'Needs prompt acknowledgement' : 'No critical cases right now',
            icon: <AlertIcon />,
            tone: criticalCount > 0 ? 'critical' : 'default',
          },
          {
            label: 'In queue',
            value: counted(queueSize, 'board'),
            hint: queueUnavailable
              ? 'Queue data unavailable'
              : `avg dispatch ${formatDuration(averageDispatch)}`,
            icon: <SirenIcon />,
            tone: queueSize > 0 ? 'warning' : 'default',
          },
          {
            label: 'Free beds',
            value: counted(availableBeds, 'board'),
            hint: bedsUnavailable
              ? 'Bed capacity unavailable'
              : `of ${bedCapacity} beds${bedCapacity > 0 ? ` · ${Math.round((availableBeds / bedCapacity) * 100)}% free` : ''}`,
            icon: <BedIcon />,
          },
        ]

      case 'ADMIN':
        return [
          {
            label: 'Active users',
            value: counted(activeUsers, 'users'),
            hint: errors.users
              ? 'User directory unavailable'
              : `${data.users.length - activeUsers} inactive account${data.users.length - activeUsers === 1 ? '' : 's'}`,
            icon: <UsersIcon />,
            tone: 'accent',
          },
          {
            label: 'Departments',
            value: counted(data.departments.length, 'departments'),
            hint: 'Clinical and operational units',
            icon: <BuildingIcon />,
          },
          {
            label: 'Appointments',
            value: counted(data.appointments.length, 'appointments'),
            hint: errors.appointments
              ? 'Appointment data unavailable'
              : `${upcoming.length} upcoming`,
            icon: <ClipboardIcon />,
          },
          {
            label: 'Active emergencies',
            value: counted(activeCases.length, 'board'),
            hint: errors.board
              ? 'Emergency board unavailable'
              : `${criticalCount} critical · ${queueSize} in queue`,
            icon: <SirenIcon />,
            tone: criticalCount > 0 ? 'critical' : 'default',
          },
        ]
    }
  }

  const stats = buildStats(role)
  const todayLabel = todayFormatter.format(new Date())
  const greeting = greetingFor(new Date())

  const primaryAction: HeroAction =
    role === 'PATIENT' || role === 'RECEPTIONIST'
      ? {
          to: '/book',
          label: role === 'RECEPTIONIST' ? 'Book for patient' : 'Book appointment',
          icon: CalendarIcon,
        }
      : role === 'ADMIN'
        ? { to: '/users', label: 'Users', icon: UsersIcon }
        : { to: '/board', label: 'Emergency board', icon: AlertIcon }

  const secondaryAction =
    role === 'PATIENT'
      ? { to: '/appointments', label: 'My appointments' }
      : role === 'DOCTOR'
        ? { to: '/schedule', label: 'My schedule' }
        : role === 'ADMIN'
          ? { to: '/board', label: 'Emergency board' }
          : { to: '/all-appointments', label: 'All appointments' }

  const contextLine = (() => {
    switch (role) {
      case 'PATIENT':
        return errors.appointments
          ? 'Your appointment overview is temporarily unavailable.'
          : upcoming[0]
            ? `Next visit ${formatRelative(upcoming[0].start)} with ${upcoming[0].doctorName} on ${formatShortDate(upcoming[0].start)} at ${formatTime(upcoming[0].start)}.`
            : 'No upcoming visits. Book a consultation whenever you are ready.'
      case 'DOCTOR':
        return joinContext(
          [
            !errors.appointments && `${todayBooked.length} booked today`,
            !errors.appointments && `${upcoming.length} upcoming`,
            !errors.slots && `${freeSlots.length} open slots`,
            !errors.board && assignedActive.length > 0
              ? `${assignedActive.length} emergency assignment${assignedActive.length === 1 ? '' : 's'}`
              : null,
          ],
          'Your clinical day at a glance.',
        )
      case 'RECEPTIONIST':
        return joinContext(
          [
            !errors.appointments && `${todayBooked.length} booked today`,
            !errors.waitlist && `${waitlistCount} awaiting re-booking`,
            !queueUnavailable && `${queueSize} in emergency queue`,
            !bedsUnavailable && `${availableBeds}/${bedCapacity} beds free`,
          ],
          'Front desk overview for today.',
        )
      case 'ER_STAFF':
        return joinContext(
          [
            !errors.board && `${activeCases.length} active case${activeCases.length === 1 ? '' : 's'}`,
            !errors.board && `${criticalCount} critical`,
            !errors.board && `${queueSize} in queue`,
            !bedsUnavailable && `${availableBeds}/${bedCapacity} beds free`,
          ],
          'Emergency operations at a glance.',
        )
      case 'ADMIN':
        return joinContext(
          [
            !errors.users && `${activeUsers} active user${activeUsers === 1 ? '' : 's'}`,
            !errors.departments &&
              `${data.departments.length} department${data.departments.length === 1 ? '' : 's'}`,
            !errors.appointments && `${data.appointments.length} appointments`,
            !errors.board && `${queueSize} in emergency queue`,
          ],
          'Organisation overview.',
        )
    }
  })()

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* Hero */}
      <DashboardHero
        role={role}
        fullName={user.fullName}
        greeting={greeting}
        todayLabel={todayLabel}
        contextLine={contextLine}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        onPrimaryAction={() => navigate(primaryAction.to)}
      />

      {/* Stats */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-4 lg:grid-cols-4"
      >
        {ready ? (
          stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              hint={stat.hint}
              icon={stat.icon}
              tone={stat.tone}
              className="min-w-0"
            />
          ))
        ) : (
          <StatSkeletons />
        )}
      </motion.div>

      {/* Main grid — explicit xl placement keeps both column bottoms level
          regardless of how live data changes card heights. DOM order is the
          mobile stacking order: schedule, status, emergency, weekly, actions. */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <motion.div variants={fadeUp} className="min-w-0 xl:col-start-1 xl:row-start-1">
          <ScheduleCard
            role={role}
            upcoming={upcoming}
            loading={!ready}
            error={errors.appointments ?? null}
            onRetry={() => void load()}
          />
        </motion.div>

        <motion.div variants={fadeUp} className="min-w-0 xl:col-start-1 xl:row-start-2">
          <StatusMixCard
            statusData={statusChartData}
            totalBookings={data.appointments.length}
            loading={!ready}
            error={errors.appointments ?? null}
            onRetry={() => void load()}
          />
        </motion.div>

        <motion.div variants={fadeUp} className="min-w-0 xl:col-start-2 xl:row-start-1">
          <EmergencySnapshot
            role={role}
            board={data.board}
            mine={data.mine}
            loading={!ready}
            error={role === 'PATIENT' ? (errors.mine ?? null) : (errors.board ?? null)}
            onRetry={() => void load()}
          />
        </motion.div>

        <motion.div variants={fadeUp} className="min-w-0 xl:col-start-2 xl:row-start-2">
          <WeeklyChartCard
            dayData={dayChartData}
            loading={!ready}
            error={errors.appointments ?? null}
            onRetry={() => void load()}
          />
        </motion.div>

        <motion.div variants={fadeUp} className="min-w-0 xl:col-span-2 xl:row-start-3">
          <QuickActions role={role} />
        </motion.div>
      </div>

      {/* Recent activity — full width so the two main columns stay balanced */}
      {(role === 'ER_STAFF' || role === 'ADMIN') && (
        <motion.div variants={fadeUp}>
          <RecentEvents
            events={data.events}
            loading={!ready}
            error={errors.events ?? null}
            onRetry={() => void load()}
          />
        </motion.div>
      )}

      <motion.footer
        variants={fadeUp}
        className="flex flex-col gap-2 border-t border-line pt-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between"
      >
        <LiveDot label="Live updates" tone={ready ? 'live' : 'idle'} />
        <p>
          Last refreshed{' '}
          <span className="font-mono tabular-nums text-ink-soft">
            {refreshedAt ? clockFormatter.format(refreshedAt) : '—'}
          </span>{' '}
          · refreshes every 30 seconds while this tab is open
        </p>
      </motion.footer>
    </motion.div>
  )
}
