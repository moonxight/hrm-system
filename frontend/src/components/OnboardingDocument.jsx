import { useEffect, useRef, useState } from 'react'
import apiClient from '../api/client'

const types = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }

export default function OnboardingDocument({ document, own, reviewer, completed, onChanged, highlighted }) {
  const { document_id: id, document_status: status } = document
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null)
  const [reason, setReason] = useState('')
  const [history, setHistory] = useState(null)
  const target = useRef(null)
  const canUpload = own && !completed && ['Pending', 'Rejected'].includes(status)
  const canReview = reviewer && !own && status === 'Submitted'

  useEffect(() => {
    if (highlighted) target.current?.scrollIntoView({ block: 'center' })
  }, [highlighted])

  async function run(action, operation) {
    setBusy(action)
    setMessage(null)
    try {
      await operation()
    } catch (error) {
      setMessage({ error: true, text: error.response?.data?.message || error.message || 'The document action could not be completed.' })
    } finally {
      setBusy('')
    }
  }

  function upload(event) {
    event.preventDefault()
    const form = event.currentTarget
    const body = new FormData(form)
    const file = body.get('file')
    if (!file?.size || file.size > 5 * 1024 * 1024 || (file.type && !types[file.type])) {
      setMessage({ error: true, text: 'Choose a PDF, PNG, or JPEG up to 5 MB.' })
      return
    }
    body.append('document_id', id)
    run('upload', async () => {
      await apiClient.post('/api/documents/submit.php', body, { headers: { 'Content-Type': 'multipart/form-data' } })
      form.reset()
      setMessage({ text: 'File submitted. HR will review it.' })
      setHistory(null)
      onChanged()
    })
  }

  function review(decision) {
    if (decision === 'Rejected' && !reason.trim()) {
      setMessage({ error: true, text: 'Enter a reason so the employee knows what to replace.' })
      return
    }
    run(decision, async () => {
      await apiClient.post('/api/documents/verify.php', { document_id: id, document_status: decision, reason: reason.trim() })
      setMessage({ text: decision === 'Verified' ? 'Document verified.' : 'Changes requested. The employee can upload a replacement.' })
      setReason('')
      setHistory(null)
      onChanged()
    })
  }

  function download() {
    run('download', async () => {
      const { data } = await apiClient.get('/api/documents/download.php', { params: { document_id: id }, responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `document-${id}.${types[data.type] || 'bin'}`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }

  function toggleHistory() {
    if (history) { setHistory(null); return }
    run('history', async () => {
      const response = await apiClient.get('/api/documents/history.php', { params: { document_id: id } })
      setHistory(response.data.data || [])
    })
  }

  return (
    <article ref={target} id={`document-${id}`} className={`scroll-mt-24 rounded-xl border p-4 ${highlighted ? 'border-sky-400 bg-sky-50' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-semibold text-slate-900">{document.document_name}</h3><p className="text-sm text-slate-500">{document.document_type}</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : status === 'Rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'}`}>{status}</span>
      </div>
      {document.rejection_reason && <p className="mt-3 text-sm text-rose-800">Changes requested: {document.rejection_reason}</p>}
      {canUpload && <form onSubmit={upload} className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-medium text-slate-700">PDF, PNG, or JPEG up to 5 MB<input required type="file" name="file" accept=".pdf,.png,.jpg,.jpeg" className="field-input mt-1" /></label><button type="submit" disabled={Boolean(busy)} className="action-button-primary">{busy === 'upload' ? 'Uploading…' : status === 'Rejected' ? 'Upload replacement' : 'Submit file'}</button></form>}
      {(document.has_file || status !== 'Pending') && <div className="mt-4 flex flex-wrap gap-2">
        {document.has_file && <button type="button" className="action-button-secondary" disabled={Boolean(busy)} onClick={download}>{busy === 'download' ? 'Downloading…' : 'Download file'}</button>}
        <button type="button" className="action-button-secondary" aria-expanded={Boolean(history)} disabled={Boolean(busy)} onClick={toggleHistory}>{history ? 'Hide history' : busy === 'history' ? 'Loading…' : 'Review history'}</button>
      </div>}
      {canReview && <div className="mt-4 border-t border-slate-200 pt-4">
        <label className="block text-sm font-medium text-slate-700">Review reason (required to reject)<textarea className="field-input mt-1" rows="2" maxLength="5000" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="action-button-primary" disabled={Boolean(busy) || !document.has_file} onClick={() => review('Verified')}>Verify file</button><button type="button" className="action-button-secondary" disabled={Boolean(busy)} onClick={() => review('Rejected')}>Request replacement</button></div>
      </div>}
      {history && (history.length ? <ol className="mt-4 space-y-2 border-l-2 border-sky-200 pl-3 text-sm">
        {history.map((event) => <li key={event.history_id}><strong>{event.status}</strong> · {event.changed_by_name || 'Nexa'} · {new Date(event.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Lusaka' })}{event.reason && <p className="text-slate-600">{event.reason}</p>}</li>)}
      </ol> : <p className="mt-3 text-sm text-slate-600">No uploads or reviews yet.</p>)}
      {message && <p role={message.error ? 'alert' : 'status'} className={`mt-3 text-sm ${message.error ? 'text-rose-800' : 'text-emerald-800'}`}>{message.text}</p>}
    </article>
  )
}
