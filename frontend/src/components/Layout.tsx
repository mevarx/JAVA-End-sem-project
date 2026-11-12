import { Suspense, useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { notificationApi } from '../api/endpoints'
import type { NotificationItem } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { RAISE_EMERGENCY_EVENT } from '../lib/events'
import { pageVariants } from '../lib/motion'
import { DATA_CHANGED_EVENT } from '../lib/useLiveRefresh'
import { useNotificationStream } from '../sse/useNotificationStream'
import { EmergencyDialog } from './EmergencyDialog'
import { MobileNav } from './shell/MobileNav'
import { NotificationPanel } from './shell/NotificationPanel'
import { Sidebar } from './shell/Sidebar'
import { Topbar } from './shell/Topbar'
import { Spinner } from './ui'

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const outlet = useOutlet()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)

  useEffect(() => {
    let active = true
    notificationApi
      .history()
      .then((history) => {
        if (active) setNotifications(history.slice(0, 100))
      })
      .catch(() => {
        if (active) setNotifications([])
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const onRaise = () => setEmergencyOpen(true)
    window.addEventListener(RAISE_EMERGENCY_EVENT, onRaise)
    return () => window.removeEventListener(RAISE_EMERGENCY_EVENT, onRaise)
  }, [])

  useEffect(() => {
    setMobileNavOpen(false)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  const handleNotification = useCallback((notification: NotificationItem) => {
    setNotifications((previous) => [notification, ...previous].slice(0, 100))
    setUnread((count) => count + 1)
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
  }, [])
  useNotificationStream(handleNotification)

  const openNotifications = useCallback(() => {
    setUnread(0)
    setNotificationsOpen(true)
  }, [])

  const closeNotifications = useCallback(() => setNotificationsOpen(false), [])
  const openMobileNav = useCallback(() => setMobileNavOpen(true), [])
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])
  const closeEmergency = useCallback(() => setEmergencyOpen(false), [])
  const clearNotifications = useCallback(() => setNotifications([]), [])
  const handleRaised = useCallback(() => {
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
  }, [])

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  if (!user) return null

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-on-accent"
      >
        Skip to content
      </a>

      <Sidebar user={user} onLogout={handleLogout} />

      <div className="flex min-h-dvh min-w-0 flex-col lg:pl-[17rem]">
        <Topbar
          user={user}
          unread={unread}
          onOpenNotifications={openNotifications}
          onOpenNav={openMobileNav}
        />

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10"
            >
              <Suspense fallback={<Spinner label="Opening workspace…" />}>
                {outlet}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-[0.6875rem] leading-5 text-muted sm:px-6 lg:px-10">
            <span>HAES &middot; academic simulation</span>
            <span className="hidden sm:inline">Live updates enabled</span>
          </div>
        </footer>
      </div>

      <MobileNav
        open={mobileNavOpen}
        user={user}
        onClose={closeMobileNav}
        onLogout={handleLogout}
      />

      <NotificationPanel
        open={notificationsOpen}
        notifications={notifications}
        onClear={clearNotifications}
        onClose={closeNotifications}
      />

      <EmergencyDialog
        open={emergencyOpen}
        onClose={closeEmergency}
        onRaised={handleRaised}
      />
    </div>
  )
}
