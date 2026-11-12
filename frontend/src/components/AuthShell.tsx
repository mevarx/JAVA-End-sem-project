import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTheme } from '../theme/ThemeProvider'
import { EASE_OUT } from '../lib/motion'
import { Logo } from './Logo'
import { Alert, Field, IconButton, cx, inputClass } from './ui'
import {
  CalendarDaysIcon,
  EyeIcon,
  EyeOffIcon,
  HistoryIcon,
  LockIcon,
  MoonIcon,
  SirenIcon,
  SunIcon,
} from './icons'

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

const CAPABILITIES = [
  {
    icon: CalendarDaysIcon,
    title: 'Conflict-free booking',
    copy: 'Only genuinely free slots are listed; overlapping bookings are rejected.',
  },
  {
    icon: SirenIcon,
    title: 'Severity-first emergency dispatch',
    copy: 'The emergency board orders cases by clinical severity, then by arrival.',
  },
  {
    icon: HistoryIcon,
    title: 'Append-only audit trail',
    copy: 'Every lifecycle event is timestamped, so the record stays reviewable.',
  },
]

export function AuthShell({
  mode,
  children,
}: {
  mode: 'login' | 'register'
  children: ReactNode
}) {
  const supportingCopy =
    mode === 'login'
      ? 'Sign in to book care, run clinics and triage emergencies — one calm workspace for the whole hospital day.'
      : 'Create a patient account to book appointments and keep your care history in one place, from first request to follow-up.'

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-canvas lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col overflow-hidden border-r border-panel-line bg-panel px-10 py-8 text-panel-ink lg:flex xl:px-14 xl:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-panel-ink/5 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <Logo size={38} onDark />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="font-display text-[1.4rem] font-semibold tracking-[-0.04em] text-panel-ink">
              HAES
            </span>
            <span className="mt-1 font-mono text-[9px] font-medium uppercase tracking-[0.24em] text-panel-muted">
              Health operations
            </span>
          </span>
        </div>

        <div className="relative flex flex-1 flex-col justify-center py-8 xl:py-10">
          <p className="flex items-center gap-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-panel-muted">
            <span aria-hidden="true" className="h-px w-6 bg-panel-line" />
            Hospital appointment &amp; emergency operations
          </p>
          <p className="mt-4 max-w-[22ch] font-display text-[1.95rem] font-semibold leading-[1.06] tracking-[-0.03em] text-panel-ink xl:text-[2.55rem]">
            Every appointment. Every critical minute.
          </p>
          <p className="mt-3.5 max-w-[42ch] text-sm leading-relaxed text-panel-muted">
            {supportingCopy}
          </p>

          <ul className="mt-7 space-y-3.5">
            {CAPABILITIES.map((capability) => {
              const Icon = capability.icon
              return (
                <li key={capability.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-panel-line bg-panel-ink/5 text-panel-ink">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-snug text-panel-ink">
                      {capability.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-panel-muted">
                      {capability.copy}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>

          <PulseArt />
        </div>

        <p className="relative max-w-[46ch] border-t border-panel-line pt-4 text-[11px] leading-relaxed text-panel-muted">
          Academic simulation. HAES is a student-built hospital workflow model; every account and
          record in it is fictional.
        </p>
      </aside>

      <div className="relative flex min-h-dvh min-w-0 flex-col">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-8 lg:justify-end lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <Logo size={30} />
            <span className="flex min-w-0 flex-col leading-none">
              <span className="font-display text-lg font-semibold tracking-[-0.04em] text-ink">
                HAES
              </span>
              <span className="mt-1 font-mono text-[8px] font-medium uppercase tracking-[0.2em] text-muted">
                Health operations
              </span>
            </span>
          </div>
          <ThemeToggle />
        </div>

        <main className="flex flex-1 items-start justify-center px-5 pb-10 pt-8 sm:px-8 sm:pt-10 lg:items-center lg:pt-4">
          <div className="w-full max-w-[26rem]">{children}</div>
        </main>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <IconButton
      label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="min-h-11 min-w-11"
    >
      {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
    </IconButton>
  )
}

/** Thin ECG line drawn once on mount — decoration only, no measured data. */
function PulseArt() {
  const reduceMotion = useReducedMotion()
  const gradientId = useId().replace(/:/g, '')
  const path =
    'M0 96 H64 L74 96 L82 74 L92 132 L104 40 L116 96 H176 L186 96 L196 80 L206 112 L218 96 H278 L288 96 L298 66 L308 138 L320 32 L334 96 H394 L404 96 L414 82 L424 110 L436 96 H520'

  return (
    <div aria-hidden="true" className="relative mt-8 h-[112px] w-full overflow-hidden xl:h-[136px]">
      <svg
        viewBox="0 0 520 170"
        fill="none"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-panel-ink)" stopOpacity="0" />
            <stop offset="12%" stopColor="var(--color-panel-ink)" stopOpacity="0.85" />
            <stop offset="88%" stopColor="var(--color-panel-ink)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--color-panel-ink)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[20, 55, 130, 162].map((y) => (
          <line
            key={`h-${y}`}
            x1="0"
            y1={y}
            x2="520"
            y2={y}
            stroke="var(--color-panel-line)"
            strokeWidth="1"
            strokeDasharray="2 7"
          />
        ))}
        {[65, 195, 325, 455].map((x) => (
          <line
            key={`v-${x}`}
            x1={x}
            y1="0"
            x2={x}
            y2="170"
            stroke="var(--color-panel-line)"
            strokeWidth="1"
            strokeDasharray="2 7"
          />
        ))}
        <line
          x1="0"
          y1="96"
          x2="520"
          y2="96"
          stroke="var(--color-panel-ink)"
          strokeOpacity="0.12"
          strokeWidth="1"
        />

        <motion.path
          d={path}
          stroke={`url(#${gradientId}-stroke)`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, ease: EASE_OUT, delay: 0.2 }}
        />
      </svg>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Fields                                                                     */
/* -------------------------------------------------------------------------- */

const labelClass = 'text-[13px] font-semibold leading-none text-ink'

const iconClass =
  'pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-muted'

const revealClass =
  'absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function AuthField({
  id,
  label,
  icon,
  value,
  onChange,
  type = 'text',
  name,
  autoComplete,
  required,
  hint,
  error,
  placeholder,
  inputMode,
  autoCapitalize,
  spellCheck,
}: {
  id: string
  label: string
  icon: ReactNode
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'tel' | 'email'
  name?: string
  autoComplete?: string
  required?: boolean
  hint?: string
  error?: string
  placeholder?: string
  inputMode?: 'text' | 'tel' | 'email'
  autoCapitalize?: 'none' | 'off'
  spellCheck?: boolean
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <span className="relative block">
        <span aria-hidden="true" className={iconClass}>
          {icon}
        </span>
        <input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          inputMode={inputMode}
          autoCapitalize={autoCapitalize}
          spellCheck={spellCheck}
          aria-invalid={error ? true : undefined}
          className={cx(inputClass, 'pl-10', error && 'border-critical')}
        />
      </span>
    </Field>
  )
}

export function AuthPasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required,
  hint,
  error,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  required?: boolean
  hint?: string
  error?: string
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <LockIcon className={iconClass} aria-hidden="true" />
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={cx(inputClass, 'pl-10 pr-12', error && 'border-critical')}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className={revealClass}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && !error && <span className="text-xs leading-relaxed text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-xs font-medium leading-relaxed text-critical-ink">
          {error}
        </span>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Error banner                                                               */
/* -------------------------------------------------------------------------- */

export function AuthErrorAlert({ message }: { message: string | null }) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key={message}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          <Alert tone="error">{message}</Alert>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
