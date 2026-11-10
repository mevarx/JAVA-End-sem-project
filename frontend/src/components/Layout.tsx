import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { notificationApi } from '../api/endpoints'
import type { NotificationItem } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { DATA_CHANGED_EVENT } from '../lib/useLiveRefresh'
import { notificationTone, ROLE_LABELS, formatTime } from '../lib/format'
import { labelForRole, navForRole } from '../nav'
import { useNotificationStream } from '../sse/useNotificationStream'
import { EmergencyDialog } from './EmergencyDialog'
import { AlertIcon, BellIcon, LogOutIcon, MenuIcon } from './icons'
import { Button, EmptyState } from './ui'

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    notificationApi
      .history()
      .then((history) => setNotifications(history.slice(0, 100)))
      .catch(() => setNotifications([]))
  }, [])

  const handleNotification = useCallback((notification: NotificationItem) => {
    setNotifications((previous) => [notification, ...previous].slice(0, 100))
    setUnread((count) => count + 1)
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
  }, [])
  useNotificationStream(handleNotification)

  if (!user) return null

  const items = navForRole(user.role)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-slate-950 to-cyan-950 text-white shadow-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-white/10 md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNav((open) => !open)}
          >
            <MenuIcon />
          </button>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight">HAES</span>
            <span className="hidden text-xs text-cyan-200 sm:inline">
              Hospital Appointment &amp; Emergency Centre
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDrawerOpen((open) => !open)
                setUnread(0)
              }}
              className="relative rounded-lg p-2 hover:bg-white/10"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            >
              <BellIcon />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            <Button variant="emergency" onClick={() => setEmergencyOpen(true)}>
              <AlertIcon width={16} height={16} />
              <span className="hidden sm:inline">Emergency</span>
            </Button>
            <div className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 sm:flex">
              <span className="text-sm font-bold">{user.fullName}</span>
              <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[11px] font-bold text-cyan-100">
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 hover:bg-white/10"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOutIcon />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <nav
          className={`${mobileNav ? 'block' : 'hidden'} w-full shrink-0 border-r border-border bg-surface md:block md:w-64`}
          aria-label="Main navigation"
        >
          <ul className="flex flex-col gap-1 p-3">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMobileNav(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                        isActive
                          ? 'bg-cyan-50 text-primary-strong'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`
                    }
                  >
                    <Icon />
                    {labelForRole(item, user.role)}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>

        {drawerOpen && (
          <aside
            className="fixed inset-y-0 right-0 z-40 w-full max-w-sm border-l border-border bg-surface shadow-2xl"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-bold">Notifications</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setNotifications([])}>
                  Clear
                </Button>
                <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
              {notifications.length === 0 ? (
                <EmptyState title="No notifications yet" hint="Live appointment and emergency events appear here." />
              ) : (
                <ul className="space-y-2">
                  {notifications.map((notification) => (
                    <li
                      key={notification.id}
                      className={`rounded-lg px-3 py-2 text-sm ${notificationTone(notification.level)}`}
                    >
                      <p className="text-xs font-bold opacity-70">{formatTime(notification.timestamp)}</p>
                      <p className="mt-0.5">{notification.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </div>

      <EmergencyDialog
        open={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        onRaised={() => window.dispatchEvent(new Event(DATA_CHANGED_EVENT))}
      />
    </div>
  )
}
