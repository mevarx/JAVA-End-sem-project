import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { departmentApi } from '../../api/endpoints'
import type { Department } from '../../api/types'
import { fadeUp, staggerContainer } from '../../lib/motion'
import { DataList, type Column } from '../../components/DataList'
import { ConfirmDialog, useToast } from '../../components/feedback'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SearchInput,
  SectionHeader,
  TableSkeleton,
  inputClass,
} from '../../components/ui'
import {
  BuildingIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from '../../components/icons'

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function ListEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{hint}</p>
    </div>
  )
}

export function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<Department | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<Department | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [renameBusy, setRenameBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    departmentApi
      .list()
      .then((list) => {
        setDepartments(list)
        setError(null)
      })
      .catch((e) => setError(messageOf(e, 'Could not load departments.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return departments
    return departments.filter(
      (department) =>
        department.name.toLowerCase().includes(needle) ||
        String(department.id).includes(needle),
    )
  }, [departments, query])

  async function create() {
    const trimmed = name.trim()
    if (!trimmed || creating) return
    setCreating(true)
    setError(null)
    try {
      await departmentApi.create(trimmed)
      toast.push({
        title: 'Department created',
        description: `“${trimmed}” is now available for assignment.`,
        tone: 'success',
      })
      setName('')
      load()
    } catch (e) {
      setError(messageOf(e, 'Could not create the department.'))
    } finally {
      setCreating(false)
    }
  }

  async function rename() {
    if (!renaming || !renameValue.trim() || renameBusy) return
    setRenameBusy(true)
    setRenameError(null)
    try {
      await departmentApi.update(renaming.id, renameValue.trim())
      toast.push({
        title: 'Department renamed',
        description: `“${renameValue.trim()}” was saved.`,
        tone: 'success',
      })
      setRenaming(null)
      load()
    } catch (e) {
      setRenameError(messageOf(e, 'Could not rename the department.'))
    } finally {
      setRenameBusy(false)
    }
  }

  async function removeDepartment() {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    setError(null)
    try {
      await departmentApi.remove(deleting.id)
      toast.push({
        title: 'Department deleted',
        description: `“${deleting.name}” was removed.`,
        tone: 'success',
      })
      setDeleting(null)
      load()
    } catch (e) {
      setError(messageOf(e, 'Could not delete the department.'))
      setDeleting(null)
    } finally {
      setDeleteBusy(false)
    }
  }

  function openRename(department: Department) {
    setRenaming(department)
    setRenameValue(department.name)
    setRenameError(null)
  }

  const columns: Column<Department>[] = [
    {
      key: 'name',
      header: 'Department',
      render: (department) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink"
          >
            <BuildingIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 truncate font-semibold text-ink">{department.name}</span>
        </div>
      ),
    },
    {
      key: 'id',
      header: 'ID',
      width: '7rem',
      render: (department) => (
        <span className="font-mono text-xs text-muted">#{department.id}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '13rem',
      render: (department) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" className="px-3" onClick={() => openRename(department)}>
            Rename
          </Button>
          <Button
            variant="danger"
            size="icon"
            aria-label={`Delete ${department.name}`}
            title={`Delete ${department.name}`}
            onClick={() => setDeleting(department)}
          >
            <TrashIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

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
          title="Departments"
          subtitle="Departments group doctors and drive the booking filter and emergency matching."
          actions={
            <Button variant="secondary" onClick={load} loading={loading}>
              {!loading && <RefreshIcon className="h-4 w-4" aria-hidden="true" />}
              Refresh
            </Button>
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
        <Card className="p-5">
          <SectionHeader
            title="New department"
            description="Add a clinical or support unit, then assign doctors to it."
          />
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              create()
            }}
          >
            <Field label="Department name" className="min-w-0 flex-1">
              <input
                className={inputClass}
                value={name}
                placeholder="e.g. Cardiology"
                autoComplete="off"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              loading={creating}
              disabled={!name.trim()}
              className="w-full sm:w-auto"
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Add department
            </Button>
          </form>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-3">
        <SectionHeader
          title="All departments"
          description="Rename a department or remove one that is no longer in use."
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <SearchInput
                className="w-full sm:w-64"
                value={query}
                onChange={setQuery}
                placeholder="Search departments"
                label="Search departments"
              />
              <span className="font-mono text-xs tabular-nums text-muted sm:ml-1">
                {loading ? '—' : `${filtered.length} of ${departments.length}`}
              </span>
            </div>
          }
        />

        {loading ? (
          <TableSkeleton rows={5} columns={3} />
        ) : departments.length === 0 ? (
          <EmptyState
            icon={<BuildingIcon className="h-5 w-5" />}
            title="No departments yet"
            hint="Create the first department above to start grouping doctors and powering booking filters."
          />
        ) : (
          <DataList
            items={filtered}
            columns={columns}
            rowKey={(department) => department.id}
            ariaLabel="Hospital departments"
            empty={
              <ListEmpty
                title="No departments match this search"
                hint="Try a different name or clear the search to see every department."
              />
            }
            mobileCard={(department) => (
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink"
                  >
                    <BuildingIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{department.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted">
                      Department ID #{department.id}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => openRename(department)}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => setDeleting(department)}
                  >
                    <TrashIcon className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          />
        )}
      </motion.div>

      <Modal
        open={renaming !== null}
        title={renaming ? `Rename ${renaming.name}` : 'Rename department'}
        description="Doctor assignments and booking filters follow the new name."
        onClose={() => {
          if (!renameBusy) setRenaming(null)
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)} disabled={renameBusy}>
              Cancel
            </Button>
            <Button
              onClick={rename}
              loading={renameBusy}
              disabled={!renameValue.trim()}
            >
              Save name
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {renameError && (
            <Alert title="Could not rename the department" onDismiss={() => setRenameError(null)}>
              {renameError}
            </Alert>
          )}
          <Field label="Department name">
            <input
              className={inputClass}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  rename()
                }
              }}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete department?'}
        description={
          deleting
            ? `“${deleting.name}” will no longer be available for doctor assignment, booking filters or emergency matching.`
            : undefined
        }
        confirmLabel="Delete department"
        tone="danger"
        busy={deleteBusy}
        onConfirm={removeDepartment}
        onClose={() => {
          if (!deleteBusy) setDeleting(null)
        }}
      />
    </motion.div>
  )
}
