'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

export default function RubricPage() {
  const [form, setForm] = useState({
    assignment_title: '', subject: '', max_marks: '', description: ''
  })
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.assignment_title || !form.subject || !form.max_marks) {
      setError('Please fill in title, subject, and max marks.'); return
    }
    setLoading(true); setError(''); setResult('')
    try {
      const { data } = await api.post('/api/v1/ai/rubric-generator', {
        ...form, max_marks: parseInt(form.max_marks)
      })
      setResult(data.response)
    } catch (e: any) { setError(e.response?.data?.detail || e.message || 'Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Rubric Generator</h1>
      <p className="text-slate-400 text-sm mb-6">Create detailed marking rubrics for any assignment</p>
      <div className="p-5 rounded-xl border border-[var(--border)] mb-4" style={{ background: 'var(--surface-850)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Assignment Title</label>
            <input className="input w-full" placeholder="e.g. Lab Report"
              value={form.assignment_title} onChange={e => set('assignment_title', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Subject</label>
            <input className="input w-full" placeholder="e.g. Chemistry"
              value={form.subject} onChange={e => set('subject', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Total Marks</label>
            <input className="input w-full" type="number" placeholder="e.g. 50"
              value={form.max_marks} onChange={e => set('max_marks', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-400 mb-1">Description (optional)</label>
            <input className="input w-full" placeholder="e.g. Students must document their experiment methodology and results"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Rubric'}
        </button>
      </div>
      {result && (
        <div className="p-5 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface-850)' }}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white font-medium">Marking Rubric</h2>
            <button className="text-xs text-slate-400 hover:text-white"
              onClick={() => navigator.clipboard.writeText(result)}>Copy</button>
          </div>
          <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{result}</pre>
        </div>
      )}
    </div>
  )
}