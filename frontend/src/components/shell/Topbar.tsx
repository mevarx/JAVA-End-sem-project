import { useLocation } from 'react-router-dom'
import type { User } from '../../api/types'
import { requestEmergencyDialog } from '../../lib/events'
import { labelForRole, navItemForPath, ROLE_WORKSPACE } from '../../nav'
import { AlertIcon, BellIcon, MenuIcon } from '../icons'
import { LiveDot } from '../status'
import { Button, IconButton } from '../ui'
import { ThemeToggle } from './Sidebar'

export function Topbar({
  user,
  unread,
  onOpenNotifications,
  onOpenNav,
}: {
  user: User
  unread: number
  onOpenNotifications: () => void
  onOpenNav: () => void
}) {
  const { pathname } = useLocation()
  const current = navItemForPath(pathname)
  const title = current ? labelForRole(current, user.role) : ROLE_WORKSPACE[user.role]
  const notificationLabel = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-canvas/80 px-3 backdrop-blur-xl sm:gap-3 sm:px-5 lg:px-8">
      <IconButton
        label="Open navigation"
        variant="ghost"
        size="icon"
        onClick={onOpenNav}
        className="shrink-0 lg:hidden"
      >
        <MenuIcon width={20} height={20} />
      </IconButton>

      <div className="min-w-0 flex-1">
        <p className="hidden truncate text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-muted sm:block">
          {ROLE_WORKSPACE[user.role]}
        </p>
        <p className="truncate font-display text-[0.95rem] font-semibold leading-tight text-ink sm:text-base">
          {title}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <span className="mr-1 hidden md:inline-flex">
          <LiveDot label="Live" />
        </span>

        <div className="relative">
          <IconButton label={notificationLabel} variant="ghost" size="icon" onClick={onOpenNotifications}>
            <BellIcon width={19} height={19} />
          </IconButton>
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 font-mono text-[0.5625rem] font-semibold leading-none text-on-accent ring-2 ring-canvas"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>

        <Button
          variant="emergency"
          size="sm"
          onClick={requestEmergencyDialog}
          aria-label="Raise emergency"
          className="min-h-11 min-w-11 shrink-0 px-2.5 sm:px-3.5"
        >
          <AlertIcon width={16} height={16} aria-hidden="true" />
          <span className="hidden sm:inline">Emergency</span>
        </Button>

        <ThemeToggle />
      </div>
    </header>
  )
}
