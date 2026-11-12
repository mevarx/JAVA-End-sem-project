import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_HOME } from '../../nav'
import {
  AuthErrorAlert,
  AuthField,
  AuthPasswordField,
  AuthShell,
} from '../../components/AuthShell'
import { Button } from '../../components/ui'
import { ArrowRightIcon, UserIcon } from '../../components/icons'
import { pageVariants } from '../../lib/motion'

const DEMO_ACCOUNTS = [
  { role: 'Patient', username: 'patient.anita', password: 'patient123' },
  { role: 'Doctor', username: 'dr.sharma', password: 'doctor123' },
  { role: 'Reception', username: 'reception', password: 'reception123' },
  { role: 'ER staff', username: 'er.patel', password: 'er123' },
  { role: 'Admin', username: 'admin', password: 'admin123' },
]

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await login(username, password)
      navigate(ROLE_HOME[user.role], { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  function fillDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setUsername(account.username)
    setPassword(account.password)
    setError(null)
  }

  return (
    <AuthShell mode="login">
      <motion.div variants={pageVariants} initial="initial" animate="animate">
        <header>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent-ink">
            Staff &amp; patient access
          </p>
          <h1 className="mt-2.5 font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[2.15rem]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Sign in with your hospital account to reach your workspace.
          </p>
        </header>

        <form className="mt-7 space-y-4" onSubmit={submit}>
          <AuthErrorAlert message={error} />

          <AuthField
            id="login-username"
            label="Username"
            icon={<UserIcon />}
            value={username}
            onChange={setUsername}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />

          <AuthPasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />

          <Button type="submit" className="w-full" loading={busy} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          New here?{' '}
          <Link
            to="/register"
            className="font-semibold text-accent-ink underline-offset-4 hover:underline"
          >
            Create a patient account
          </Link>
        </p>

        <section className="mt-7 border-t border-line pt-5" aria-labelledby="demo-accounts-title">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2
              id="demo-accounts-title"
              className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted"
            >
              Demo accounts
            </h2>
            <p className="text-[11px] leading-relaxed text-muted">
              Select a role to fill both fields.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => fillDemo(account)}
                aria-label={`Fill ${account.role} demo credentials, username ${account.username}`}
                className="group flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors duration-150 hover:border-line-strong hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:active:translate-y-px"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold leading-tight text-ink">
                    {account.role}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] leading-tight text-muted">
                    {account.username}
                  </span>
                </span>
                <ArrowRightIcon
                  className="shrink-0 text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </section>
      </motion.div>
    </AuthShell>
  )
}
