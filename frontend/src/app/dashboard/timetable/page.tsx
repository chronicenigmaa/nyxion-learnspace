'use client'
import { useEffect, useState } from 'react'
import { api, getUser } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Clock, Sparkles } from 'lucide-react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PERIODS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

interface TimetableEntry {
  id: string
  day: string
  period: string
  subject: string
  teacher_name: string
  class_name: string
  start_time: string
  end_time: string
}

interface AIState {
  open: boolean
  subject: string
  class_name: string
  topic: string
  loading: boolean
  result: string
}

export default function TimetablePage() {
  const user = getUser()
  const isTeacher = user?.role === 'teacher' || user?.role === 'school_admin' || user?.role === 'super_admin'
  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    day: 'Monday', period: '1st', subject: '',
    teacher_name: '', class_name: '', start_time: '08:00', end_time: '08:45'
  })
  const [ai, setAi] = useState<AIState>({
    open: false, subject: '', class_name: '', topic: '', loading: false, result: ''
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/api/v1/timetable/')
      setEntries(data)
    } catch { toast.error('Failed to load timetable') }
    finally { setLoading(false) }
  }

  async function handleAdd() {
    if (!form.subject || !form.class_name) { toast.error('Subject and class required'); return }
    try {
      await api.post('/api/v1/timetable/', form)
      toast.success('Entry added')
      setShowAdd(false)
      setForm({ day: 'Monday', period: '1st', subject: '', teacher_name: '', class_name: '', start_time: '08:00', end_time: '08:45' })
      load()
    } catch { toast.error('Failed to add entry') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this entry?')) return
    try {
      await api.delete(`/api/v1/timetable/${id}`)
      toast.success('Entry deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  async function generateLessonPlan() {
    if (!ai.subject || !ai.class_name || !ai.topic) { toast.error('Fill in all fields'); return }
    setAi(a => ({ ...a, loading: true, result: '' }))
    try {
      const { data } = await api.post('/api/v1/ai/lesson-planner', {
        subject: ai.subject, class_name: ai.class_name, topic: ai.topic, duration_minutes: 45
      })
      setAi(a => ({ ...a, loading: false, result: data.response }))
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'AI error')
      setAi(a => ({ ...a, loading: false }))
    }
  }

  const grouped: Record<string, TimetableEntry[]> = {}
  DAYS.forEach(d => { grouped[d] = entries.filter(e => e.day === d) })

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Timetable</h1>
          <p className="text-slate-400 text-sm mt-0.5">{entries.length} entries across {DAYS.length} days</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAi(a => ({ ...a, open: true }))}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-all"
          >
            <Sparkles size={15} /> Lesson Planner
          </button>
          {isTeacher && (
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus size={16} /> Add Entry
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="card p-5 border-indigo-500/30">
          <h3 className="text-white font-medium mb-4">New Timetable Entry</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Day</label>
              <select className="input w-full" value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Period</label>
              <select className="input w-full" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                {PERIODS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Subject</label>
              <input className="input w-full" placeholder="e.g. Mathematics" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Class</label>
              <input className="input w-full" placeholder="e.g. Grade 8" value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Teacher</label>
              <input className="input w-full" placeholder="Teacher name" value={form.teacher_name} onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Start Time</label>
              <input className="input w-full" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">End Time</label>
              <input className="input w-full" type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleAdd}>Save Entry</button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {DAYS.map(day => (
            <div key={day} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{day}</span>
                <span className="text-xs text-slate-500">{grouped[day].length} periods</span>
              </div>
              {grouped[day].length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-600 text-sm">No classes scheduled</div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {grouped[day]
                    .sort((a, b) => a.period.localeCompare(b.period))
                    .map(entry => (
                      <div key={entry.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--surface-700)] transition-colors group">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-400 flex-shrink-0"
                          style={{ background: 'rgba(99,102,241,0.15)' }}
                        >
                          {entry.period.replace('th', '').replace('st', '').replace('nd', '').replace('rd', '')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white">{entry.subject}</div>
                          <div className="text-xs text-slate-400">{entry.class_name} · {entry.teacher_name}</div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={11} /> {entry.start_time} – {entry.end_time}
                        </div>
                        <button
                          onClick={() => setAi(a => ({ ...a, open: true, subject: entry.subject, class_name: entry.class_name }))}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded text-xs text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-all"
                        >
                          <Sparkles size={11} /> Plan
                        </button>
                        {isTeacher && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {ai.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] overflow-hidden" style={{ background: 'var(--surface-850)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <span className="text-white font-medium">AI Lesson Planner</span>
              </div>
              <button
                onClick={() => setAi(a => ({ ...a, open: false, result: '' }))}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Subject</label>
                  <input
                    className="input w-full"
                    placeholder="e.g. Biology"
                    value={ai.subject}
                    onChange={e => setAi(a => ({ ...a, subject: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Class</label>
                  <input
                    className="input w-full"
                    placeholder="e.g. Grade 9"
                    value={ai.class_name}
                    onChange={e => setAi(a => ({ ...a, class_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Topic</label>
                  <input
                    className="input w-full"
                    placeholder="e.g. Photosynthesis"
                    value={ai.topic}
                    onChange={e => setAi(a => ({ ...a, topic: e.target.value }))}
                  />
                </div>
              </div>
              <button className="btn-primary w-full" onClick={generateLessonPlan} disabled={ai.loading}>
                {ai.loading ? 'Generating...' : 'Generate Lesson Plan'}
              </button>
              {ai.result && (
                <div
                  className="rounded-xl border border-[var(--border)] p-4 max-h-96 overflow-y-auto"
                  style={{ background: 'var(--surface-900)' }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-400">Lesson Plan</span>
                    <button
                      className="text-xs text-slate-400 hover:text-white"
                      onClick={() => navigator.clipboard.writeText(ai.result)}
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{ai.result}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}