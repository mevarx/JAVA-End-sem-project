import { useCallback, useEffect, useState } from 'react'
import { departmentApi } from '../../api/endpoints'
import type { Department } from '../../api/types'
import { Alert, Button, Card, Field, Modal, PageHeader, Spinner, inputClass } from '../../components/ui'
import { Cell, EmptyRow, Row, Table } from '../../components/Table'

export function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<Department | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    departmentApi
      .list()
      .then(setDepartments)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load departments.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await departmentApi.create(name.trim())
      setNotice(`Department “${name.trim()}” created.`)
      setName('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the department.')
    } finally {
      setBusy(false)
    }
  }

  async function rename() {
    if (!renaming || !renameValue.trim()) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await departmentApi.update(renaming.id, renameValue.trim())
      setNotice(`Department renamed to “${renameValue.trim()}”.`)
      setRenaming(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rename the department.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(department: Department) {
    if (!window.confirm(`Delete the ${department.name} department?`)) return
    setError(null)
    setNotice(null)
    try {
      await departmentApi.remove(department.id)
      setNotice(`Department “${department.name}” deleted.`)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the department.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Departments group doctors and drive the booking filter and emergency matching."
        actions={
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        }
      />

      <div className="mb-3 space-y-2">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[240px] flex-1">
          <Field label="New department">
            <input
              className={inputClass}
              value={name}
              placeholder="e.g. Cardiology"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create()
              }}
            />
          </Field>
        </div>
        <Button onClick={create} disabled={busy || !name.trim()}>
          Add department
        </Button>
      </Card>

      {loading ? (
        <Spinner label="Loading departments…" />
      ) : (
        <Table head={['Name', '']}>
          {departments.length === 0 ? (
            <EmptyRow colSpan={2} message="No departments yet." />
          ) : (
            departments.map((department) => (
              <Row key={department.id}>
                <Cell>{department.name}</Cell>
                <Cell className="whitespace-nowrap text-right">
                  <button
                    type="button"
                    className="mr-3 text-xs font-bold text-primary hover:underline"
                    onClick={() => {
                      setRenaming(department)
                      setRenameValue(department.name)
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="text-xs font-bold text-red-700 hover:underline"
                    onClick={() => remove(department)}
                  >
                    Delete
                  </button>
                </Cell>
              </Row>
            ))
          )}
        </Table>
      )}

      <Modal
        open={renaming !== null}
        title={renaming ? `Rename ${renaming.name}` : 'Rename department'}
        onClose={() => setRenaming(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={rename} disabled={busy || !renameValue.trim()}>
              Save
            </Button>
          </>
        }
      >
        <Field label="Department name">
          <input
            className={inputClass}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  )
}
