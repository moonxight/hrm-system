import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import { readStoredUser } from '../api/session'

const zone = 'Africa/Lusaka'
const labels = { leave: 'Leave', interview: 'Interview', onboarding: 'New starter' }
const tones = { leave: 'bg-sky-100 text-sky-900', interview: 'bg-violet-100 text-violet-900', onboarding: 'bg-emerald-100 text-emerald-900' }
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const todayKey = () => new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(new Date())
const key = (date) => date.toISOString().slice(0, 10)

function source(event) {
  if (event.kind === 'leave') return `/leave?request=${event.record_id}`
  if (event.kind === 'interview') return `/recruitment?application=${event.application_id}&interview=${event.record_id}`
  return `/onboarding?case=${event.record_id}`
}

export default function CalendarPage() {
  const [today] = useState(todayKey)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState(today)
  const [kind, setKind] = useState('')
  const [result, setResult] = useState({ month: '', events: [], error: '' })
  const user = readStoredUser()
  const [year, number] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, number - 1, 1))
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate()
  const padding = (first.getUTCDay() + 6) % 7
  const monthName = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  useEffect(() => {
    let active = true
    apiClient.get('/api/calendar/get.php', { params: { from: `${month}-01`, to: `${month}-${days}` } }).then(({ data }) => {
      if (active) setResult({ month, events: data.data || [], error: '' })
    }).catch((error) => {
      if (active) setResult({ month, events: [], error: error.response?.data?.message || 'Calendar could not be loaded.' })
    })
    return () => { active = false }
  }, [month, days])

  function changeMonth(offset) {
    const next = key(new Date(Date.UTC(year, number - 1 + offset, 1)))
    setMonth(next.slice(0, 7))
    setSelected(next)
  }

  const events = result.month === month ? result.events.filter((event) => !kind || kind === event.kind) : []
  const onDay = (date) => events.filter((event) => event.start_date <= date && event.end_date >= date)
  const selectedEvents = onDay(selected)

  return <main className="min-h-screen bg-[var(--nexa-canvas)] p-4 sm:p-7">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="nexa-feature-header flex flex-wrap items-end justify-between gap-4 p-5 sm:p-7">
        <div><h1 className="text-3xl font-bold">Calendar</h1><p className="mt-1 text-sm text-slate-600">{user?.onboarding_required ? 'Your new-starter dates.' : 'Leave, new-starter dates and interviews available to your role.'} Times are shown in Lusaka time.</p></div>
        <Link to="/help#calendar" className="action-button-secondary">Calendar help</Link>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <section className="panel-surface min-w-0 p-3 sm:p-5" aria-label="Month view">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold" aria-live="polite">{monthName}</h2>
            <div className="flex flex-wrap gap-2"><button type="button" className="action-button-secondary" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button><button type="button" className="action-button-secondary" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today) }}>Today</button><button type="button" className="action-button-secondary" aria-label="Next month" onClick={() => changeMonth(1)}>›</button></div>
          </div>
          <label className="mb-3 block text-sm font-medium">Event type<select className="field-input mt-1 sm:max-w-56" value={kind} onChange={(event) => setKind(event.target.value)}><option value="">All events</option>{!user?.onboarding_required && <option value="leave">Leave</option>}<option value="onboarding">New starters</option>{user?.role_name !== 'Employee' && <option value="interview">Interviews</option>}</select></label>
          {result.month !== month && <p className="mb-2 text-sm" role="status">Loading calendar…</p>}
          {result.month === month && result.error && <p className="form-message form-message--error mb-2" role="alert">{result.error}</p>}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {dayNames.map((name) => <div key={name} className="pb-1 text-center text-xs font-semibold text-slate-500">{name}</div>)}
            {Array.from({ length: padding }, (_, index) => <div key={`pad-${index}`} aria-hidden="true" />)}
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1
              const date = `${month}-${String(day).padStart(2, '0')}`
              const entries = onDay(date)
              const categories = [...new Set(entries.map((entry) => entry.kind))]
              return <button key={date} type="button" aria-pressed={selected === date} aria-current={today === date ? 'date' : undefined} aria-label={`${day} ${monthName}, ${entries.length} events`} className={`min-h-14 min-w-0 rounded-lg border p-1 text-sm sm:min-h-20 sm:p-2 ${selected === date ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'}`} onClick={() => setSelected(date)}>
                <span className={today === date ? 'rounded bg-sky-700 px-1.5 py-0.5 font-bold text-white' : 'font-semibold'}>{day}</span>
                <span className="mt-1 flex flex-wrap items-center justify-center gap-0.5" aria-hidden="true">{categories.map((category) => <span key={category} className={`rounded px-1 text-[10px] font-semibold ${tones[category]}`}>{labels[category][0]}</span>)}</span>
              </button>
            })}
          </div>
        </section>
        <section className="panel-surface p-5" aria-label="Selected day details">
          <h2 className="text-lg font-bold">{new Date(`${selected}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</h2>
          {result.month === month && !result.error && (selectedEvents.length ? <ul className="mt-3 space-y-3">{selectedEvents.map((event) => <li key={`${event.kind}-${event.record_id}`} className="rounded-xl border border-slate-200 p-3">
            <span className={`rounded px-2 py-1 text-xs font-semibold ${tones[event.kind]}`}>{labels[event.kind]}</span>
            <p className="mt-2 font-semibold">{event.title}</p><p className="text-sm text-slate-600">{event.time ? `${event.time} · ` : ''}{event.status}</p>
            {event.start_date !== event.end_date && <p className="text-xs text-slate-600">{event.start_date} to {event.end_date}</p>}
            <Link className="action-button-secondary mt-2" to={source(event)}>Open {labels[event.kind].toLowerCase()}</Link>
          </li>)}</ul> : <p className="mt-3 text-sm text-slate-600">No events on this day.</p>)}
          <div className="mt-5 flex flex-wrap gap-2 text-xs" aria-label="Calendar legend">{Object.entries(labels).filter(([category]) => category === 'onboarding' || (!user?.onboarding_required && (category === 'leave' || user?.role_name !== 'Employee'))).map(([category, label]) => <span key={category} className={`rounded px-2 py-1 ${tones[category]}`}>{label[0]} · {label}</span>)}</div>
        </section>
      </div>
    </div>
  </main>
}
