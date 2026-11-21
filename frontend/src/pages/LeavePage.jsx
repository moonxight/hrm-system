import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import apiClient from '../api/client'
import { readStoredUser } from '../api/session'

const initialForm = {
  leave_type_id: '',
  start_date: '',
  end_date: '',
  reason: '',
}

function getErrorMessage(error, fallback) {
  return error.response?.data?.message || fallback
}

function LeavePage() {
  const [query, setQuery] = useSearchParams()
  const linkedRequest = query.get('request') || ''
  const employeeId = query.get('employee_id') || ''
  const status = query.get('status') || ''
  const year = query.get('year') || ''
  const user = readStoredUser()
  const isEmployee = user?.role_name === 'Employee'
  const canReview = ['Admin', 'HR', 'Manager'].includes(user?.role_name)
  const [leaveTypes, setLeaveTypes] = useState([])
  const [balances, setBalances] = useState([])
  const [requests, setRequests] = useState([])
  const [form, setForm] = useState(initialForm)
  const [review, setReview] = useState(null)
  const [staff, setStaff] = useState([])
  const [staffError, setStaffError] = useState('')
  const [showRequest, setShowRequest] = useState(false)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const changeFilter = (name, value) => {
    setReview(null)
    setQuery((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('request')
      if (value) next.set(name, value)
      else next.delete(name)
      return next
    })
  }

  useEffect(() => {
    if (!canReview) return undefined
    const controller = new AbortController()
    apiClient.get('/api/employees/get.php', { params: { limit: 200 }, signal: controller.signal })
      .then(({ data }) => setStaff(data.data || []))
      .catch((failure) => {
        if (!controller.signal.aborted) setStaffError(getErrorMessage(failure, 'Employee names could not be loaded.'))
      })
    return () => controller.abort()
  }, [canReview])

  const loadData = useCallback(async (signal) => {
    setLoading(true)
    setError('')

    try {
      const requestParams = linkedRequest
        ? { leave_request_id: linkedRequest }
        : { employee_id: canReview && employeeId ? employeeId : undefined, status: status || undefined, year: year || undefined }
      const [typesResponse, requestsResponse, balancesResponse] = await Promise.all([
        isEmployee ? apiClient.get('/api/Leave/types.php', { signal }) : null,
        apiClient.get('/api/Leave/get.php', { params: requestParams, signal }),
        isEmployee || employeeId
          ? apiClient.get('/api/Leave/balance.php', { params: { employee_id: employeeId || undefined }, signal })
          : null,
      ])
      if (signal.aborted) return
      setLeaveTypes(typesResponse?.data.data || [])
      setRequests(requestsResponse.data.data || [])
      setBalances(balancesResponse?.data.data || [])
    } catch (requestError) {
      if (!signal.aborted) setError(getErrorMessage(requestError, 'Unable to load leave data.'))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [canReview, employeeId, status, year, isEmployee, linkedRequest])

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => loadData(controller.signal))
    return () => controller.abort()
  }, [loadData, revision])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
  }

  const runAction = async (action, message) => {
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const response = await action()
      setSuccess(message)
      setRevision((value) => value + 1)
      return response.data.data
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'The leave request could not be completed.'))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const submitRequest = async (event) => {
    event.preventDefault()
    const submitted = await runAction(
      () => apiClient.post('/api/Leave/request.php', form),
      'Leave request submitted successfully.',
    )
    if (submitted) {
      setForm(initialForm)
      setShowRequest(false)
      showResult(submitted.leave_request_id)
    }
  }

  const showResult = (requestId) => {
    setQuery((previous) => {
      const next = new URLSearchParams(previous)
      next.set('request', requestId)
      return next
    })
  }

  const cancelRequest = async (requestId) => {
    if (await runAction(
      () => apiClient.post('/api/Leave/cancel.php', { leave_request_id: requestId }),
      'Leave request cancelled.',
    )) showResult(requestId)
  }

  const submitReview = async (event) => {
    event.preventDefault()
    const { id, decision, reason } = review
    if (decision === 'reject' && !reason.trim()) {
      setError('Enter a reason for rejecting this request.')
      return
    }
    const payload = { leave_request_id: id }
    if (decision === 'reject') payload.rejection_reason = reason.trim()
    if (await runAction(
      () => apiClient.post(`/api/Leave/${decision}.php`, payload),
      decision === 'approve' ? 'Leave request approved.' : 'Leave request rejected.',
    )) {
      setReview(null)
      showResult(id)
    }
  }

  const selectedLeaveType = leaveTypes.find(
    (type) => String(type.leave_type_id) === String(form.leave_type_id),
  )

  const listQuery = new URLSearchParams(query)
  listQuery.delete('request')
  const selectedReview = requests.find((request) => request.leave_request_id === review?.id)

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="panel-surface mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">HRMS</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Leave Management</h1>
            <p className="mt-2 text-sm text-slate-600">Live leave balances, requests, and approvals.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/dashboard" className="action-button-secondary">Back to Dashboard</Link>
          </div>
        </header>

        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

        {canReview && (
          <section className="panel-surface mb-6 p-5 sm:p-6" aria-label="Leave filters">
            <h2 className="mb-3 font-semibold">Filter requests</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium">Employee
                <select className="field-input mt-1" value={employeeId} onChange={(event) => changeFilter('employee_id', event.target.value)}>
                  <option value="">All employees in scope</option>
                  {staff.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.first_name} {employee.last_name} ({employee.employee_number || employee.employee_id})</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Request status
                <select className="field-input mt-1" value={status} onChange={(event) => changeFilter('status', event.target.value)}>
                  <option value="">All statuses</option>
                  {['Pending', 'Approved', 'Rejected', 'Cancelled'].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Leave year
                <input className="field-input mt-1" type="number" min="1900" max="9998" key={year} defaultValue={year} placeholder="All years"
                  onBlur={(event) => { if (event.currentTarget.validity.valid) changeFilter('year', event.currentTarget.value) }} />
              </label>
            </div>
            {staffError && <p role="status" className="mt-2 text-sm text-slate-600">{staffError}</p>}
          </section>
        )}

        {(isEmployee || employeeId) && <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="panel-surface min-w-0 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Leave balance</h2>
            {loading ? <p className="mt-4 text-sm text-slate-600">Loading balances...</p> : balances.length === 0 ? <p className="mt-4 text-sm text-slate-600">No leave balances are available.</p> : (
              <div className="mt-4 space-y-3">
                {balances.map((balance) => (
                  <div key={balance.leave_balance_id} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{balance.leave_name}</p><span className="text-sm font-semibold text-sky-700">{balance.remaining_days} remaining</span></div>
                    <p className="mt-2 text-sm text-slate-600">{balance.used_days} used of {balance.total_days} days</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isEmployee && <div className="panel-surface min-w-0 p-5 sm:p-6">
            <button type="button" className="action-button-primary mb-4" aria-expanded={showRequest} aria-controls="leave-request-form" onClick={() => setShowRequest(!showRequest)}>{showRequest ? 'Close request form' : 'Request leave'}</button>
            {showRequest && <form id="leave-request-form" onSubmit={submitRequest} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Leave type</span><select required name="leave_type_id" value={form.leave_type_id} onChange={handleChange} className="field-input"><option value="">Select leave type</option>{leaveTypes.map((type) => <option key={type.leave_type_id} value={type.leave_type_id}>{type.leave_name}</option>)}</select></label>
              {selectedLeaveType && <div className="sm:col-span-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><p className="font-semibold">Demonstration leave policy</p><p className="mt-1">Annual allowance: {selectedLeaveType.default_days} days · Requests per year: {selectedLeaveType.max_requests_per_year ?? 'Not limited'} · Maximum consecutive days: {selectedLeaveType.max_consecutive_days ?? 'Not limited'}</p>{selectedLeaveType.policy_notes && <p className="mt-2 text-xs text-sky-800">{selectedLeaveType.policy_notes}</p>}</div>}
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Start date</span><input required name="start_date" type="date" value={form.start_date} onChange={handleChange} className="field-input" /></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">End date</span><input required name="end_date" type="date" value={form.end_date} onChange={handleChange} className="field-input" /></label>
              <label className="sm:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Reason</span><textarea name="reason" value={form.reason} onChange={handleChange} maxLength="5000" rows="3" className="field-input" /></label>
              <button type="submit" disabled={submitting || loading || leaveTypes.length === 0} className="action-button-primary sm:col-span-2">{submitting ? 'Submitting...' : 'Submit leave request'}</button>
            </form>}
          </div>}
        </section>}

        <section className="panel-surface p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900">Leave requests</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{loading ? 'Loading' : `${requests.length} records`}</span></div>
          {linkedRequest && <Link to={listQuery.size ? `/leave?${listQuery}` : '/leave'} className="action-button-secondary mb-4">Back to leave requests</Link>}
          {selectedReview && <form className="mb-5 space-y-3 rounded-xl bg-slate-50 p-4" onSubmit={submitReview} aria-label="Review leave request">
            <h3 className="font-semibold">{review.decision === 'reject' ? 'Reject' : 'Approve'} leave for {selectedReview.employee_name}</h3>
            <p className="text-sm text-slate-600">{selectedReview.leave_name}, {selectedReview.start_date} to {selectedReview.end_date}</p>
            {review.decision === 'reject' && <label className="block text-sm font-medium">Rejection reason
              <textarea autoFocus required maxLength={5000} rows={3} className="field-input mt-1" value={review.reason} onChange={(event) => setReview({ ...review, reason: event.target.value })} />
            </label>}
            <div className="flex flex-wrap gap-2">
              <button className="action-button-primary" disabled={submitting}>{review.decision === 'reject' ? 'Confirm rejection' : 'Confirm approval'}</button>
              <button type="button" className="action-button-secondary" disabled={submitting} onClick={() => setReview(null)}>Back</button>
            </div>
          </form>}
          {loading ? <p className="py-6 text-center text-sm text-slate-600">Loading leave requests...</p> : requests.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">{linkedRequest ? 'This leave request is unavailable.' : 'No leave requests found.'}</p> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Leave</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Days</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-200">{requests.map((request) => <tr key={request.leave_request_id} className="bg-white"><td className="px-4 py-3 text-slate-700">{request.employee_name}</td><td className="px-4 py-3 font-medium text-slate-900">{request.leave_name}</td><td className="px-4 py-3 text-slate-700">{request.start_date} to {request.end_date}</td><td className="px-4 py-3 text-slate-700">{request.number_of_days}</td><td className="px-4 py-3 text-slate-700">{request.status}{request.rejection_reason && <p className="mt-1 text-xs text-slate-600">{request.rejection_reason}</p>}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2">{isEmployee && request.status === 'Pending' && <button type="button" disabled={submitting} onClick={() => cancelRequest(request.leave_request_id)} className="action-button-secondary">Cancel</button>}{canReview && request.status === 'Pending' && <><button type="button" disabled={submitting} onClick={() => setReview({ id: request.leave_request_id, decision: 'approve', reason: '' })} className="action-button-primary">Approve</button><button type="button" disabled={submitting} onClick={() => setReview({ id: request.leave_request_id, decision: 'reject', reason: '' })} className="action-button-secondary">Reject</button></>}</div></td></tr>)}</tbody></table></div>
          )}
        </section>
      </div>
    </main>
  )
}

export default LeavePage
