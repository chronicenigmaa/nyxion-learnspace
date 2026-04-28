'use client'
import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { Sparkles, ChevronDown, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface AIDropdownProps {
  context?: {
    subject?: string
    class_name?: string
    title?: string
    submission_text?: string
    marks_obtained?: number
    max_marks?: number
  }
  tools?: Array<
    'exam-generator' | 'homework-generator' | 'lesson-planner' |
    'plagiarism-check' | 'feedback-writer' | 'rubric-generator'
  >
  role?: string
}

const TOOL_LABELS: Record<string, string> = {
  'exam-generator':     'Generate Exam Questions',
  'homework-generator': 'Generate Homework',
  'lesson-planner':     'Plan a Lesson',
  'plagiarism-check':   'Check Plagiarism',
  'feedback-writer':    'Write Feedback',
  'rubric-generator':   'Generate Rubric',
}

export default function AIDropdown({ context = {}, tools = [], role }: AIDropdownProps) {
  const [open, setOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({
    subject: context.subject || '',
    class_name: context.class_name || '',
    topic: '',
    assignment_title: context.title || '',
    submission_text: context.submission_text || '',
    marks_obtained: context.marks_obtained || '',
    max_marks: context.max_marks || '',
    num_questions: 10,
    difficulty: 'medium',
    question_type: 'mixed',
  })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    setLoading(true)
    setResult('')
    try {
      let payload: any = {}

      if (activeTool === 'exam-generator') {
        payload = {
          subject: form.subject, class_name: form.class_name, topic: form.topic,
          num_questions: form.num_questions, difficulty: form.difficulty, question_type: form.question_type
        }
      } else if (activeTool === 'homework-generator') {
        payload = {
          subject: form.subject, class_name: form.class_name, topic: form.topic,
          num_questions: form.num_questions, difficulty: form.difficulty
        }
      } else if (activeTool === 'lesson-planner') {
        payload = { subject: form.subject, class_name: form.class_name, topic: form.topic, duration_minutes: 45 }
      } else if (activeTool === 'plagiarism-check') {
        payload = { text: form.submission_text, assignment_title: form.assignment_title }
      } else if (activeTool === 'feedback-writer') {
        payload = {
          subject: form.subject, submission_text: form.submission_text,
          marks_obtained: parseFloat(form.marks_obtained), max_marks: parseFloat(form.max_marks),
          assignment_title: form.assignment_title
        }
      } else if (activeTool === 'rubric-generator') {
        payload = { assignment_title: form.assignment_title, subject: form.subject, max_marks: parseInt(form.max_marks) }
      }

      const { data } = await api.post(`/api/v1/ai/${activeTool}`, payload)
      setResult(data.response || data.analysis || '')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'AI error')
    } finally {
      setLoading(false)
    }
  }

  function closeModal() {
    setActiveTool(null)
    setResult('')
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-all"
      >
        <Sparkles size={14} />
        AI Tools
        <ChevronDown size={12} className={`transition-transform ${open && !activeTool ? 'rotate-180' : ''}`} />
      </button>

      {open && !activeTool && (
        <div
          className="absolute right-0 top-full mt-1 z-40 w-52 rounded-xl border border-[var(--border)] overflow-hidden shadow-xl"
          style={{ background: 'var(--surface-850)' }}
        >
          {tools.map(tool => (
            <button
              key={tool}
              onClick={() => { setActiveTool(tool); setResult('') }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-[var(--surface-700)] transition-colors flex items-center gap-2"
            >
              <Sparkles size={12} className="text-purple-400" />
              {TOOL_LABELS[tool]}
            </button>
          ))}
        </div>
      )}

      {activeTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="w-full max-w-xl rounded-2xl border border-[var(--border)] overflow-hidden"
            style={{ background: 'var(--surface-850)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-purple-400" />
                <span className="text-white font-medium text-sm">{TOOL_LABELS[activeTool]}</span>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {['exam-generator', 'homework-generator', 'lesson-planner', 'feedback-writer', 'rubric-generator'].includes(activeTool) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Subject</label>
                    <input
                      className="input w-full"
                      value={form.subject}
                      onChange={e => set('subject', e.target.value)}
                      placeholder="e.g. Mathematics"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Class</label>
                    <input
                      className="input w-full"
                      value={form.class_name}
                      onChange={e => set('class_name', e.target.value)}
                      placeholder="e.g. Grade 8"
                    />
                  </div>
                </div>
              )}

              {['exam-generator', 'homework-generator', 'lesson-planner'].includes(activeTool) && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Topic</label>
                  <input
                    className="input w-full"
                    value={form.topic}
                    onChange={e => set('topic', e.target.value)}
                    placeholder="e.g. Quadratic Equations"
                  />
                </div>
              )}

              {['plagiarism-check', 'feedback-writer', 'rubric-generator'].includes(activeTool) && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Assignment Title</label>
                  <input
                    className="input w-full"
                    value={form.assignment_title}
                    onChange={e => set('assignment_title', e.target.value)}
                    placeholder="e.g. Essay on Climate Change"
                  />
                </div>
              )}

              {['feedback-writer', 'rubric-generator'].includes(activeTool) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Marks Obtained</label>
                    <input
                      className="input w-full"
                      type="number"
                      value={form.marks_obtained}
                      onChange={e => set('marks_obtained', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Max Marks</label>
                    <input
                      className="input w-full"
                      type="number"
                      value={form.max_marks}
                      onChange={e => set('max_marks', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {['plagiarism-check', 'feedback-writer'].includes(activeTool) && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Submission Text</label>
                  <textarea
                    className="input w-full h-28 resize-none"
                    value={form.submission_text}
                    onChange={e => set('submission_text', e.target.value)}
                    placeholder="Paste student submission..."
                  />
                </div>
              )}

              {activeTool === 'exam-generator' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Questions</label>
                    <input
                      className="input w-full"
                      type="number"
                      min={1}
                      max={30}
                      value={form.num_questions}
                      onChange={e => set('num_questions', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Difficulty</label>
                    <select className="input w-full" value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Type</label>
                    <select className="input w-full" value={form.question_type} onChange={e => set('question_type', e.target.value)}>
                      <option value="mixed">Mixed</option>
                      <option value="mcq">MCQ</option>
                      <option value="short_answer">Short Answer</option>
                    </select>
                  </div>
                </div>
              )}

              <button className="btn-primary w-full" onClick={run} disabled={loading}>
                {loading ? 'Generating...' : 'Generate'}
              </button>

              {result && (
                <div
                  className="rounded-xl border border-[var(--border)] p-4 max-h-72 overflow-y-auto"
                  style={{ background: 'var(--surface-900)' }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-400">Result</span>
                    <button
                      className="text-xs text-slate-400 hover:text-white"
                      onClick={() => navigator.clipboard.writeText(result)}
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{result}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}