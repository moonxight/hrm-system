import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import apiClient from '../api/client'
import OnboardingDocument from '../components/OnboardingDocument'
import { OnboardingCompletionPanel, OnboardingProgressCard } from '../components/OnboardingStatus'

const emptyOnboardingForm = {
  phone: '', address: '', emergency_contact_name: '', emergency_contact_phone: '',
  emergency_contact_relationship: '', bank_name: '', bank_account_number: '',
  tax_number: '', national_id: '', next_of_kin_name: '',
}

const fieldLabels = {
  phone: 'Phone', address: 'Home address', emergency_contact_name: 'Emergency contact name',
  emergency_contact_phone: 'Emergency contact phone', emergency_contact_relationship: 'Emergency contact relationship',
  bank_name: 'Bank name', bank_account_number: 'Bank account number', tax_number: 'Tax / TPIN number',
  national_id: 'National ID', next_of_kin_name: 'Next of kin',
}

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('hrms_user') || 'null') } catch { return null }
}

function humanValue(value) {
  if (value === true) return 'Received and encrypted'
  if (value === false || value === null || value === '') return 'Not provided'
  return String(value)
}

function OnboardingPage() {
  const user = readStoredUser()
  const role = user?.role_name || 'Employee'
  const canRequestDocuments = ['Admin', 'HR'].includes(role)
  const canReviewForms = ['Admin', 'HR'].includes(role)
  const canLoadForms = ['Admin', 'HR', 'Manager', 'Employee'].includes(role)
  const [query, setQuery] = useSearchParams()
  const caseId = query.get('case') || ''
  const documentId = query.get('document') || ''
  const formId = query.get('form') || ''
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [startAfter, setStartAfter] = useState('')
  const [records, setRecords] = useState([])
  const [linkedCase, setLinkedCase] = useState(null)
  const [forms, setForms] = useState([])
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [catalog, setCatalog] = useState({ types: [], documents: [] })
  const [requestForm, setRequestForm] = useState({ document_name: '', custom_name: '', document_type: '' })
  const [employeeForm, setEmployeeForm] = useState(emptyOnboardingForm)
  const hydratedForm = useRef('')
  const [reviewReasons, setReviewReasons] = useState({})
  const [bankAccessReasons, setBankAccessReasons] = useState({})
  const [bankingViews, setBankingViews] = useState({})
  const [requesting, setRequesting] = useState(false)
  const [formBusy, setFormBusy] = useState('')
  const [requestMessage, setRequestMessage] = useState({ kind: '', text: '' })
  const [formMessage, setFormMessage] = useState({ kind: '', text: '' })

  useEffect(() => {
    let active = true
    const match = [
      ['onboarding_id', caseId], ['document_id', documentId], ['form_id', formId],
    ].filter(([, value]) => /^[1-9]\d*$/.test(value))
    const requests = [apiClient.get('/api/onboarding/get.php', { params: { limit: 200 } })]
    if (match.length) requests.push(apiClient.get('/api/onboarding/get.php', { params: Object.fromEntries(match) }))
    Promise.all(requests).then(([response, target]) => {
      if (!active) return
      const listed = response.data.data || []
      const requested = target?.data.data?.[0]
      setLinkedCase({ caseId, documentId, formId, id: requested?.onboarding_id })
      setRecords(requested && !listed.some((record) => record.onboarding_id === requested.onboarding_id) ? [...listed, requested] : listed)
      setState('ready')
    }).catch((error) => {
      if (!active) return
      setMessage(error.response?.data?.message || 'Unable to load onboarding records.')
      setState('error')
    })
    return () => { active = false }
  }, [refreshKey, caseId, documentId, formId])

  useEffect(() => {
    if (!canRequestDocuments) return undefined
    let active = true
    apiClient.get('/api/onboarding/document-types.php').then((response) => {
      if (active) setCatalog(response.data.data || { types: [], documents: [] })
    }).catch(() => {
      if (active) setRequestMessage({ kind: 'error', text: 'Document types could not be loaded.' })
    })
    return () => { active = false }
  }, [canRequestDocuments])

  const handleRequestChange = (event) => {
    const { name, value } = event.target
    setRequestForm((current) => {
      const next = { ...current, [name]: value }
      if (name === 'document_name') {
        const match = catalog.documents.find((item) => item.document_name === value)
        next.document_type = match ? match.document_type : (value === '__other' ? 'Other' : '')
      }
      return next
    })
  }

  const submitDocumentRequest = async (event) => {
    event.preventDefault()
    const documentName = requestForm.document_name === '__other' ? requestForm.custom_name.trim() : requestForm.document_name
    if (!documentName) { setRequestMessage({ kind: 'error', text: 'Choose a document to request.' }); return }
    setRequesting(true); setRequestMessage({ kind: '', text: '' })
    try {
      await apiClient.post('/api/onboarding/request-document.php', { onboarding_id: Number(latest?.onboarding_id), document_name: documentName, document_type: requestForm.document_type || 'Other' })
      setRequestMessage({ kind: 'success', text: 'Document requested.' })
      setRequestForm((current) => ({ ...current, document_name: '', custom_name: '', document_type: '' }))
      setRefreshKey((key) => key + 1)
    } catch (error) {
      setRequestMessage({ kind: 'error', text: error.response?.data?.message || 'The document could not be requested.' })
    } finally { setRequesting(false) }
  }

  const submitEmployeeForm = async (event) => {
    event.preventDefault(); setFormBusy('submit'); setFormMessage({ kind: '', text: '' })
    try {
      await apiClient.post('/api/onboarding/form-submit.php', employeeForm)
      setFormMessage({ kind: 'success', text: 'Your onboarding form was encrypted and submitted to HR.' })
      setEmployeeForm(emptyOnboardingForm)
      setRefreshKey((key) => key + 1)
    } catch (error) {
      setFormMessage({ kind: 'error', text: error.response?.data?.message || 'The onboarding form could not be submitted.' })
    } finally { setFormBusy('') }
  }

  const reviewForm = async (formId, status) => {
    const reason = reviewReasons[formId] || ''
    if (status === 'Rejected' && !reason.trim()) { setFormMessage({ kind: 'error', text: 'Add a reason before rejecting the form.' }); return }
    setFormBusy(`review-${formId}`); setFormMessage({ kind: '', text: '' })
    try {
      await apiClient.post('/api/onboarding/form-review.php', { form_id: formId, status, reason })
      setFormMessage({ kind: 'success', text: `Onboarding form ${status.toLowerCase()}.` })
      setRefreshKey((key) => key + 1)
    } catch (error) {
      setFormMessage({ kind: 'error', text: error.response?.data?.message || 'The onboarding form could not be reviewed.' })
    } finally { setFormBusy('') }
  }

  const revealBanking = async (formId) => {
    const reason = (bankAccessReasons[formId] || '').trim()
    if (!reason) { setFormMessage({ kind: 'error', text: 'Enter a reason before accessing protected banking information.' }); return }
    setFormBusy(`banking-${formId}`); setFormMessage({ kind: '', text: '' })
    try {
      const response = await apiClient.post('/api/onboarding/form-banking.php', { form_id: formId, reason })
      setBankingViews((current) => ({ ...current, [formId]: response.data.data }))
      window.setTimeout(() => setBankingViews((current) => {
        const next = { ...current }; delete next[formId]; return next
      }), 60000)
      setFormMessage({ kind: 'success', text: 'Banking information revealed temporarily. This access was recorded in the audit log.' })
    } catch (error) {
      setFormMessage({ kind: 'error', text: error.response?.data?.message || 'Protected banking information could not be accessed.' })
    } finally { setFormBusy('') }
  }

  const departments = [...new Set(records.map((record) => record.department_name).filter(Boolean))].sort()
  const employees = [...new Map(records.map((record) => [record.employee_id, record.employee_name])).entries()]
    .sort(([, first], [, second]) => first.localeCompare(second))
  const visible = records.filter((record) => (
    (!employeeFilter || String(record.employee_id) === employeeFilter)
    && (!department || record.department_name === department)
    && (!status || record.onboarding_status === status || (record.onboarding_status !== 'Completed' && (
      (status === 'Needs HR review' && (record.requirements.form_status === 'Submitted' || record.documents?.some((item) => item.document_status === 'Submitted')))
      || (status === 'Ready to sign off' && record.onboarding_status === 'In Progress' && record.requirements.ready_to_complete)
    )))
    && (!startAfter || record.start_date >= startAfter)
  ))
  const linked = caseId || documentId || formId
  const linkResolved = linkedCase?.caseId === caseId && linkedCase?.documentId === documentId && linkedCase?.formId === formId
  const latest = linked ? records.find((record) => linkResolved && record.onboarding_id === linkedCase.id) : visible[0]
  const documents = latest?.documents || []
  const ownCase = latest && Number(latest.employee_id) === Number(user?.employee_id)
  const activeCaseId = latest?.onboarding_id
  useEffect(() => {
    if (!canLoadForms || !activeCaseId || (!canReviewForms && !ownCase)) return undefined
    let active = true
    apiClient.get('/api/onboarding/form-get.php', { params: { onboarding_id: activeCaseId } }).then((response) => {
      if (!active) return
      const nextForms = response.data.data?.forms || []
      setForms(nextForms)
      const formVersion = `${activeCaseId}:${nextForms[0]?.form_id || ''}:${nextForms[0]?.form_status || ''}`
      if (ownCase && hydratedForm.current !== formVersion) {
        hydratedForm.current = formVersion
        const data = nextForms[0]?.form_data || {}
        setEmployeeForm({ ...emptyOnboardingForm, ...Object.fromEntries(Object.keys(emptyOnboardingForm).filter((key) => !['bank_name', 'bank_account_number'].includes(key)).map((key) => [key, data[key] || ''])) })
      }
    }).catch((error) => {
      if (active) setFormMessage({ kind: 'error', text: error.response?.data?.message || 'Onboarding forms could not be loaded.' })
    })
    return () => { active = false }
  }, [activeCaseId, canLoadForms, canReviewForms, ownCase, refreshKey])

  useEffect(() => {
    if (!formId) return
    window.document.getElementById(canReviewForms ? 'form-review' : 'own-form')?.scrollIntoView({ block: 'center' })
  }, [formId, activeCaseId, forms, canReviewForms])
  const ownForm = ownCase ? forms.find((form) => form.onboarding_id === latest.onboarding_id) : undefined
  const selectedForms = latest ? forms.filter((form) => form.onboarding_id === latest.onboarding_id && form.form_id) : []
  const requirements = latest?.requirements
  const needsUpload = requirements && (requirements.documents_pending > 0 || requirements.documents_rejected > 0)
  const formAction = requirements?.form_required && ['Pending', 'Rejected'].includes(requirements.form_status)
  const nextStep = !latest ? '' : latest.onboarding_status === 'Completed' ? 'Onboarding complete.'
    : latest.onboarding_status === 'On Hold' ? 'HR needs to resume this case.'
    : requirements?.documents_total === 0 ? 'HR needs to request the required documents.'
    : needsUpload || formAction ? (ownCase ? 'Submit the outstanding files or information below.' : 'Waiting for the employee to submit or replace their information.')
    : requirements?.ready_to_complete ? 'HR can sign off and complete onboarding.'
    : 'HR needs to review the submitted information or documents.'
  function changeFilter(setter, value) {
    setter(value)
    if (linked) setQuery({}, { replace: true })
  }
  const maySubmitOwnForm = Boolean(ownForm) && latest.onboarding_status !== 'Completed' && (!ownForm.form_id || ['Pending', 'Rejected'].includes(ownForm.form_status))

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl">
      <header className="panel-surface mb-6 p-4 sm:p-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="section-label">Nexa People / Employee lifecycle</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Onboarding</h1><p className="mt-2 text-sm text-slate-600">Complete employee information, documents and HR verification in one protected workflow.</p></div><div className="flex items-center gap-3"><Link to="/dashboard" className="action-button-secondary">Back to Dashboard</Link></div></div></header>

      <section className="mb-6 grid gap-4 md:grid-cols-4"><div className="panel-surface p-5"><p className="section-label">Records</p><p className="mt-2 text-2xl font-bold text-slate-900">{state === 'ready' ? records.length : '—'}</p></div><div className="panel-surface p-5"><p className="section-label">Current status</p><p className="mt-2 text-lg font-bold text-slate-900">{latest?.onboarding_status || (state === 'ready' ? 'Not started' : '—')}</p></div><div className="panel-surface p-5"><p className="section-label">Documents</p><p className="mt-2 text-2xl font-bold text-slate-900">{requirements?.documents_total ?? 0}</p></div><div className="panel-surface p-5"><p className="section-label">Verified</p><p className="mt-2 text-2xl font-bold text-emerald-600">{latest ? `${latest.verification_percentage || 0}%` : '—'}</p></div></section>

      {state === 'loading' && <div className="panel-surface p-6 text-sm text-slate-600">Loading onboarding information...</div>}
      {state === 'error' && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{message}</div>}
      {formMessage.text && <div className={`mb-6 rounded-xl border p-4 text-sm ${formMessage.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`} role={formMessage.kind === 'error' ? 'alert' : 'status'}>{formMessage.text}</div>}
      {state === 'ready' && records.length === 0 && <div className="panel-surface p-7 text-center"><h2 className="font-semibold text-slate-900">No onboarding record yet</h2><p className="mt-2 text-sm text-slate-600">HR can create an onboarding record and request the documents needed for this employee.</p></div>}

      {role === 'Employee' && latest && <OnboardingProgressCard record={latest} restricted={Boolean(user?.onboarding_required)} />}

      {role !== 'Employee' && state === 'ready' && records.length > 0 && (
        <section className="panel-surface mb-6 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">{canRequestDocuments ? 'Onboarding queue' : 'Your team’s onboarding'}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium">Employee
              <select className="field-input mt-1" value={employeeFilter} onChange={(event) => changeFilter(setEmployeeFilter, event.target.value)}>
                <option value="">All employees in scope</option>
                {employees.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Department<select className="field-input mt-1" value={department} onChange={(event) => changeFilter(setDepartment, event.target.value)}><option value="">All departments</option>{departments.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="text-sm font-medium">Status<select className="field-input mt-1" value={status} onChange={(event) => changeFilter(setStatus, event.target.value)}><option value="">All statuses</option>{['Not Started', 'In Progress', 'On Hold', 'Completed', ...(canReviewForms ? ['Needs HR review', 'Ready to sign off'] : [])].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="text-sm font-medium">Starts on or after<input className="field-input mt-1" type="date" value={startAfter} onChange={(event) => changeFilter(setStartAfter, event.target.value)} /></label>
          </div>
          <label className="mt-4 block text-sm font-medium">Open onboarding case<select className="field-input mt-1" value={latest?.onboarding_id || ''} onChange={(event) => setQuery({ case: event.target.value })}>
            {!latest && <option value="" disabled>{visible.length ? 'Select a case' : 'No matching cases'}</option>}
            {latest && !visible.includes(latest) && <option value={latest.onboarding_id}>{latest.employee_name} · {latest.employee_number}</option>}
            {visible.map((record) => <option key={record.onboarding_id} value={record.onboarding_id}>{record.employee_name} · {record.employee_number} · {record.onboarding_status}</option>)}
          </select></label>
        </section>
      )}
      {linked && state === 'ready' && !latest && <p className="mb-5 rounded-xl bg-sky-50 p-4 text-sm" role="status">{linkResolved ? <>This onboarding item is unavailable. <Link to="/onboarding" className="font-semibold underline">View onboarding</Link></> : 'Opening onboarding case…'}</p>}
      {latest && <section className="panel-surface mb-6 p-5 sm:p-6">
        <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">{latest.employee_name} <span className="text-sm font-medium text-slate-600">{latest.employee_number}</span></h2>
          <p className="mt-1 text-sm text-slate-600">{latest.department_name || 'Department pending'} · Starts {latest.start_date} · HR contact {latest.assigned_hr_name || 'Unassigned'}</p></div>
          <Link className="action-button-secondary" to="/help#onboarding">How onboarding works</Link></div>
        <p className="mt-4 rounded-lg bg-sky-50 p-3 text-sm font-semibold text-sky-900">{nextStep}</p>
        {latest.notes && <p className="mt-3 text-sm text-slate-600">{latest.notes}</p>}
      </section>}
      {latest && (ownCase || canReviewForms) && <section className="panel-surface mb-6 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">Document checklist</h2>
        <p className="mt-1 text-sm text-slate-600">{requirements.documents_verified} of {requirements.documents_total} verified. HR checks each submission and records its decision here.</p>
        <div className="mt-4 space-y-3">{documents.map((document) => <OnboardingDocument key={document.document_id} document={document} own={ownCase} reviewer={canReviewForms} completed={latest.onboarding_status === 'Completed'} highlighted={String(document.document_id) === documentId} onChanged={() => setRefreshKey((key) => key + 1)} />)}</div>
      </section>}

      {ownForm && (
        <section id="own-form" className="panel-surface mb-6 scroll-mt-24 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="section-label">Employee form</p><h2 className="mt-2 text-lg font-bold text-slate-900">Your onboarding information</h2><p className="mt-1 text-sm text-slate-600">Banking values are encrypted before storage and are never returned by this screen.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{ownForm.form_status}</span></div>
          {ownForm.form_status === 'Rejected' && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">HR requested changes: {ownForm.rejection_reason}. Re-enter the banking fields because protected values cannot be displayed.</p>}
          {maySubmitOwnForm ? <form onSubmit={submitEmployeeForm} className="mt-5 grid gap-4 md:grid-cols-2">
            {Object.keys(emptyOnboardingForm).map((field) => <label key={field} className={field === 'address' ? 'md:col-span-2' : ''}><span className="mb-2 block text-sm font-medium text-slate-700">{fieldLabels[field]}{!['tax_number', 'national_id', 'next_of_kin_name'].includes(field) ? ' *' : ''}</span>{field === 'address' ? <textarea required rows="3" maxLength="300" className="field-input" value={employeeForm[field]} onChange={(event) => setEmployeeForm((current) => ({ ...current, [field]: event.target.value }))} /> : <input required={!['tax_number', 'national_id', 'next_of_kin_name'].includes(field)} type={field === 'bank_account_number' ? 'password' : 'text'} autoComplete="off" maxLength={field === 'bank_name' ? 100 : field === 'bank_account_number' ? 40 : 100} className="field-input" value={employeeForm[field]} onChange={(event) => setEmployeeForm((current) => ({ ...current, [field]: event.target.value }))} />}</label>)}
            <button type="submit" disabled={Boolean(formBusy)} className="action-button-primary md:col-span-2">{formBusy === 'submit' ? 'Encrypting and submitting...' : 'Submit onboarding form'}</button>
          </form> : <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-700">{ownForm.form_status === 'Approved' ? 'HR has approved this form.' : 'This form is awaiting HR review.'} {ownForm.form_data?.banking_submitted && 'Protected banking information was received.'}</div>}
        </section>
      )}

      {canReviewForms && latest && (
        <section className="panel-surface mb-6 p-5 sm:p-6"><p className="section-label">HR review</p><h2 className="mt-2 text-lg font-bold text-slate-900">Submitted onboarding forms</h2><p className="mt-1 text-sm text-slate-600">Only HR/Admin can review these forms. Banking values remain encrypted and are not displayed.</p><div className="mt-5 space-y-4">
          {selectedForms.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No employee forms have been submitted.</p>}
          {selectedForms.map((form) => <article key={form.form_id} id="form-review" className="scroll-mt-24 rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">{form.employee_name}</h3><p className="text-xs text-slate-500">{latest.employee_number}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{form.form_status}</span></div><dl className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(form.form_data || {}).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key === 'banking_submitted' ? 'Banking information' : (fieldLabels[key] || key.replaceAll('_', ' '))}</dt><dd className="mt-1 break-words text-sm text-slate-800">{humanValue(value)}</dd></div>)}</dl>{form.form_data?.banking_submitted && Number(form.employee_id) !== Number(user?.employee_id) && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Protected banking access</p><p className="mt-1 text-xs text-amber-800">Use only for a legitimate HR or payroll task. Every reveal is audited and automatically hidden after 60 seconds.</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input className="field-input" maxLength="250" placeholder="Reason, e.g. payroll verification" value={bankAccessReasons[form.form_id] || ''} onChange={(event) => setBankAccessReasons((current) => ({ ...current, [form.form_id]: event.target.value }))} /><button type="button" disabled={Boolean(formBusy)} onClick={() => revealBanking(form.form_id)} className="action-button-secondary">{formBusy === `banking-${form.form_id}` ? 'Accessing...' : 'Reveal for 60 seconds'}</button></div>{bankingViews[form.form_id] && <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-800"><p><span className="font-semibold">Bank:</span> {bankingViews[form.form_id].bank_name}</p><p className="mt-1"><span className="font-semibold">Account:</span> {bankingViews[form.form_id].bank_account_number}</p><button type="button" className="mt-2 text-xs font-semibold text-sky-700" onClick={() => setBankingViews((current) => { const next = { ...current }; delete next[form.form_id]; return next })}>Hide now</button></div>}</div>}{form.form_status === 'Submitted' && Number(form.employee_id) !== Number(user?.employee_id) && <div className="mt-4"><textarea className="field-input" rows="2" placeholder="Reason required only when rejecting" value={reviewReasons[form.form_id] || ''} onChange={(event) => setReviewReasons((current) => ({ ...current, [form.form_id]: event.target.value }))} /><div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={Boolean(formBusy)} onClick={() => reviewForm(form.form_id, 'Approved')} className="action-button-primary">Approve</button><button type="button" disabled={Boolean(formBusy)} onClick={() => reviewForm(form.form_id, 'Rejected')} className="action-button-secondary">Reject</button></div></div>}{form.form_status === 'Submitted' && Number(form.employee_id) === Number(user?.employee_id) && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Another HR/Admin user must review your form.</p>}{form.rejection_reason && <p className="mt-3 text-sm text-red-700">Reason: {form.rejection_reason}</p>}</article>)}
        </div></section>
      )}

            {role === 'Manager' && latest && !ownCase && <section className="panel-surface mb-6 p-5"><h2 className="font-semibold">Team progress</h2><p className="mt-2 text-sm text-slate-700">{requirements.documents_verified} of {requirements.documents_total} documents verified{requirements.form_required ? ' · Information form: ' + requirements.form_status : ''}.</p></section>}

      {canRequestDocuments && latest && latest.onboarding_status !== 'Completed' && <section className="panel-surface mb-6 p-5 sm:p-6"><p className="section-label">HR action</p><h2 className="mt-2 text-lg font-bold text-slate-900">Request a document</h2><form onSubmit={submitDocumentRequest} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label><span className="mb-2 block text-sm font-medium text-slate-700">Document</span><select required name="document_name" value={requestForm.document_name} onChange={handleRequestChange} className="field-input"><option value="">Select document</option>{catalog.documents.map((item) => <option key={item.document_name} value={item.document_name}>{item.document_name}</option>)}<option value="__other">Other (specify)</option></select></label><label><span className="mb-2 block text-sm font-medium text-slate-700">Document type</span><select required name="document_type" value={requestForm.document_type} onChange={handleRequestChange} className="field-input"><option value="">Select type</option>{catalog.types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>{requestForm.document_name === '__other' && <label><span className="mb-2 block text-sm font-medium text-slate-700">Document name</span><input required name="custom_name" value={requestForm.custom_name} onChange={handleRequestChange} maxLength="150" className="field-input" /></label>}<button type="submit" disabled={requesting || catalog.documents.length === 0} className="action-button-primary md:col-span-2 xl:col-span-4">{requesting ? 'Requesting...' : 'Request document'}</button></form>{requestMessage.text && <p role={requestMessage.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${requestMessage.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{requestMessage.text}</p>}</section>}

      {canRequestDocuments && latest && <OnboardingCompletionPanel records={[latest]} onChanged={() => setRefreshKey((key) => key + 1)} />}
    </div></main>
  )
}

export default OnboardingPage
