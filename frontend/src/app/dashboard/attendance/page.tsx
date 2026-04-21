'use client'
import { useEffect, useState } from 'react'
import { getUser, getStudents, markAttendance, getClassAttendance } from '@/lib/api'
import toast from 'react-hot-toast'
import { Calendar, CheckCircle, XCircle, Users } from 'lucide-react'
import { format } from 'date-fns'

const CLASS_OPTIONS = ['8-A', '8-B', '9-A', '9-B', '10-A', '10-B']

export default function AttendancePage() {
  const [user, setUser] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [className, setClassName] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState<any[]>([])
  const [tab, setTab] = useState<'mark' | 'report'>('mark')

  useEffect(() => {
    const u = getUser()
    setUser(u)
  }, [])

  async function loadStudents() {
    if (!className) { toast.error('Select a class'); return }
    try {
      const r = await getStudents(className)
      setStudents(r.data)
      const init: Record<string, boolean> = {}
      r.data.forEach((s: any) => init[s.id] = true)
      setAttendance(init)
      if (r.data.length === 0) toast.error('No students found for this class')
    } catch { toast.error('Failed to load students') }
  }

  async function saveAttendance() {
    if (!className || students.length === 0) return
    setSaving(true)
    try {
      const records = students.map(s => ({
        student_id: s.id,
        student_name: s.name,
        class_name: s.class_name ? `${s.class_name}${s.section ? `-${s.section}` : ''}` : className,
        roll_number: s.roll_number,
        is_present: attendance[s.id] ?? true,
      }))
      await markAttendance({ class_name: className, date, records })
      toast.success('Attendance saved!')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function loadReport() {
    if (!className) { toast.error('Select a class'); return }
    try {
      const r = await getClassAttendance(className)
      setReport(r.data)
    } catch { toast.error('Failed to load report') }
  }

  const presentCount = Object.values(attendance).filter(Boolean).length
  const absentCount = students.length - presentCount

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Attendance</h1>
        <p className="text-slate-400 text-sm mt-0.5">Mark and track daily attendance</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface-800)', width: 'fit-content' }}>
        {['mark', 'report'].map(t => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'mark' ? 'Mark Attendance' : 'View Report'}
          </button>
        ))}
      </div>

      {tab === 'mark' && (
        <>
          <div className="card p-5 flex gap-4 flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="label">Class Name</label>
              <select className="input" value={className} onChange={e => setClassName(e.target.value)}>
                <option value="">Select class</option>
                {CLASS_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-40">
              <label className="label">Date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button onClick={loadStudents} className="btn-secondary">Load Students</button>
            </div>
          </div>

          {students.length > 0 && (
            <>
              <div className="flex items-center gap-4">
                <div className="card px-4 py-2 flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-400" />
                  <span className="text-sm text-white font-medium">{presentCount} Present</span>
                </div>
                <div className="card px-4 py-2 flex items-center gap-2">
                  <XCircle size={14} className="text-red-400" />
                  <span className="text-sm text-white font-medium">{absentCount} Absent</span>
                </div>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => { const a: Record<string, boolean> = {}; students.forEach(s => a[s.id] = true); setAttendance(a) }} className="btn-secondary py-1.5 text-sm">All Present</button>
                  <button onClick={() => { const a: Record<string, boolean> = {}; students.forEach(s => a[s.id] = false); setAttendance(a) }} className="btn-secondary py-1.5 text-sm">All Absent</button>
                </div>
              </div>

              <div className="card divide-y divide-[var(--border)]">
                {students.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-700)] transition-colors">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: '#6366f1' }}>
                      {s.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{s.name}</div>
                      <div className="text-xs text-slate-400">{s.roll_number || `#${i+1}`}</div>
                    </div>
                    <button onClick={() => setAttendance(a => ({ ...a, [s.id]: !a[s.id] }))}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${attendance[s.id] ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                      {attendance[s.id] ? <><CheckCircle size={14} /> Present</> : <><XCircle size={14} /> Absent</>}
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={saveAttendance} className="btn-primary w-full justify-center py-3" disabled={saving}>
                {saving ? 'Saving...' : `Save Attendance for ${date}`}
              </button>
            </>
          )}
          {className && students.length === 0 && (
            <div className="card p-6 text-sm text-slate-400">
              No students loaded for <span className="text-slate-200">{className}</span>. Check that students exist in this class-section in EduOS.
            </div>
          )}
        </>
      )}

      {tab === 'report' && (
        <>
          <div className="card p-5 flex gap-4">
            <div className="flex-1">
              <label className="label">Class Name</label>
              <select className="input" value={className} onChange={e => setClassName(e.target.value)}>
                <option value="">Select class</option>
                {CLASS_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={loadReport} className="btn-secondary">Load Report</button>
            </div>
          </div>

          {report.length > 0 && (
            <div className="card divide-y divide-[var(--border)]">
              <div className="px-5 py-3 grid grid-cols-5 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                <span className="col-span-2">Student</span>
                <span className="text-center">Present</span>
                <span className="text-center">Absent</span>
                <span className="text-center">%</span>
              </div>
              {report.map(r => (
                <div key={r.student_id} className="px-5 py-3.5 grid grid-cols-5 items-center hover:bg-[var(--surface-700)] transition-colors">
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-white">{r.student_name}</div>
                  </div>
                  <div className="text-center text-green-400 font-semibold text-sm">{r.present}</div>
                  <div className="text-center text-red-400 font-semibold text-sm">{r.absent}</div>
                  <div className="text-center">
                    <span className={`badge ${r.percentage >= 75 ? 'badge-green' : r.percentage >= 50 ? 'badge-yellow' : 'badge-red'}`}>
                      {r.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
