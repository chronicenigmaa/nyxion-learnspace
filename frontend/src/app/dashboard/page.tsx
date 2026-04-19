'use client'
import { useEffect, useState } from 'react'
import { getUser, getAssignments, getExams, getMyAttendance, getMyGrades, getNotes } from '@/lib/api'
import { FileText, ClipboardList, BookOpen, BarChart2, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any>(null)
  const [grades, setGrades] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])

  useEffect(() => {
    const u = getUser()
    setUser(u)
    if (!u) return

    getAssignments().then(r => setAssignments(r.data)).catch(() => {})
    getExams().then(r => setExams(r.data)).catch(() => {})
    getNotes().then(r => setNotes(r.data)).catch(() => {})

    if (u.role === 'student') {
      getMyAttendance().then(r => setAttendance(r.data)).catch(() => {})
      getMyGrades().then(r => setGrades(r.data)).catch(() => {})
    }
  }, [])

  if (!user) return null

  const isTeacher = user.role === 'teacher' || user.role === 'school_admin'
  const isStudent = user.role === 'student'

  const avgGrade = grades.length
    ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length)
    : null

  const pendingAssignments = assignments.filter(a => {
    const due = new Date(a.due_date)
    return due > new Date() && a.status === 'published'
  })

  const liveExams = exams.filter(e => e.status === 'live')

  return (
    <div className="animate-fade-in space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white font-display">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
          {isStudent && user.class_name && ` · ${user.class_name}`}
          {isTeacher && user.subject && ` · ${user.subject}`}
        </p>
      </div>

      {/* Live exam alert */}
      {liveExams.length > 0 && (
        <div className="rounded-xl p-4 border border-red-500/30 flex items-center gap-4"
          style={{ background: 'rgba(239,68,68,0.1)' }}>
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <div className="flex-1">
            <p className="text-red-400 font-semibold text-sm">🔴 Live Exam In Progress</p>
            <p className="text-slate-300 text-sm">{liveExams[0].title} — {liveExams[0].subject}</p>
          </div>
          <Link href="/dashboard/exams" className="btn-primary" style={{ background: '#ef4444' }}>
            {isStudent ? 'Join Exam' : 'Monitor'}
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Assignments" value={assignments.length} sub={isStudent ? `${pendingAssignments.length} pending` : `${assignments.filter(a => a.status === 'published').length} active`} color="#6366f1" />
        <StatCard icon={ClipboardList} label="Exams" value={exams.length} sub={`${liveExams.length} live now`} color="#8b5cf6" />
        <StatCard icon={BookOpen} label="Notes" value={notes.length} sub="Available resources" color="#06b6d4" />
        {isStudent
          ? <StatCard icon={BarChart2} label="Avg Grade" value={avgGrade !== null ? `${avgGrade}%` : '—'} sub={`${grades.length} graded`} color="#10b981" />
          : <StatCard icon={BarChart2} label="Students" value="—" sub="View in Students" color="#10b981" />
        }
      </div>

      {/* Student: attendance card */}
      {isStudent && attendance && (
        <div className="card p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-indigo-400" /> Attendance Overview
          </h3>
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--surface-700)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3"
                  strokeDasharray={`${attendance.percentage} ${100 - attendance.percentage}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{attendance.percentage}%</span>
              </div>
            </div>
            <div className="flex gap-6">
              <div><div className="text-2xl font-bold text-green-400">{attendance.present}</div><div className="text-xs text-slate-400">Present</div></div>
              <div><div className="text-2xl font-bold text-red-400">{attendance.absent}</div><div className="text-xs text-slate-400">Absent</div></div>
              <div><div className="text-2xl font-bold text-white">{attendance.total}</div><div className="text-xs text-slate-400">Total</div></div>
            </div>
          </div>
        </div>
      )}

      {/* Recent assignments */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Clock size={16} className="text-indigo-400" />
            {isTeacher ? 'Your Assignments' : 'Recent Assignments'}
          </h3>
          <Link href="/dashboard/assignments" className="text-indigo-400 text-xs hover:text-indigo-300">View all →</Link>
        </div>
        {assignments.length === 0 ? (
          <p className="text-slate-500 text-sm">No assignments yet.</p>
        ) : (
          <div className="space-y-2">
            {assignments.slice(0, 5).map(a => {
              const due = new Date(a.due_date)
              const overdue = due < new Date()
              return (
                <Link href={`/dashboard/assignments/${a.id}`} key={a.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--surface-700)] transition-colors group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.15)' }}>
                    <FileText size={14} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate group-hover:text-indigo-300">{a.title}</div>
                    <div className="text-xs text-slate-400">{a.subject} · {a.class_name}</div>
                  </div>
                  <div className={`text-xs font-mono ${overdue ? 'text-red-400' : 'text-slate-400'}`}>
                    {overdue ? 'Overdue' : format(due, 'MMM d')}
                  </div>
                  <span className={`badge ${a.status === 'published' ? 'badge-green' : 'badge-gray'}`}>{a.status}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-white font-display">{value}</div>
      <div className="text-xs font-semibold text-slate-300 mt-0.5">{label}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </div>
  )
}
