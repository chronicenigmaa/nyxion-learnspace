'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

export default function FeedbackPage() {
  const [form, setForm] = useState({
    submission_text: '', marks_obtained: '', max_marks: '',
    subject: '', assignment_title: ''
  })
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.submission_text || !form.marks_obtained || !form.max_marks || !form.subject) {
      setError('Please fill in all required fields.'); return
    }
    setLoading(true); setError(''); setResult('')
    try {
      const { data } = await api.post('/api/v1/ai/feedback-writer', {
        ...form,
        marks_obtained: parseFloat(form.marks_obtained),
        max_marks: parseFloat(form.max_marks),
      })
      setResult(data.response)
    } catch (e: any) { setError(e.response?.data?.detail || e.message || 'Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Feedback Writer</h1>
      <p className="text-slate-400 text-sm mb-6">Generate personalised student feedback based on their submission and marks</p>
      <div className="p-5 rounded-xl border border-[var(--border)] mb-4" style={{ background: 'var(--surface-850)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Subject</label>
            <input className="input w-full" placeholder="e.g. English"
              value={form.subject} onChange={e => set('subject', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Assignment Title (optional)</label>
            <input className="input w-full" placeholder="e.g. Descriptive Essay"
              value={form.assignment_title} onChange={e => set('assignment_title', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Marks Obtained</label>
            <input className="input w-full" type="number" placeholder="e.g. 72"
              value={form.marks_obtained} onChange={e => set('marks_obtained', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Max Marks</label>
            <input className="input w-full" type="number" placeholder="e.g. 100"
              value={form.max_marks} onChange={e => set('max_marks', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-400 mb-1">Student Submission</label>
            <textarea className="input w-full h-36 resize-none" placeholder="Paste the student's submission..."
              value={form.submission_text} onChange={e => set('submission_text', e.target.value)} />
          </div>
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Writing feedback...' : 'Generate Feedback'}
        </button>
      </div>
      {result && (
        <div className="p-5 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface-850)' }}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white font-medium">Generated Feedback</h2>
            <button className="text-xs text-slate-400 hover:text-white"
              onClick={() => navigator.clipboard.writeText(result)}>Copy</button>
          </div>
          <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{result}</pre>
        </div>
      )}
    </div>
  )
}