'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getExamAttemptDetail, gradeExamAttempt } from '@/lib/api'
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ExamAttemptDetailPage() {
  const { id, attemptId } = useParams() as { id: string; attemptId: string }
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [manualGrades, setManualGrades] = useState<Record<string, string>>({})

  useEffect(() => {
    getExamAttemptDetail(id, attemptId)
      .then((res) => {
        setData(res.data)
        const initialGrades: Record<string, string> = {}
        for (const question of res.data.questions || []) {
          if (question.type === 'mcq') continue
          initialGrades[question.id] = question.awarded_marks != null ? String(question.awarded_marks) : ''
        }
        setManualGrades(initialGrades)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [id, attemptId])

  async function handleSaveGrades() {
    if (!data) return
    const questionGrades = (data.questions || [])
      .filter((question: any) => question.type !== 'mcq')
      .map((question: any) => {
        const rawValue = manualGrades[question.id]
        return {
          question_id: question.id,
          awarded_marks: rawValue === '' ? 0 : Number(rawValue),
        }
      })

    if (questionGrades.some((grade: any) => Number.isNaN(grade.awarded_marks))) {
      toast.error('Enter valid marks for all manual-review questions')
      return
    }

    setSaving(true)
    try {
      await gradeExamAttempt(id, attemptId, { question_grades: questionGrades })
      const refreshed = await getExamAttemptDetail(id, attemptId)
      setData(refreshed.data)
      const nextGrades: Record<string, string> = {}
      for (const question of refreshed.data.questions || []) {
        if (question.type === 'mcq') continue
        nextGrades[question.id] = question.awarded_marks != null ? String(question.awarded_marks) : ''
      }
      setManualGrades(nextGrades)
      toast.success('Exam grading saved')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save grades')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="skeleton h-72 rounded-xl" />
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-300 font-medium">Could not load exam submission</p>
        <Link href={`/dashboard/exams/${id}/results`} className="btn-secondary mt-4 inline-flex">
          Back to Results
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/exams/${id}/results`} className="text-slate-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white font-display">{data.exam.title} Submission</h1>
          <p className="text-slate-400 text-sm">
            {data.student.name} · {data.exam.subject} · Score {data.score ?? '—'} / {data.exam.total_marks}
          </p>
        </div>
        <div className="ml-auto">
          <button onClick={handleSaveGrades} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Grades'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-slate-400">Started</div>
          <div className="text-sm text-white mt-1">{data.started_at ? new Date(data.started_at).toLocaleString() : '—'}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-400">Submitted</div>
          <div className="text-sm text-white mt-1">{data.submitted_at ? new Date(data.submitted_at).toLocaleString() : 'In progress'}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-400">Tab Switches</div>
          <div className="text-sm text-white mt-1">{data.tab_switches}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-400">Status</div>
          <div className="text-sm mt-1">
            {data.terminated
              ? <span className="badge badge-red">Terminated</span>
              : data.submitted_at
                ? <span className="badge badge-green">Submitted</span>
                : <span className="badge badge-gray">In Progress</span>}
          </div>
        </div>
      </div>

      {data.termination_reason && (
        <div className="card p-4 border border-red-500/30" style={{ background: 'rgba(239,68,68,0.08)' }}>
          <p className="text-red-400 text-sm font-medium">Termination Reason</p>
          <p className="text-slate-300 text-sm mt-1">{data.termination_reason}</p>
        </div>
      )}

      {data.violations.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-white mb-3">Violation Log</h2>
          <div className="space-y-2">
            {data.violations.map((violation: any, index: number) => (
              <div key={index} className="rounded-lg p-3" style={{ background: 'var(--surface-700)' }}>
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <AlertTriangle size={14} />
                  <span className="font-medium">{violation.type}</span>
                </div>
                <p className="text-slate-300 text-sm mt-1">{violation.details || 'No details provided.'}</p>
                <p className="text-slate-500 text-xs mt-1">{violation.timestamp ? new Date(violation.timestamp).toLocaleString() : '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {data.questions.map((question: any, index: number) => (
          <div key={question.id || index} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Question {index + 1}</p>
                <h3 className="text-white font-medium mt-1">{question.question}</h3>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">{question.marks} marks</p>
                {question.is_correct === true && (
                  <span className="inline-flex items-center gap-1 text-green-400 text-xs mt-1">
                    <CheckCircle size={12} />
                    Correct
                  </span>
                )}
                {question.is_correct === false && (
                  <span className="inline-flex items-center gap-1 text-red-400 text-xs mt-1">
                    <XCircle size={12} />
                    Incorrect
                  </span>
                )}
              </div>
            </div>

            {question.options?.length > 0 && (
              <div className="mt-4 space-y-2">
                {question.options.map((option: string, optionIndex: number) => {
                  const isSelected = option === question.student_answer
                  const isCorrectOption = option === question.correct_answer
                  return (
                    <div
                      key={optionIndex}
                      className="rounded-lg px-3 py-2 text-sm border"
                      style={{
                        background: isSelected ? 'rgba(99,102,241,0.12)' : 'var(--surface-700)',
                        borderColor: isCorrectOption ? 'rgba(16,185,129,0.35)' : isSelected ? 'rgba(99,102,241,0.35)' : 'var(--border)',
                      }}
                    >
                      <span className={isCorrectOption ? 'text-green-400' : isSelected ? 'text-indigo-300' : 'text-slate-300'}>
                        {option}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: 'var(--surface-700)' }}>
                <p className="text-xs text-slate-400">Student Answer</p>
                <p className="text-sm text-white mt-1 whitespace-pre-wrap">{question.student_answer || 'No answer submitted.'}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--surface-700)' }}>
                <p className="text-xs text-slate-400">Correct Answer</p>
                <p className="text-sm text-white mt-1 whitespace-pre-wrap">{question.correct_answer || 'Manual review required.'}</p>
              </div>
            </div>

            {question.type !== 'mcq' && (
              <div className="mt-4 rounded-lg p-3 border border-indigo-500/20" style={{ background: 'rgba(99,102,241,0.08)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Teacher Grading</p>
                    <p className="text-xs text-slate-400 mt-1">Award marks for this manual-review response.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={question.marks}
                      step="0.5"
                      value={manualGrades[question.id] ?? ''}
                      onChange={(e) => setManualGrades((prev) => ({ ...prev, [question.id]: e.target.value }))}
                      className="input w-24 text-center"
                    />
                    <span className="text-sm text-slate-400">/ {question.marks}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
