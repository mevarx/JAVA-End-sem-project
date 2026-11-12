import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { emergencyApi } from '../../api/endpoints'
import type { EmergencyCase, EmergencyEvent } from '../../api/types'
import { formatDateTime, waitedFor } from '../../lib/format'
import { requestEmergencyDialog } from '../../lib/events'
import { fadeUpSmall, listItem, staggerContainer } from '../../lib/motion'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { AnimatedNumber } from '../../components/charts'
import { ActivityTimeline } from '../../components/emergency/ActivityTimeline'
import {
  BedIcon,
  ClockIcon,
  MapPinIcon,
  RefreshIcon,
  SirenIcon,
  StethoscopeIcon,
  TimerIcon,
} from '../../components/icons'
import {
  EmergencyStatusBadge,
  PriorityRail,
  SeverityBadge,
} from '../../components/status'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  IconButton,
  PageHeader,
  Skeleton,
  cx,
} from '../../components/ui'

function PatientCaseCard({
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
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Raised {formatDateTime(emergency.raisedAt)}
            </span>
            {emergency.assignedToName && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <StethoscopeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{emergency.assignedToName}</span>
              </span>
            )}
            {emergency.bedNo != null && (
              <span className="inline-flex items-center gap-1">
                <BedIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Bed {emergency.bedNo}
              </span>
            )}
          </span>
        </span>
      </button>
    </motion.li>
  )
}

function Detail({ label, children }: { label: string; children: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 break-words text-[13px] leading-snug text-ink">{children}</dd>
    </div>
  )
}

export function MyEmergenciesPage() {
  const reduceMotion = useReducedMotion()
  const [cases, setCases] = useState<EmergencyCase[]>([])
  const [selected, setSelected] = useState<EmergencyCase | null>(null)
  const [events, setEvents] = useState<EmergencyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(() => {
    emergencyApi
      .mine()
      .then((list) => {
        setCases(list)
        setSelected((current) => {
          if (current) {
            return list.find((item) => item.id === current.id) ?? list[0] ?? null
          }
          return list[0] ?? null
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your emergencies.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(load)

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
      if (!window.matchMedia('(max-width: 1023px)').matches) return
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'start',
        })
      })
    },
    [reduceMotion],
  )

  const summary = useMemo(() => {
    const open = cases.filter((item) => item.status !== 'RESOLVED').length
    return { open, resolved: cases.length - open }
  }, [cases])

  return (
    <div className="min-w-0">
      <PageHeader
        title="My emergencies"
        subtitle="Every emergency you raised, with its current status and timestamped timeline."
        actions={
          <>
            <Button
              variant="emergency"
              className="min-h-11 flex-1 cursor-pointer sm:flex-none"
              onClick={requestEmergencyDialog}
            >
              <SirenIcon className="h-4 w-4" aria-hidden="true" />
              Raise emergency
            </Button>
            <IconButton label="Refresh emergencies" onClick={load}>
              <RefreshIcon className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </>
        }
      />

      {error && (
        <Alert className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!loading && cases.length > 0 && (
        <Card className="mb-5 grid max-w-md grid-cols-2 divide-x divide-line">
          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-muted">
              Open
            </p>
            <p className="mt-2.5 font-display text-3xl font-semibold leading-none tracking-tight tabular-nums text-ink">
              <AnimatedNumber value={summary.open} />
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">Still being handled</p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-muted">
              Resolved
            </p>
            <p className="mt-2.5 font-display text-3xl font-semibold leading-none tracking-tight tabular-nums text-ink">
              <AnimatedNumber value={summary.resolved} />
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">Case closed</p>
          </div>
        </Card>
      )}

      {loading ? (
        <div role="status" aria-label="Loading emergencies" className="space-y-5">
          <span className="sr-only">Loading…</span>
          <Card className="grid max-w-md grid-cols-2 divide-x divide-line">
            {[0, 1].map((index) => (
              <div key={index} className="p-4 sm:p-5">
                <Skeleton className="h-2.5 w-16 rounded-sm" />
                <Skeleton className="mt-4 h-8 w-12 rounded-md" />
                <Skeleton className="mt-3 h-2.5 w-24 rounded-sm" />
              </div>
            ))}
          </Card>
          <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card className="space-y-2 p-3">
              {[0, 1, 2].map((index) => (
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
      ) : cases.length === 0 ? (
        <EmptyState
          icon={<SirenIcon className="h-5 w-5" aria-hidden="true" />}
          title="No emergencies on record"
          hint="If you need urgent help, raise a case and the ER team sees it immediately."
          action={
            <Button variant="emergency" className="min-h-11 cursor-pointer" onClick={requestEmergencyDialog}>
              <SirenIcon className="h-4 w-4" aria-hidden="true" />
              Raise emergency
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line p-4 sm:p-5">
              <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                Your cases
              </h2>
              <p className="font-mono text-[11px] tabular-nums text-muted">
                {cases.length} case(s)
              </p>
            </div>
            <motion.ul
              variants={staggerContainer}
              initial={reduceMotion ? false : 'hidden'}
              animate="show"
              className="list-none space-y-2 p-2.5 sm:p-3"
            >
              {cases.map((emergency) => (
                <PatientCaseCard
                  key={emergency.id}
                  emergency={emergency}
                  selected={selected?.id === emergency.id}
                  onSelect={selectCase}
                />
              ))}
            </motion.ul>
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
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                      {selected.status === 'RESOLVED' ? 'Total wait' : 'Time open'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-ink">
                      <TimerIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                      {waitedFor(selected.raisedAt, selected.resolvedAt)}
                    </span>
                  </div>
                </div>

                <div className="space-y-5 p-4 sm:p-5">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Detail label="Raised">{formatDateTime(selected.raisedAt)}</Detail>
                    <Detail label="Resolved">{formatDateTime(selected.resolvedAt)}</Detail>
                    <Detail label="Responder">{selected.assignedToName ?? 'Not assigned yet'}</Detail>
                    <Detail label="Bed">
                      {selected.bedNo != null ? `Bed ${selected.bedNo}` : 'Not assigned yet'}
                    </Detail>
                  </dl>

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
              <p className="text-sm text-muted">Select a case to inspect its timeline.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
