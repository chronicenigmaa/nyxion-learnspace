'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

export default function PlagiarismPage() {
  const [form, setForm] = useState({ text: '', assignment_title: '' })
  const [result, setResult] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.text || !form.assignment_title) {
      setError('Please fill in assignment title and paste the submission text.'); return
    }
    setLoading(true); setError(''); setResult('')
    try {
      const { data } = await api.post('/api/v1/ai/plagiarism-check', form)
      setResult(data.response)
      setWordCount(data.word_count)
    } catch (e: any) { setError(e.response?.data?.detail || e.message || 'Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Plagiarism Checker</h1>
      <p className="text-slate-400 text-sm mb-6">Detect copied or AI-generated content in student submissions</p>
      <div className="p-5 rounded-xl border border-[var(--border)] mb-4" style={{ background: 'var(--surface-850)' }}>
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1">Assignment Title</label>
          <input className="input w-full" placeholder="e.g. Essay on Climate Change"
            value={form.assignment_title} onChange={e => set('assignment_title', e.target.value)} />
        </div>
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1">Student Submission Text</label>
          <textarea className="input w-full h-48 resize-none" placeholder="Paste the student's submission here..."
            value={form.text} onChange={e => set('text', e.target.value)} />
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Analysing...' : 'Check for Plagiarism'}
        </button>
      </div>
      {result && (
        <div className="p-5 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface-850)' }}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white font-medium">Analysis Result</h2>
            <span className="text-xs text-slate-500">{wordCount} words</span>
          </div>
          <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{result}</pre>
        </div>
      )}
    </div>
  )
}