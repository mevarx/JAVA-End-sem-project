import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { CloseIcon } from './icons'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'emergency'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-strong shadow-sm',
  secondary: 'bg-surface text-foreground border border-border hover:bg-muted',
  danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
  ghost: 'text-muted-foreground hover:bg-muted',
  emergency: 'bg-destructive text-white hover:bg-red-700 shadow-sm',
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold
        transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>
      {children}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-3xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
      <p className="font-bold text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-bold text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary'

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
      {label}
    </div>
  )
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success'; children: ReactNode }) {
  const style = tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
  return <div className={`rounded-lg border px-4 py-3 text-sm ${style}`}>{children}</div>
}
