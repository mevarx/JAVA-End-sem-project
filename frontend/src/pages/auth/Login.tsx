import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_HOME } from '../../nav'
import { Alert, Button, Field, inputClass } from '../../components/ui'

const DEMO_ACCOUNTS = [
  { role: 'Patient', username: 'patient.anita', password: 'patient123' },
  { role: 'Doctor', username: 'dr.sharma', password: 'doctor123' },
  { role: 'Reception', username: 'reception', password: 'reception123' },
  { role: 'ER staff', username: 'er.patel', password: 'er123' },
  { role: 'Admin', username: 'admin', password: 'admin123' },
]

const HIGHLIGHTS = [
  'Conflict-free booking protected by per-slot locks and database transactions.',
  'Priority emergency dispatch with escalation, pre-emption and shared ER beds.',
  'Live notifications for every appointment and emergency event.',
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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between bg-gradient-to-br from-slate-950 via-cyan-950 to-teal-800 p-12 text-white lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-2xl font-bold text-cyan-200">
              +
            </span>
            <div>
              <p className="text-xl font-bold tracking-tight">HAES</p>
              <p className="text-xs text-cyan-200">Hospital Appointment &amp; Emergency Scheduler</p>
            </div>
          </div>
          <h1 className="mt-16 max-w-lg text-4xl font-bold leading-tight">
            Planned care and unplanned emergencies, scheduled in one place.
          </h1>
          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex gap-3 text-sm text-cyan-50">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-cyan-300/80">
          Academic simulation · invented data only · not for clinical use
        </p>
      </section>

      <section className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">CSE 213 · Integrated project</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your hospital account, or pick a demo role below.
            </p>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              {error && <Alert>{error}</Alert>}
              <Field label="Username">
                <input
                  className={inputClass}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </Field>
              <Field label="Password">
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              New here?{' '}
              <Link className="font-bold text-primary hover:underline" to="/register">
                Create a patient account
              </Link>
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Demo accounts
            </p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => {
                    setUsername(account.username)
                    setPassword(account.password)
                  }}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted"
                >
                  <span className="font-bold text-foreground">{account.role}</span>
                  <span className="font-mono text-muted-foreground">{account.username}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
