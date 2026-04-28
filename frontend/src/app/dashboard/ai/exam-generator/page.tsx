'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

export default function ExamGeneratorPage() {
  const [form, setForm] = useState({
    subject: '', class_name: '', topic: '',
    num_questions: 10, difficulty: 'medium', question_type: 'mixed'
  })
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.subject || !form.class_name || !form.topic) {
      setError('Please fill in subject, class, and topic.'); return
    }
    setLoading(true); setError(''); setResult('')
    try {
      const { data } = await api.post('/api/v1/ai/exam-generator', form)
      setResult(data.response)
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Exam Generator</h1>
      <p className="text-slate-400 text-sm mb-6">Generate exam questions for any subject and topic</p>

      <div className="p-5 rounded-xl border border-[var(--border)] mb-4" style={{ background: 'var(--surface-850)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Subject</label>
            <input className="input w-full" placeholder="e.g. Mathematics"
              value={form.subject} onChange={e => set('subject', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Class</label>
            <input className="input w-full" placeholder="e.g. Grade 8"
              value={form.class_name} onChange={e => set('class_name', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-400 mb-1">Topic</label>
            <input className="input w-full" placeholder="e.g. Quadratic Equations"
              value={form.topic} onChange={e => set('topic', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Number of Questions</label>
            <input className="input w-full" type="number" min={1} max={30}
              value={form.num_questions} onChange={e => set('num_questions', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Difficulty</label>
            <select className="input w-full" value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Question Type</label>
            <select className="input w-full" value={form.question_type} onChange={e => set('question_type', e.target.value)}>
              <option value="mixed">Mixed</option>
              <option value="mcq">MCQ Only</option>
              <option value="short_answer">Short Answer Only</option>
            </select>
          </div>
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Exam'}
        </button>
      </div>

      {result && (
        <div className="p-5 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface-850)' }}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white font-medium">Generated Exam</h2>
            <button className="text-xs text-slate-400 hover:text-white"
              onClick={() => navigator.clipboard.writeText(result)}>Copy</button>
          </div>
          <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{result}</pre>
        </div>
      )}
    </div>
  )
}