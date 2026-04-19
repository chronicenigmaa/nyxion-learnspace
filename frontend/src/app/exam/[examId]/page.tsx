'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getExams, startExamAttempt, logViolation, submitExam } from '@/lib/api'
import toast from 'react-hot-toast'
import { AlertTriangle, Shield, Clock, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import NyxionLogo from '@/components/ui/NyxionLogo'

type Phase = 'briefing' | 'exam' | 'submitted'

export default function LiveExamPage() {
  const { examId } = useParams() as { examId: string }
  const router = useRouter()

  const [exam, setExam] = useState<any>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('briefing')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQ, setCurrentQ] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [violations, setViolations] = useState(0)
  const [terminated, setTerminated] = useState(false)
  const [warningsLeft, setWarningsLeft] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    loadExam()
  }, [examId])

  async function loadExam() {
    try {
      const r = await getExams()
      const e = r.data.find((ex: any) => ex.id === examId)
      if (!e) { toast.error('Exam not found'); router.push('/dashboard/exams'); return }
      if (e.status !== 'live') { toast.error('Exam is not live'); router.push('/dashboard/exams'); return }
      setExam(e)
      setTimeLeft(e.duration_minutes * 60)
      setWarningsLeft(e.max_tab_warnings)
    } catch { toast.error('Failed to load exam') }
  }

  async function handleEnterExam() {
    try {
      const r = await startExamAttempt(examId)
      setAttemptId(r.data.attempt_id)
      setPhase('exam')

      // Enter fullscreen
      if (exam.fullscreen_required && containerRef.current) {
        try { await document.documentElement.requestFullscreen() } catch {}
      }

      // Disable copy/paste
      if (exam.restrict_copy_paste) {
        document.addEventListener('copy', e => { e.preventDefault() })
        document.addEventListener('paste', e => { e.preventDefault() })
        document.addEventListener('cut', e => { e.preventDefault() })
      }

      // Disable right click
      if (exam.restrict_right_click) {
        document.addEventListener('contextmenu', e => { e.preventDefault() })
      }

      // Add exam mode class
      document.body.classList.add('exam-mode')

      startTimer()
      if (!startedRef.current) {
        startedRef.current = true
        setupViolationDetection()
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not start exam')
    }
  }

  function startTimer() {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          handleAutoSubmit()
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  function setupViolationDetection() {
    // Tab/window visibility change
    const handleVisibility = () => {
      if (document.hidden) {
        recordViolation('tab_switch', 'Student switched tab or minimized window')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Fullscreen exit
    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        recordViolation('fullscreen_exit', 'Student exited fullscreen')
        toast.error('⚠️ Please stay in fullscreen!')
        // Re-enter fullscreen
        setTimeout(() => {
          try { document.documentElement.requestFullscreen() } catch {}
        }, 500)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreen)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('fullscreenchange', handleFullscreen)
    }
  }

  async function recordViolation(type: string, details: string) {
    try {
      const res = await logViolation(examId, {
        type,
        timestamp: new Date().toISOString(),
        details
      })
      setViolations(res.data.tab_switch_count || 0)
      setWarningsLeft(res.data.warnings_remaining ?? 0)

      if (res.data.terminated) {
        setTerminated(true)
        clearInterval(timerRef.current!)
        document.body.classList.remove('exam-mode')
        try { document.exitFullscreen() } catch {}
        toast.error('🚫 Exam terminated due to violations')
        setPhase('submitted')
      } else {
        // Flash warning
        document.body.classList.add('violation-flash')
        setTimeout(() => document.body.classList.remove('violation-flash'), 300)
        toast.error(`⚠️ Warning! ${res.data.warnings_remaining} warning(s) remaining`)
      }
    } catch {}
  }

  async function handleSubmit() {
    if (!confirm('Submit exam? You cannot change answers after submission.')) return
    setSubmitting(true)
    try {
      clearInterval(timerRef.current!)
      document.body.classList.remove('exam-mode')
      try { document.exitFullscreen() } catch {}
      const res = await submitExam(examId, answers)
      setScore(res.data.auto_score)
      setPhase('submitted')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Submission failed')
    } finally { setSubmitting(false) }
  }

  async function handleAutoSubmit() {
    clearInterval(timerRef.current!)
    document.body.classList.remove('exam-mode')
    try { document.exitFullscreen() } catch {}
    try {
      const res = await submitExam(examId, answers)
      setScore(res.data.auto_score)
    } catch {}
    setPhase('submitted')
    toast.success('Time up — exam auto-submitted')
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const answered = Object.keys(answers).length
  const questions = exam?.questions || []

  // BRIEFING PHASE
  if (phase === 'briefing') return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--surface-900)' }}>
      <div className="w-full max-w-lg card p-8 animate-slide-up">
        <NyxionLogo size="sm" sub="LearnSpace" />
        <h1 className="text-2xl font-bold text-white font-display mt-6 mb-1">{exam?.title}</h1>
        <p className="text-slate-400 text-sm mb-6">{exam?.subject} · {exam?.class_name}</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            ['Questions', exam?.question_count],
            ['Duration', `${exam?.duration_minutes} min`],
            ['Total Marks', exam?.total_marks],
          ].map(([l, v]) => (
            <div key={l} className="p-3 rounded-xl text-center" style={{ background: 'var(--surface-700)' }}>
              <div className="text-xl font-bold text-white">{v}</div>
              <div className="text-xs text-slate-400">{l}</div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl border border-yellow-500/30 mb-6" style={{ background: 'rgba(245,158,11,0.08)' }}>
          <h3 className="font-semibold text-yellow-400 text-sm mb-2 flex items-center gap-2">
            <Shield size={14} /> Exam Rules & Restrictions
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {exam?.fullscreen_required && <li>• Fullscreen mode will be activated and must be maintained</li>}
            {exam?.restrict_tab_switch && <li>• Switching tabs or windows will be logged. Max {exam?.max_tab_warnings} warnings before auto-termination</li>}
            {exam?.restrict_copy_paste && <li>• Copy, paste and cut operations are disabled</li>}
            {exam?.restrict_right_click && <li>• Right-click menu is disabled</li>}
            {exam?.shuffle_questions && <li>• Questions are in randomized order</li>}
            <li>• Timer will auto-submit when time runs out</li>
          </ul>
        </div>

        <button onClick={handleEnterExam} className="btn-primary w-full justify-center py-3 text-base" style={{ background: '#ef4444' }}>
          Enter Exam — I Understand the Rules
        </button>
        <button onClick={() => router.push('/dashboard/exams')} className="btn-secondary w-full justify-center mt-2">
          Go Back
        </button>
      </div>
    </div>
  )

  // SUBMITTED PHASE
  if (phase === 'submitted') return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--surface-900)' }}>
      <div className="w-full max-w-md card p-8 text-center animate-slide-up">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: terminated ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' }}>
          {terminated ? <AlertTriangle size={28} className="text-red-400" /> : <CheckCircle size={28} className="text-green-400" />}
        </div>
        <h2 className="text-2xl font-bold text-white font-display mb-2">
          {terminated ? 'Exam Terminated' : 'Exam Submitted!'}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {terminated ? 'Your exam was terminated due to too many violations.' : 'Your responses have been saved successfully.'}
        </p>
        {score !== null && (
          <div className="p-4 rounded-xl mb-6" style={{ background: 'var(--surface-700)' }}>
            <div className="text-sm text-slate-400">MCQ Auto-Score</div>
            <div className="text-3xl font-bold text-white mt-1">{score} / {exam?.total_marks}</div>
            <div className="text-xs text-slate-500 mt-1">Essay questions will be graded by your teacher</div>
          </div>
        )}
        {violations > 0 && <p className="text-yellow-400 text-sm mb-4">Total violations recorded: {violations}</p>}
        <button onClick={() => { router.push('/dashboard/exams') }} className="btn-primary w-full justify-center">
          Back to Dashboard
        </button>
      </div>
    </div>
  )

  // EXAM PHASE
  const q = questions[currentQ]
  if (!q) return null

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col select-none" style={{ background: 'var(--surface-900)' }}>
      {/* Top bar */}
      <div className="flex items-center px-6 py-3 border-b border-[var(--border)] glass sticky top-0 z-10">
        <NyxionLogo size="sm" showText={false} />
        <div className="flex-1 mx-4">
          <span className="text-sm font-medium text-white">{exam?.title}</span>
          <span className="text-xs text-slate-400 ml-2">{exam?.subject}</span>
        </div>

        <div className="flex items-center gap-4">
          {violations > 0 && (
            <div className="flex items-center gap-1.5 text-yellow-400 text-xs">
              <AlertTriangle size={13} />
              <span>{warningsLeft} warning{warningsLeft !== 1 ? 's' : ''} left</span>
            </div>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-bold ${timeLeft < 300 ? 'text-red-400 bg-red-400/10' : 'text-white bg-[var(--surface-700)]'}`}>
            <Clock size={14} />
            {formatTime(timeLeft)}
          </div>
          <button onClick={handleSubmit} className="btn-primary py-1.5 text-sm" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Question navigator */}
        <div className="hidden md:flex flex-col w-52 border-r border-[var(--border)] p-4 overflow-y-auto" style={{ background: 'var(--surface-850)' }}>
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Questions</div>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((_: any, i: number) => (
              <button key={i} onClick={() => setCurrentQ(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentQ === i ? 'bg-indigo-600 text-white' : answers[questions[i]?.id] ? 'bg-green-600/30 text-green-400 border border-green-600/40' : 'text-slate-400 border border-[var(--border)]'}`}
                style={currentQ !== i && !answers[questions[i]?.id] ? { background: 'var(--surface-700)' } : {}}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 text-xs text-slate-500">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-indigo-600" /> Current</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-600/30 border border-green-600/40" /> Answered</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded border border-[var(--border)]" style={{ background: 'var(--surface-700)' }} /> Unanswered</div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--border)]">
            <div className="text-xs text-slate-400">{answered}/{questions.length} answered</div>
            <div className="w-full h-1.5 rounded-full mt-1.5" style={{ background: 'var(--surface-600)' }}>
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Question area */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8">
          <div className="max-w-2xl mx-auto w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-500 uppercase">Question {currentQ + 1} of {questions.length}</span>
              <div className="flex items-center gap-2">
                <span className={`badge ${q.type === 'mcq' ? 'badge-blue' : q.type === 'short' ? 'badge-green' : 'badge-yellow'}`}>{q.type}</span>
                <span className="text-xs text-slate-400">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <p className="text-lg font-medium text-white mb-6 leading-relaxed">{q.question}</p>

            {q.type === 'mcq' && (
              <div className="space-y-2.5">
                {(q.options || []).map((opt: string, oi: number) => (
                  <label key={oi}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${answers[q.id] === opt ? 'border-indigo-500 bg-indigo-500/10' : 'border-[var(--border)] hover:border-indigo-500/40'}`}
                    style={answers[q.id] !== opt ? { background: 'var(--surface-700)' } : {}}>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${answers[q.id] === opt ? 'border-indigo-500' : 'border-slate-500'}`}>
                      {answers[q.id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                    <input type="radio" name={`q-${q.id}`} value={opt} className="hidden"
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))} />
                    <span className="text-sm text-white">
                      <span className="font-mono text-slate-400 mr-2">{String.fromCharCode(65 + oi)}.</span>
                      {opt}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {(q.type === 'short' || q.type === 'long') && (
              <textarea
                className="input w-full"
                rows={q.type === 'long' ? 10 : 4}
                placeholder={q.type === 'short' ? 'Write your answer (2-5 sentences)...' : 'Write your detailed answer...'}
                value={answers[q.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                onCopy={exam?.restrict_copy_paste ? e => e.preventDefault() : undefined}
                onPaste={exam?.restrict_copy_paste ? e => e.preventDefault() : undefined}
              />
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0} className="btn-secondary">
                <ChevronLeft size={16} /> Previous
              </button>
              {currentQ < questions.length - 1 ? (
                <button onClick={() => setCurrentQ(q => q + 1)} className="btn-primary">
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button onClick={handleSubmit} className="btn-primary" style={{ background: '#10b981' }} disabled={submitting}>
                  <CheckCircle size={16} /> Submit Exam
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
