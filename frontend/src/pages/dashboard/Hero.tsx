import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import type { Role } from '../../api/types'
import { SirenIcon, type IconComponent } from '../../components/icons'
import { requestEmergencyDialog } from '../../lib/events'
import { ROLE_LABELS } from '../../lib/format'
import { fadeUp } from '../../lib/motion'
import { Button } from '../../components/ui'

export interface HeroAction {
  to: string
  label: string
  icon: IconComponent
}

export function DashboardHero({
  role,
  fullName,
  greeting,
  todayLabel,
  contextLine,
  primaryAction,
  secondaryAction,
  onPrimaryAction,
}: {
  role: Role
  fullName: string
  greeting: string
  todayLabel: string
  contextLine: string
  primaryAction: HeroAction
  secondaryAction: { to: string; label: string }
  onPrimaryAction: () => void
}) {
  const PrimaryIcon = primaryAction.icon

  return (
    <motion.section
      variants={fadeUp}
      aria-labelledby="dashboard-greeting"
      className="relative overflow-hidden rounded-card border border-panel-line bg-panel text-panel-ink shadow-md"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(120% 130% at 92% -10%, color-mix(in srgb, var(--color-accent) 34%, transparent), transparent 62%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--color-panel-line) 1px, transparent 1px), linear-gradient(to bottom, var(--color-panel-line) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(80% 100% at 85% 0%, var(--color-panel-ink) 0%, transparent 72%)',
          WebkitMaskImage:
            'radial-gradient(80% 100% at 85% 0%, var(--color-panel-ink) 0%, transparent 72%)',
        }}
      />

      <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="flex flex-col items-start gap-1 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-panel-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
            <span className="inline-flex items-center gap-1.5 text-panel-accent">
              <span aria-hidden="true" className="h-px w-5 bg-panel-accent/70" />
              {ROLE_LABELS[role]}
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span>{todayLabel}</span>
          </p>

          <h1
            id="dashboard-greeting"
            className="mt-3 min-w-0 break-words font-display text-[1.6rem] font-semibold leading-[1.15] tracking-tight text-panel-ink sm:text-[2rem]"
          >
            <span className="block text-sm font-medium text-panel-muted sm:text-base">
              {greeting},
            </span>
            {fullName}
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-relaxed text-panel-muted">{contextLine}</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
          <Button
            size="lg"
            onClick={onPrimaryAction}
            className="w-full sm:w-auto"
          >
            <PrimaryIcon className="h-4 w-4" />
            {primaryAction.label}
          </Button>
          <Link
            to={secondaryAction.to}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-panel-line px-5 text-base font-semibold text-panel-ink transition-colors hover:bg-panel-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          >
            {secondaryAction.label}
          </Link>
          <Button
            variant="emergency"
            size="lg"
            onClick={requestEmergencyDialog}
            className="w-full sm:w-auto"
          >
            <SirenIcon className="h-4 w-4" />
            Raise emergency
          </Button>
        </div>
      </div>
    </motion.section>
  )
}
