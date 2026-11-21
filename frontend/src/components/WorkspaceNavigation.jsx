import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import { isLockedByOnboarding, readStoredUser, refreshSession } from '../api/session'

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
  const [loadState, setLoadState] = useState('loading')
  const [readError, setReadError] = useState('')
  const [readMessage, setReadMessage] = useState('')
  const [open, setOpen] = useState(false)
  const [revision, refreshNotifications] = useState(0)
  const container = useRef(null)
  const trigger = useRef(null)
  const location = useLocation()
  const unreadItems = items.filter((item) => !item.read_at)
  const readItems = items.filter((item) => item.read_at)
  const unread = unreadItems.length
  const unreadHeading = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    apiClient.get('/api/notifications/get.php', { params: { limit: 20 }, signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return
      setItems(data.data || [])
      setLoadState('ready')
    }).catch(() => { if (!controller.signal.aborted) setLoadState('error') })
    return () => controller.abort()
  }, [location.key, revision])

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  useEffect(() => {
    if (!open) return undefined
    const dismissOutside = (event) => {
      if (!container.current?.contains(event.target)) setOpen(false)
    }
    const dismissWithEscape = (event) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissWithEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissWithEscape)
    }
  }, [open])

  async function markRead(item, button) {
    if (item.read_at) return
    setReadError('')
    setReadMessage('')
    try {
      const send = () => apiClient.post('/api/notifications/read.php', { notification_id: item.notification_id })
      const { data } = await send().catch(async (failure) => {
        if (failure.response?.status !== 403 || !failure.response?.data?.message?.includes('X-CSRF-Token')) throw failure
        await refreshSession()
        return send()
      })
      if (button && document.activeElement === button) unreadHeading.current?.focus()
      if (button) setReadMessage('Notification marked as read.')
      setItems((previous) => previous.map((entry) => entry.notification_id === item.notification_id
        ? { ...entry, read_at: data.data.read_at }
        : entry))
    } catch (failure) {
      setReadError(failure.response?.data?.message || 'Could not mark this notification as read. Try again.')
    }
  }

  return (
    <div ref={container}>
      <button ref={trigger} type="button" className="action-button-secondary" aria-expanded={open}
        aria-controls="workspace-notifications" aria-label={`Notifications, ${unread} unread`}
        onClick={() => {
          setReadError('')
          setReadMessage('')
          if (!open) refreshNotifications((value) => value + 1)
          setOpen(!open)
        }}>
        Notifications{unread > 0 ? ` (${unread})` : ''}
      </button>
      {open && <div id="workspace-notifications" className="notification-popover" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        <div className="notification-popover__heading">
          <div><strong>Notifications</strong><small className="ml-2" role="status">{unread} unread</small></div>
          <button type="button" className="action-button-secondary" onClick={close}>Close</button>
        </div>
        {loadState === 'loading' && <p className="notification-empty" role="status">Loading notifications.</p>}
        {loadState === 'error' && <p className="notification-empty" role="alert">Could not load notifications. Reopen this menu to retry.</p>}
        {readError && <p className="notification-empty" role="alert">{readError}</p>}
        {loadState === 'ready' && !items.length && <p className="notification-empty">You're all caught up.</p>}
        <p className="sr-only" role="status">{readMessage}</p>
        {items.length > 0 && [
          { title: 'Unread', entries: unreadItems, initiallyOpen: true },
          { title: 'Read', entries: readItems, initiallyOpen: false },
        ].map(({ title, entries, initiallyOpen }) => (
          <details key={title} open={initiallyOpen}>
            <summary ref={initiallyOpen ? unreadHeading : null} className="min-h-11 cursor-pointer border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              {title} ({entries.length})
            </summary>
            {entries.length === 0 && <p className="notification-empty">No {title.toLowerCase()} notifications.</p>}
            {entries.map((item) => {
              const target = destination(item, user)
              return (
                <div key={item.notification_id} className={'notification-item' + (item.read_at ? '' : ' notification-item--unread')}>
                  <span>{item.title}</span>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {target && <Link className="inline-flex min-h-11 items-center font-semibold text-sky-800 underline underline-offset-2" to={target.path}
                      onClick={() => { void markRead(item); setOpen(false) }}>Open {target.label}</Link>}
                    {!item.read_at && <button type="button" className="min-h-11 font-semibold text-sky-800"
                      onClick={(event) => markRead(item, event.currentTarget)}>Mark as read</button>}
                  </div>
                </div>
              )
            })}
          </details>
        ))}
      </div>}
    </div>
  )
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

  return <nav className="workspace-header relative z-40 border-b border-slate-200 bg-white px-2 py-2 sm:px-6 print:hidden" aria-label="Nexa workspace navigation">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
      <details ref={menu} className="relative" onKeyDown={(event) => { if (event.key === 'Escape') menu.current.open = false }}>
        <summary className="action-button-secondary cursor-pointer list-none">Menu <span aria-hidden="true">▾</span></summary>
        <div className="absolute left-0 top-full mt-2 grid max-h-[65vh] w-56 gap-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {available.map(([path, label]) => <NavLink key={path} to={path} end={path !== '/dashboard'} onClick={() => { menu.current.open = false }} className={({ isActive }) => `flex min-h-11 items-center rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-sky-50 font-semibold text-sky-900' : 'text-slate-700 hover:bg-slate-100'}`}>{label}</NavLink>)}
          {['calendar', 'help'].map((page) => <NavLink key={page} to={`/${page}`} onClick={() => { menu.current.open = false }}
            className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm capitalize sm:hidden">{page}</NavLink>)}
        </div>
      </details>
      <span className="mr-auto hidden text-sm font-semibold text-slate-700 sm:inline">{here}</span>
      <div className="workspace-header-links hidden items-center gap-2 sm:flex">
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
