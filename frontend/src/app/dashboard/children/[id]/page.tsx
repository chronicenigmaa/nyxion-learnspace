'use client'
// PRODUCT: LearnSpace frontend (Vercel)
// PATH:    src/app/dashboard/children/[id]/page.tsx   (NEW FILE)
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getChildOverview, getChildFees } from '@/lib/api'
import {
  ArrowLeft, BarChart2, Calendar, FileText, ClipboardList,
  Wallet, CheckCircle, XCircle, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import toast from 'react-hot-toast'

function gradeColor(pct: number) {
  if (pct >= 80) return '#10b981'
  if (pct >= 60) return '#f59e0b'
  return '#ef4444'
}

export default function ChildDetailPage() {
  const params = useParams()
  const router = useRouter()
  const childId = String(params?.id || '')

  const [overview, setOverview] = useState<any>(null)
  const [fees, setFees] = useState<any>(null)
  const [feesUnavailable, setFeesUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => { if (childId) load() }, [childId])

  async function load() {
    setLoading(true)
    setError(false)
    setFeesUnavailable(false)
    try {
      const o = await getChildOverview(childId)
      setOverview(o.data)
    } catch {
      setError(true)
      toast.error('Could not load this child')
      setLoading(false)
      return
    }
    // Fees come from EduOS and may be unavailable; never block the page on them.
    try {
      const f = await getChildFees(childId)
      setFees(f.data)
    } catch {
      setFeesUnavailable(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="animate-fade-in space-y-4">
      <div className="skeleton h-8 w-56 rounded-lg" />
      <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      <div className="skeleton h-64 rounded-xl" />
    </div>
  )

  if (error || !overview) return (
    <div className="animate-fade-in space-y-4">
      <button onClick={() => router.push('/dashboard/children')} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={16} /> Back to my children
      </button>
      <div className="card p-12 text-center">
        <AlertTriangle size={32} className="text-red-600 mx-auto mb-3" />
        <p className="text-[var(--text-secondary)] font-medium">Could not load this child</p>
        <button onClick={load} className="btn-secondary mt-4">Retry</button>
      </div>
    </div>
  )

  const child = overview.child
  const grades: any[] = overview.grades || []
  const attendance = overview.attendance || { total: 0, present: 0, absent: 0, percentage: 0 }
  const assignments: any[] = overview.assignments || []
  const exams: any[] = overview.upcoming_exams || []

  const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length) : 0
  const chartData = grades.map(g => ({
    name: g.assignment_title?.length > 12 ? g.assignment_title.slice(0, 12) + '…' : g.assignment_title,
    score: g.percentage,
  }))

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push('/dashboard/children')}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-700)] transition-all flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-on-brand font-bold flex-shrink-0" style={{ background: '#6366f1' }}>
            {child.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] font-display truncate">{child.name}</h1>
            <p className="text-[var(--text-secondary)] text-xs">
              {child.class_name || 'No class'}{child.roll_number ? ` · Roll ${child.roll_number}` : ''}
            </p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-700)] transition-all flex-shrink-0">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold font-display text-[var(--text-primary)]">{avg}%</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">Average Grade</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold font-display" style={{ color: attendance.percentage >= 75 ? '#10b981' : '#f59e0b' }}>
            {attendance.percentage}%
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">Attendance</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold font-display text-[var(--text-primary)]">{assignments.length}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">Open Assignments</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold font-display text-[var(--text-primary)]">{exams.length}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">Upcoming Exams</div>
        </div>
      </div>

      {/* Grades */}
      <div className="card p-5">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-indigo-600" /> Grades
        </h3>
        {grades.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No graded work yet.</p>
        ) : (
          <>
            {chartData.length > 1 && (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 40, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} angle={-35} textAnchor="end" />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 10px 24px -6px rgba(15,23,42,0.12)', fontSize: '13px' }}
                    formatter={(val: any) => [`${val}%`, 'Score']}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={gradeColor(entry.score)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-4 space-y-2">
              {grades.map((g, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-[var(--border)] last:border-0 py-2">
                  <div className="min-w-0">
                    <div className="text-[var(--text-primary)] font-medium truncate">{g.assignment_title}</div>
                    <div className="text-xs text-[var(--text-muted)]">{g.subject}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[var(--text-secondary)]">{g.marks_obtained}/{g.max_marks}</span>
                    <span className="badge" style={{ color: gradeColor(g.percentage), background: `${gradeColor(g.percentage)}18`, border: `1px solid ${gradeColor(g.percentage)}30` }}>
                      {g.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Attendance */}
      <div className="card p-5">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-indigo-600" /> Attendance
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center"><div className="text-xl font-bold text-[var(--text-primary)]">{attendance.total}</div><div className="text-xs text-[var(--text-secondary)]">Total</div></div>
          <div className="text-center"><div className="text-xl font-bold text-green-600">{attendance.present}</div><div className="text-xs text-[var(--text-secondary)]">Present</div></div>
          <div className="text-center"><div className="text-xl font-bold text-red-600">{attendance.absent}</div><div className="text-xs text-[var(--text-secondary)]">Absent</div></div>
        </div>
        {attendance.percentage > 0 && attendance.percentage < 75 && (
          <div className="card p-3 border border-yellow-500/30 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
            <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0" />
            <p className="text-[var(--text-secondary)] text-xs">Attendance is below 75%. Please encourage regular attendance.</p>
          </div>
        )}
      </div>

      {/* Assignments */}
      <div className="card p-5">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <FileText size={16} className="text-indigo-600" /> Open Assignments
        </h3>
        {assignments.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">Nothing due right now.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-[var(--border)] last:border-0 py-2">
                <div className="min-w-0">
                  <div className="text-[var(--text-primary)] font-medium truncate">{a.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">{a.subject}</div>
                </div>
                <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                  {a.due_date ? `Due ${new Date(a.due_date).toLocaleDateString()}` : 'No due date'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming exams */}
      <div className="card p-5">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <ClipboardList size={16} className="text-indigo-600" /> Upcoming Exams
        </h3>
        {exams.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No exams scheduled.</p>
        ) : (
          <div className="space-y-2">
            {exams.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-[var(--border)] last:border-0 py-2">
                <div className="min-w-0">
                  <div className="text-[var(--text-primary)] font-medium truncate">{e.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">{e.subject}</div>
                </div>
                <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                  {e.scheduled_at ? new Date(e.scheduled_at).toLocaleDateString() : 'TBD'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fees (from EduOS) */}
      <div className="card p-5">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Wallet size={16} className="text-indigo-600" /> Fees
        </h3>
        {feesUnavailable ? (
          <p className="text-[var(--text-muted)] text-sm">Fee information isn’t available right now.</p>
        ) : !fees || (fees.fees || []).length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No fee records found.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-xl font-bold" style={{ color: (fees.total_due || 0) > 0 ? '#ef4444' : '#10b981' }}>
                  {fees.total_due ?? 0}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">Total Due</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-[var(--text-primary)]">{fees.months_overdue ?? 0}</div>
                <div className="text-xs text-[var(--text-secondary)]">Months Overdue</div>
              </div>
            </div>
            <div className="space-y-2">
              {(fees.fees || []).map((f: any, i: number) => {
                const paid = String(f.status).toLowerCase() === 'paid'
                return (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-[var(--border)] last:border-0 py-2">
                    <div className="min-w-0">
                      <div className="text-[var(--text-primary)] font-medium truncate">{f.month || '—'} {f.year || ''}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Paid {f.paid_amount ?? 0} of {f.amount ?? 0}
                      </div>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium flex-shrink-0 ${paid ? 'text-green-600' : 'text-red-600'}`}>
                      {paid ? <><CheckCircle size={13} /> Paid</> : <><XCircle size={13} /> {String(f.status || 'due')}</>}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}