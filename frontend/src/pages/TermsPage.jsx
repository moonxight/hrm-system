import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { readStoredUser } from '../api/session'

function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--nexa-canvas)] px-4 py-8 sm:px-6">
      <article className="panel-surface mx-auto max-w-3xl p-6 sm:p-10">
        <BrandMark />
        <h1 className="mt-6 text-3xl font-bold">Terms of use</h1>
        <p className="mt-2 text-slate-600">Nexa People demonstration workspace</p>
        <section className="mt-6 space-y-5 text-sm leading-relaxed text-slate-700">
          <div><h2 className="text-base font-semibold text-slate-900">Access</h2><p>Use the account assigned for your role. Keep its sign-in details within the demonstration group and sign out when you finish on a shared device.</p></div>
          <div><h2 className="text-base font-semibold text-slate-900">Sample data</h2><p>Use fictitious staff, contact details and documents. Keep real employee, identity, banking and payroll information out of this workspace.</p></div>
          <div><h2 className="text-base font-semibold text-slate-900">Payroll records</h2><p>Payment entries in this workspace are simulation records. Nexa People records dates, methods and references for review. Any money movement takes place separately.</p></div>
          <div><h2 className="text-base font-semibold text-slate-900">Activity and support</h2><p>Sign-ins and administrative actions may be logged for testing. The workspace owner may reset demonstration records. Ask the owner for account access or to report an issue.</p></div>
        </section>
        <Link to={readStoredUser() ? '/dashboard' : '/login'} className="action-button-secondary mt-8">Back to workspace</Link>
      </article>
    </main>
  )
}

export default TermsPage
