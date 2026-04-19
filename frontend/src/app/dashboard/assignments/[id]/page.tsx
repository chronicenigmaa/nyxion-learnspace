'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getUser, getAssignment, getSubmissionsForAssignment, getMySubmission, submitAssignment, gradeSubmission } from '@/lib/api'
import toast from 'react-hot-toast'
import { Upload, X, FileText, Download, AlertTriangle, CheckCircle, Clock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function AssignmentDetailPage() {
  const { id } = useParams() as { id: string }
  const [user, setUser] = useState<any>(null)
  const [assignment, setAssignment] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [mySubmission, setMySubmission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [gradingId, setGradingId] = useState<string | null>(null)
  const [gradeForm, setGradeForm] = useState({ marks: '', feedback: '' })

  useEffect(() => {
    const u = getUser()
    setUser(u)
    loadData(u)
  }, [id])

  async function loadData(u: any) {
    try {
      const [aRes] = await Promise.all([getAssignment(id)])
      setAssignment(aRes.data)

      if (u?.role === 'teacher' || u?.role === 'school_admin') {
        const sRes = await getSubmissionsForAssignment(id)
        setSubmissions(sRes.data)
      } else if (u?.role === 'student') {
        try {
          const mRes = await getMySubmission(id)
          setMySubmission(mRes.data)
        } catch {}
      }
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content && files.length === 0) { toast.error('Please add content or files'); return }
    setSubmitting(true)
    try {
      const data = new FormData()
      data.append('assignment_id', id)
      data.append('content', content)
      files.forEach(f => data.append('files', f))
      const res = await submitAssignment(data)
      setMySubmission(res.data)
      toast.success('Assignment submitted!')
      setFiles([])
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Submission failed')
    } finally { setSubmitting(false) }
  }

  async function handleGrade(submissionId: string) {
    const data = new FormData()
    data.append('marks', gradeForm.marks)
    data.append('feedback', gradeForm.feedback)
    try {
      await gradeSubmission(submissionId, data)
      toast.success('Graded!')
      setGradingId(null)
      loadData(user)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Grading failed')
    }
  }

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
  if (!assignment) return <p className="text-slate-400">Assignment not found</p>

  const isTeacher = user?.role === 'teacher' || user?.role === 'school_admin'
  const due = new Date(assignment.due_date)
  const overdue = due < new Date()

  return (
    <div className="animate-fade-in max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/assignments" className="text-slate-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-white font-display flex-1">{assignment.title}</h1>
        <span className={`badge ${assignment.status === 'published' ? 'badge-green' : 'badge-gray'}`}>{assignment.status}</span>
      </div>

      {/* Assignment info */}
      <div className="card p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            ['Subject', assignment.subject],
            ['Class', assignment.class_name],
            ['Max Marks', assignment.max_marks],
            ['Due', format(due, 'MMM d, h:mm a')],
          ].map(([l, v]) => (
            <div key={l as string}>
              <div className="text-xs text-slate-400 uppercase tracking-wider">{l}</div>
              <div className={`text-sm font-semibold mt-0.5 ${l === 'Due' && overdue ? 'text-red-400' : 'text-white'}`}>{v}</div>
            </div>
          ))}
        </div>
        {assignment.description && (
          <p className="text-sm text-slate-300 leading-relaxed border-t border-[var(--border)] pt-4">{assignment.description}</p>
        )}
        {assignment.attachments?.length > 0 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {assignment.attachments.map((f: any) => (
              <a key={f.id} href={f.path} download={f.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/50 transition-all"
                style={{ background: 'rgba(99,102,241,0.08)' }}>
                <Download size={12} /> {f.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Student submission form */}
      {!isTeacher && (
        <div className="card p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            {mySubmission ? <CheckCircle size={16} className="text-green-400" /> : <Clock size={16} className="text-indigo-400" />}
            {mySubmission ? 'Your Submission' : 'Submit Assignment'}
          </h3>

          {mySubmission?.status === 'graded' ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-green-500/30" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-green-400 font-semibold">Graded</span>
                  <span className="text-2xl font-bold text-white">{mySubmission.marks_obtained}/{assignment.max_marks}</span>
                </div>
                {mySubmission.feedback && <p className="text-slate-300 text-sm mt-2">{mySubmission.feedback}</p>}
              </div>
              {mySubmission.plagiarism_score > 40 && (
                <div className="p-3 rounded-lg border border-yellow-500/30 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  <AlertTriangle size={14} className="text-yellow-400" />
                  <span className="text-yellow-400 text-sm">Similarity: {mySubmission.plagiarism_score}%</span>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mySubmission && (
                <div className="p-3 rounded-lg border border-indigo-500/30 text-sm text-indigo-300"
                  style={{ background: 'rgba(99,102,241,0.1)' }}>
                  ✓ Already submitted on {format(new Date(mySubmission.submitted_at), 'MMM d, h:mm a')} — you can re-submit
                </div>
              )}
              <div>
                <label className="label">Written Answer</label>
                <textarea className="input" rows={6} placeholder="Write your answer here..." value={content} onChange={e => setContent(e.target.value)} />
              </div>
              <div>
                <label className="label">File Uploads</label>
                <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-indigo-500/50 cursor-pointer transition-colors"
                  style={{ background: 'var(--surface-700)' }}>
                  <Upload size={18} className="text-indigo-400" />
                  <span className="text-sm text-slate-300">Click to upload files</span>
                  <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) setFiles(p => [...p, ...Array.from(e.target.files!)]) }} />
                </label>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 mt-2 p-2 rounded-lg" style={{ background: 'var(--surface-600)' }}>
                    <FileText size={12} className="text-indigo-400" />
                    <span className="text-xs text-white flex-1 truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}><X size={12} className="text-slate-400 hover:text-red-400" /></button>
                  </div>
                ))}
              </div>
              <button type="submit" className="btn-primary w-full justify-center" disabled={submitting || (overdue && !assignment.allow_late)}>
                {overdue && !assignment.allow_late ? 'Deadline Passed' : submitting ? 'Submitting...' : mySubmission ? 'Re-submit' : 'Submit Assignment'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Teacher: submissions list */}
      {isTeacher && (
        <div className="card p-5">
          <h3 className="font-semibold text-white mb-4">{submissions.length} Submissions</h3>
          {submissions.length === 0 ? (
            <p className="text-slate-500 text-sm">No submissions yet</p>
          ) : (
            <div className="space-y-3">
              {submissions.map(s => (
                <div key={s.id} className="p-4 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface-700)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{s.student_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Submitted {s.submitted_at ? format(new Date(s.submitted_at), 'MMM d, h:mm a') : 'N/A'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.plagiarism_score > 60 && (
                        <span className="badge badge-red"><AlertTriangle size={10} className="mr-1" />{s.plagiarism_score}% match</span>
                      )}
                      {s.plagiarism_score > 0 && s.plagiarism_score <= 60 && (
                        <span className="badge badge-yellow">{s.plagiarism_score}% similar</span>
                      )}
                      <span className={`badge ${s.status === 'graded' ? 'badge-green' : s.status === 'late' ? 'badge-yellow' : 'badge-blue'}`}>{s.status}</span>
                    </div>
                  </div>

                  {s.content && <p className="text-sm text-slate-300 mt-2 line-clamp-2">{s.content}</p>}

                  {s.status === 'graded' ? (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <CheckCircle size={14} className="text-green-400" />
                      <span className="text-green-400 font-semibold">{s.marks_obtained}/{assignment.max_marks}</span>
                      {s.feedback && <span className="text-slate-400">— {s.feedback}</span>}
                    </div>
                  ) : (
                    gradingId === s.id ? (
                      <div className="mt-3 flex gap-2">
                        <input type="number" className="input py-1.5 text-sm" placeholder={`Marks (max ${assignment.max_marks})`}
                          value={gradeForm.marks} onChange={e => setGradeForm(p => ({ ...p, marks: e.target.value }))} style={{ flex: '0 0 140px' }} />
                        <input className="input py-1.5 text-sm flex-1" placeholder="Feedback (optional)"
                          value={gradeForm.feedback} onChange={e => setGradeForm(p => ({ ...p, feedback: e.target.value }))} />
                        <button onClick={() => handleGrade(s.id)} className="btn-primary py-1.5">Grade</button>
                        <button onClick={() => setGradingId(null)} className="btn-secondary py-1.5">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setGradingId(s.id); setGradeForm({ marks: '', feedback: '' }) }}
                        className="btn-secondary mt-3 py-1.5 text-sm">Grade</button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
