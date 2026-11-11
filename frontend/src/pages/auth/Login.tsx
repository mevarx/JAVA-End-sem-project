import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_HOME } from '../../nav'
import { Alert, Button, Card, Field, inputClass } from '../../components/ui'
import { Logo } from '../../components/Logo'

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

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo size={40} />
          <p className="mt-3 text-lg font-bold tracking-tight text-foreground">HAES</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hospital Appointment &amp; Emergency Scheduler
          </p>
        </div>

        <Card className="mt-6 p-6 sm:p-8">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Use your hospital account to continue.
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {error && (
              <Alert>
                <span role="alert">{error}</span>
              </Alert>
            )}
            <Field label="Username">
              <input
                className={`${inputClass} min-h-[44px]`}
                autoComplete="username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </Field>
            <Field label="Password">
              <input
                className={`${inputClass} min-h-[44px]`}
                type="password"
                autoComplete="current-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" className="min-h-[44px] w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <p className="mt-4 border-t border-border pt-4 text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link className="font-bold text-primary hover:underline" to="/register">
            Create a patient account
          </Link>
        </p>

        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Demo accounts
          </p>
          <div className="mt-2 grid gap-1">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => {
                  setUsername(account.username)
                  setPassword(account.password)
                }}
                className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-lg px-2 text-left transition-colors duration-150 hover:bg-muted"
              >
                <span className="text-sm font-bold text-foreground">{account.role}</span>
                <span className="font-mono text-xs text-muted-foreground">{account.username}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
