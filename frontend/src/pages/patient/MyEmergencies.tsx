import { useCallback, useEffect, useState } from 'react'
import { emergencyApi } from '../../api/endpoints'
import type { EmergencyCase, EmergencyEvent } from '../../api/types'
import { formatDateTime, emergencyStatusTone, severityTone, waitedFor } from '../../lib/format'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { Cell, Row, Table } from '../../components/Table'

export function MyEmergenciesPage() {
  const [cases, setCases] = useState<EmergencyCase[]>([])
  const [selected, setSelected] = useState<EmergencyCase | null>(null)
  const [events, setEvents] = useState<EmergencyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="space-y-5">
      <PageHeader
        title="My emergencies"
        subtitle="Every emergency you raised, with its current status and timestamped timeline."
        actions={
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        }
      />

      <div className="space-y-2">{error && <Alert>{error}</Alert>}</div>

      {loading ? (
        <Spinner label="Loading emergencies…" />
      ) : cases.length === 0 ? (
        <EmptyState
          title="No emergencies on record"
          hint="Use the Emergency button in the header if you need to raise a case."
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="min-w-0 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">Cases</h2>
              <p className="text-sm text-muted-foreground">{cases.length} case(s)</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <Table head={['#', 'Severity', 'Type', 'Status', 'Raised', 'Waited']}>
                {cases.map((emergency) => (
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
                    <Cell>
                      <Badge tone={emergencyStatusTone(emergency.status)}>{emergency.statusLabel}</Badge>
                    </Cell>
                    <Cell>{formatDateTime(emergency.raisedAt)}</Cell>
                    <Cell>{waitedFor(emergency.raisedAt, emergency.resolvedAt)}</Cell>
                  </Row>
                ))}
              </Table>
            </div>
          </Card>

          <Card className="min-w-0 p-4">
            <h2 className="text-base font-semibold">Case timeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every lifecycle event is timestamped in SQLite and the append-only audit file.
            </p>
            {selected ? (
              <ol className="mt-4 space-y-3">
                {events.length === 0 && <li className="text-sm text-muted-foreground">No events yet.</li>}
                {events.map((event) => (
                  <li key={event.id} className="border-l-2 border-border pl-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      {event.eventType}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(event.eventTime)}</p>
                    {event.note && <p className="mt-0.5 text-sm">{event.note}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Select a case to inspect its events.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
