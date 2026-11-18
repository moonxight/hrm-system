import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import { readStoredUser } from '../api/session'
import OnboardingDocument from '../components/OnboardingDocument'

export default function DocumentsPage() {
  const user = readStoredUser()
  const reviewer = ['Admin', 'HR'].includes(user?.role_name)
  const [records, setRecords] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiClient.get('/api/onboarding/get.php', { params: { limit: 200 } }).then(({ data }) => {
      if (active) {
        setRecords(data.data || [])
        setError('')
      }
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'Document requests could not be loaded.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])

  const query = search.trim().toLowerCase().replace(/\s+/g, ' ')
  const visible = records.flatMap((record) => (record.documents || [])
    .filter((document) => (!status || document.document_status === status) && [
      record.employee_name, record.employee_number, document.document_name, document.document_type,
    ].some((value) => String(value ?? '').toLowerCase().includes(query)))
    .map((document) => ({ record, document })))

  return (
    <main className="min-h-screen bg-[var(--nexa-canvas)] p-4 sm:p-7">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="nexa-feature-header flex flex-wrap items-center justify-between gap-4 p-5 sm:p-7">
          <div><h1 className="text-3xl font-bold">Documents</h1><p className="mt-1 text-sm text-slate-600">Find onboarding requests, submitted files and review decisions.</p></div>
          <Link to="/onboarding" className="action-button-secondary">Open onboarding</Link>
        </header>
        <section className="panel-surface p-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-[2fr_1fr]">
            <label className="text-sm font-medium">Document, employee name or ID<input type="search" className="field-input mt-1" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <label className="text-sm font-medium">Status<select className="field-input mt-1" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{['Pending', 'Submitted', 'Verified', 'Rejected'].map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>
          {loading && <p role="status">Loading documents…</p>}
          {error && <p className="form-message form-message--error" role="alert">{error}</p>}
          {!loading && !error && (visible.length ? <div className="space-y-4">
            {visible.map(({ record, document }) => <div key={document.document_id}>
              <Link to={`/onboarding?document=${document.document_id}`} className="mb-2 inline-block text-sm font-semibold text-sky-800 underline">{record.employee_name} · {record.employee_number}</Link>
              <OnboardingDocument document={document} own={Number(record.employee_id) === Number(user?.employee_id)} reviewer={reviewer} completed={record.onboarding_status === 'Completed'} onChanged={() => setRevision((value) => value + 1)} />
            </div>)}
          </div> : <p className="rounded-lg bg-slate-50 p-4 text-sm">No document requests match these filters.</p>)}
        </section>
      </div>
    </main>
  )
}
