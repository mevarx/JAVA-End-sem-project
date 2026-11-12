import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { departmentApi, userApi } from '../../api/endpoints'
import type { Department, Role, User } from '../../api/types'
import { ROLE_LABELS } from '../../lib/format'
import { fadeUp, staggerContainer } from '../../lib/motion'
import { DataList, type Column } from '../../components/DataList'
import { ConfirmDialog, useToast } from '../../components/feedback'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SectionHeader,
  TableSkeleton,
  inputClass,
  selectClass,
} from '../../components/ui'
import { PlusIcon, RefreshIcon, TrashIcon } from '../../components/icons'

const ROLES: Role[] = ['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ER_STAFF', 'ADMIN']
const PAGE_SIZE = 8

const ROLE_TONE: Record<Role, string> = {
  PATIENT: 'bg-info-soft text-info-ink ring-1 ring-info/20',
  DOCTOR: 'bg-accent-soft text-accent-ink ring-1 ring-accent/20',
  RECEPTIONIST: 'bg-subtle text-ink-soft ring-1 ring-line',
  ER_STAFF: 'bg-warning-soft text-warning-ink ring-1 ring-warning/20',
  ADMIN: 'bg-accent text-on-accent',
}

type RoleFilter = 'ALL' | Role
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

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

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function ListEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{hint}</p>
    </div>
  )
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
  const [formError, setFormError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([userApi.list(), departmentApi.list()])
      .then(([userList, departmentList]) => {
        setUsers(userList)
        setDepartments(departmentList)
        setError(null)
      })
      .catch((e) => setError(messageOf(e, 'Could not load users.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return users.filter((user) => {
      if (roleFilter !== 'ALL' && user.role !== roleFilter) return false
      if (statusFilter === 'ACTIVE' && !user.active) return false
      if (statusFilter === 'INACTIVE' && user.active) return false
      if (!needle) return true
      return (
        user.fullName.toLowerCase().includes(needle) ||
        user.username.toLowerCase().includes(needle)
      )
    })
  }, [users, query, roleFilter, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function updateForm<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((current) => {
      const next = { ...current }
      next[key] = value
      return next
    })
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
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
    setFormError(null)
    setModalOpen(true)
  }

  async function save() {
    if (busy) return
    setBusy(true)
    setFormError(null)
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
        toast.push({
          title: 'User updated',
          description: `${form.username} was saved.`,
          tone: 'success',
        })
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
        toast.push({
          title: 'User created',
          description: `${form.username} can now sign in.`,
          tone: 'success',
        })
      }
      setModalOpen(false)
      load()
    } catch (e) {
      setFormError(messageOf(e, 'Could not save the user.'))
    } finally {
      setBusy(false)
    }
  }

  async function removeUser() {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    setError(null)
    try {
      await userApi.remove(deleting.id)
      toast.push({
        title: 'User deleted',
        description: `${deleting.fullName} (${deleting.username}) was removed.`,
        tone: 'success',
      })
      setDeleting(null)
      load()
    } catch (e) {
      setError(messageOf(e, 'Could not delete the user.'))
      setDeleting(null)
    } finally {
      setDeleteBusy(false)
    }
  }

  function departmentName(id: number | null): string {
    return departments.find((department) => department.id === id)?.name ?? 'Unassigned'
  }

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: 'User',
      width: '24%',
      render: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={user.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{user.fullName}</p>
            <p className="truncate text-xs text-muted">{user.phone || 'No phone on file'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'username',
      header: 'Username',
      width: '14%',
      className: 'hidden xl:table-cell',
      headerClassName: 'hidden xl:table-cell',
      render: (user) => (
        <span className="font-mono text-xs text-ink-soft">{user.username}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '13%',
      render: (user) => (
        <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABELS[user.role]}</Badge>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      width: '16%',
      render: (user) => (
        <span className={user.departmentId ? 'text-ink-soft' : 'text-muted'}>
          {departmentName(user.departmentId)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '11%',
      render: (user) => (
        <Badge
          tone={
            user.active
              ? 'bg-success-soft text-success-ink ring-1 ring-success/20'
              : 'bg-subtle text-muted ring-1 ring-line'
          }
        >
          {user.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '10rem',
      render: (user) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" className="px-3" onClick={() => openEdit(user)}>
            Edit
          </Button>
          <Button
            variant="danger"
            size="icon"
            aria-label={`Delete ${user.fullName}`}
            title={`Delete ${user.fullName}`}
            onClick={() => setDeleting(user)}
          >
            <TrashIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  const isDoctor = form.role === 'DOCTOR'
  const hasFilters = query.trim().length > 0 || roleFilter !== 'ALL' || statusFilter !== 'ALL'

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          className="mb-0"
          eyebrow="Administration"
          title="Users"
          subtitle="Create and edit accounts for every role. Clinical history protects accounts from deletion."
          actions={
            <>
              <Button variant="secondary" onClick={load} loading={loading}>
                {!loading && <RefreshIcon className="h-4 w-4" aria-hidden="true" />}
                Refresh
              </Button>
              <Button onClick={openCreate}>
                <PlusIcon className="h-4 w-4" aria-hidden="true" />
                Add user
              </Button>
            </>
          }
        />
      </motion.div>

      {error && (
        <motion.div variants={fadeUp}>
          <Alert title="Could not complete that request" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <Card className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <SearchInput
              className="w-full lg:max-w-sm"
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Search name or username"
              label="Search users"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:ml-auto lg:flex lg:items-end">
              <Field label="Role" className="lg:w-48">
                <select
                  className={selectClass}
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value as RoleFilter)
                    setPage(1)
                  }}
                >
                  <option value="ALL">All roles</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status" className="lg:w-40">
                <select
                  className={selectClass}
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as StatusFilter)
                    setPage(1)
                  }}
                >
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </Field>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-3">
        <SectionHeader
          title="User directory"
          description="Every account in the hospital, with its role and department assignment."
          actions={
            loading ? undefined : (
              <span className="font-mono text-xs tabular-nums text-muted">
                {filtered.length} of {users.length}
              </span>
            )
          }
        />

        {loading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : (
          <>
            <DataList
              items={pageItems}
              columns={columns}
              rowKey={(user) => user.id}
              ariaLabel="Hospital users"
              empty={
                <ListEmpty
                  title={users.length === 0 ? 'No users yet' : 'No users match these filters'}
                  hint={
                    users.length === 0
                      ? 'Add the first account to start staffing the hospital.'
                      : hasFilters
                        ? 'Adjust the search or filters to see more accounts.'
                        : 'There are no accounts to show.'
                  }
                />
              }
              mobileCard={(user) => (
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <Avatar name={user.fullName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="min-w-0 truncate font-semibold text-ink">
                          {user.fullName}
                        </p>
                        <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                        <Badge
                          tone={
                            user.active
                              ? 'bg-success-soft text-success-ink ring-1 ring-success/20'
                              : 'bg-subtle text-muted ring-1 ring-line'
                          }
                        >
                          {user.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-ink-soft">
                        {user.username}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span>{departmentName(user.departmentId)}</span>
                        <span>{user.phone || 'No phone'}</span>
                        {user.role === 'DOCTOR' && user.specialization && (
                          <span>{user.specialization}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => openEdit(user)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => setDeleting(user)}
                    >
                      <TrashIcon className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            />

            {filtered.length > 0 && (
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                onChange={setPage}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
              />
            )}
          </>
        )}
      </motion.div>

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.fullName}` : 'Add user'}
        description={
          editing
            ? 'Update the account details, role or dispatch availability.'
            : 'Create a staff or patient account with a role and department.'
        }
        onClose={() => setModalOpen(false)}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {editing ? 'Save changes' : 'Create user'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {formError && (
            <Alert title="Could not save the user" onDismiss={() => setFormError(null)}>
              {formError}
            </Alert>
          )}

          <FormSection
            title="Account access"
            description={editing ? 'Leave the password blank to keep the current one.' : undefined}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Username">
                <input
                  className={inputClass}
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => updateForm('username', e.target.value)}
                />
              </Field>
              <Field
                label={editing ? 'New password' : 'Password'}
                hint={editing ? 'Leave blank to keep it.' : 'At least 6 characters.'}
              >
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="new-password"
                  value={editing ? form.newPassword : form.password}
                  onChange={(e) =>
                    editing
                      ? updateForm('newPassword', e.target.value)
                      : updateForm('password', e.target.value)
                  }
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  className={inputClass}
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => updateForm('fullName', e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputClass}
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Role and assignment">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role">
                <select
                  className={selectClass}
                  value={form.role}
                  onChange={(e) => updateForm('role', e.target.value as Role)}
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
                  className={selectClass}
                  value={form.departmentId}
                  onChange={(e) => updateForm('departmentId', e.target.value)}
                >
                  <option value="">No department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Clinical dispatch"
            description="Only doctors can be matched to emergency cases."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Specialization" hint="Required for doctors (emergency matching).">
                <input
                  className={inputClass}
                  value={form.specialization}
                  disabled={!isDoctor}
                  onChange={(e) => updateForm('specialization', e.target.value)}
                />
              </Field>
              <label
                className={
                  isDoctor
                    ? 'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line bg-subtle/60 px-3.5 py-3'
                    : 'flex min-h-11 cursor-not-allowed items-start gap-3 rounded-lg border border-line bg-subtle/60 px-3.5 py-3 opacity-60'
                }
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed"
                  checked={form.onCall}
                  disabled={!isDoctor}
                  onChange={(e) => updateForm('onCall', e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">
                    Available for emergency dispatch
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    Only applies to doctors.
                  </span>
                </span>
              </label>
            </div>
          </FormSection>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.fullName}?` : 'Delete user?'}
        description={
          deleting
            ? `${deleting.username} will lose access immediately. Accounts with clinical history cannot be deleted.`
            : undefined
        }
        confirmLabel="Delete user"
        tone="danger"
        busy={deleteBusy}
        onConfirm={removeUser}
        onClose={() => {
          if (!deleteBusy) setDeleting(null)
        }}
      />
    </motion.div>
  )
}
