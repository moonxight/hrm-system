import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import BrandMark from '../components/BrandMark'

const accountStatuses = ['Active', 'Inactive', 'Locked']

function AccessPage() {
  const [accounts, setAccounts] = useState([])
  const [employees, setEmployees] = useState([])
  const [roles, setRoles] = useState([])
  const [activeId, setActiveId] = useState(0)
  const [mode, setMode] = useState('')
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const active = accounts.find((account) => account.user_id === activeId)
  const employeeById = new Map(employees.map((person) => [person.employee_id, person]))
  const available = employees.filter((person) => !accounts.some((account) => account.employee_id === person.employee_id))

  useEffect(() => {
    let current = true
    Promise.all([
      apiClient.get('/api/users/get.php', { params: { limit: 200 } }),
      apiClient.get('/api/employees/get.php', { params: { limit: 200, status: 'Active' } }),
      apiClient.get('/api/configuration/get.php'),
    ]).then(([users, people, configuration]) => {
      if (!current) return
      setAccounts(users.data.data)
      setEmployees(people.data.data)
      setRoles(configuration.data.data.roles)
      setReady(true)
    }).catch((failure) => {
      if (current) setError(failure.response?.data?.message || 'Could not load accounts.')
    })
    return () => { current = false }
  }, [revision])

  async function save(event) {
    event.preventDefault()
    const entries = new FormData(event.currentTarget)
    const payload = Object.fromEntries(entries)
    if (mode !== 'create') payload.user_id = activeId
    if (entries.has('password')) payload.must_change_password = true
    setBusy(true)
    setFeedback('')
    setError('')
    try {
      await apiClient.post(`/api/users/${mode}.php`, payload)
      setFeedback(mode === 'reset-password' ? 'Temporary password set. The employee must change it on their next sign-in.' : 'Account saved.')
      setMode('')
      setRevision((value) => value + 1)
    } catch (failure) {
      setError(failure.response?.data?.message || 'The account could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--nexa-canvas)] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="nexa-feature-header mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div><BrandMark /><h1 className="mt-4 text-3xl font-bold">People access</h1><p className="mt-1 text-sm text-slate-600">Manage role assignments, account status, and temporary passwords.</p></div>
          <Link className="action-button-secondary" to="/dashboard">Dashboard</Link>
        </header>
        {error && <p className="form-message form-message--error mb-4" role="alert">{error}</p>}
        {feedback && <p className="form-message form-message--success mb-4" role="status">{feedback}</p>}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
          <section className="panel-surface min-w-0 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">User accounts</h2>
              <button type="button" className="action-button-primary" disabled={!ready || !available.length} onClick={() => { setMode('create'); setActiveId(0) }}>New account</button>
            </div>
            {!ready && !error && <p role="status">Loading accounts…</p>}
            <div className="space-y-2">
              {accounts.map((account) => {
                const person = employeeById.get(account.employee_id)
                return (
                  <button type="button" className="nexa-select-row" key={account.user_id} aria-pressed={activeId === account.user_id} onClick={() => { setActiveId(account.user_id); setMode('update') }}>
                    <span>{person ? `${person.first_name} ${person.last_name}` : account.username}<small className="block">{account.username}</small></span>
                    <small>{account.role_name} · {account.account_status}</small>
                  </button>
                )
              })}
            </div>
          </section>
          <section className="panel-surface p-5">
            <h2 className="mb-3 text-lg font-bold">{mode === 'create' ? 'Create account' : active?.username || 'Account details'}</h2>
            {!mode && <p className="text-sm text-slate-600">Select a person to manage their account.</p>}
            {mode && (
              <form key={`${mode}-${activeId}`} onSubmit={save} className="space-y-4">
                {mode === 'create' && (
                  <>
                    <label className="block text-sm font-medium">Employee<select required name="employee_id" className="field-input mt-1"><option value="">Select employee</option>{available.map((person) => <option key={person.employee_id} value={person.employee_id}>{person.first_name} {person.last_name}</option>)}</select></label>
                    <label className="block text-sm font-medium">Username<input required name="username" minLength={3} maxLength={50} className="field-input mt-1" autoComplete="off" /></label>
                  </>
                )}
                {mode !== 'reset-password' && <label className="block text-sm font-medium">Role<select required name="role_id" defaultValue={active?.role_id || ''} className="field-input mt-1"><option value="">Select role</option>{roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.role_name}</option>)}</select></label>}
                {mode === 'update' && <label className="block text-sm font-medium">Account status<select name="account_status" defaultValue={active.account_status} className="field-input mt-1">{accountStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>}
                {mode !== 'update' && <label className="block text-sm font-medium">Temporary password<input required type="password" name="password" minLength={10} maxLength={128} className="field-input mt-1" autoComplete="new-password" /><small className="mt-1 block text-slate-600">At least 10 characters with uppercase, lowercase, a number, and a symbol.</small></label>}
                <div className="flex flex-wrap gap-2"><button className="action-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save account'}</button>{mode === 'update' && <button type="button" className="action-button-secondary" onClick={() => setMode('reset-password')} disabled={busy}>Reset password</button>}</div>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

export default AccessPage
