import { useCallback, useEffect, useState } from 'react'
import { slotApi } from '../../api/endpoints'
import type { Slot } from '../../api/types'
import { formatDate, formatTime, todayIso } from '../../lib/format'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { Alert, Badge, Button, Card, Field, PageHeader, Spinner, inputClass } from '../../components/ui'
import { Cell, EmptyRow, Row, Table } from '../../components/Table'

const START_TIMES = Array.from({ length: 20 }, (_, index) => {
  const minutes = 8 * 60 + index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

const DURATIONS = [15, 30, 45, 60]

export function AvailabilityPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [selected, setSelected] = useState<Slot | null>(null)
  const [date, setDate] = useState(todayIso())
  const [start, setStart] = useState('09:00')
  const [duration, setDuration] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    slotApi
      .mine()
      .then((list) => setSlots([...list].sort((a, b) => a.start.localeCompare(b.start))))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load availability.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(load)

  function endTime(): string {
    const [hours, minutes] = start.split(':').map(Number)
    const total = hours * 60 + minutes + duration
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  async function publish() {
    setError(null)
    setNotice(null)
    try {
      await slotApi.publish(`${date}T${start}:00`, `${date}T${endTime()}:00`)
      setNotice(`Slot published for ${formatDate(`${date}T00:00:00`)} at ${start}.`)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish the slot.')
    }
  }

  async function remove() {
    if (!selected) return
    if (!window.confirm(`Delete the ${formatDate(selected.start)} ${formatTime(selected.start)} slot?`)) return
    setError(null)
    setNotice(null)
    try {
      await slotApi.remove(selected.id)
      setNotice('Slot deleted.')
      setSelected(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the slot.')
    }
  }

  return (
    <div>
      <PageHeader
        title="My availability"
        subtitle="Publish free windows for patients. Overlaps with existing slots are rejected."
        actions={
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        }
      />

      <div className="mb-3 space-y-2">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      {loading ? (
        <Spinner label="Loading slots…" />
      ) : (
        <Table head={['Date', 'Start', 'End', 'Status']}>
          {slots.length === 0 ? (
            <EmptyRow colSpan={4} message="No slots published yet. Add one below." />
          ) : (
            slots.map((slot) => (
              <Row
                key={slot.id}
                selected={selected?.id === slot.id}
                onClick={() => setSelected(slot)}
              >
                <Cell>{formatDate(slot.start)}</Cell>
                <Cell>{formatTime(slot.start)}</Cell>
                <Cell>{formatTime(slot.end)}</Cell>
                <Cell>
                  <Badge tone={slot.status === 'FREE' ? 'bg-emerald-100 text-emerald-800' : 'bg-cyan-100 text-cyan-800'}>
                    {slot.status === 'FREE' ? 'Free' : 'Booked'}
                  </Badge>
                </Cell>
              </Row>
            ))
          )}
        </Table>
      )}

      <Card className="mt-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              value={date}
              min={todayIso()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Start">
            <select className={inputClass} value={start} onChange={(e) => setStart(e.target.value)}>
              {START_TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minutes">
            <select
              className={inputClass}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end gap-2">
            <Button onClick={publish} className="flex-1">
              Publish slot
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <Button variant="danger" onClick={remove} disabled={!selected}>
            Delete selected free slot
          </Button>
        </div>
      </Card>
    </div>
  )
}
