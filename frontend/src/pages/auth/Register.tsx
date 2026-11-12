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
import { PhoneIcon, UserIcon } from '../../components/icons'
import { pageVariants } from '../../lib/motion'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirm: '',
    fullName: '',
    phone: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const mismatch = form.confirm.length > 0 && form.confirm !== form.password

  function update(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (form.password !== form.confirm) {
      setError(null)
      return
    }
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
    <AuthShell mode="register">
      <motion.div variants={pageVariants} initial="initial" animate="animate">
        <header>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent-ink">
            New patient registration
          </p>
          <h1 className="mt-2.5 font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[2.15rem]">
            Create a patient account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Set up access to book appointments. You will be signed in automatically after
            registering.
          </p>
        </header>

        <form className="mt-7 space-y-4" onSubmit={submit}>
          <AuthErrorAlert message={error} />

          <AuthField
            id="register-username"
            label="Username"
            icon={<UserIcon />}
            value={form.username}
            onChange={(value) => update('username', value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />

          <AuthPasswordField
            id="register-password"
            label="Password"
            value={form.password}
            onChange={(value) => update('password', value)}
            autoComplete="new-password"
            hint="At least 6 characters."
            required
          />

          <AuthPasswordField
            id="register-confirm"
            label="Confirm password"
            value={form.confirm}
            onChange={(value) => update('confirm', value)}
            autoComplete="new-password"
            error={mismatch ? 'Passwords do not match.' : undefined}
            required
          />

          <AuthField
            id="register-full-name"
            label="Full name"
            icon={<UserIcon />}
            value={form.fullName}
            onChange={(value) => update('fullName', value)}
            autoComplete="name"
            required
          />

          <AuthField
            id="register-phone"
            label="Phone (optional)"
            icon={<PhoneIcon />}
            value={form.phone}
            onChange={(value) => update('phone', value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
          />

          <Button type="submit" className="w-full" loading={busy} disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Already registered?{' '}
          <Link
            to="/login"
            className="font-semibold text-accent-ink underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </AuthShell>
  )
}
