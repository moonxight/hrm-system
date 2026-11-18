import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import { isLockedByOnboarding, readStoredUser } from '../api/session'

const leads = ['Admin', 'HR', 'Manager']
const hr = ['Admin', 'HR']
const links = [
  ['/dashboard', 'Dashboard'], ['/onboarding', 'Onboarding'], ['/documents', 'Documents'],
  ['/employees', 'Employee directory', leads], ['/recruitment', 'Recruitment', leads],
  ['/leave', 'Leave'], ['/attendance', 'Attendance'], ['/progress-tracker', 'Progress tracker'],
  ['/benefits', 'Benefits'], ['/payslip', 'Payslips'], ['/payroll', 'Payroll', leads],
  ['/reports', 'Reports', hr], ['/access', 'People access', ['Admin']],
]

function destination(notification, user) {
  const { entity, entity_id: id, application_id: application } = notification
  if (!/^[1-9]\d*$/.test(String(id))) return null
  const places = {
    onboarding: ['/onboarding', 'case', 'Onboarding'],
    onboarding_documents: ['/onboarding', 'document', 'Document checklist'],
    onboarding_forms: ['/onboarding', 'form', 'Onboarding form'],
    leave_requests: ['/leave', 'request', 'Leave request'],
    payroll: ['/payslip', 'payroll', 'Payslip'],
    progress_records: ['/progress-tracker', 'record', 'Progress record'],
    job_applications: ['/recruitment', 'application', 'Candidate', leads],
    training_enrollments: ['/progress-tracker#training', '', 'Training progress'],
  }
  if (entity === 'interviews' && application && leads.includes(user.role_name)) {
    return { path: `/recruitment?application=${application}&interview=${id}`, label: 'Interview' }
  }
  const place = places[entity]
  if (!place) return null
  const [route, key, label, roles] = place
  if ((roles && !roles.includes(user.role_name)) || isLockedByOnboarding(user, route.split('#')[0])) return null
  return { path: key ? `${route}?${key}=${id}` : route, label }
}

function NotificationMenu({ user }) {
  const [items, setItems] = useState([])
  const [state, setState] = useState('loading')
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const unread = items.filter((item) => !item.read_at).length

  useEffect(() => {
    let active = true
    apiClient.get('/api/notifications/get.php', { params: { limit: 20 } }).then(({ data }) => {
      if (!active) return
      setItems(data.data || [])
      setState('ready')
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [location.key, open])

  async function markRead(item) {
    if (item.read_at) return
    try {
      await apiClient.post('/api/notifications/read.php', { notification_id: item.notification_id })
      setItems((previous) => previous.map((entry) => entry.notification_id === item.notification_id ? { ...entry, read_at: new Date().toISOString() } : entry))
    } catch { setState('error') }
  }

  return <div onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}>
    <button type="button" className="action-button-secondary" aria-expanded={open} aria-label={`Notifications, ${unread} unread`} onClick={() => setOpen(!open)}>Notifications{unread > 0 ? ` (${unread})` : ''}</button>
    {open && <div className="notification-popover" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
      <div className="notification-popover__heading"><strong>Notifications</strong><small>{unread} unread</small></div>
      {state === 'loading' && <p className="notification-empty" role="status">Loading notifications…</p>}
      {state === 'error' && <p className="notification-empty" role="alert">Could not update notifications. Reopen this menu to retry.</p>}
      {state === 'ready' && !items.length && <p className="notification-empty">You’re all caught up.</p>}
      {items.map((item) => {
        const target = destination(item, user)
        const style = `notification-item${item.read_at ? '' : ' notification-item--unread'}`
        return target ? <Link key={item.notification_id} className={style} to={target.path} onClick={() => { void markRead(item); setOpen(false) }}><span>{item.title}</span><small>Open {target.label}</small></Link> :
          <button type="button" key={item.notification_id} className={style} onClick={() => markRead(item)}><span>{item.title}</span><small>{item.read_at ? 'Read' : 'Mark as read'}</small></button>
      })}
    </div>}
  </div>
}

export default function WorkspaceNavigation() {
  const user = readStoredUser()
  const location = useLocation()
  const navigate = useNavigate()
  const menu = useRef(null)
  const [signingOut, setSigningOut] = useState(false)
  if (!user?.role_name || user.must_change_password || ['/', '/login', '/terms', '/change-password'].includes(location.pathname)) return null
  const available = links.filter(([path, , roles]) => (!roles || roles.includes(user.role_name)) && !isLockedByOnboarding(user, path))
  const here = links.find(([path]) => path === location.pathname)?.[1] || (location.pathname === '/dashboard/employee' ? 'Dashboard' : 'Workspace')

  async function signOut() {
    setSigningOut(true)
    try {
      await apiClient.post('/api/auth/logout.php')
    } catch {
      // Clear local credentials even when the server is unavailable.
    } finally {
      localStorage.removeItem('hrms_user')
      sessionStorage.removeItem('hrms_csrf_token')
      setSigningOut(false)
      navigate('/login', { replace: true })
    }
  }

  return <nav className="relative z-40 border-b border-slate-200 bg-white px-3 py-2 sm:px-6 print:hidden" aria-label="Nexa workspace navigation">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
      <details ref={menu} className="relative" onKeyDown={(event) => { if (event.key === 'Escape') menu.current.open = false }}>
        <summary className="action-button-secondary cursor-pointer list-none">Menu <span aria-hidden="true">▾</span></summary>
        <div className="absolute left-0 top-full mt-2 grid max-h-[65vh] w-56 gap-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {available.map(([path, label]) => <NavLink key={path} to={path} end={path !== '/dashboard'} onClick={() => { menu.current.open = false }} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-sky-50 font-semibold text-sky-900' : 'text-slate-700 hover:bg-slate-100'}`}>{label}</NavLink>)}
        </div>
      </details>
      <span className="mr-auto hidden text-sm font-semibold text-slate-700 sm:inline">{here}</span>
      <div className="flex items-center gap-2">
        <NavLink to="/calendar" className="action-button-secondary">Calendar</NavLink>
        <NavLink to="/help" className="action-button-secondary">Help</NavLink>
      </div>
      <div className="relative ml-auto flex items-center gap-2 sm:ml-0">
        <NotificationMenu user={user} />
        <button type="button" onClick={signOut} disabled={signingOut} className="min-h-11 whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-60">
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  </nav>
}
