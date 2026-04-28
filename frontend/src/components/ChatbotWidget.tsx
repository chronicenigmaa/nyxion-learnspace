'use client'
import { useState, useRef, useEffect } from 'react'
import { api, getUser } from '@/lib/api'
import { MessageCircle, X, Send, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

async function buildContext(user: any): Promise<string> {
  let ctx = `Student/User Info:
- Name: ${user?.name}
- Role: ${user?.role}
- Class: ${user?.class_name || 'N/A'}
- Subject (if teacher): ${user?.subject || 'N/A'}`

  const results = await Promise.allSettled([
    api.get('/api/v1/exams/'),
    api.get('/api/v1/assignments/'),
    api.get('/api/v1/grades/my'),
    api.get('/api/v1/attendance/my'),
    api.get('/api/v1/notes/'),
    api.get('/api/v1/events/'),
  ])

  const [examsR, assignR, gradesR, attR, notesR, eventsR] = results

  if (examsR.status === 'fulfilled') {
    const all = examsR.value.data as any[]
    const scheduled = all.filter(e => e.status === 'scheduled')
    const live = all.filter(e => e.status === 'live')
    const ended = all.filter(e => e.status === 'ended')
    ctx += `\n\nExams:
- Scheduled (${scheduled.length}): ${scheduled.map(e => `"${e.title}" in ${e.subject} on ${e.scheduled_at ? new Date(e.scheduled_at).toDateString() : 'TBD'} (${e.duration_minutes} min, ${e.total_marks} marks)`).join('; ') || 'None'}
- Live now (${live.length}): ${live.map(e => `"${e.title}" in ${e.subject}`).join('; ') || 'None'}
- Completed (${ended.length}): ${ended.slice(0, 3).map(e => `"${e.title}"`).join('; ') || 'None'}`
  }

  if (assignR.status === 'fulfilled') {
    const all = assignR.value.data as any[]
    const active = all.filter(a => a.status === 'published' && new Date(a.due_date) > new Date())
    const overdue = all.filter(a => new Date(a.due_date) < new Date() && a.status !== 'closed')
    const closed = all.filter(a => a.status === 'closed')
    ctx += `\n\nAssignments:
- Active/Upcoming (${active.length}): ${active.map(a => `"${a.title}" (${a.subject}, due ${new Date(a.due_date).toDateString()}, ${a.max_marks} marks, submissions: ${a.submission_count ?? 'N/A'})`).join('; ') || 'None'}
- Overdue (${overdue.length}): ${overdue.map(a => `"${a.title}" (${a.subject})`).join('; ') || 'None'}
- Closed (${closed.length}): ${closed.slice(0, 3).map(a => `"${a.title}"`).join('; ') || 'None'}`
  }

  if (gradesR.status === 'fulfilled') {
    const grades = gradesR.value.data as any[]
    const avg = grades.length > 0
      ? Math.round(grades.reduce((s, g) => s + (g.percentage || 0), 0) / grades.length)
      : 0
    ctx += `\n\nGrades (${grades.length} graded assignments):
- Average: ${avg}%
- Recent: ${grades.slice(0, 5).map(g => `"${g.assignment_title}" ${g.marks_obtained}/${g.max_marks} (${g.percentage}%)`).join('; ') || 'None'}`
  }

  if (attR.status === 'fulfilled') {
    const att = attR.value.data as any[]
    const present = att.filter(a => a.is_present).length
    const total = att.length
    const pct = total > 0 ? Math.round((present / total) * 100) : 0
    const recent = att.slice(-5).reverse()
    ctx += `\n\nAttendance:
- Overall: ${present}/${total} days (${pct}%)
- Recent: ${recent.map(a => `${a.date} - ${a.is_present ? 'Present' : 'Absent'} (${a.subject || 'General'})`).join('; ') || 'None'}`
  }

  if (notesR.status === 'fulfilled') {
    const notes = notesR.value.data as any[]
    ctx += `\n\nNotes & Slides (${notes.length} total): ${notes.slice(0, 5).map(n => `"${n.title}" (${n.subject}, ${n.class_name})`).join('; ') || 'None'}`
  }

  if (eventsR.status === 'fulfilled') {
    const events = eventsR.value.data as any[]
    const upcoming = events.filter(e => new Date(e.date) >= new Date())
    ctx += `\n\nUpcoming Events/Holidays (${upcoming.length}): ${upcoming.slice(0, 5).map(e => `"${e.title}" on ${e.date} (${e.event_type})`).join('; ') || 'None'}`
  }

  return ctx
}

export default function ChatbotWidget() {
  const user = getUser()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi ${user?.name?.split(' ')[0] || 'there'}! I'm Nyxion AI. I can see your exams, assignments, grades, attendance, and more. Ask me anything!`
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
      const detail = e.response?.data?.detail || 'Something went wrong. Try again.'
      setMessages(m => [...m, { role: 'assistant', content: detail }])
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
              <div className="text-xs text-slate-500">Knows your data • Llama 3.3 70B</div>
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