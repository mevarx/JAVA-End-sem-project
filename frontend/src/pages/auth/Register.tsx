import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_HOME } from '../../nav'
import { Alert, Button, Card, Field, inputClass } from '../../components/ui'

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
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">HAES</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Create a patient account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You will be signed in automatically after registering.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {error && <Alert>{error}</Alert>}
          <Field label="Username">
            <input
              className={inputClass}
              autoComplete="username"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              required
            />
          </Field>
          <Field label="Password" hint="At least 6 characters.">
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
            />
          </Field>
          <Field label="Full name">
            <input
              className={inputClass}
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              required
            />
          </Field>
          <Field label="Phone (optional)">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <Link className="font-bold text-primary hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}
