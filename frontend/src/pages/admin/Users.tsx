import { useCallback, useEffect, useState } from 'react'
import { departmentApi, userApi } from '../../api/endpoints'
import type { Department, Role, User } from '../../api/types'
import { ROLE_LABELS } from '../../lib/format'
import { Alert, Badge, Button, Field, Modal, PageHeader, Spinner, inputClass } from '../../components/ui'
import { Cell, EmptyRow, Row, Table } from '../../components/Table'

const ROLES: Role[] = ['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ER_STAFF', 'ADMIN']

interface UserForm {
  username: string
  password: string
  newPassword: string
  fullName: string
  phone: string
  role: Role
  departmentId: string
  specialization: string
  onCall: boolean
}

const EMPTY_FORM: UserForm = {
  username: '',
  password: '',
  newPassword: '',
  fullName: '',
  phone: '',
  role: 'PATIENT',
  departmentId: '',
  specialization: '',
  onCall: true,
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [editing, setEditing] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([userApi.list(), departmentApi.list()])
      .then(([userList, departmentList]) => {
        setUsers(userList)
        setDepartments(departmentList)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load users.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(user: User) {
    setEditing(user)
    setForm({
      username: user.username,
      password: '',
      newPassword: '',
      fullName: user.fullName,
      phone: user.phone ?? '',
      role: user.role,
      departmentId: user.departmentId ? String(user.departmentId) : '',
      specialization: user.specialization ?? '',
      onCall: user.onCall ?? true,
    })
    setError(null)
    setModalOpen(true)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const departmentId = form.departmentId ? Number(form.departmentId) : null
      if (editing) {
        await userApi.update(editing.id, {
          username: form.username,
          newPassword: form.newPassword,
          role: form.role,
          fullName: form.fullName,
          phone: form.phone,
          departmentId,
          specialization: form.specialization,
          onCall: form.onCall,
        })
        setNotice(`User ${form.username} updated.`)
      } else {
        await userApi.create({
          username: form.username,
          password: form.password,
          role: form.role,
          fullName: form.fullName,
          phone: form.phone,
          departmentId,
          specialization: form.specialization,
          onCall: form.onCall,
        })
        setNotice(`User ${form.username} created.`)
      }
      setModalOpen(false)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the user.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(user: User) {
    if (!window.confirm(`Delete ${user.fullName} (${user.username})?`)) return
    setError(null)
    setNotice(null)
    try {
      await userApi.remove(user.id)
      setNotice(`User ${user.username} deleted.`)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the user.')
    }
  }

  function departmentName(id: number | null): string {
    return departments.find((department) => department.id === id)?.name ?? '—'
  }

  const isDoctor = form.role === 'DOCTOR'

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Create and edit accounts for every role. Clinical history protects accounts from deletion."
        actions={
          <>
            <Button variant="secondary" onClick={load}>
              Refresh
            </Button>
            <Button onClick={openCreate}>Add user</Button>
          </>
        }
      />

      <div className="mb-3 space-y-2">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      {loading ? (
        <Spinner label="Loading users…" />
      ) : (
        <Table head={['Name', 'Username', 'Role', 'Department', 'Status', '']}>
          {users.length === 0 ? (
            <EmptyRow colSpan={6} message="No users yet." />
          ) : (
            users.map((user) => (
              <Row key={user.id}>
                <Cell>{user.fullName}</Cell>
                <Cell className="font-mono text-xs">{user.username}</Cell>
                <Cell>{ROLE_LABELS[user.role]}</Cell>
                <Cell>{departmentName(user.departmentId)}</Cell>
                <Cell>
                  <Badge tone={user.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>
                    {user.active ? 'Active' : 'Inactive'}
                  </Badge>
                </Cell>
                <Cell className="whitespace-nowrap text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button variant="ghost" className="min-h-11 px-3" onClick={() => openEdit(user)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => remove(user)}>
                      Delete
                    </Button>
                  </div>
                </Cell>
              </Row>
            ))
          )}
        </Table>
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.fullName}` : 'Add user'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username">
            <input
              className={inputClass}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </Field>
          <Field label={editing ? 'New password' : 'Password'} hint={editing ? 'Leave blank to keep it.' : 'At least 6 characters.'}>
            <input
              className={inputClass}
              type="password"
              value={editing ? form.newPassword : form.password}
              onChange={(e) =>
                setForm({ ...form, [editing ? 'newPassword' : 'password']: e.target.value })
              }
            />
          </Field>
          <Field label="Full name">
            <input
              className={inputClass}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Role">
            <select
              className={inputClass}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select
              className={inputClass}
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Specialization" hint="Required for doctors (emergency matching).">
            <input
              className={inputClass}
              value={form.specialization}
              disabled={!isDoctor}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
            />
          </Field>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-bold text-foreground">Dispatch availability</span>
            <label className="flex min-h-11 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-primary"
                checked={form.onCall}
                disabled={!isDoctor}
                onChange={(e) => setForm({ ...form, onCall: e.target.checked })}
              />
              Available for emergency dispatch
            </label>
            <span className="text-xs text-muted-foreground">Only applies to doctors.</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
