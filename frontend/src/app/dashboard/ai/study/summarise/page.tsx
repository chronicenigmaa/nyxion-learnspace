'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

export default function SummarisePage() {
  const [text, setText] = useState('')
  const [subject, setSubject] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!text) { setError('Please paste your notes first.'); return }
    setLoading(true); setError(''); setResult('')
    try {
      const { data } = await api.post('/api/v1/ai/summarise', { text, subject })
      setResult(data.response)
    } catch (e: any) { setError(e.response?.data?.detail || e.message || 'Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Notes Summariser</h1>
      <p className="text-slate-400 text-sm mb-6">Paste your notes and get a summary, key points, and glossary</p>
      <div className="p-5 rounded-xl border border-[var(--border)] mb-4" style={{ background: 'var(--surface-850)' }}>
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1">Subject (optional)</label>
          <input className="input w-full" placeholder="e.g. Chemistry"
            value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1">Your Notes</label>
          <textarea className="input w-full h-48 resize-none" placeholder="Paste your notes here..."
            value={text} onChange={e => setText(e.target.value)} />
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Summarising...' : 'Summarise Notes'}
        </button>
      </div>
      {result && (
        <div className="p-5 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface-850)' }}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white font-medium">Summary</h2>
            <button className="text-xs text-slate-400 hover:text-white"
              onClick={() => navigator.clipboard.writeText(result)}>Copy</button>
          </div>
          <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{result}</pre>
        </div>
      )}
    </div>
  )
}