import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react'
import { motion } from 'motion/react'
import { appointmentApi, emergencyApi, reportApi } from '../../api/endpoints'
import { download } from '../../api/client'
import type { AuditLog, EmergencyEvent, ReportResult, Stats } from '../../api/types'
import { formatDateTime } from '../../lib/format'
import { fadeUp, staggerContainer } from '../../lib/motion'
import { AnimatedNumber } from '../../components/charts'
import { DataList, type Column } from '../../components/DataList'
import { useToast } from '../../components/feedback'
import {
  Alert,
  Button,
  Card,
  Modal,
  PageHeader,
  SectionHeader,
  Skeleton,
  Spinner,
  StatCard,
  TableSkeleton,
  cx,
} from '../../components/ui'
import {
  BedIcon,
  CalendarDaysIcon,
  ClipboardIcon,
  DownloadIcon,
  FileTextIcon,
  RefreshIcon,
  SirenIcon,
  TimerIcon,
  UploadIcon,
} from '../../components/icons'

type ExportKind = 'appointments' | 'emergencies'

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function StatSkeleton() {
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-xs">
      <Skeleton className="h-2.5 w-20 rounded-sm" />
      <Skeleton className="mt-4 h-8 w-16 rounded-md" />
      <Skeleton className="mt-3 h-2.5 w-28 rounded-sm" />
    </div>
  )
}

function ExportCard({
  icon,
  tone = 'accent',
  title,
  description,
  busy,
  disabled,
  onDownload,
}: {
  icon: ReactNode
  tone?: 'accent' | 'critical'
  title: string
  description: string
  busy: boolean
  disabled?: boolean
  onDownload: () => void
}) {
  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            tone === 'critical'
              ? 'bg-critical-soft text-critical-ink'
              : 'bg-accent-soft text-accent-ink',
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold tracking-tight text-ink">
            {title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        className="mt-auto w-full sm:w-auto"
        onClick={onDownload}
        loading={busy}
        disabled={disabled}
      >
        <DownloadIcon className="h-4 w-4" aria-hidden="true" />
        Download CSV
      </Button>
    </Card>
  )
}

function EventsEmpty() {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-display text-base font-semibold text-ink">No emergency events yet</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        Lifecycle events will appear here as emergency cases are raised, assigned and resolved.
      </p>
    </div>
  )
}

export function ReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [appointments, setAppointments] = useState<number | null>(null)
  const [cases, setCases] = useState<number | null>(null)
  const [events, setEvents] = useState<EmergencyEvent[]>([])
  const [audit, setAudit] = useState<AuditLog | null>(null)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<ExportKind | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      emergencyApi.stats(),
      appointmentApi.list(),
      emergencyApi.board('all'),
      emergencyApi.recentEvents(25),
    ])
      .then(([statsData, appointmentList, board, recentEvents]) => {
        setStats(statsData)
        setAppointments(appointmentList.length)
        setCases(board.cases.length)
        setEvents(recentEvents)
        setError(null)
      })
      .catch((e) => setError(messageOf(e, 'Could not load reports.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function exportCsv(path: string, fallback: string, kind: ExportKind) {
    if (exporting !== null || importing) return
    setExporting(kind)
    setError(null)
    try {
      await download(path, fallback)
      toast.push({
        title: 'Export downloaded',
        description: fallback,
        tone: 'success',
      })
    } catch (e) {
      setError(messageOf(e, 'Could not export the report.'))
    } finally {
      setExporting(null)
    }
  }

  async function importFile(file: File) {
    if (importing || exporting !== null) return
    setImporting(true)
    setError(null)
    setImportResult(null)
    try {
      const result = await reportApi.importSlots(file)
      setImportResult(result)
      if (result.success) {
        toast.push({
          title: 'Availability imported',
          description: `${result.imported} slot(s) added from ${file.name}.`,
          tone: 'success',
        })
      }
      load()
    } catch (e) {
      setError(messageOf(e, 'Could not import the file.'))
    } finally {
      setImporting(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function loadAudit() {
    setAuditOpen(true)
    setAuditLoading(true)
    setAuditError(null)
    setAudit(null)
    try {
      setAudit(await reportApi.auditLog())
    } catch (e) {
      setAuditError(messageOf(e, 'Could not read the audit log.'))
    } finally {
      setAuditLoading(false)
    }
  }

  const eventColumns: Column<EmergencyEvent>[] = [
    {
      key: 'case',
      header: 'Case',
      width: '7rem',
      render: (event) => (
        <span className="font-mono text-xs font-semibold text-ink">#{event.emergencyId}</span>
      ),
    },
    {
      key: 'event',
      header: 'Event',
      width: '18%',
      render: (event) => (
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
          {event.eventType}
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      width: '12rem',
      render: (event) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft">
          {formatDateTime(event.eventTime)}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'Note',
      width: '32%',
      render: (event) => (
        <span className="break-words text-sm text-muted">{event.note || '—'}</span>
      ),
    },
  ]

  const meanDispatchMs = stats?.averageDispatchMillis ?? null
  const meanDispatchValue =
    meanDispatchMs === null
      ? null
      : meanDispatchMs >= 1000
        ? meanDispatchMs / 1000
        : Math.round(meanDispatchMs)

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          className="mb-0"
          eyebrow="Administration"
          title="Reports and evaluation"
          subtitle="CSV exports, audit access and measured emergency response indicators from SQLite events."
          actions={
            <Button variant="secondary" onClick={load} loading={loading}>
              {!loading && <RefreshIcon className="h-4 w-4" aria-hidden="true" />}
              Refresh metrics
            </Button>
          }
        />
      </motion.div>

      {error && (
        <motion.div variants={fadeUp}>
          <Alert title="Could not complete that request" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </motion.div>
      )}

      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4"
      >
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Appointments"
              icon={<CalendarDaysIcon className="h-4 w-4" />}
              value={<AnimatedNumber value={appointments} />}
              hint="Total bookings on record"
              tone="accent"
            />
            <StatCard
              label="Emergency cases"
              icon={<SirenIcon className="h-4 w-4" />}
              value={<AnimatedNumber value={cases} />}
              hint="All cases, including resolved"
              tone="critical"
            />
            <StatCard
              label="Free ER beds"
              icon={<BedIcon className="h-4 w-4" />}
              value={<AnimatedNumber value={stats?.availableBeds ?? null} />}
              hint={stats ? `of ${stats.bedCapacity} beds` : 'No bed data yet'}
            />
            <StatCard
              label="Mean dispatch"
              icon={<TimerIcon className="h-4 w-4" />}
              value={
                <AnimatedNumber
                  value={meanDispatchValue}
                  decimals={meanDispatchMs !== null && meanDispatchMs >= 1000 ? 1 : 0}
                  suffix={meanDispatchMs !== null && meanDispatchMs >= 1000 ? ' s' : ' ms'}
                />
              }
              hint={
                stats?.averageDispatchMillis != null
                  ? 'From case raised to dispatch'
                  : 'No dispatch data yet'
              }
            />
          </>
        )}
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-3">
        <SectionHeader
          title="Exports, imports and audit"
          description="Download CSV snapshots, import availability, or review the append-only audit trail."
        />

        <div className="grid gap-3 md:grid-cols-2">
          <ExportCard
            icon={<FileTextIcon className="h-5 w-5" />}
            title="Appointments CSV"
            description="Every booking with its patient, doctor, time and status."
            busy={exporting === 'appointments'}
            disabled={exporting !== null || importing}
            onDownload={() =>
              exportCsv(reportApi.appointmentsCsv(), 'appointments.csv', 'appointments')
            }
          />
          <ExportCard
            icon={<SirenIcon className="h-5 w-5" />}
            tone="critical"
            title="Emergency CSV"
            description="Every emergency case with severity, assignment and timings."
            busy={exporting === 'emergencies'}
            disabled={exporting !== null || importing}
            onDownload={() =>
              exportCsv(reportApi.emergenciesCsv(), 'emergencies.csv', 'emergencies')
            }
          />

          <Card className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink"
              >
                <UploadIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                  Import availability
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Upload a CSV of doctor availability slots.
                </p>
              </div>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importFile(file)
              }}
            />

            <button
              type="button"
              disabled={importing || exporting !== null}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={(event: DragEvent<HTMLButtonElement>) => {
                const next = event.relatedTarget
                if (next instanceof Node && event.currentTarget.contains(next)) return
                setDragActive(false)
              }}
              onDrop={(event: DragEvent<HTMLButtonElement>) => {
                event.preventDefault()
                setDragActive(false)
                const file = event.dataTransfer.files?.[0]
                if (file) void importFile(file)
              }}
              className={cx(
                'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                dragActive
                  ? 'border-accent bg-accent-soft/50'
                  : 'border-line-strong bg-subtle/40 hover:border-accent/60 hover:bg-subtle',
                importing && 'cursor-wait opacity-60',
                exporting !== null && 'cursor-wait opacity-60',
              )}
              aria-busy={importing || undefined}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'flex h-9 w-9 items-center justify-center rounded-full',
                  dragActive
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface text-muted ring-1 ring-line',
                )}
              >
                <UploadIcon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-ink">
                {importing ? 'Importing…' : 'Drop a CSV here or click to choose'}
              </span>
              <span className="text-xs text-muted">Accepted format: .csv</span>
            </button>

            {importResult && (
              <Alert
                tone={importResult.success ? 'success' : 'error'}
                title={importResult.success ? 'Import complete' : 'Import needs attention'}
              >
                {importResult.success
                  ? `${importResult.imported} slot(s) imported.`
                  : importResult.error ?? 'Some rows could not be imported.'}
              </Alert>
            )}
          </Card>

          <Card className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink-soft"
              >
                <ClipboardIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                  Audit trail
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Read the append-only emergency audit file exactly as it is stored.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="mt-auto w-full sm:w-auto"
              onClick={() => void loadAudit()}
            >
              <ClipboardIcon className="h-4 w-4" aria-hidden="true" />
              Open audit log
            </Button>
          </Card>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-3">
        <SectionHeader
          title="Recent lifecycle events"
          description="The audit file is append-only; the database keeps the structured event trail."
          actions={
            loading ? undefined : (
              <span className="font-mono text-xs tabular-nums text-muted">
                {events.length} event(s)
              </span>
            )
          }
        />

        {loading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : (
          <DataList
            items={events}
            columns={eventColumns}
            rowKey={(event) => event.id}
            ariaLabel="Recent emergency lifecycle events"
            empty={<EventsEmpty />}
            mobileCard={(event) => (
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-ink">
                    Case #{event.emergencyId}
                  </span>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-ink">
                    {event.eventType}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">
                  {formatDateTime(event.eventTime)}
                </p>
                {event.note && (
                  <p className="mt-2 break-words text-sm leading-relaxed text-muted">
                    {event.note}
                  </p>
                )}
              </div>
            )}
          />
        )}
      </motion.div>

      <Modal
        open={auditOpen}
        title="Emergency audit log"
        description="The append-only file written by the emergency workflow."
        onClose={() => setAuditOpen(false)}
        maxWidth="max-w-3xl"
        footer={
          <Button variant="secondary" onClick={() => setAuditOpen(false)}>
            Close
          </Button>
        }
      >
        {auditLoading ? (
          <Spinner label="Loading the audit log…" />
        ) : auditError ? (
          <Alert title="Could not read the audit log">
            <p>{auditError}</p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => void loadAudit()}
            >
              Try again
            </Button>
          </Alert>
        ) : audit ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-panel-line bg-panel px-3 py-2.5">
              <FileTextIcon
                className="mt-0.5 h-4 w-4 shrink-0 text-panel-muted"
                aria-hidden="true"
              />
              <p className="break-all font-mono text-[11px] leading-relaxed text-panel-muted">
                {audit.path}
              </p>
            </div>
            <pre className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-panel-line bg-panel p-4 font-mono text-[11px] leading-relaxed text-panel-ink sm:text-xs">
              {audit.content.trim() || 'No emergency audit entries yet.'}
            </pre>
          </div>
        ) : null}
      </Modal>
    </motion.div>
  )
}
