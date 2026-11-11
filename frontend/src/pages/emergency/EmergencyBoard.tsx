import { useCallback, useEffect, useState } from 'react'
import { emergencyApi } from '../../api/endpoints'
import type { Board, EmergencyCase, EmergencyEvent } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import {
  emergencyStatusTone,
  formatDateTime,
  severityTone,
  waitedFor,
} from '../../lib/format'
import { useLiveRefresh, usePoll } from '../../lib/useLiveRefresh'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Spinner,
  StatCard,
  inputClass,
} from '../../components/ui'
import { Cell, Row, Table } from '../../components/Table'

export function EmergencyBoardPage() {
  const { user } = useAuth()
  const role = user?.role
  const [board, setBoard] = useState<Board | null>(null)
  const [scope, setScope] = useState<'active' | 'all'>('active')
  const [selected, setSelected] = useState<EmergencyCase | null>(null)
  const [events, setEvents] = useState<EmergencyEvent[]>([])
  const [resolving, setResolving] = useState<EmergencyCase | null>(null)
  const [note, setNote] = useState('Case resolved')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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

  const critical = board?.cases.find(
    (item) => item.severity === 'CRITICAL' && item.status !== 'RESOLVED',
  )

  async function acknowledge() {
    if (!selected) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await emergencyApi.acknowledge(selected.id)
      setNotice(`Emergency #${selected.id} acknowledged. Escalation cancelled.`)
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
    setError(null)
    setNotice(null)
    try {
      await emergencyApi.resolve(resolving.id, note)
      setNotice(`Emergency #${resolving.id} resolved and bed released.`)
      setResolving(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resolve the case.')
    } finally {
      setBusy(false)
    }
  }

  async function dispatch() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await emergencyApi.dispatch()
      setNotice(`Dispatch pass complete · ${result.dispatched} case(s) assigned.`)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispatch failed.')
    } finally {
      setBusy(false)
    }
  }

  const canAcknowledge =
    selected &&
    (role === 'DOCTOR' || role === 'ER_STAFF') &&
    (selected.status === 'ASSIGNED' || selected.status === 'ESCALATED')
  const canResolve =
    selected && (role === 'DOCTOR' || role === 'ER_STAFF' || role === 'ADMIN') && selected.status !== 'RESOLVED'

  return (
    <div>
      <PageHeader
        title={role === 'DOCTOR' ? 'My emergencies' : 'Emergency board'}
        subtitle={
          role === 'DOCTOR'
            ? 'Cases assigned to you. Priority order is severity first, then arrival time.'
            : 'Priority order is severity first, then arrival time. The dispatcher assigns a responder and bed.'
        }
        actions={
          <>
            {isStaff && (
              <select
                aria-label="Case scope"
                className={`${inputClass} min-h-11 w-auto cursor-pointer`}
                value={scope}
                onChange={(e) => setScope(e.target.value as 'active' | 'all')}
              >
                <option value="active">Active cases</option>
                <option value="all">Include resolved</option>
              </select>
            )}
            {role === 'ER_STAFF' || role === 'ADMIN' ? (
              <Button variant="secondary" className="min-h-11 cursor-pointer" onClick={dispatch} disabled={busy}>
                Dispatch now
              </Button>
            ) : null}
            <Button variant="secondary" className="min-h-11 cursor-pointer" onClick={load}>
              Refresh
            </Button>
          </>
        }
      />

      {critical && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-red-700 to-red-600 px-4 py-3 text-sm font-bold text-white shadow-md">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20">!</span>
          CRITICAL #{critical.id} {critical.typeLabel} at {critical.location} · {critical.statusLabel}
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dispatcher queue" value={board?.queueSize ?? '—'} />
        <StatCard
          label="Free ER beds"
          value={board ? board.availableBeds : '—'}
          hint={board ? `of ${board.bedCapacity}` : undefined}
        />
        <StatCard
          label="Mean dispatch"
          value={board?.averageDispatchMillis != null ? `${Math.round(board.averageDispatchMillis)} ms` : '—'}
        />
        <StatCard label="Cases in view" value={board?.cases.length ?? '—'} />
      </div>

      <div className="mb-3 min-h-12 space-y-2" aria-live="polite">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      {loading ? (
        <Spinner label="Loading the emergency board…" />
      ) : !board || board.cases.length === 0 ? (
        <EmptyState title="No emergency cases to show" hint="Raise a case with the Emergency button." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <Table head={['#', 'Severity', 'Type', 'Location', 'Patient', 'Status', 'Assigned', 'Bed', 'Raised', 'Waited']}>
            {board.cases.map((emergency) => (
              <Row
                key={emergency.id}
                selected={selected?.id === emergency.id}
                onClick={() => setSelected(emergency)}
              >
                <Cell>#{emergency.id}</Cell>
                <Cell>
                  <Badge tone={severityTone(emergency.severity)}>{emergency.severityLabel}</Badge>
                </Cell>
                <Cell>{emergency.typeLabel}</Cell>
                <Cell>{emergency.location}</Cell>
                <Cell>{emergency.patientLabel || '—'}</Cell>
                <Cell>
                  <Badge tone={emergencyStatusTone(emergency.status)}>{emergency.statusLabel}</Badge>
                </Cell>
                <Cell>{emergency.assignedToName || '—'}</Cell>
                <Cell>{emergency.bedNo ?? '—'}</Cell>
                <Cell>{formatDateTime(emergency.raisedAt)}</Cell>
                <Cell>{waitedFor(emergency.raisedAt, emergency.resolvedAt)}</Cell>
              </Row>
            ))}
          </Table>

          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="text-base font-bold">Case timeline</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Every lifecycle event is timestamped in SQLite and the append-only audit file.
              </p>
              {selected ? (
                <ol className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                  {events.length === 0 && <li className="text-sm text-muted-foreground">No events yet.</li>}
                  {events.map((event) => (
                    <li key={event.id} className="border-l-2 border-cyan-200 pl-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">{event.eventType}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(event.eventTime)}</p>
                      {event.note && <p className="mt-0.5 text-sm">{event.note}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Select a case to inspect its events.</p>
              )}
            </Card>

            <Card className="flex flex-wrap gap-2 p-4">
              <Button onClick={acknowledge} disabled={!canAcknowledge || busy}>
                Acknowledge selected
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setNote('Case resolved')
                  setResolving(selected)
                }}
                disabled={!canResolve || busy}
              >
                Resolve selected
              </Button>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={resolving !== null}
        title={resolving ? `Resolve emergency #${resolving.id}` : 'Resolve emergency'}
        onClose={() => setResolving(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolving(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={resolve} disabled={busy}>
              {busy ? 'Resolving…' : 'Resolve case'}
            </Button>
          </>
        }
      >
        <Field label="Resolution note">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  )
}
