'use client'
import { useEffect, useState } from 'react'
import { getMyAttendance } from '@/lib/api'
import { Calendar, CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'

export default function MyAttendancePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAttendance().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="skeleton h-40 rounded-xl" />

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-white font-display">My Attendance</h1>

      {data && (
        <>
          <div className="grid grid-cols-4 gap-4">
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

          {data.percentage < 75 && (
            <div className="card p-4 border-yellow-500/30 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-yellow-400 font-semibold text-sm">Low Attendance</p>
                <p className="text-slate-400 text-xs">Your attendance is below 75%. Please attend regularly.</p>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] flex justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <span>Date</span><span>Subject</span><span>Status</span>
            </div>
            {(data.records || []).slice().reverse().map((r: any, i: number) => (
              <div key={i} className="px-5 py-3 border-b border-[var(--border)] last:border-0 flex justify-between items-center hover:bg-[var(--surface-700)] transition-colors">
                <span className="text-sm text-slate-300 font-mono">{r.date}</span>
                <span className="text-sm text-slate-400">{r.subject || '—'}</span>
                <span className={`flex items-center gap-1.5 text-sm font-medium ${r.is_present ? 'text-green-400' : 'text-red-400'}`}>
                  {r.is_present ? <><CheckCircle size={13} /> Present</> : <><XCircle size={13} /> Absent</>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
