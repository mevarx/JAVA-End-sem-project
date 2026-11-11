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
import { Logo } from './Logo'
import { AlertIcon, BellIcon, CloseIcon, LogOutIcon, MenuIcon } from './icons'
import { Badge, Button, EmptyState } from './ui'

function NavItems({ onNavigate, role }: { onNavigate?: () => void; role: Parameters<typeof labelForRole>[1] }) {
  const items = navForRole(role)
  return (
    <ul className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors duration-200 ${
                  isActive
                    ? 'bg-background text-primary-strong'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                <Icon width={20} height={20} />
              </span>
              <span className="truncate">{labelForRole(item, role)}</span>
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}

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

  useEffect(() => {
    if (!drawerOpen && !mobileNav) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false)
        setMobileNav(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen, mobileNav])

  const handleNotification = useCallback((notification: NotificationItem) => {
    setNotifications((previous) => [notification, ...previous].slice(0, 100))
    setUnread((count) => count + 1)
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
  }, [])
  useNotificationStream(handleNotification)

  if (!user) return null

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-slate-950 to-cyan-950 text-white shadow-md">
        <div className="flex min-h-16 items-center gap-2 px-4 py-2 sm:gap-3">
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] cursor-pointer rounded-lg p-2 transition-colors duration-200 hover:bg-white/10 md:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileNav}
            onClick={() => setMobileNav((open) => !open)}
          >
            <MenuIcon />
          </button>
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo size={32} />
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight">HAES</span>
              <span className="hidden truncate text-xs text-cyan-200 lg:inline">
                Hospital Appointment &amp; Emergency Centre
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setDrawerOpen((open) => !open)
                setUnread(0)
              }}
              className="relative min-h-[44px] min-w-[44px] cursor-pointer rounded-lg p-2 transition-colors duration-200 hover:bg-white/10"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              aria-expanded={drawerOpen}
            >
              <BellIcon />
              {unread > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold"
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            <Button variant="emergency" onClick={() => setEmergencyOpen(true)} className="min-h-[44px] shrink-0">
              <AlertIcon width={16} height={16} />
              <span className="hidden sm:inline">Emergency</span>
              <span className="sm:hidden">SOS</span>
            </Button>
            <div className="hidden items-center gap-2 rounded-full bg-white/10 py-1.5 pl-3 pr-1.5 sm:flex">
              <span className="max-w-40 truncate text-sm font-bold">{user.fullName}</span>
              <Badge tone="bg-cyan-400/20 text-cyan-100">{ROLE_LABELS[user.role]}</Badge>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[44px] min-w-[44px] cursor-pointer rounded-lg p-2 transition-colors duration-200 hover:bg-white/10"
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
          className="hidden w-64 shrink-0 border-r border-border bg-surface md:block"
          aria-label="Main navigation"
        >
          <NavItems role={user.role} />
        </nav>

        {mobileNav && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Site navigation">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNav(false)}
              className="absolute inset-0 cursor-pointer bg-slate-950/50"
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-2xl">
              <div className="flex min-h-16 items-center justify-between border-b border-border px-4">
                <div className="flex items-center gap-2">
                  <Logo size={28} />
                  <span className="text-base font-bold tracking-tight">HAES</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNav(false)}
                  aria-label="Close navigation"
                  className="min-h-[44px] min-w-[44px] cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors duration-200 hover:bg-muted"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavItems role={user.role} onNavigate={() => setMobileNav(false)} />
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>

        {drawerOpen && (
          <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Notifications">
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 cursor-pointer bg-slate-950/50"
            />
            <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-border bg-surface shadow-2xl">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="text-base font-bold">Notifications</h2>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" onClick={() => setNotifications([])}>
                    Clear
                  </Button>
                  <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
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
          </div>
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
