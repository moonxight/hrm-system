import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import apiClient from '../api/client'

const emptyEmployeeForm = {
  employee_number: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  gender: 'Female',
  date_of_birth: '',
  national_id: '',
  email: '',
  phone: '',
  address: '',
  department_id: '',
  position_id: '',
  employment_type: 'Full-Time',
  hire_date: '',
  basic_salary: '',
  create_account: false,
  username: '',
  application_id: '',
}

function employeeFromOffer(previous, offer) {
  if (!offer) return { ...previous, application_id: '' }
  const [firstName, ...rest] = offer.full_name.trim().split(/\s+/)
  return {
    ...previous,
    application_id: offer.application_id,
    first_name: firstName,
    middle_name: '',
    last_name: rest.join(' '),
    email: offer.email,
    phone: offer.phone || '',
    department_id: offer.department_id,
    position_id: offer.position_id,
    create_account: true,
  }
}

function EmployeeDirectory() {
  const currentRole = JSON.parse(localStorage.getItem('hrms_user') || 'null')?.role_name
  const isManager = currentRole === 'Manager'
  const canManageEmployees = ['Admin', 'HR'].includes(currentRole)
  const [employees, setEmployees] = useState([])
  const [teamDepartments, setTeamDepartments] = useState([])
  const [teamDepartmentStatus, setTeamDepartmentStatus] = useState('loading')
  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const employmentStatus = searchParams.get('status') || ''
  const [employmentType, setEmploymentType] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [hiredFrom, setHiredFrom] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [configuration, setConfiguration] = useState({ departments: [], positions: [] })
  const [adding, setAdding] = useState(false)
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm)
  const [editingEmployeeId, setEditingEmployeeId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newAccount, setNewAccount] = useState(null)
  const [offers, setOffers] = useState([])
  const [offerError, setOfferError] = useState('')
  const requestedOffer = searchParams.get('offer')

  useEffect(() => {
    if (!canManageEmployees) return undefined
    let active = true
    apiClient.get('/api/recruitment/applications.php', { params: { status: 'Offered', limit: 200 } })
      .then((response) => {
        if (active) {
          setOffers(response.data.data || [])
          setOfferError('')
          if (requestedOffer) {
            const offer = response.data.data.find((record) => String(record.application_id) === requestedOffer)
            if (offer) setEmployeeForm((previous) => employeeFromOffer(previous, offer))
            else setOfferError('This offer is no longer available. Select another offer or enter the employee manually.')
          }
        }
      })
      .catch((requestError) => {
        if (active) setOfferError(requestError.response?.data?.message || 'Recruitment offers could not be loaded.')
      })
    return () => { active = false }
  }, [canManageEmployees, refreshKey, requestedOffer])

  useEffect(() => {
    if (!isManager) return undefined
    const controller = new AbortController()
    apiClient.get('/api/manager/team.php', { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return
      const departments = new Map()
      for (const { department } of data.data.employees) {
        if (department?.department_id && department.department_name) departments.set(department.department_id, department)
      }
      setTeamDepartments([...departments.values()].sort((a, b) => a.department_name.localeCompare(b.department_name)))
      setTeamDepartmentStatus('ready')
    }).catch(() => {
      if (!controller.signal.aborted) setTeamDepartmentStatus('error')
    })
    return () => controller.abort()
  }, [isManager])

  useEffect(() => {
    if (!canManageEmployees) return undefined
    let isActive = true
    apiClient.get('/api/configuration/get.php')
      .then((response) => {
        if (isActive) setConfiguration(response.data.data || { departments: [], positions: [] })
      })
      .catch((requestError) => {
        if (isActive) setError(requestError.response?.data?.message || 'Departments and positions could not be loaded.')
      })
    return () => {
      isActive = false
    }
  }, [canManageEmployees])

  useEffect(() => {
    let isActive = true

    const loadEmployees = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await apiClient.get('/api/employees/get.php', {
          params: {
            search: search.trim() || undefined,
            status: employmentStatus || undefined,
            employment_type: employmentType || undefined,
            department_id: departmentFilter || undefined,
            hired_from: hiredFrom || undefined,
            limit: 200,
          },
        })

        if (!isActive) return

        if (!response.data.success) {
          throw new Error(response.data.message || 'Unable to retrieve employees.')
        }

        setEmployees(response.data.data || [])
      } catch (requestError) {
        if (!isActive) return

        setEmployees([])
        setError(requestError.response?.data?.message || requestError.message || 'Unable to retrieve employees.')
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    const debounce = window.setTimeout(loadEmployees, 250)

    return () => {
      isActive = false
      clearTimeout(debounce)
    }
  }, [departmentFilter, employmentStatus, employmentType, hiredFrom, refreshKey, search])

  const availablePositions = configuration.positions.filter(
    (position) => String(position.department_id) === String(employeeForm.department_id),
  )

  const handleEmployeeFormChange = (event) => {
    const { name, value, type, checked } = event.target
    setEmployeeForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'department_id' ? { position_id: '' } : {}),
    }))
  }

  const selectOffer = (event) => {
    const offer = offers.find((candidate) => String(candidate.application_id) === event.target.value)
    if (requestedOffer) {
      setAdding(true)
      setSearchParams({}, { replace: true })
    }
    setEmployeeForm((previous) => employeeFromOffer(previous, offer))
  }

  const beginEdit = (employee) => {
    setAdding(true)
    setEditingEmployeeId(employee.employee_id)
    setEmployeeForm({
      employee_number: employee.employee_number || '',
      first_name: employee.first_name || '',
      middle_name: employee.middle_name || '',
      last_name: employee.last_name || '',
      gender: employee.gender || 'Female',
      date_of_birth: employee.date_of_birth || '',
      national_id: employee.national_id || '',
      email: employee.email || '',
      phone: employee.phone || '',
      address: employee.address || '',
      department_id: employee.department_id || '',
      position_id: employee.position_id || '',
      employment_type: employee.employment_type || 'Full-Time',
      hire_date: employee.hire_date || '',
      basic_salary: '',
      create_account: false,
      username: '',
    })
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetEmployeeForm = () => {
    setAdding(false)
    setEditingEmployeeId(null)
    setEmployeeForm(emptyEmployeeForm)
    if (requestedOffer) setSearchParams({}, { replace: true })
  }

  const saveEmployee = async (event) => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const endpoint = editingEmployeeId ? '/api/employees/update.php' : '/api/employees/create.php'
      const { basic_salary: basicSalary, create_account: createAccount, application_id: applicationId, username, ...employeeFields } = employeeForm
      const response = await apiClient.post(endpoint, {
        ...employeeFields,
        hire_date: fields.get('hire_date'),
        date_of_birth: fields.get('date_of_birth') || null,
        national_id: employeeForm.national_id || null,
        department_id: Number(employeeForm.department_id),
        position_id: Number(employeeForm.position_id),
        ...(editingEmployeeId ? { employee_id: editingEmployeeId } : {
          ...(applicationId ? { application_id: applicationId } : {}),
          ...(basicSalary ? { basic_salary: basicSalary } : {}),
          ...(createAccount ? { create_account: true, ...(username ? { username } : {}) } : {}),
        }),
      })
      setNewAccount(response.data?.data?.account || null)
      setSuccess(editingEmployeeId ? 'Employee information updated.' : applicationId ? 'Applicant hired and onboarding checklist created.' : 'Employee record created.')
      resetEmployeeForm()
      setRefreshKey((value) => value + 1)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The employee record could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const changeEmployeeStatus = async (employee, nextStatus) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await apiClient.post('/api/employees/status.php', {
        employee_id: employee.employee_id,
        employment_status: nextStatus,
      })
      setSuccess(`${employee.first_name} ${employee.last_name} is now ${nextStatus.toLowerCase()}.`)
      setRefreshKey((value) => value + 1)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Employment status could not be changed.')
    } finally {
      setSaving(false)
    }
  }

  const statusOptions = ['Active', 'Inactive', 'Suspended', 'Terminated']
  const typeOptions = ['Full-Time', 'Part-Time', 'Contract', 'Temporary']

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="panel-surface mb-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">HRMS</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Employee Directory</h1>
              {isManager && <p className="mt-2 text-sm text-slate-700">
                <strong>{teamDepartments.length > 1 ? 'Team departments' : 'Team department'}</strong>
                {' '}{teamDepartmentStatus === 'loading' ? 'Loading' : teamDepartmentStatus === 'error' ? 'Unavailable' : teamDepartments.map((department) => department.department_name).join(', ') || 'None assigned'}
              </p>}
            </div>

            <Link to="/dashboard" className="action-button-secondary">
              Back to Dashboard
            </Link>
          </div>
        </header>

        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {newAccount && (
          <div role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p className="font-semibold">Login account created. Share these details with the employee now.</p>
            <p className="mt-2">Username: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{newAccount.username}</code></p>
            <p className="mt-1">Temporary password: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{newAccount.temporary_password}</code></p>
            <p className="mt-2 text-xs">This password is shown only once and is not stored anywhere readable. The employee must choose their own password at first sign-in.</p>
            <button type="button" onClick={() => setNewAccount(null)} className="action-button-secondary mt-3">I have noted it, dismiss</button>
          </div>
        )}
        {success && <div role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

        {canManageEmployees && (
          <section className="panel-surface mb-6 p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="section-label">HR administration</p>
                <h2 className="mt-2 text-lg font-bold text-slate-900">{editingEmployeeId ? 'Edit employee' : 'Add employee'}</h2>
                <p className="mt-1 text-sm text-slate-600">Nexa assigns an employee number when you save. Select the department and position by name.</p>
              </div>
              {adding || requestedOffer
                ? <button type="button" onClick={resetEmployeeForm} className="action-button-secondary">Close employee form</button>
                : <button type="button" onClick={() => setAdding(true)} className="action-button-primary">New employee</button>}
            </div>

            {(adding || requestedOffer) && <form onSubmit={saveEmployee} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {!editingEmployeeId && (
                <label className="md:col-span-2 xl:col-span-4">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Start from a recruitment offer</span>
                  <select value={employeeForm.application_id} onChange={selectOffer} className="field-input">
                    <option value="">Enter employee details manually</option>
                    {offers.map((offer) => <option key={offer.application_id} value={offer.application_id}>{offer.full_name} — {offer.title}</option>)}
                  </select>
                  {offerError && <span className="mt-1 block text-sm text-red-700">{offerError}</span>}
                  {employeeForm.application_id && <span className="mt-1 block text-sm text-slate-600">Review the suggested details before saving. Saving marks the applicant hired and opens their onboarding checklist.</span>}
                </label>
              )}
              <fieldset className="col-span-full grid min-w-0 gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <legend className="px-2 text-sm font-semibold text-slate-900">Personal details</legend>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Employee number</span><input readOnly value={employeeForm.employee_number || (editingEmployeeId ? 'Legacy record' : 'Assigned when saved')} className="field-input" /></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">First name</span><input required name="first_name" value={employeeForm.first_name} onChange={handleEmployeeFormChange} className="field-input" /></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Middle name</span><input name="middle_name" value={employeeForm.middle_name} onChange={handleEmployeeFormChange} className="field-input" /></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Last name</span><input required name="last_name" value={employeeForm.last_name} onChange={handleEmployeeFormChange} className="field-input" /></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Gender</span><select required name="gender" value={employeeForm.gender} onChange={handleEmployeeFormChange} className="field-input"><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Date of birth</span><input type="date" name="date_of_birth" value={employeeForm.date_of_birth} onChange={handleEmployeeFormChange} className="field-input" /></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">National ID</span><input name="national_id" value={employeeForm.national_id} onChange={handleEmployeeFormChange} className="field-input" autoComplete="off" /></label>
              </fieldset>
              <fieldset className="col-span-full grid min-w-0 gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <legend className="px-2 text-sm font-semibold text-slate-900">Contact details</legend>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Email</span><input required type="email" name="email" value={employeeForm.email} onChange={handleEmployeeFormChange} className="field-input" /></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Phone</span><input name="phone" value={employeeForm.phone} onChange={handleEmployeeFormChange} className="field-input" /></label>
              <label className="md:col-span-2 xl:col-span-1"><span className="mb-2 block text-sm font-medium text-slate-700">Address</span><input name="address" value={employeeForm.address} onChange={handleEmployeeFormChange} className="field-input" /></label>
              </fieldset>
              <fieldset className="col-span-full grid min-w-0 gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <legend className="px-2 text-sm font-semibold text-slate-900">Employment details</legend>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Hire date</span><input required type="date" name="hire_date" value={employeeForm.hire_date} onChange={handleEmployeeFormChange} className="field-input" /></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Department</span><select required name="department_id" value={employeeForm.department_id} onChange={handleEmployeeFormChange} className="field-input"><option value="">Select department</option>{configuration.departments.map((department) => <option key={department.department_id} value={department.department_id}>{department.department_code ? `${department.department_code} · ` : ''}{department.department_name}</option>)}</select></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Position</span><select required name="position_id" value={employeeForm.position_id} onChange={handleEmployeeFormChange} disabled={!employeeForm.department_id} className="field-input"><option value="">Select position</option>{availablePositions.map((position) => <option key={position.position_id} value={position.position_id}>{position.position_name}</option>)}</select></label>
              <label><span className="mb-2 block text-sm font-medium text-slate-700">Employment type</span><select required name="employment_type" value={employeeForm.employment_type} onChange={handleEmployeeFormChange} className="field-input"><option value="Full-Time">Full-Time</option><option value="Part-Time">Part-Time</option><option value="Contract">Contract</option><option value="Temporary">Temporary</option></select></label>
              </fieldset>
              {!editingEmployeeId && (
                <>
                  <label><span className="mb-2 block text-sm font-medium text-slate-700">Basic salary (optional, ZMW)</span><input type="number" min="0" step="0.01" name="basic_salary" value={employeeForm.basic_salary} onChange={handleEmployeeFormChange} className="field-input" placeholder="e.g. 7500.00" /></label>
                  <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"><input type="checkbox" name="create_account" checked={employeeForm.create_account} onChange={handleEmployeeFormChange} />Create a login account with a temporary password</label>
                  {employeeForm.create_account && <label><span className="mb-2 block text-sm font-medium text-slate-700">Username (optional)</span><input name="username" value={employeeForm.username} onChange={handleEmployeeFormChange} className="field-input" placeholder="Defaults to first.last" autoComplete="off" /></label>}
                </>
              )}
              <button type="submit" disabled={saving || configuration.departments.length === 0} className="action-button-primary md:col-span-2 xl:col-span-4">{saving ? 'Saving employee...' : editingEmployeeId ? 'Save employee changes' : 'Add employee'}</button>
            </form>}
          </section>
        )}

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="panel-surface p-5">
            <p className="section-label">Data source</p>
            <p className="mt-2 text-lg font-bold text-slate-900">Employee JSON API</p>
          </div>

          <div className="panel-surface p-5">
            <p className="section-label">Status</p>
            <p className={`mt-2 text-lg font-bold ${error ? 'text-red-600' : loading ? 'text-amber-600' : 'text-emerald-600'}`}>
              {error ? 'Unavailable' : loading ? 'Loading' : 'Connected'}
            </p>
          </div>

          <div className="panel-surface p-5">
            <p className="section-label">Frontend readiness</p>
            <p className="mt-2 text-lg font-bold text-slate-900">Live employee records</p>
          </div>
        </section>

        <section className="panel-surface mb-6 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Employee search and filters</h2>
              <p className="mt-1 text-sm text-slate-600">
                Search by employee number or name and filter the live employee records.
              </p>
            </div>

            <fieldset className="flex flex-wrap items-end gap-3">
              <legend className="sr-only">Employee search and filter controls</legend>
              <div>
                <label htmlFor="employee-search" className="sr-only">Search by employee ID, number, or name</label>
                <input
                  id="employee-search"
                  type="search"
                  placeholder="Search employees"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-describedby="employee-filter-status"
                  className="field-input w-full sm:w-64"
                />
              </div>
              <div>
                <label htmlFor="employment-status" className="sr-only">Filter by employment status</label>
                <select
                  id="employment-status"
                  value={employmentStatus}
                  onChange={(event) => setSearchParams((previous) => {
                  const next = new URLSearchParams(previous)
                  if (event.target.value) next.set('status', event.target.value)
                  else next.delete('status')
                  return next
                })}
                  aria-describedby="employee-filter-status"
                  className="field-input w-full sm:w-48"
                >
                  <option value="">All statuses</option>
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="employment-type" className="sr-only">Filter by employment type</label>
                <select
                  id="employment-type"
                  value={employmentType}
                  onChange={(event) => setEmploymentType(event.target.value)}
                  aria-describedby="employee-filter-status"
                  className="field-input w-full sm:w-48"
                >
                  <option value="">All types</option>
                  {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              {(!isManager || teamDepartments.length > 1) && <label className="text-sm font-medium">Department<select className="field-input mt-1" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="">All departments</option>{(isManager ? teamDepartments : configuration.departments).map((entry) => <option key={entry.department_id} value={entry.department_id}>{entry.department_name}</option>)}</select></label>}
              <label className="text-sm font-medium">Hired on or after<input className="field-input mt-1" type="date" value={hiredFrom} onChange={(event) => setHiredFrom(event.target.value)} /></label>
            </fieldset>
          </div>
          <p id="employee-filter-status" role="status" className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Search by full name, employee number, or ID. Filters work together.
          </p>
        </section>

        <section className="panel-surface p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Employee roster</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {loading ? 'Loading records' : `${employees.length} records`}
            </span>
          </div>

          {loading && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-6 text-center text-sm text-sky-700" role="status">
              Loading employee records...
            </div>
          )}

          {!loading && !error && employees.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-base font-semibold text-slate-800">No employees match the current filters.</p>
              <p className="mt-2 text-sm text-slate-600">Try a different search or filter.</p>
            </div>
          )}

          {!loading && !error && employees.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="responsive-record-table min-w-full text-left text-sm" role="table">
                <thead role="rowgroup" className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr role="row">
                    <th role="columnheader" scope="col" className="px-4 py-3 font-semibold">ID</th>
                    <th role="columnheader" scope="col" className="px-4 py-3 font-semibold">Employee number</th>
                    <th role="columnheader" scope="col" className="px-4 py-3 font-semibold">Name</th>
                    {!isManager && <th role="columnheader" scope="col" className="px-4 py-3 font-semibold">Department</th>}
                    <th role="columnheader" scope="col" className="px-4 py-3 font-semibold">Position</th>
                    <th role="columnheader" scope="col" className="px-4 py-3 font-semibold">Employment type</th>
                    <th role="columnheader" scope="col" className="px-4 py-3 font-semibold">Status</th>
                    {canManageEmployees && <th role="columnheader" scope="col" className="px-4 py-3 font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-200">
                  {employees.map((employee) => (
                    <tr role="row" key={employee.employee_id} className="bg-white">
                      <td role="cell" data-label="ID" className="px-4 py-3 text-slate-700">{employee.employee_id}</td>
                      <td role="cell" data-label="Employee number" className="px-4 py-3 text-slate-700">{employee.employee_number}</td>
                      <td role="cell" data-label="Name" className="px-4 py-3 font-medium text-slate-900">{employee.first_name} {employee.last_name}</td>
                      {!isManager && <td role="cell" data-label="Department" className="px-4 py-3 text-slate-700">{employee.department_name || 'Unassigned'}</td>}
                      <td role="cell" data-label="Position" className="px-4 py-3 text-slate-700">{employee.position_name || 'Unassigned'}</td>
                      <td role="cell" data-label="Employment type" className="px-4 py-3 text-slate-700">{employee.employment_type}</td>
                      <td role="cell" data-label="Status" className="px-4 py-3 text-slate-700">{employee.employment_status}</td>
                      {canManageEmployees && (
                        <td role="cell" data-label="Actions" className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={saving} onClick={() => beginEdit(employee)} className="action-button-secondary">Edit</button>
                            <button type="button" disabled={saving} onClick={() => changeEmployeeStatus(employee, employee.employment_status === 'Active' ? 'Inactive' : 'Active')} className="action-button-secondary">{employee.employment_status === 'Active' ? 'Deactivate' : 'Reactivate'}</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default EmployeeDirectory
