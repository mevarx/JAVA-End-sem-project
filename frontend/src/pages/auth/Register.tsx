import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_HOME } from '../../nav'
import { Alert, Button, Card, Field, inputClass } from '../../components/ui'
import { Logo } from '../../components/Logo'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', fullName: '', phone: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function update(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await register(form.username, form.password, form.fullName, form.phone)
      navigate(ROLE_HOME[user.role], { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the account.')
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
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Create a patient account
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            You will be signed in automatically after registering.
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
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
                required
              />
            </Field>
            <Field label="Password" hint="At least 6 characters.">
              <input
                className={`${inputClass} min-h-[44px]`}
                type="password"
                autoComplete="new-password"
                name="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
              />
            </Field>
            <Field label="Full name">
              <input
                className={`${inputClass} min-h-[44px]`}
                autoComplete="name"
                name="fullName"
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                required
              />
            </Field>
            <Field label="Phone (optional)">
              <input
                className={`${inputClass} min-h-[44px]`}
                type="tel"
                autoComplete="tel"
                name="phone"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
              />
            </Field>
            <Button type="submit" className="min-h-[44px] w-full" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </Card>

        <p className="mt-4 border-t border-border pt-4 text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <Link className="font-bold text-primary hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
