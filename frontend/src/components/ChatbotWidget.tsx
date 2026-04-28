'use client'
import { useState, useRef, useEffect } from 'react'
import { api, getUser } from '@/lib/api'
import { MessageCircle, X, Send, Bot, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatbotWidget() {
  const user = getUser()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Hi ${user?.name?.split(' ')[0] || 'there'}! I'm Nyxion AI. Ask me anything about your studies, assignments, or school.` }
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
      const { data } = await api.post('/api/v1/ai/chatbot', {
        message: msg,
        school_context: `User: ${user?.name}, Role: ${user?.role}, Class: ${user?.class_name || 'N/A'}`
      })
      setMessages(m => [...m, { role: 'assistant', content: data.response }])
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: 'Sorry, I ran into an error. Please try again.' }])
    } finally { setLoading(false) }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        {open ? <X size={20} className="text-white" /> : <MessageCircle size={20} className="text-white" />}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 rounded-2xl border border-[var(--border)] overflow-hidden shadow-2xl flex flex-col"
          style={{ background: 'var(--surface-850)', height: '420px' }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]"
            style={{ background: 'var(--surface-900)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Nyxion AI</div>
              <div className="text-xs text-slate-500">Powered by Llama 3.3 70B</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'text-white rounded-br-sm'
                    : 'text-slate-200 rounded-bl-sm border border-[var(--border)]'
                }`}
                  style={m.role === 'user' ? { background: '#6366f1' } : { background: 'var(--surface-700)' }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm px-3 py-2 border border-[var(--border)]"
                  style={{ background: 'var(--surface-700)' }}>
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-[var(--border)]" style={{ background: 'var(--surface-900)' }}>
            <div className="flex gap-2 items-center">
              <input
                className="input flex-1 text-sm py-2"
                placeholder="Ask anything..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
              />
              <button onClick={send} disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                style={{ background: '#6366f1' }}>
                <Send size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}