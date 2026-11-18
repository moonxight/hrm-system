import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import apiClient from '../api/client'
import { readStoredUser } from '../api/session'
import BrandMark from '../components/BrandMark'

const stages = ['Submitted', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'Rejected', 'Withdrawn']
const transitions = {
  Submitted: ['Shortlisted', 'Rejected', 'Withdrawn'],
  Shortlisted: ['Interview', 'Rejected', 'Withdrawn'],
  Interview: ['Offered', 'Rejected', 'Withdrawn'],
  Offered: ['Rejected', 'Withdrawn'],
}

function Field({ label, children }) {
  return <label><span className="mb-1 block text-sm font-medium">{label}</span>{children}</label>
}

function VacancyForm({ configuration, managers, busy, save }) {
  const [department, setDepartment] = useState('')
  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <Field label="Job title"><input required name="title" maxLength={150} className="field-input" /></Field>
      <Field label="Applications close"><input required type="date" name="closing_date" className="field-input" /></Field>
      <Field label="Department">
        <select required name="department_id" className="field-input" value={department} onChange={(event) => setDepartment(event.target.value)}>
          <option value="">Select department</option>
          {configuration.departments.map((entry) => <option key={entry.department_id} value={entry.department_id}>{entry.department_name}</option>)}
        </select>
      </Field>
      <Field label="Position">
        <select key={department} required name="position_id" className="field-input" disabled={!department}>
          <option value="">Select position</option>
          {configuration.positions.filter((entry) => String(entry.department_id) === department).map((entry) => (
            <option key={entry.position_id} value={entry.position_id}>{entry.position_name}</option>
          ))}
        </select>
      </Field>
      <Field label="Hiring manager">
        <select name="manager_employee_id" className="field-input">
          <option value="">Unassigned</option>
          {managers.map((person) => <option key={person.employee_id} value={person.employee_id}>{person.display_name}</option>)}
        </select>
      </Field>
      <Field label="Initial status">
        <select name="status" className="field-input"><option>Draft</option><option>Open</option></select>
      </Field>
      <Field label="Responsibilities"><textarea required name="description" maxLength={5000} className="field-input" /></Field>
      <Field label="Requirements"><textarea required name="requirements" maxLength={5000} className="field-input" /></Field>
      <button disabled={busy} className="action-button-primary sm:justify-self-start">Create vacancy</button>
    </form>
  )
}

function RecruitmentPage() {
  const user = readStoredUser()
  const managesHiring = ['Admin', 'HR'].includes(user?.role_name)
  const [params, setParams] = useSearchParams()
  const requestedId = params.get('application') || ''
  const requestedInterview = params.get('interview') || ''
  const [vacancies, setVacancies] = useState([])
  const [applications, setApplications] = useState([])
  const [vacancyId, setVacancyId] = useState(0)
  const [stage, setStage] = useState('')
  const [search, setSearch] = useState('')
  const [interviews, setInterviews] = useState([])
  const [configuration, setConfiguration] = useState({ departments: [], positions: [] })
  const [interviewers, setInterviewers] = useState([])
  const [form, setForm] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const candidateId = /^[1-9]\d*$/.test(requestedId) ? Number(requestedId) : 0

  useEffect(() => {
    let current = true
    const requests = [
      apiClient.get('/api/recruitment/vacancies.php', { params: { limit: 200 } }),
      apiClient.get('/api/recruitment/applications.php', { params: { limit: 200 } }),
      candidateId ? apiClient.get('/api/recruitment/applications.php', { params: { application_id: candidateId } }) : null,
    ]
    if (managesHiring) {
      requests.push(apiClient.get('/api/configuration/get.php'), apiClient.get('/api/recruitment/interviewers.php'))
    }
    Promise.all(requests).then(([jobs, people, linked, choices, team]) => {
      if (!current) return
      setVacancies(jobs.data.data)
      const list = people.data.data || []
      const target = linked?.data.data?.[0]
      setApplications(target && !list.some((person) => person.application_id === target.application_id) ? [target, ...list] : list)
      if (choices) setConfiguration(choices.data.data)
      if (team) setInterviewers(team.data.data)
    }).catch((requestError) => {
      if (current) setError(requestError.response?.data?.message || 'Could not load recruitment records.')
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [candidateId, managesHiring, revision])

  useEffect(() => {
    if (!candidateId) return undefined
    let current = true
    apiClient.get('/api/recruitment/interviews.php', { params: { application_id: candidateId } })
      .then((response) => { if (current) setInterviews(response.data.data) })
      .catch((requestError) => { if (current) setError(requestError.response?.data?.message || 'Could not load interviews.') })
    return () => { current = false }
  }, [candidateId, revision])

  const vacancy = vacancies.find((job) => job.vacancy_id === vacancyId)
  const vacancyApplications = applications.filter((entry) => !vacancyId || entry.vacancy_id === vacancyId)
  const searchText = search.trim().toLowerCase().replace(/\s+/g, ' ')
  const candidates = vacancyApplications.filter((entry) => (!stage || entry.status === stage) && [entry.full_name, entry.email, entry.application_id].some((value) => String(value ?? '').toLowerCase().includes(searchText)))
  const candidate = applications.find((entry) => entry.application_id === candidateId)
  const candidateVacancy = vacancies.find((job) => job.vacancy_id === candidate?.vacancy_id)
  const availableInterviewers = interviewers.filter((person) => person.role_name !== 'Manager' || person.employee_id === candidateVacancy?.manager_employee_id)
  const canOffer = interviews.some((entry) => entry.status === 'Completed' && entry.result === 'Pass')

  useEffect(() => {
    if (requestedInterview) window.document.getElementById(`interview-${requestedInterview}`)?.scrollIntoView({ block: 'center' })
  }, [interviews, requestedInterview])

  async function save(event, endpoint, extras, message, transform = (data) => data) {
    event.preventDefault()
    const formElement = event.currentTarget
    const fields = Object.fromEntries([...new FormData(formElement)].filter(([, value]) => value !== ''))
    setBusy(true)
    setError('')
    setFeedback('')
    try {
      await apiClient.post(`/api/recruitment/${endpoint}.php`, { ...transform(fields), ...extras })
      formElement.reset()
      setForm('')
      setStage('')
      setFeedback(message)
      setRevision((previous) => previous + 1)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The change could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  function selectCandidate(id) {
    if (id === candidateId && !requestedInterview) return
    setInterviews([])
    setParams(id ? { application: String(id) } : {})
  }

  return (
    <main className="min-h-screen bg-[var(--nexa-canvas)] px-4 py-6 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="nexa-feature-header mb-6 flex flex-wrap items-center justify-between gap-5 p-5 sm:p-7">
          <div>
            <BrandMark />
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Recruitment</h1>
            <p className="mt-1 text-sm text-slate-600">Manage vacancies and follow candidates from application to onboarding.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard" className="action-button-secondary">Dashboard</Link>
            {managesHiring && <button type="button" onClick={() => setForm(form === 'vacancy' ? '' : 'vacancy')} className="action-button-primary">{form === 'vacancy' ? 'Close form' : 'New vacancy'}</button>}
          </div>
        </header>

        {error && <p role="alert" className="form-message form-message--error mb-4">{error}</p>}
        {feedback && <p role="status" className="form-message form-message--success mb-4">{feedback}</p>}
        {loading && <p role="status" className="mb-4 text-sm text-slate-600">Loading recruitment…</p>}
        {form === 'vacancy' && <section className="panel-surface mb-6 p-5"><h2 className="mb-4 text-lg font-semibold">New vacancy</h2><VacancyForm configuration={configuration} managers={interviewers.filter((person) => person.role_name === 'Manager')} busy={busy} save={(event) => save(event, 'create-vacancy', {}, 'Vacancy created.')} /></section>}

        <div className="grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="panel-surface p-4">
            <h2 className="mb-3 font-semibold">Vacancies</h2>
            <div className="space-y-2">
              <button type="button" className="nexa-select-row" aria-pressed={!vacancyId} onClick={() => { setVacancyId(0); selectCandidate(0); setStage(''); setForm('') }}>All vacancies</button>
              {vacancies.map((job) => <button type="button" key={job.vacancy_id} className="nexa-select-row" aria-pressed={vacancyId === job.vacancy_id} onClick={() => { setVacancyId(job.vacancy_id); selectCandidate(0); setStage(''); setForm('') }}><span>{job.title}</span><small>{job.status}</small></button>)}
            </div>
          </aside>

          <section className="panel-surface min-w-0 p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{vacancy?.title || 'Hiring pipeline'}</h2>
                {vacancy && <p className="mt-1 text-sm text-slate-600">{vacancy.status} · Closes {vacancy.closing_date}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {managesHiring && vacancy?.status === 'Open' && <button type="button" className="action-button-secondary" onClick={() => setForm(form === 'applicant' ? '' : 'applicant')}>Add applicant</button>}
                {managesHiring && ['Draft', 'Open', 'Closed'].includes(vacancy?.status) && (
                  <form onSubmit={(event) => save(event, 'update-vacancy', { vacancy_id: vacancyId }, 'Vacancy status updated.')} className="flex gap-2">
                    <select aria-label="New vacancy status" name="status" className="field-input">
                      {(vacancy.status === 'Draft' ? ['Open', 'Cancelled'] : vacancy.status === 'Open' ? ['Closed', 'Cancelled'] : ['Open', 'Filled', 'Cancelled']).map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <button className="action-button-secondary" disabled={busy}>Update</button>
                  </form>
                )}
              </div>
            </div>
            {form === 'applicant' && vacancy?.status === 'Open' && (
              <form onSubmit={(event) => save(event, 'apply', { vacancy_id: vacancyId }, 'Applicant added.')} className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <Field label="Candidate name"><input required name="full_name" maxLength={150} className="field-input" /></Field>
                <Field label="Email"><input required type="email" name="email" className="field-input" /></Field>
                <Field label="Phone"><input name="phone" type="tel" className="field-input" /></Field>
                <Field label="Application note"><input name="cover_letter" maxLength={5000} className="field-input" /></Field>
                <button className="action-button-primary sm:justify-self-start" disabled={busy}>Save applicant</button>
              </form>
            )}
            <label className="mb-3 block text-sm font-medium">Search candidates<input type="search" className="field-input mt-1" placeholder="Name, email or application ID" value={search} onChange={(event) => { setSearch(event.target.value); selectCandidate(0) }} /></label>
            <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter by application stage">
              {['', ...stages].map((label) => <button key={label} type="button" className="nexa-stage" aria-pressed={stage === label} onClick={() => { setStage(label); selectCandidate(0) }}>{label || 'All'} <b>{vacancyApplications.filter((entry) => !label || entry.status === label).length}</b></button>)}
            </div>
            {!loading && candidates.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No candidates in this view.</p>}
            {!loading && requestedId && !candidate && <p className="rounded-xl bg-sky-50 p-4 text-sm">This candidate is unavailable. <Link to="/recruitment" className="font-semibold underline">View recruitment</Link></p>}
            <div className="grid gap-4 xl:grid-cols-[minmax(12rem,1fr)_minmax(17rem,1.35fr)]">
              <div className="space-y-2">
                {candidates.map((person) => <button type="button" key={person.application_id} className="nexa-select-row" aria-pressed={candidateId === person.application_id} onClick={() => selectCandidate(person.application_id)}><span>{person.full_name}<small className="block">{person.title}</small></span><small>{person.status}</small></button>)}
              </div>
              {candidate && (
                <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="font-bold">{candidate.full_name}</h3>
                  <p className="break-all text-sm text-slate-600">{candidate.email}</p>
                  {candidate.decision_notes && <p className="mt-2 whitespace-pre-wrap text-sm">{candidate.decision_notes}</p>}
                  {managesHiring && candidate.status === 'Offered' && <Link className="action-button-primary mt-3" to={`/employees?offer=${candidate.application_id}`}>Hire and start onboarding</Link>}
                  {managesHiring && transitions[candidate.status] && (
                    <form key={candidate.application_id} onSubmit={(event) => save(event, 'decision', { application_id: candidateId }, 'Application updated.')} className="mt-4 space-y-3">
                      <Field label="Next stage"><select name="status" required defaultValue="" className="field-input"><option value="">Select a stage</option>{transitions[candidate.status].map((next) => <option disabled={next === 'Offered' && !canOffer} key={next}>{next}</option>)}</select></Field>
                      <Field label="Decision note"><textarea required name="decision_notes" maxLength={5000} className="field-input" /></Field>
                      <button className="action-button-secondary" disabled={busy}>Save decision</button>
                    </form>
                  )}
                  {candidate.status === 'Interview' && managesHiring && (
                    <form onSubmit={(event) => save(event, 'schedule-interview', { application_id: candidateId }, 'Interview scheduled.', (fields) => ({ ...fields, scheduled_at: fields.scheduled_at?.replace('T', ' ') + ':00' }))} className="mt-5 space-y-3 border-t border-slate-200 pt-4">
                      <Field label="Interviewer"><select required name="interviewer_employee_id" className="field-input"><option value="">Select interviewer</option>{availableInterviewers.map((person) => <option key={person.employee_id} value={person.employee_id}>{person.display_name}</option>)}</select></Field>
                      <Field label="Interview time (Lusaka)"><input required type="datetime-local" name="scheduled_at" className="field-input" /></Field>
                      <button className="action-button-secondary" disabled={busy}>Schedule interview</button>
                    </form>
                  )}
                  {interviews.map((entry) => (
                    <div key={entry.interview_id} id={`interview-${entry.interview_id}`} className={`mt-4 scroll-mt-24 border-t border-slate-200 p-3 ${String(entry.interview_id) === requestedInterview ? 'rounded-lg bg-sky-100' : ''}`}>
                      <p className="text-sm font-medium">Interview · {new Date(entry.scheduled_at).toLocaleString('en-GB', { timeZone: 'Africa/Lusaka' })} · {entry.result || entry.status}</p>
                      {entry.status === 'Scheduled' && candidate.status === 'Interview' && (managesHiring || Number(user?.employee_id) === Number(entry.interviewer_employee_id)) && (
                        <form onSubmit={(event) => save(event, 'interview-result', { interview_id: entry.interview_id }, 'Interview result recorded.')} className="mt-2 space-y-2">
                          <Field label="Result"><select name="result" className="field-input"><option>Pass</option><option>Hold</option><option>Fail</option></select></Field>
                          <Field label="Interview notes"><input required maxLength={5000} name="notes" className="field-input" /></Field>
                          <button className="action-button-secondary" disabled={busy}>Record result</button>
                        </form>
                      )}
                    </div>
                  ))}
                </article>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default RecruitmentPage
