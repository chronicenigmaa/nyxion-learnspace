'use client'
import { useEffect, useState } from 'react'
import { getMyAttendance } from '@/lib/api'
import { Calendar, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MyAttendancePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const r = await getMyAttendance()
      setData(r.data)
    } catch {
      setError(true)
      toast.error('Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="animate-fade-in space-y-4">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      <div className="skeleton h-64 rounded-xl" />
    </div>
  )

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white font-display">My Attendance</h1>
        <button onClick={load} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--surface-700)] transition-all">
          <RefreshCw size={16} />
        </button>
      </div>

      {error ? (
        <div className="card p-12 text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">Failed to load attendance</p>
          <p className="text-slate-500 text-sm mt-1">Check your connection and try again.</p>
          <button onClick={load} className="btn-secondary mt-4">Retry</button>
        </div>
      ) : !data || data.total === 0 ? (
        <div className="card p-12 text-center">
          <Calendar size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">No attendance records yet</p>
          <p className="text-slate-500 text-sm mt-1">Your attendance will appear here once your teacher marks it.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Days', value: data.total, color: '#6366f1' },
              { label: 'Present', value: data.present, color: '#10b981' },
              { label: 'Absent', value: data.absent, color: '#ef4444' },
              { label: 'Percentage', value: `${data.percentage}%`, color: data.percentage >= 75 ? '#10b981' : data.percentage >= 50 ? '#f59e0b' : '#ef4444' },
            ].map(s => (
              <div key={s.label} className="card p-4 text-center">
                <div className="text-2xl font-bold font-display" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {data.percentage > 0 && data.percentage < 75 && (
            <div className="card p-4 border border-yellow-500/30 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-yellow-400 font-semibold text-sm">Low Attendance Warning</p>
                <p className="text-slate-400 text-xs">Your attendance is below 75%. Please attend regularly to avoid issues.</p>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] grid grid-cols-3 text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <span>Date</span><span>Subject</span><span>Status</span>
            </div>
            {data.records.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-500 text-sm">No records to display</div>
            ) : (
              data.records.slice().reverse().map((r: any, i: number) => (
                <div key={i} className="px-5 py-3 border-b border-[var(--border)] last:border-0 grid grid-cols-3 items-center hover:bg-[var(--surface-700)] transition-colors">
                  <span className="text-sm text-slate-300 font-mono">{r.date}</span>
                  <span className="text-sm text-slate-400">{r.subject || '—'}</span>
                  <span className={`flex items-center gap-1.5 text-sm font-medium ${r.is_present ? 'text-green-400' : 'text-red-400'}`}>
                    {r.is_present ? <><CheckCircle size={13} /> Present</> : <><XCircle size={13} /> Absent</>}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
