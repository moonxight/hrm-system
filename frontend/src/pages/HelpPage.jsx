import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isLockedByOnboarding, readStoredUser } from '../api/session'

export default function HelpPage() {
  const user = readStoredUser()
  const { hash } = useLocation()
  const reviewer = ['Admin', 'HR'].includes(user?.role_name)
  const manager = user?.role_name === 'Manager'

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  return <main className="min-h-screen bg-[var(--nexa-canvas)] p-4 sm:p-7">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="nexa-feature-header p-5 sm:p-7"><h1 className="text-3xl font-bold">Nexa Help</h1><p className="mt-1 text-sm text-slate-600">Find the right page and see who takes the next step.</p></header>
      <section id="onboarding" className="panel-surface scroll-mt-24 p-5 sm:p-7">
        <h2 className="text-xl font-bold">How onboarding works</h2>
        <ol className="mt-4 list-inside list-decimal space-y-3 text-sm text-slate-700">
          <li><strong>HR requests your files.</strong> Open Onboarding and check your start date, assigned HR contact and document checklist.</li>
          <li><strong>You submit the form and each requested file.</strong> Upload a PDF, PNG or JPEG up to 5 MB on the matching checklist item. The information form collects contact and protected banking details.</li>
          <li><strong>HR reviews each item.</strong> HR compares the file with the request and reviews the form separately. If changes are needed, read the reason and submit the corrected form or replacement file.</li>
          <li><strong>HR completes onboarding.</strong> Once every required document is verified and the required form is approved, HR signs off. Restricted workspace features then become available.</li>
        </ol>
        {reviewer && <p className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">Use the onboarding queue to select a person. Download the submitted file for review, record a decision and check its history before signing off. Rejections require a reason the employee can act on.</p>}
        {user?.role_name === 'Manager' && <p className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">Open Onboarding to see your assigned team’s case status and checklist counts. HR handles file and form review.</p>}
        <Link to="/onboarding" className="action-button-primary mt-4">Open onboarding</Link>
      </section>
      <section id="calendar" className="panel-surface scroll-mt-24 p-5 sm:p-7">
        <h2 className="text-xl font-bold">Find a date or follow a notification</h2>
        <p className="mt-3 text-sm text-slate-700">Use the month arrows and the event type filter in Calendar. Select a day to see the records you can access and open the one you need. Pending leave is labelled separately from approved leave.</p>
        <p className="mt-2 text-sm text-slate-700">Open Notifications at the top of the workspace and expand Unread or Read. An Open link takes you to the matching record and marks the notification as read.</p>
        <Link to="/calendar" className="action-button-primary mt-4">Open calendar</Link>
      </section>
      <section className="panel-surface p-5 sm:p-7">
        <h2 className="text-xl font-bold">Everyday tasks</h2>
        <ul className="mt-3 space-y-3 text-sm text-slate-700">
          <li><strong>Attendance.</strong> Check in at the start of your shift. Check out once your check-in is recorded.</li>
          {manager && <>
            <li><strong>Team leave.</strong> Filter by employee or status in Leave. HR and Admin decide requests.</li>
            <li><strong>Payroll drafts.</strong> In Payroll, choose an assigned employee and pay period. Create the draft, add any one-off items and calculate totals. Give HR the payroll ID to finalize it.</li>
          </>}
          {reviewer && <>
            <li><strong>Leave reviews.</strong> Open a pending request from Leave or Notifications. Approve it, or enter a reason and confirm rejection.</li>
            <li><strong>Finalize payroll.</strong> Open the draft in Payroll history, review the totals and select Process Payroll. Record the payment once it has been made.</li>
          </>}
          {user?.role_name === 'Employee' && !isLockedByOnboarding(user, '/leave') && (
            <li><strong>Request leave.</strong> Choose the leave type and dates. Check Leave or Notifications for the outcome.</li>
          )}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2"><Link to="/attendance" className="action-button-secondary">Open attendance</Link>{!isLockedByOnboarding(user, '/leave') && <Link to="/leave" className="action-button-secondary">Open leave</Link>}<Link to="/terms" className="action-button-secondary">Terms of use</Link></div>
      </section>
    </div>
  </main>
}
