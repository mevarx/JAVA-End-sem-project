import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { NotificationItem } from '../../api/types'
import { formatRelative, formatTime, notificationTone } from '../../lib/format'
import { drawerFromRight } from '../../lib/motion'
import { BellIcon, CloseIcon } from '../icons'
import { Button, cx, EmptyState, IconButton } from '../ui'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function usePanelFocusTrap(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusables = () =>
      panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []

    const frame = window.requestAnimationFrame(() => focusables()[0]?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const nodes = focusables()
      if (nodes.length === 0) {
        event.preventDefault()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [open])

  return panelRef
}

export function NotificationPanel({
  open,
  notifications,
  onClear,
  onClose,
}: {
  open: boolean
  notifications: NotificationItem[]
  onClear: () => void
  onClose: () => void
}) {
  const panelRef = usePanelFocusTrap(open, onClose)
  const titleId = useId()

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="notification-overlay"
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.18 } }}
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
          onClick={onClose}
        />
      )}
      {open && (
        <motion.aside
          key="notification-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          variants={drawerFromRight}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-y-0 right-0 z-40 flex h-dvh w-full max-w-md flex-col border-l border-line bg-canvas shadow-float"
        >
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate font-display text-base font-semibold text-ink">
                Notifications
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted">
                {notifications.length > 0 ? `${notifications.length} recent` : 'Live activity'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" onClick={onClear} className="min-h-11">
                  Clear
                </Button>
              )}
              <IconButton label="Close notifications" variant="ghost" size="icon" onClick={onClose}>
                <CloseIcon width={18} height={18} />
              </IconButton>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
            {notifications.length === 0 ? (
              <EmptyState
                title="No notifications yet"
                hint="Appointment changes and emergency events will appear here as they happen."
                icon={<BellIcon width={20} height={20} />}
              />
            ) : (
              <ul className="space-y-2">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={cx('rounded-xl border px-3.5 py-3', notificationTone(notification.level))}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <time
                        dateTime={notification.timestamp}
                        className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.08em] opacity-70"
                      >
                        {formatRelative(notification.timestamp)}
                      </time>
                      <span className="shrink-0 font-mono text-[0.625rem] opacity-60">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1.5 break-words text-sm leading-relaxed">{notification.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  )
}
