import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { initials } from '../lib/format'
import { modalBackdrop, modalPanel, springSnappy } from '../lib/motion'
import {
  AlertCircleIcon,
  AlertIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  InfoIcon,
  SearchIcon,
} from './icons'

/** Join conditional class fragments without pulling in a dependency. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'emergency'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-on-accent shadow-xs hover:bg-accent-strong active:bg-accent-strong',
  secondary:
    'border border-line-strong bg-surface text-ink shadow-xs hover:bg-subtle active:bg-subtle',
  ghost: 'text-ink-soft hover:bg-subtle hover:text-ink',
  danger:
    'border border-critical/30 bg-critical-soft text-critical-ink hover:border-critical/50 hover:bg-critical/10',
  emergency:
    'bg-critical text-on-accent shadow-xs hover:bg-critical-ink active:bg-critical-ink',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 gap-1.5 px-3 text-[13px]',
  md: 'min-h-11 gap-2 px-4 text-sm',
  lg: 'min-h-12 gap-2 px-5 text-base',
  icon: 'h-11 w-11 gap-0 p-0',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex cursor-pointer select-none items-center justify-center rounded-lg font-semibold',
        'transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out',
        'motion-safe:active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
        focusRing,
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80 motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  )
}

export interface IconButtonProps {
  label: string
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  onClick?: () => void
  disabled?: boolean
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type']
}

export function IconButton({
  label,
  children,
  variant = 'ghost',
  size = 'icon',
  className,
  onClick,
  disabled,
  type = 'button',
}: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      type={type}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cx('shrink-0', className)}
    >
      {children}
    </Button>
  )
}

export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cx(
        'rounded-card border border-line bg-surface shadow-xs',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Badge({
  tone,
  children,
  className,
}: {
  tone?: string
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none',
        tone ?? 'bg-subtle text-ink-soft ring-1 ring-line',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cx(
        'mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
            <span aria-hidden="true" className="h-px w-6 bg-accent/60" />
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[2rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{subtitle}</p>
        )}
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      )}
    </div>
  )
}

const STAT_TONES = {
  default: {
    value: 'text-ink',
    icon: 'bg-subtle text-ink-soft',
  },
  accent: {
    value: 'text-accent-ink',
    icon: 'bg-accent-soft text-accent-ink',
  },
  critical: {
    value: 'text-critical-ink',
    icon: 'bg-critical-soft text-critical-ink',
  },
  warning: {
    value: 'text-warning-ink',
    icon: 'bg-warning-soft text-warning-ink',
  },
} as const

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  tone?: 'default' | 'accent' | 'critical' | 'warning'
  className?: string
}) {
  const palette = STAT_TONES[tone]
  return (
    <Card className={cx('flex h-full flex-col p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-muted">
          {label}
        </p>
        {icon && (
          <span
            aria-hidden="true"
            className={cx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              palette.icon,
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={cx(
          'mt-3 font-display text-3xl font-semibold leading-none tracking-tight tabular-nums',
          palette.value,
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>}
    </Card>
  )
}

export function CompactStatStrip({
  items,
  className,
}: {
  items: Array<{
    label: string
    value: ReactNode
    tone?: 'default' | 'accent' | 'critical' | 'warning'
  }>
  className?: string
}) {
  const tones = {
    default: 'text-ink',
    accent: 'text-accent-ink',
    critical: 'text-critical-ink',
    warning: 'text-warning-ink',
  } as const

  return (
    <div
      className={cx(
        'grid grid-cols-3 divide-x divide-line overflow-hidden rounded-card border border-line bg-surface shadow-xs sm:hidden',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-2 py-3 text-center">
          <p
            className={cx(
              'font-display text-xl font-semibold leading-none tabular-nums',
              tones[item.tone ?? 'default'],
            )}
          >
            {item.value}
          </p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-muted">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
  className,
}: {
  title: string
  hint?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center sm:py-16',
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted"
        >
          {icon}
        </span>
      )}
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {hint && (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{hint}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
  error,
  htmlFor,
  className,
}: {
  label: string
  children: ReactNode
  hint?: string
  error?: string
  htmlFor?: string
  className?: string
}) {
  return (
    <label htmlFor={htmlFor} className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-[13px] font-semibold leading-none text-ink">{label}</span>
      {children}
      {hint && !error && (
        <span className="text-xs leading-relaxed text-muted">{hint}</span>
      )}
      {error && (
        <span
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-critical-ink"
        >
          <AlertCircleIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </span>
      )}
    </label>
  )
}

const fieldBase =
  'w-full rounded-lg border border-line bg-surface text-sm text-ink shadow-xs outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60 aria-[invalid=true]:border-critical aria-[invalid=true]:focus:ring-critical/30'

export const inputClass = cx('min-h-11 px-3.5 py-2.5', fieldBase)

export const selectClass = cx('min-h-11 cursor-pointer py-2.5 pl-3.5 pr-9', fieldBase)

export const textareaClass = cx('min-h-28 resize-y px-3.5 py-3', fieldBase)

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

let bodyLocks = 0
let savedOverflow = ''
let savedPaddingRight = ''

function lockBodyScroll() {
  if (typeof document === 'undefined') return
  if (bodyLocks === 0) {
    savedOverflow = document.body.style.overflow
    savedPaddingRight = document.body.style.paddingRight
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
  }
  bodyLocks += 1
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return
  bodyLocks = Math.max(0, bodyLocks - 1)
  if (bodyLocks === 0) {
    document.body.style.overflow = savedOverflow
    document.body.style.paddingRight = savedPaddingRight
  }
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-xl',
  className,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
  className?: string
}) {
  const titleId = useId()
  const descriptionId = useId()
  const reduceMotion = useReducedMotion()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    lockBodyScroll()

    const getFocusable = () => {
      const panel = panelRef.current
      if (!panel) return []
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getClientRects().length > 0,
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || active === panel || !panel.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.clearTimeout(focusTimer)
      unlockBodyScroll()
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          role="presentation"
          variants={modalBackdrop}
          initial={reduceMotion ? false : 'hidden'}
          animate="show"
          exit="exit"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onCloseRef.current()
          }}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-overlay p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
        >
          <motion.div
            key="modal-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            variants={modalPanel}
            initial={reduceMotion ? false : 'hidden'}
            animate="show"
            exit="exit"
            className={cx(
              'relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-float outline-none',
              maxWidth,
              className,
            )}
          >
            <div className="flex shrink-0 items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  className="font-display text-lg font-semibold leading-snug tracking-tight text-ink"
                >
                  {title}
                </h2>
                {description && (
                  <p
                    id={descriptionId}
                    className="mt-1 text-sm leading-relaxed text-muted"
                  >
                    {description}
                  </p>
                )}
              </div>
              <IconButton
                label="Close dialog"
                onClick={onClose}
                className="-mr-2 -mt-1"
              >
                <CloseIcon className="h-5 w-5" aria-hidden="true" />
              </IconButton>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              {children}
            </div>

            {footer && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* -------------------------------------------------------------------------- */
/* Feedback primitives                                                        */
/* -------------------------------------------------------------------------- */

export function Spinner({
  label = 'Loading…',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'mx-auto flex w-full flex-col items-center justify-center gap-3 px-6 py-16 text-center text-sm text-muted',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none h-6 w-6',
        )}
      />
      {label && <span>{label}</span>}
    </div>
  )
}

const ALERT_TONES = {
  error: {
    container: 'border-critical/30 bg-critical-soft text-critical-ink',
    icon: AlertCircleIcon,
    role: 'alert' as const,
  },
  success: {
    container: 'border-success/30 bg-success-soft text-success-ink',
    icon: CheckCircleIcon,
    role: 'status' as const,
  },
  warning: {
    container: 'border-warning/30 bg-warning-soft text-warning-ink',
    icon: AlertIcon,
    role: 'status' as const,
  },
  info: {
    container: 'border-info/30 bg-info-soft text-info-ink',
    icon: InfoIcon,
    role: 'status' as const,
  },
}

export function Alert({
  tone = 'error',
  title,
  children,
  className,
  onDismiss,
}: {
  tone?: 'error' | 'success' | 'warning' | 'info'
  title?: string
  children: ReactNode
  className?: string
  onDismiss?: () => void
}) {
  const palette = ALERT_TONES[tone]
  const Icon = palette.icon
  return (
    <div
      role={palette.role}
      className={cx(
        'flex items-start gap-3 rounded-lg border px-4 py-3.5 text-sm leading-relaxed',
        palette.container,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cx(title && 'mt-0.5', 'text-[13px] leading-relaxed')}>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-my-1.5 -mr-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-70 transition-[background-color,opacity] duration-150 hover:bg-ink/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <CloseIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx('animate-pulse bg-subtle motion-reduce:animate-none', className)}
    />
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const count = Math.max(1, lines)
  return (
    <div aria-hidden="true" className={cx('space-y-2', className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          className={cx(
            'h-3 rounded-md',
            index === count - 1 && count > 1 ? 'w-2/3' : 'w-full',
          )}
        />
      ))}
    </div>
  )
}

export function TableSkeleton({
  rows = 6,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  const safeColumns = Math.max(1, columns)
  const gridTemplateColumns = `repeat(${safeColumns}, minmax(0, 1fr))`

  return (
    <div
      role="status"
      aria-label="Loading table"
      className="overflow-hidden rounded-card border border-line bg-surface shadow-xs"
    >
      <span className="sr-only">Loading…</span>
      <div
        className="grid gap-4 border-b border-line px-5 py-3.5"
        style={{ gridTemplateColumns }}
      >
        {Array.from({ length: safeColumns }, (_, index) => (
          <Skeleton key={index} className="h-2.5 w-16 max-w-full rounded-sm" />
        ))}
      </div>
      {Array.from({ length: Math.max(0, rows) }, (_, row) => (
        <div
          key={row}
          className="grid gap-4 border-b border-line/70 px-5 py-4 last:border-b-0"
          style={{ gridTemplateColumns }}
        >
          {Array.from({ length: safeColumns }, (_, column) => (
            <Skeleton
              key={column}
              className={cx(
                'h-3 max-w-full rounded-md',
                column === 0 ? 'w-32' : 'w-20',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
  id,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
  id?: string
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const accessibleLabel = label ?? placeholder ?? 'Search'

  return (
    <div className={cx('relative', className)}>
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
      <input
        id={inputId}
        type="text"
        role="searchbox"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label ? undefined : accessibleLabel}
        autoComplete="off"
        spellCheck={false}
        className={cx(inputClass, 'pl-10', value && 'pr-12')}
      />
      {label && (
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-0.5 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CloseIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
}) {
  const rawId = useId()
  const indicatorId = `segmented-${rawId.replace(/:/g, '')}`
  const buttons = useRef<Array<HTMLButtonElement | null>>([])

  const move = (delta: number) => {
    if (options.length === 0) return
    const currentIndex = options.findIndex((option) => option.value === value)
    const nextIndex = (currentIndex + delta + options.length) % options.length
    onChange(options[nextIndex].value)
    buttons.current[nextIndex]?.focus()
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx(
        'inline-flex w-full max-w-full flex-wrap items-center gap-1 rounded-lg border border-line bg-subtle p-1 sm:w-auto',
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                move(1)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(-1)
              }
            }}
            className={cx(
              'relative inline-flex grow shrink-0 basis-auto cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 font-medium transition-colors duration-150 sm:flex-none',
              'min-h-11 text-sm',
              active ? 'text-ink' : 'text-muted hover:text-ink',
              focusRing,
            )}
          >
            {active && (
              <motion.span
                aria-hidden="true"
                layoutId={indicatorId}
                transition={springSnappy}
                className="absolute inset-0 rounded-md bg-surface shadow-xs ring-1 ring-line/70"
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{option.label}</span>
            {option.count !== undefined && (
              <span
                className={cx(
                  'relative z-10 font-mono text-[11px] tabular-nums',
                  active ? 'text-accent-ink' : 'text-muted',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                 */
/* -------------------------------------------------------------------------- */

function pageWindow(page: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: Array<number | 'gap'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)

  if (start > 2) items.push('gap')
  for (let current = start; current <= end; current += 1) items.push(current)
  if (end < pageCount - 1) items.push('gap')
  items.push(pageCount)

  return items
}

const pageButton =
  'inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg px-2 text-sm transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ' +
  focusRing

export function Pagination({
  page,
  pageCount,
  onChange,
  totalItems,
  pageSize,
  className,
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
  totalItems?: number
  pageSize?: number
  className?: string
}) {
  const safePageCount = Math.max(1, Math.floor(pageCount))
  const safePage = Math.min(Math.max(1, Math.floor(page)), safePageCount)
  const items = pageWindow(safePage, safePageCount)

  const showSummary =
    totalItems !== undefined &&
    totalItems > 0 &&
    pageSize !== undefined &&
    pageSize > 0
  const start =
    pageSize !== undefined && totalItems !== undefined && showSummary
      ? (safePage - 1) * pageSize + 1
      : 0
  const end =
    pageSize !== undefined && totalItems !== undefined && showSummary
      ? Math.min(safePage * pageSize, totalItems)
      : 0

  return (
    <nav
      aria-label="Pagination"
      className={cx(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {showSummary && (
        <p className="text-xs text-muted">
          Showing{' '}
          <span className="font-mono tabular-nums text-ink-soft">
            {start}–{end}
          </span>{' '}
          of <span className="font-mono tabular-nums text-ink-soft">{totalItems}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={safePage <= 1}
          onClick={() => onChange(safePage - 1)}
          className={cx(pageButton, 'text-ink-soft hover:bg-subtle')}
        >
          <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        </button>

        {items.map((item, index) =>
          item === 'gap' ? (
            <span
              key={`gap-${index}`}
              aria-hidden="true"
              className="inline-flex h-11 w-7 items-center justify-center text-sm text-muted"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={`Page ${item}`}
              aria-current={item === safePage ? 'page' : undefined}
              onClick={() => onChange(item)}
              className={cx(
                pageButton,
                item === safePage
                  ? 'bg-accent-soft font-semibold text-accent-ink ring-1 ring-accent/25'
                  : 'text-ink-soft hover:bg-subtle hover:text-ink',
              )}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          aria-label="Next page"
          disabled={safePage >= safePageCount}
          onClick={() => onChange(safePage + 1)}
          className={cx(pageButton, 'text-ink-soft hover:bg-subtle')}
        >
          <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}

/* -------------------------------------------------------------------------- */
/* Avatar & progress                                                          */
/* -------------------------------------------------------------------------- */

const AVATAR_SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
} as const

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold uppercase tracking-wide text-accent-ink ring-1 ring-accent/15',
        AVATAR_SIZES[size],
        className,
      )}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  )
}

const PROGRESS_TONES = {
  accent: 'bg-accent',
  critical: 'bg-critical',
  warning: 'bg-warning',
} as const

export function ProgressBar({
  value,
  max = 100,
  label,
  tone = 'accent',
  className,
}: {
  value: number
  max?: number
  label?: string
  tone?: 'accent' | 'critical' | 'warning'
  className?: string
}) {
  const safeMax = max > 0 ? max : 1
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0
  const percent = Math.round((safeValue / safeMax) * 100)

  return (
    <div className={className}>
      {label && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-medium text-ink-soft">{label}</span>
          <span className="font-mono text-[11px] tabular-nums text-muted">{percent}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        aria-valuetext={`${percent}%`}
        className="h-2 w-full overflow-hidden rounded-full bg-subtle"
      >
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
            PROGRESS_TONES[tone],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
