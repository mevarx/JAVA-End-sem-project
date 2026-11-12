import { AnimatedNumber, BarChart, DonutChart } from '../../components/charts'
import { ActivityIcon, CalendarDaysIcon } from '../../components/icons'
import { Card, SectionHeader, Skeleton } from '../../components/ui'
import { CalmEmpty, CalmError } from './Widgets'

export interface StatusChartDatum {
  label: string
  value: number
  color?: string
}

export function StatusMixCard({
  statusData,
  totalBookings,
  loading,
  error,
  onRetry,
}: {
  statusData: StatusChartDatum[]
  totalBookings: number
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  return (
    <Card className="h-full min-w-0 p-4 sm:p-5">
      <SectionHeader
        title="Status mix"
        description="Every appointment on record, by current status."
      />
      <div className="mt-5">
        {loading ? (
          <div className="flex flex-col items-center gap-5">
            <Skeleton className="h-[148px] w-[148px] max-w-full rounded-full" />
            <div className="w-full space-y-2.5">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-3 w-full rounded-sm" />
              ))}
            </div>
          </div>
        ) : error ? (
          <CalmError message={error} onRetry={onRetry} />
        ) : statusData.length === 0 ? (
          <CalmEmpty
            icon={<ActivityIcon />}
            title="No appointments yet"
            hint="Status counts appear here once bookings exist."
          />
        ) : (
          <DonutChart
            data={statusData}
            size={148}
            centerValue={<AnimatedNumber value={totalBookings} />}
            centerLabel="bookings"
          />
        )}
      </div>
    </Card>
  )
}

export function WeeklyChartCard({
  dayData,
  loading,
  error,
  onRetry,
}: {
  dayData: { label: string; value: number }[]
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const hasDayData = dayData.some((day) => day.value > 0)

  return (
    <Card className="h-full min-w-0 p-4 sm:p-5">
      <SectionHeader
        title="Next seven days"
        description="Booked appointments per calendar day."
      />
      <div className="mt-5">
        {loading ? (
          <Skeleton className="h-[148px] w-full rounded-lg" />
        ) : error ? (
          <CalmError message={error} onRetry={onRetry} />
        ) : hasDayData ? (
          <BarChart
            data={dayData}
            height={148}
            ariaLabel={`Appointments over the next seven days: ${dayData
              .map((day) => `${day.label} ${day.value}`)
              .join(', ')}.`}
          />
        ) : (
          <CalmEmpty
            icon={<CalendarDaysIcon />}
            title="A clear week ahead"
            hint="No appointments are scheduled in the next seven days."
          />
        )}
      </div>
    </Card>
  )
}
