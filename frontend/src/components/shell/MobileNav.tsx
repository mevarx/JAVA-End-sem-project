import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { User } from '../../api/types'
import { drawerFromLeft } from '../../lib/motion'
import { ROLE_WORKSPACE } from '../../nav'
import { CloseIcon } from '../icons'
import { Logo, Wordmark } from '../Logo'
import { IconButton } from '../ui'
import { SidebarNav, UserCard } from './Sidebar'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function useDrawerFocusTrap(open: boolean, onClose: () => void) {
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

export function MobileNav({
  open,
  user,
  onClose,
  onLogout,
}: {
  open: boolean
  user: User
  onClose: () => void
  onLogout: () => void | Promise<void>
}) {
  const panelRef = useDrawerFocusTrap(open, onClose)

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-nav-overlay"
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.18 } }}
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
          onClick={onClose}
        />
      )}
      {open && (
        <motion.aside
          key="mobile-nav-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          variants={drawerFromLeft}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-y-0 left-0 z-40 flex h-dvh w-[17rem] max-w-[85vw] flex-col border-r border-line bg-canvas shadow-float lg:hidden"
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line pl-5 pr-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo size={28} />
              <Wordmark />
            </div>
            <IconButton label="Close navigation" variant="ghost" size="icon" onClick={onClose}>
              <CloseIcon width={18} height={18} />
            </IconButton>
          </div>

          <div className="shrink-0 px-4 pb-1 pt-4">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-muted">Workspace</p>
            <p className="mt-1 truncate font-display text-sm font-semibold text-ink">
              {ROLE_WORKSPACE[user.role]}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
            <SidebarNav role={user.role} onNavigate={onClose} layoutId="mobile-nav-active-indicator" />
          </div>

          <div className="shrink-0 border-t border-line p-3">
            <UserCard user={user} onLogout={onLogout} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  )
}
