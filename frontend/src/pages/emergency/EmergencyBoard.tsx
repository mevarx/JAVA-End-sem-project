import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { emergencyApi } from '../../api/endpoints'
import type { Board, EmergencyCase, EmergencyEvent, Severity } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { formatDateTime, waitedFor } from '../../lib/format'
import { fadeUpSmall, listItem, staggerContainer } from '../../lib/motion'
import { useLiveRefresh, usePoll } from '../../lib/useLiveRefresh'
import { AnimatedNumber } from '../../components/charts'
import { ActivityTimeline } from '../../components/emergency/ActivityTimeline'
import { useToast } from '../../components/feedback'
import {
  AlertIcon,
  ArrowRightIcon,
  BedIcon,
  ClockIcon,
  InboxIcon,
  MapPinIcon,
  RefreshIcon,
  SendIcon,
  SirenIcon,
  StethoscopeIcon,
  TimerIcon,
  UserIcon,
} from '../../components/icons'
import {
  EmergencyStatusBadge,
  LiveDot,
  PriorityRail,
  SeverityBadge,
} from '../../components/status'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  ProgressBar,
  SearchInput,
  SegmentedControl,
  Skeleton,
  StatCard,
  cx,
  textareaClass,
} from '../../components/ui'

type Scope = 'active' | 'all'
type SeverityFilter = 'ALL' | Severity

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'History' },
]

const SEVERITY_FILTERS: { value: SeverityFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
]

function CaseCard({
  emergency,
  selected,
  onSelect,
}: {
  emergency: EmergencyCase
  selected: boolean
  onSelect: (emergency: EmergencyCase) => void
}) {
  return (
    <motion.li variants={listItem} className="min-w-0">
      <button
        type="button"
        onClick={() => onSelect(emergency)}
        aria-pressed={selected}
        className={cx(
          'group flex w-full items-stretch overflow-hidden rounded-xl border bg-surface text-left transition-[border-color,box-shadow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected
            ? 'border-accent shadow-sm ring-1 ring-accent/20'
            : 'border-line hover:border-line-strong hover:bg-subtle/40',
        )}
      >
        <span className="flex shrink-0 py-2.5 pl-0.5">
          <PriorityRail severity={emergency.severity} />
        </span>
        <span className="min-w-0 flex-1 px-3 py-3 sm:px-4">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold tabular-nums text-muted">
              #{emergency.id}
            </span>
            <SeverityBadge severity={emergency.severity} label={emergency.severityLabel} />
            <EmergencyStatusBadge status={emergency.status} label={emergency.statusLabel} />
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-ink-soft">
              <TimerIcon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              {waitedFor(emergency.raisedAt, emergency.resolvedAt)}
            </span>
          </span>

          <span className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="font-display text-[15px] font-semibold leading-snug tracking-tight text-ink">
              {emergency.typeLabel}
            </span>
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            <span className="inline-flex min-w-0 items-center gap-1 text-[13px] text-ink-soft">
              <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
              <span className="truncate">{emergency.location}</span>
            </span>
          </span>

          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-relaxed text-muted">
            <span className="inline-flex min-w-0 items-center gap-1">
              <UserIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{emergency.patientLabel ?? 'Unidentified patient'}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1">
              <StethoscopeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{emergency.assignedToName ?? 'Unassigned'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <BedIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {emergency.bedNo != null ? `Bed ${emergency.bedNo}` : 'No bed'}
            </span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Raised {formatDateTime(emergency.raisedAt)}
            </span>
            {emergency.escalationCount > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-critical-ink">
                <AlertIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Escalated ×{emergency.escalationCount}
              </span>
            )}
          </span>
        </span>
      </button>
    </motion.li>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 break-words text-[13px] leading-snug text-ink">{children}</dd>
    </div>
  )
}

export function EmergencyBoardPage() {
  const { user } = useAuth()
  const role = user?.role
  const toast = useToast()
  const reduceMotion = useReducedMotion()
  const [board, setBoard] = useState<Board | null>(null)
  const [scope, setScope] = useState<Scope>('active')
  const [selected, setSelected] = useState<EmergencyCase | null>(null)
  const [events, setEvents] = useState<EmergencyEvent[]>([])
  const [resolving, setResolving] = useState<EmergencyCase | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [note, setNote] = useState('Case resolved')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const detailRef = useRef<HTMLDivElement | null>(null)

  const isStaff = role === 'RECEPTIONIST' || role === 'ER_STAFF' || role === 'ADMIN'

  const load = useCallback(() => {
    emergencyApi
      .board(scope)
      .then((data) => {
        setBoard(data)
        setSelected((current) => {
          if (current) {
            return data.cases.find((item) => item.id === current.id) ?? data.cases[0] ?? null
          }
          return data.cases[0] ?? null
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the emergency board.'))
      .finally(() => setLoading(false))
  }, [scope])

  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(load)
  usePoll(load, 5000)

  useEffect(() => {
    if (!selected) {
      setEvents([])
      return
    }
    emergencyApi
      .events(selected.id)
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [selected])

  const selectCase = useCallback(
    (emergency: EmergencyCase) => {
      setSelected(emergency)
      if (typeof window.matchMedia !== 'function') return
      if (!window.matchMedia('(max-width: 1279px)').matches) return
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'start',
        })
      })
    },
    [reduceMotion],
  )

  const critical = board?.cases.find(
    (item) => item.severity === 'CRITICAL' && item.status !== 'RESOLVED',
  )

  const cases = board?.cases
  const filteredCases = useMemo(() => {
    if (!cases) return []
    const needle = query.trim().toLowerCase()
    return cases.filter((item) => {
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) return false
      if (!needle) return true
      return `#${item.id} ${item.id} ${item.typeLabel} ${item.location} ${item.patientLabel ?? ''}`
        .toLowerCase()
        .includes(needle)
    })
  }, [cases, query, severityFilter])

  async function acknowledge() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await emergencyApi.acknowledge(selected.id)
      toast.push({
        title: `Emergency #${selected.id} acknowledged`,
        description: 'Escalation cancelled.',
        tone: 'success',
      })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not acknowledge the case.')
    } finally {
      setBusy(false)
    }
  }

  async function resolve() {
    if (!resolving) return
    setBusy(true)
    setResolveError(null)
    try {
      await emergencyApi.resolve(resolving.id, note)
      toast.push({
        title: `Emergency #${resolving.id} resolved`,
        description: 'Bed released.',
        tone: 'success',
      })
      setResolving(null)
      load()
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Could not resolve the case.')
    } finally {
      setBusy(false)
    }
  }

  async function dispatch() {
    setBusy(true)
    setError(null)
    try {
      const result = await emergencyApi.dispatch()
      toast.push({
        title: 'Dispatch pass complete',
        description: `${result.dispatched} case(s) assigned.`,
        tone: 'success',
      })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispatch failed.')
    } finally {
      setBusy(false)
    }
  }

  const isResponderRole = role === 'DOCTOR' || role === 'ER_STAFF'
  const isAdmin = role === 'ADMIN'
  const isAssignedResponder =
    selected !== null && selected.assignedTo !== null && selected.assignedTo === user?.id

  const canAcknowledge =
    selected !== null &&
    isResponderRole &&
    isAssignedResponder &&
    (selected.status === 'ASSIGNED' || selected.status === 'ESCALATED')
  const canResolve =
    selected !== null &&
    (isAdmin || (isResponderRole && isAssignedResponder)) &&
    selected.status !== 'RESOLVED'

  let acknowledgeHint: string | null = null
  if (selected && !canAcknowledge) {
    acknowledgeHint =
      selected.status === 'RESOLVED'
        ? 'This case is already resolved.'
        : selected.status === 'ACKNOWLEDGED'
          ? 'This case has already been acknowledged.'
          : selected.assignedTo === null
            ? 'A case can be acknowledged once dispatch assigns it or it escalates.'
            : 'Only the assigned responder can acknowledge this case.'
  }

  let resolveHint: string | null = null
  if (selected && !canResolve) {
    resolveHint =
      selected.status === 'RESOLVED'
        ? 'This case is already resolved.'
        : 'Only the assigned responder (or an admin) can resolve this case.'
  }

  const title =
    role === 'DOCTOR'
      ? 'My emergencies'
      : role === 'RECEPTIONIST'
        ? 'Emergency board'
        : 'Emergency operations'
  const subtitle =
    role === 'DOCTOR'
      ? 'Cases assigned to you. Priority order is severity first, then arrival time.'
      : 'Priority order is severity first, then arrival time. The dispatcher assigns a responder and bed.'

  const bedCapacity = board?.bedCapacity ?? 0
  const availableBeds = board?.availableBeds ?? 0
  const bedTone: 'accent' | 'warning' | 'critical' =
    availableBeds === 0 ? 'critical' : availableBeds <= 2 ? 'warning' : 'accent'

  return (
    <div className="min-w-0">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {(role === 'ER_STAFF' || role === 'ADMIN') && (
              <Button
                variant="secondary"
                className="min-h-11 flex-1 cursor-pointer sm:flex-none"
                onClick={dispatch}
                disabled={busy}
              >
                <SendIcon className="h-4 w-4" aria-hidden="true" />
                Dispatch
              </Button>
            )}
            <IconButton label="Refresh board" onClick={load}>
              <RefreshIcon className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <LiveDot label="Live board · refreshes every 5s" />
        {isStaff && (
          <SegmentedControl
            ariaLabel="Case scope"
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={setScope}
            className="sm:w-auto"
          />
        )}
      </div>

      {error && (
        <Alert className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {critical && (
        <motion.button
          key={critical.id}
          type="button"
          variants={fadeUpSmall}
          initial={reduceMotion ? false : 'hidden'}
          animate="show"
          onClick={() => setSelected(critical)}
          className="group relative mb-4 flex w-full items-center gap-3 overflow-hidden rounded-card border border-critical/30 bg-critical-soft px-4 py-3.5 text-left transition-colors duration-150 hover:border-critical/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical/40 sm:px-5"
        >
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-critical" />
          <span
            aria-hidden="true"
            className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-critical/10 text-critical-ink"
          >
            <SirenIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-critical-ink">
                Critical case
              </span>
              <span className="font-mono text-[11px] tabular-nums text-critical-ink">
                #{critical.id}
              </span>
              <EmergencyStatusBadge status={critical.status} label={critical.statusLabel} />
            </span>
            <span className="mt-1 block truncate font-display text-base font-semibold tracking-tight text-ink">
              {critical.typeLabel} · {critical.location}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-critical-ink">
            <span className="sm:hidden">Open</span>
            <span className="hidden sm:inline">Open case</span>
            <ArrowRightIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
          </span>
        </motion.button>
      )}

      {board && (
        <div className="mb-5 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Queue"
            value={<AnimatedNumber value={board.queueSize} />}
            hint="Cases waiting for a responder"
          />
          <Card className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-muted">
                Free ER beds
              </p>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink-soft"
              >
                <BedIcon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-semibold leading-none tracking-tight tabular-nums text-ink">
              <AnimatedNumber value={board.availableBeds} />
              <span className="ml-1 text-base font-medium text-muted">/ {board.bedCapacity}</span>
            </p>
            <ProgressBar
              className="mt-3"
              value={board.availableBeds}
              max={board.bedCapacity}
              tone={bedTone}
              label="Free bed capacity"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {bedCapacity > 0
                ? `${Math.max(bedCapacity - availableBeds, 0)} of ${bedCapacity} occupied`
                : 'Bed capacity unavailable'}
            </p>
          </Card>
          <StatCard
            label="Mean dispatch"
            value={
              board.averageDispatchMillis == null ? (
                <span className="text-muted">—</span>
              ) : board.averageDispatchMillis >= 1000 ? (
                <AnimatedNumber
                  value={board.averageDispatchMillis / 1000}
                  decimals={1}
                  suffix=" s"
                />
              ) : (
                <AnimatedNumber value={board.averageDispatchMillis} suffix=" ms" />
              )
            }
            hint="Raise → responder assigned"
          />
          <StatCard
            label="Cases in view"
            value={<AnimatedNumber value={board.cases.length} />}
            hint={scope === 'active' ? 'Active cases' : 'Including resolved'}
          />
        </div>
      )}

      {loading && !board ? (
        <div role="status" aria-label="Loading the emergency board" className="space-y-5">
          <span className="sr-only">Loading…</span>
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Card key={index} className="p-5">
                <Skeleton className="h-2.5 w-24 rounded-sm" />
                <Skeleton className="mt-4 h-8 w-16 rounded-md" />
                <Skeleton className="mt-3 h-2.5 w-28 rounded-sm" />
              </Card>
            ))}
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[1.35fr_1fr]">
            <Card className="space-y-2 p-3">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-24 w-full rounded-xl" />
              ))}
            </Card>
            <Card className="p-5">
              <Skeleton className="h-2.5 w-20 rounded-sm" />
              <Skeleton className="mt-3 h-7 w-40 rounded-md" />
              <Skeleton className="mt-6 h-40 w-full rounded-lg" />
            </Card>
          </div>
        </div>
      ) : !board || board.cases.length === 0 ? (
        <EmptyState
          icon={<InboxIcon className="h-5 w-5" aria-hidden="true" />}
          title="No emergency cases to show"
          hint={
            scope === 'active'
              ? 'The active queue is clear. New cases raised from the header appear here instantly.'
              : 'No cases match this view yet.'
          }
        />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[1.35fr_1fr]">
          <Card className="min-w-0 overflow-hidden">
            <div className="border-b border-line p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                  Priority queue
                </h2>
                <p className="font-mono text-[11px] tabular-nums text-muted">
                  {filteredCases.length} of {board.cases.length}
                </p>
              </div>
              <div className="mt-3">
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search #id, type, location or patient"
                  label="Search emergency cases"
                />
              </div>
              <div
                role="group"
                aria-label="Filter cases by severity"
                className="mt-2.5 flex flex-wrap gap-1.5"
              >
                {SEVERITY_FILTERS.map((option) => {
                  const active = severityFilter === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSeverityFilter(option.value)}
                      className={cx(
                        'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9',
                        active
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {filteredCases.length === 0 ? (
              <EmptyState
                className="m-3 border-line"
                title="No cases match"
                hint="Try another search term or clear the severity filter."
                action={
                  <Button
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => {
                      setQuery('')
                      setSeverityFilter('ALL')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <motion.ul
                variants={staggerContainer}
                initial={reduceMotion ? false : 'hidden'}
                animate="show"
                className="list-none space-y-2 p-2.5 sm:p-3"
              >
                {filteredCases.map((emergency) => (
                  <CaseCard
                    key={emergency.id}
                    emergency={emergency}
                    selected={selected?.id === emergency.id}
                    onSelect={selectCase}
                  />
                ))}
              </motion.ul>
            )}
          </Card>

          {selected ? (
            <motion.div
              key={selected.id}
              ref={detailRef}
              variants={fadeUpSmall}
              initial={reduceMotion ? false : 'hidden'}
              animate="show"
              className="min-w-0 scroll-mt-20"
            >
              <Card className="min-w-0">
                <div className="border-b border-line p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] tabular-nums text-muted">
                        Case #{selected.id}
                      </p>
                      <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-ink">
                        {selected.typeLabel}
                      </h2>
                      <p className="mt-1 inline-flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
                        <MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{selected.location}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <SeverityBadge severity={selected.severity} label={selected.severityLabel} />
                      <EmergencyStatusBadge status={selected.status} label={selected.statusLabel} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-subtle/50 px-3 py-2.5">
                    <LiveDot
                      label={selected.status === 'RESOLVED' ? 'Resolved case' : 'In progress'}
                      tone={selected.status === 'RESOLVED' ? 'idle' : 'live'}
                    />
                    <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-ink">
                      <TimerIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                      {waitedFor(selected.raisedAt, selected.resolvedAt)}
                    </span>
                  </div>
                </div>

                <div className="space-y-5 p-4 sm:p-5">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Detail label="Patient">
                      {selected.patientLabel ?? 'Unidentified patient'}
                    </Detail>
                    <Detail label="Escalations">
                      {selected.escalationCount > 0 ? (
                        <span className="font-semibold text-critical-ink">
                          {selected.escalationCount}
                        </span>
                      ) : (
                        'None'
                      )}
                    </Detail>
                    <Detail label="Raised">{formatDateTime(selected.raisedAt)}</Detail>
                    <Detail label="Dispatched">{formatDateTime(selected.dispatchedAt)}</Detail>
                    <Detail label="Acknowledged">{formatDateTime(selected.acknowledgedAt)}</Detail>
                    <Detail label="Escalated">{formatDateTime(selected.escalatedAt)}</Detail>
                    <Detail label="Resolved">{formatDateTime(selected.resolvedAt)}</Detail>
                    <Detail label="Responder">
                      {selected.assignedToName ?? 'Unassigned'}
                    </Detail>
                    <Detail label="Bed">
                      {selected.bedNo != null ? `Bed ${selected.bedNo}` : 'No bed assigned'}
                    </Detail>
                    <Detail label="Case ID">
                      <span className="font-mono tabular-nums">#{selected.id}</span>
                    </Detail>
                  </dl>

                  <div className="border-t border-line pt-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        className="min-h-11 w-full cursor-pointer sm:w-auto"
                        onClick={acknowledge}
                        disabled={!canAcknowledge || busy}
                        loading={busy}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        variant="secondary"
                        className="min-h-11 w-full cursor-pointer sm:w-auto"
                        onClick={() => {
                          setNote('Case resolved')
                          setResolveError(null)
                          setResolving(selected)
                        }}
                        disabled={!canResolve || busy}
                      >
                        Resolve case
                      </Button>
                    </div>
                    {acknowledgeHint && (
                      <p className="mt-2 text-xs leading-relaxed text-muted">{acknowledgeHint}</p>
                    )}
                    {resolveHint && (
                      <p className="mt-1 text-xs leading-relaxed text-muted">{resolveHint}</p>
                    )}
                  </div>

                  <div className="border-t border-line pt-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-display text-sm font-semibold tracking-tight text-ink">
                        Activity
                      </h3>
                      <span className="font-mono text-[11px] tabular-nums text-muted">
                        {events.length} event(s)
                      </span>
                    </div>
                    <ActivityTimeline
                      key={selected.id}
                      events={events}
                      className="mt-3"
                      emptyLabel="No activity recorded yet."
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : (
            <Card className="p-5">
              <p className="text-sm text-muted">Select a case to inspect its timeline and actions.</p>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={resolving !== null}
        title={resolving ? `Resolve emergency #${resolving.id}` : 'Resolve emergency'}
        description="Resolution closes the case and releases the assigned bed."
        onClose={() => {
          setResolving(null)
          setResolveError(null)
        }}
        footer={
          <>
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                setResolving(null)
                setResolveError(null)
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              className="min-h-11"
              onClick={resolve}
              disabled={busy}
              loading={busy}
            >
              {busy ? 'Resolving…' : 'Resolve case'}
            </Button>
          </>
        }
      >
        {resolveError && (
          <Alert className="mb-4" onDismiss={() => setResolveError(null)}>
            {resolveError}
          </Alert>
        )}
        <Field label="Resolution note" hint="Stored with the case and visible in the activity timeline.">
          <textarea
            className={textareaClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  )
}
