import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { toastVariants } from '../lib/motion'
import {
  AlertCircleIcon,
  AlertIcon,
  CheckCircleIcon,
  CloseIcon,
  InfoIcon,
  type IconComponent,
} from './icons'
import { Button, Modal, Skeleton, SkeletonText, cx } from './ui'

export { TableSkeleton } from './ui'

type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastInput {
  title: string
  description?: string
  tone?: ToastTone
  duration?: number
}

interface ToastRecord {
  id: number
  title: string
  description?: string
  tone: ToastTone
}

export interface ToastApi {
  push: (input: ToastInput) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TOAST_ICONS: Record<ToastTone, IconComponent> = {
  success: CheckCircleIcon,
  error: AlertCircleIcon,
  warning: AlertIcon,
  info: InfoIcon,
}

const TOAST_ICON_STYLES: Record<ToastTone, string> = {
  success: 'bg-success-soft text-success-ink',
  error: 'bg-critical-soft text-critical-ink',
  warning: 'bg-warning-soft text-warning-ink',
  info: 'bg-info-soft text-info-ink',
}

function ToastCard({ toast, onDismiss }: { toast: ToastRecord; onDismiss: () => void }) {
  const reduceMotion = useReducedMotion()
  const Icon = TOAST_ICONS[toast.tone]

  return (
    <motion.div
      layout
      variants={toastVariants}
      initial={reduceMotion ? 'show' : 'hidden'}
      animate="show"
      exit="exit"
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-4 shadow-float"
    >
      <span
        aria-hidden="true"
        className={cx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          TOAST_ICON_STYLES[toast.tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-ink">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CloseIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const timers = useRef(new Map<number, number>())
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (input: ToastInput) => {
      counter.current += 1
      const id = counter.current
      const duration = input.duration ?? 4200

      setToasts((current) =>
        [
          ...current,
          {
            id,
            title: input.title,
            description: input.description,
            tone: input.tone ?? 'info',
          },
        ].slice(-4),
      )

      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration)
        timers.current.set(id, timer)
      }
    },
    [dismiss],
  )

  useEffect(() => {
    const scheduled = timers.current
    return () => {
      scheduled.forEach((timer) => window.clearTimeout(timer))
      scheduled.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            role="region"
            aria-label="Notifications"
            className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-2.5 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[24rem]"
          >
            <AnimatePresence>
              {toasts.map((toast) => (
                <ToastCard
                  key={toast.id}
                  toast={toast}
                  onDismiss={() => dismiss(toast.id)}
                />
              ))}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider')
  }
  return context
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!busy) onClose()
      }}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && (
        <p className="text-sm leading-relaxed text-ink-soft">{description}</p>
      )}
    </Modal>
  )
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-6">
      <span className="sr-only">Loading…</span>

      <div className="space-y-3">
        <Skeleton className="h-2.5 w-24 rounded-sm" />
        <Skeleton className="h-8 w-64 max-w-full rounded-md" />
        <SkeletonText lines={2} className="max-w-md" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-card border border-line bg-surface p-5 shadow-xs"
          >
            <Skeleton className="h-2.5 w-20 rounded-sm" />
            <Skeleton className="mt-4 h-8 w-16 rounded-md" />
            <Skeleton className="mt-3 h-2.5 w-28 rounded-sm" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-xs">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-line/70 px-5 py-4 last:border-b-0"
          >
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-2/5 rounded-md" />
              <Skeleton className="h-2.5 w-1/4 rounded-sm" />
            </div>
            <Skeleton className="hidden h-6 w-16 shrink-0 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}
