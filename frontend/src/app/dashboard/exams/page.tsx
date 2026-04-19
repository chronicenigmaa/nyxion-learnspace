'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, getExams, startExam, endExam } from '@/lib/api'
import toast from 'react-hot-toast'
import { ClipboardList, Plus, Play, Square, Eye, AlertTriangle, Shield } from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'

export default function ExamsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { setUser(getUser()); load() }, [])

  async function load() {
    setLoading(true)
    try { const r = await getExams(); setExams(r.data) } catch {}
    finally { setLoading(false) }
  }

  const isTeacher = user?.role === 'teacher' || user?.role === 'school_admin'

  async function handleStart(id: string) {
    try { await startExam(id); toast.success('Exam is now live!'); load() } catch { toast.error('Failed') }
  }
  async function handleEnd(id: string) {
    if (!confirm('End this exam? Students cannot submit after this.')) return
    try { await endExam(id); toast.success('Exam ended'); load() } catch { toast.error('Failed') }
  }

  const STATUS_COLORS: Record<string, string> = { scheduled: 'badge-blue', live: 'badge-red', ended: 'badge-gray' }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Exams</h1>
          <p className="text-slate-400 text-sm mt-0.5">{isTeacher ? 'Schedule and monitor live exams' : 'Your upcoming exams'}</p>
        </div>
        {isTeacher && (
          <Link href="/dashboard/exams/create" className="btn-primary">
            <Plus size={16} /> Schedule Exam
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : exams.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardList size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No exams scheduled</p>
          {isTeacher && <Link href="/dashboard/exams/create" className="btn-primary mt-4 inline-flex">Create first exam</Link>}
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map(exam => {
            const scheduled = new Date(exam.scheduled_at)
            return (
              <div key={exam.id} className={`card p-5 transition-colors ${exam.status === 'live' ? 'border-red-500/40' : 'hover:border-indigo-500/30'}`}
                style={exam.status === 'live' ? { background: 'rgba(239,68,68,0.04)' } : {}}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: exam.status === 'live' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)' }}>
                    <ClipboardList size={18} className={exam.status === 'live' ? 'text-red-400' : 'text-indigo-400'} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          {exam.status === 'live' && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                          <h3 className="font-semibold text-white">{exam.title}</h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {exam.subject} · {exam.class_name} · {exam.duration_minutes} min · {exam.question_count} questions
                        </p>
                      </div>
                      <span className={`badge ${STATUS_COLORS[exam.status]}`}>{exam.status}</span>
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-slate-400 font-mono">
                        {exam.status === 'scheduled' ? `Starts ${formatDistanceToNow(scheduled, { addSuffix: true })}` : format(scheduled, 'MMM d, h:mm a')}
                      </span>
                      <div className="flex items-center gap-1">
                        {exam.restrict_tab_switch && <span title="Tab restriction" className="text-xs text-yellow-500">🛡</span>}
                        {exam.fullscreen_required && <span title="Fullscreen required" className="text-xs text-yellow-500">⛶</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isTeacher ? (
                      <>
                        {exam.status === 'scheduled' && (
                          <button onClick={() => handleStart(exam.id)} className="btn-primary py-1.5 text-sm" style={{ background: '#10b981' }}>
                            <Play size={14} /> Go Live
                          </button>
                        )}
                        {exam.status === 'live' && (
                          <button onClick={() => handleEnd(exam.id)} className="btn-primary py-1.5 text-sm" style={{ background: '#ef4444' }}>
                            <Square size={14} /> End Exam
                          </button>
                        )}
                        <Link href={`/dashboard/exams/${exam.id}/results`}
                          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--surface-700)] transition-all">
                          <Eye size={16} />
                        </Link>
                      </>
                    ) : (
                      exam.status === 'live' ? (
                        <Link href={`/exam/${exam.id}`} className="btn-primary" style={{ background: '#ef4444' }}>
                          Enter Exam
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {exam.status === 'scheduled' ? 'Not started' : 'Exam ended'}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
