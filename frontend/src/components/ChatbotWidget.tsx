'use client'
import { useState, useRef, useEffect } from 'react'
import { api, getUser } from '@/lib/api'
import { MessageCircle, X, Send, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

async function buildContext(user: any): Promise<string> {
  let ctx = `User Info:
- Name: ${user?.name}
- Role: ${user?.role}
- Class: ${user?.class_name || 'N/A'}
- Subject: ${user?.subject || 'N/A'}`

  try {
    const { data } = await api.get('/api/v1/exams/')
    const all = Array.isArray(data) ? data : []
    const scheduled = all.filter((e: any) => e.status === 'scheduled')
    const live = all.filter((e: any) => e.status === 'live')
    const ended = all.filter((e: any) => e.status === 'ended')
    ctx += `\n\nExams:
- Scheduled (${scheduled.length}): ${scheduled.map((e: any) => `"${e.title}" in ${e.subject} on ${e.scheduled_at ? new Date(e.scheduled_at).toDateString() : 'TBD'} (${e.duration_minutes} min, ${e.total_marks} marks)`).join('; ') || 'None'}
- Live now (${live.length}): ${live.map((e: any) => `"${e.title}" in ${e.subject}`).join('; ') || 'None'}
- Ended (${ended.length}): ${ended.slice(0, 3).map((e: any) => `"${e.title}" in ${e.subject}`).join('; ') || 'None'}`
  } catch { ctx += '\n\nExams: unavailable' }

  try {
    const { data } = await api.get('/api/v1/assignments/')
    const all = Array.isArray(data) ? data : []
    const active = all.filter((a: any) => a.status === 'published' && new Date(a.due_date) > new Date())
    const overdue = all.filter((a: any) => a.status === 'published' && new Date(a.due_date) <= new Date())
    const closed = all.filter((a: any) => a.status === 'closed')
    ctx += `\n\nAssignments:
- Active (${active.length}): ${active.map((a: any) => `"${a.title}" (${a.subject}, due ${new Date(a.due_date).toDateString()}, ${a.max_marks} marks)`).join('; ') || 'None'}
- Overdue (${overdue.length}): ${overdue.map((a: any) => `"${a.title}" (${a.subject})`).join('; ') || 'None'}
- Closed (${closed.length}): ${closed.slice(0, 3).map((a: any) => `"${a.title}"`).join('; ') || 'None'}`
  } catch { ctx += '\n\nAssignments: unavailable' }

  try {
    const { data } = await api.get('/api/v1/grades/my')
    const grades = Array.isArray(data) ? data : []
    const avg = grades.length > 0
      ? Math.round(grades.reduce((s: number, g: any) => s + (g.percentage || 0), 0) / grades.length)
      : 0
    ctx += `\n\nGrades (${grades.length} graded):
- Average: ${grades.length > 0 ? avg + '%' : 'No grades yet'}
- Recent: ${grades.slice(0, 5).map((g: any) => `"${g.assignment_title}" ${g.marks_obtained}/${g.max_marks} (${g.percentage}%)`).join('; ') || 'None'}`
  } catch { ctx += '\n\nGrades: unavailable' }

  try {
    const { data } = await api.get('/api/v1/attendance/my')
    const att = Array.isArray(data) ? data : []
    const present = att.filter((a: any) => a.is_present).length
    const total = att.length
    const pct = total > 0 ? Math.round((present / total) * 100) : 0
    ctx += `\n\nAttendance: ${present}/${total} days present (${pct}%)`
  } catch { ctx += '\n\nAttendance: unavailable' }

  try {
    const { data } = await api.get('/api/v1/notes/')
    const notes = Array.isArray(data) ? data : []
    ctx += `\n\nNotes & Slides (${notes.length}): ${notes.slice(0, 5).map((n: any) => `"${n.title}" (${n.subject}, ${n.class_name})`).join('; ') || 'None'}`
  } catch { ctx += '\n\nNotes: unavailable' }

  try {
    const { data } = await api.get('/api/v1/events/')
    const events = Array.isArray(data) ? data : []
    const upcoming = events.filter((e: any) => new Date(e.date) >= new Date())
    ctx += `\n\nUpcoming Events/Holidays (${upcoming.length}): ${upcoming.slice(0, 5).map((e: any) => `"${e.title}" on ${e.date} (${e.event_type})`).join('; ') || 'None'}`
  } catch { ctx += '\n\nEvents: unavailable' }

  return ctx
}

export default function ChatbotWidget() {
  const user = getUser()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi ${user?.name?.split(' ')[0] || 'there'}! I'm Nyxion AI. I can see your live exams, assignments, grades, and attendance. Ask me anything!`
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const msg = input.trim()
    if (!msg || loading) return

    setInput('')
    setMessages(m => [...m, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const context = await buildContext(user)
      const { data } = await api.post('/api/v1/ai/chatbot', {
        message: msg,
        school_context: context
      })
      setMessages(m => [...m, { role: 'assistant', content: data.response }])
    } catch (e: any) {
      const detail = e.response?.data?.detail || e.message || 'Unknown error'
      setMessages(m => [...m, { role: 'assistant', content: `Error: ${detail}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
      >
        {open
          ? <X size={20} className="text-white" />
          : <MessageCircle size={20} className="text-white" />
        }
      </button>

      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 w-80 rounded-2xl border border-[var(--border)] overflow-hidden shadow-2xl flex flex-col"
          style={{ background: 'var(--surface-850)', height: '440px' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]"
            style={{ background: 'var(--surface-900)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Nyxion AI</div>
              <div className="text-xs text-slate-500">Knows your live data</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'text-slate-200 rounded-bl-sm border border-[var(--border)]'
                  }`}
                  style={m.role === 'user'
                    ? { background: '#6366f1' }
                    : { background: 'var(--surface-700)' }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl rounded-bl-sm px-3 py-2 border border-[var(--border)]"
                  style={{ background: 'var(--surface-700)' }}
                >
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div
            className="px-3 py-3 border-t border-[var(--border)]"
            style={{ background: 'var(--surface-900)' }}
          >
            <div className="flex gap-2 items-center">
              <input
                className="input flex-1 text-sm py-2"
                placeholder="Ask about exams, grades, assignments..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                style={{ background: '#6366f1' }}
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}