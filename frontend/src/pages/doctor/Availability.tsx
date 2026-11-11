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
          <Button variant="secondary" onClick={load} className="min-h-[44px] cursor-pointer">
            Refresh
          </Button>
        }
      />

      <div className="mb-4 space-y-2">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      <Card className="mb-4 p-4 sm:p-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Publish a slot
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <input
              type="date"
              className={`${inputClass} min-h-[44px]`}
              value={date}
              min={todayIso()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Start time">
            <select
              className={`${inputClass} min-h-[44px] cursor-pointer`}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            >
              {START_TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duration (minutes)" hint={`Ends at ${endTime()}`}>
            <select
              className={`${inputClass} min-h-[44px] cursor-pointer`}
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
          <div className="flex items-end">
            <Button onClick={publish} className="min-h-[44px] w-full cursor-pointer">
              Publish slot
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Published slots
          </h2>
          <span className="text-sm text-muted-foreground">{slots.length} slot(s)</span>
        </div>
        {loading ? (
          <Spinner label="Loading slots…" />
        ) : (
          <Table head={['Date', 'Start', 'End', 'Status']}>
            {slots.length === 0 ? (
              <EmptyRow colSpan={4} message="No slots published yet. Add one above." />
            ) : (
              slots.map((slot) => (
                <Row
                  key={slot.id}
                  selected={selected?.id === slot.id}
                  onClick={() => setSelected(slot)}
                >
                  <Cell className="whitespace-nowrap">{formatDate(slot.start)}</Cell>
                  <Cell className="whitespace-nowrap">{formatTime(slot.start)}</Cell>
                  <Cell className="whitespace-nowrap">{formatTime(slot.end)}</Cell>
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
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="danger"
            onClick={remove}
            disabled={!selected}
            className="min-h-[44px] w-full cursor-pointer sm:w-auto"
          >
            Delete selected free slot
          </Button>
          {selected && (
            <p className="text-sm text-muted-foreground">
              Selected {formatDate(selected.start)} · {formatTime(selected.start)}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
