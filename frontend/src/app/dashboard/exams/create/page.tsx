'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createExam } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, ArrowLeft, Shield, CheckSquare } from 'lucide-react'
import Link from 'next/link'

interface Question {
  id: string; type: 'mcq' | 'short' | 'long'
  question: string; options?: string[]; correct_answer?: string; marks: number
}

export default function CreateExamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', subject: '', class_name: '',
    duration_minutes: 60, total_marks: 100, scheduled_at: '',
    restrict_tab_switch: true, restrict_copy_paste: true,
    restrict_right_click: true, fullscreen_required: true,
    max_tab_warnings: 3, shuffle_questions: true,
  })
  const [questions, setQuestions] = useState<Question[]>([])

  function addQuestion(type: 'mcq' | 'short' | 'long') {
    const q: Question = {
      id: crypto.randomUUID(), type, question: '', marks: 5,
      ...(type === 'mcq' ? { options: ['', '', '', ''], correct_answer: '' } : {})
    }
    setQuestions(p => [...p, q])
  }

  function updateQ(id: string, field: string, value: any) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  function updateOption(id: string, idx: number, val: string) {
    setQuestions(qs => qs.map(q => {
      if (q.id !== id) return q
      const opts = [...(q.options || [])]
      opts[idx] = val
      return { ...q, options: opts }
    }))
  }

  function removeQ(id: string) { setQuestions(qs => qs.filter(q => q.id !== id)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (questions.length === 0) { toast.error('Add at least one question'); return }
    setLoading(true)
    try {
      await createExam({ ...form, questions })
      toast.success('Exam scheduled!')
      router.push('/dashboard/exams')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="animate-fade-in max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/exams" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Schedule Exam</h1>
          <p className="text-slate-400 text-sm">Build questions and configure restrictions</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic details */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-400 text-sm uppercase tracking-wider">Exam Details</h3>
          <div>
            <label className="label">Title *</label>
            <input className="input" placeholder="Mid-Term Mathematics" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Subject *</label><input className="input" placeholder="Mathematics" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} required /></div>
            <div><label className="label">Class *</label><input className="input" placeholder="Class 9A" value={form.class_name} onChange={e => setForm(p => ({ ...p, class_name: e.target.value }))} required /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Duration (min)</label><input type="number" className="input" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: +e.target.value }))} min="5" /></div>
            <div><label className="label">Total Marks</label><input type="number" className="input" value={form.total_marks} onChange={e => setForm(p => ({ ...p, total_marks: +e.target.value }))} /></div>
            <div><label className="label">Scheduled At *</label><input type="datetime-local" className="input" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} required /></div>
          </div>
        </div>

        {/* Security settings */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-400 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
            <Shield size={14} /> Exam Security
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'fullscreen_required', label: 'Require Fullscreen', desc: 'Forces fullscreen mode' },
              { key: 'restrict_tab_switch', label: 'Tab Switch Detection', desc: 'Logs & warns on tab switch' },
              { key: 'restrict_copy_paste', label: 'Block Copy/Paste', desc: 'Disables clipboard' },
              { key: 'restrict_right_click', label: 'Block Right Click', desc: 'Prevents context menu' },
              { key: 'shuffle_questions', label: 'Shuffle Questions', desc: 'Random order per student' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:border-indigo-500/30 border border-[var(--border)] transition-colors"
                style={{ background: (form as any)[key] ? 'rgba(99,102,241,0.08)' : 'var(--surface-700)' }}>
                <input type="checkbox" className="w-4 h-4 accent-indigo-500" checked={(form as any)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} />
                <div>
                  <div className="text-sm font-medium text-white">{label}</div>
                  <div className="text-xs text-slate-400">{desc}</div>
                </div>
              </label>
            ))}
            <div className="p-3 rounded-lg border border-[var(--border)]" style={{ background: 'var(--surface-700)' }}>
              <label className="label">Max Tab Warnings</label>
              <input type="number" className="input mt-1" value={form.max_tab_warnings} min="1" max="10"
                onChange={e => setForm(p => ({ ...p, max_tab_warnings: +e.target.value }))} />
              <p className="text-xs text-slate-500 mt-1">Auto-terminate after this many switches</p>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-400 text-sm uppercase tracking-wider">
              Questions ({questions.length})
            </h3>
            <div className="flex gap-2">
              {[
                { type: 'mcq', label: 'MCQ' },
                { type: 'short', label: 'Short' },
                { type: 'long', label: 'Essay' },
              ].map(({ type, label }) => (
                <button key={type} type="button"
                  onClick={() => addQuestion(type as any)}
                  className="btn-secondary py-1.5 text-xs">
                  <Plus size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          {questions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Add questions using the buttons above</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id} className="p-4 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface-700)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">Q{i + 1}</span>
                      <span className={`badge ${q.type === 'mcq' ? 'badge-blue' : q.type === 'short' ? 'badge-green' : 'badge-yellow'}`}>{q.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input py-1 w-20 text-xs text-center" value={q.marks}
                        onChange={e => updateQ(q.id, 'marks', +e.target.value)} placeholder="Marks" min="1" />
                      <span className="text-xs text-slate-400">marks</span>
                      <button type="button" onClick={() => removeQ(q.id)} className="text-slate-400 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <textarea className="input text-sm" rows={2} placeholder="Enter question..." value={q.question}
                    onChange={e => updateQ(q.id, 'question', e.target.value)} />

                  {q.type === 'mcq' && (
                    <div className="mt-3 space-y-2">
                      <label className="label">Options</label>
                      {(q.options || []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" name={`correct-${q.id}`} value={opt}
                            checked={q.correct_answer === opt} onChange={() => updateQ(q.id, 'correct_answer', opt)}
                            className="accent-indigo-500" />
                          <input className="input py-1.5 text-sm" placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                            value={opt} onChange={e => updateOption(q.id, oi, e.target.value)} />
                        </div>
                      ))}
                      <p className="text-xs text-slate-500">Select the radio button next to the correct answer</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link href="/dashboard/exams" className="btn-secondary flex-1 justify-center">Cancel</Link>
          <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
            {loading ? 'Saving...' : 'Schedule Exam'}
          </button>
        </div>
      </form>
    </div>
  )
}
