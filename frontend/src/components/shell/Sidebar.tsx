import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import type { Role, User } from '../../api/types'
import { ROLE_LABELS } from '../../lib/format'
import { springSoft } from '../../lib/motion'
import { labelForRole, navGroupsForRole, ROLE_WORKSPACE } from '../../nav'
import { useTheme } from '../../theme/ThemeProvider'
import { LogOutIcon, MoonIcon, SunIcon } from '../icons'
import { Logo, Wordmark } from '../Logo'
import { Avatar, cx, IconButton } from '../ui'

/** Small theme switch shared by the sidebar, topbar and mobile drawer. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <IconButton
      label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={className}
    >
      {dark ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
    </IconButton>
  )
}

/** Avatar, identity and the two account-level controls. */
export function UserCard({
  user,
  onLogout,
  className = '',
}: {
  user: User
  onLogout: () => void | Promise<void>
  className?: string
}) {
  return (
    <div className={cx('rounded-xl border border-line bg-surface p-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={user.fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-ink">{user.fullName}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{ROLE_LABELS[user.role]}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-1.5">
        <ThemeToggle />
        <IconButton label="Sign out" variant="ghost" size="icon" onClick={onLogout}>
          <LogOutIcon width={18} height={18} />
        </IconButton>
      </div>
    </div>
  )
}

/**
 * Role-filtered, grouped navigation. Shared by the fixed desktop rail and the
 * mobile drawer; each caller passes its own layout id so the active pill never
 * animates between two independently mounted copies.
 */
export function SidebarNav({
  role,
  onNavigate,
  layoutId = 'sidebar-active-indicator',
}: {
  role: Role
  onNavigate?: () => void
  layoutId?: string
}) {
  const groups = navGroupsForRole(role)
  return (
    <nav aria-label="Main navigation" className="px-3 pb-2">
      {groups.map((group, groupIndex) => (
        <div key={group.label} className={groupIndex === 0 ? '' : 'mt-4'}>
          <p className="px-3 pb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-muted">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cx(
                        'group relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-200',
                        isActive ? 'text-accent-ink' : 'text-ink-soft hover:bg-subtle hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId={layoutId}
                            transition={springSoft}
                            aria-hidden="true"
                            className="absolute inset-0 rounded-[10px] bg-accent-soft"
                          />
                        )}
                        <span
                          aria-hidden="true"
                          className={cx(
                            'relative flex h-5 w-5 shrink-0 items-center justify-center',
                            isActive ? 'text-accent' : 'text-muted group-hover:text-ink-soft',
                          )}
                        >
                          <Icon width={18} height={18} />
                        </span>
                        <span className="relative truncate">{labelForRole(item, role)}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function Sidebar({
  user,
  onLogout,
}: {
  user: User
  onLogout: () => void | Promise<void>
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col border-r border-line bg-canvas/95 lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5">
        <Logo size={30} />
        <Wordmark />
      </div>

      <div className="shrink-0 px-4 pb-1 pt-5">
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-muted">Workspace</p>
        <p className="mt-1 truncate font-display text-sm font-semibold text-ink">{ROLE_WORKSPACE[user.role]}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        <SidebarNav role={user.role} />
      </div>

      <div className="shrink-0 border-t border-line p-3">
        <UserCard user={user} onLogout={onLogout} />
      </div>
    </aside>
  )
}
