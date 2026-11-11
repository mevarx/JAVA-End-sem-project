import { useCallback, useEffect, useRef, useState } from 'react'
import { appointmentApi, emergencyApi, reportApi } from '../../api/endpoints'
import { download } from '../../api/client'
import type { AuditLog, EmergencyEvent, ReportResult, Stats } from '../../api/types'
import { formatDateTime } from '../../lib/format'
import { Alert, Button, Card, Modal, PageHeader, Spinner, StatCard } from '../../components/ui'
import { Cell, EmptyRow, Row, Table } from '../../components/Table'

export function ReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [appointments, setAppointments] = useState<number | null>(null)
  const [cases, setCases] = useState<number | null>(null)
  const [events, setEvents] = useState<EmergencyEvent[]>([])
  const [audit, setAudit] = useState<AuditLog | null>(null)
  const [auditOpen, setAuditOpen] = useState(false)
  const [importResult, setImportResult] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load reports.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function exportCsv(path: string, fallback: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await download(path, fallback)
      setNotice(`Downloaded ${fallback}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export the report.')
    } finally {
      setBusy(false)
    }
  }

  async function importFile(file: File) {
    setBusy(true)
    setError(null)
    setNotice(null)
    setImportResult(null)
    try {
      const result = await reportApi.importSlots(file)
      setImportResult(result)
      if (result.success) {
        setNotice(`${result.imported} slot(s) imported.`)
      } else {
        setError(result.error ?? 'Some rows could not be imported.')
      }
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import the file.')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function openAudit() {
    setAuditOpen(true)
    setAudit(null)
    try {
      setAudit(await reportApi.auditLog())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the audit log.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports and evaluation"
        subtitle="CSV exports, audit access and measured emergency response indicators from SQLite events."
        actions={
          <Button variant="secondary" onClick={load}>
            Refresh metrics
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Appointments" value={appointments ?? '—'} />
        <StatCard label="Emergency cases" value={cases ?? '—'} />
        <StatCard label="Free ER beds" value={stats ? stats.availableBeds : '—'} hint={stats ? `of ${stats.bedCapacity}` : undefined} />
        <StatCard
          label="Mean dispatch"
          value={stats?.averageDispatchMillis != null ? `${Math.round(stats.averageDispatchMillis)} ms` : '—'}
        />
      </div>

      <div className="mb-3 space-y-2">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      <Card className="mb-5 p-4">
        <h2 className="text-base font-bold text-foreground">Exports and audit</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Download CSV snapshots, import availability, or review the append-only audit trail.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => exportCsv(reportApi.appointmentsCsv(), 'appointments.csv')} disabled={busy}>
            Export appointments CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportCsv(reportApi.emergenciesCsv(), 'emergencies.csv')}
            disabled={busy}
          >
            Export emergency CSV
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importFile(file)
            }}
          />
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
            Import availability CSV
          </Button>
          <Button variant="secondary" onClick={openAudit}>
            Open audit log
          </Button>
        </div>
        {importResult && !importResult.success && (
          <p className="mt-2 text-xs text-amber-800">{importResult.error}</p>
        )}
      </Card>

      <h2 className="mb-2 text-base font-bold">Recent lifecycle events</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        The audit file is append-only; the database keeps the structured event trail.
      </p>
      {loading ? (
        <Spinner label="Loading events…" />
      ) : (
        <Table head={['Case', 'Event', 'Time', 'Note']}>
          {events.length === 0 ? (
            <EmptyRow colSpan={4} message="No emergency events yet." />
          ) : (
            events.map((event) => (
              <Row key={event.id}>
                <Cell>#{event.emergencyId}</Cell>
                <Cell className="font-bold">{event.eventType}</Cell>
                <Cell>{formatDateTime(event.eventTime)}</Cell>
                <Cell className="text-muted-foreground">{event.note || '—'}</Cell>
              </Row>
            ))
          )}
        </Table>
      )}

      <Modal open={auditOpen} title="Emergency audit log" onClose={() => setAuditOpen(false)}>
        {audit === null ? (
          <Spinner label="Loading the audit log…" />
        ) : (
          <div className="space-y-2">
            <p className="break-all text-xs text-muted-foreground">{audit.path}</p>
            <pre className="max-h-[55vh] overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
              {audit.content.trim() || 'No emergency audit entries yet.'}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  )
}
