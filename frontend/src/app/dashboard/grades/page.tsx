'use client'
import { useEffect, useState } from 'react'
import { getUser, getMyGrades } from '@/lib/api'
import { BarChart2, TrendingUp, Award } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function GradesPage() {
  const [user, setUser] = useState<any>(null)
  const [grades, setGrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(getUser())
    getMyGrades().then(r => setGrades(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length) : 0
  const highest = grades.length ? Math.max(...grades.map(g => g.percentage)) : 0
  const gradeLevel = avg >= 90 ? 'A+' : avg >= 80 ? 'A' : avg >= 70 ? 'B' : avg >= 60 ? 'C' : 'D'

  const chartData = grades.map(g => ({
    name: g.assignment_title.length > 12 ? g.assignment_title.slice(0, 12) + '…' : g.assignment_title,
    score: g.percentage,
    subject: g.subject,
  }))

  function gradeColor(pct: number) {
    if (pct >= 80) return '#10b981'
    if (pct >= 60) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Grades</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your academic performance</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : grades.length === 0 ? (
        <div className="card p-12 text-center">
          <BarChart2 size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No graded assignments yet</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5 text-center">
              <div className="text-4xl font-bold font-display gradient-text">{gradeLevel}</div>
              <div className="text-xs text-slate-400 mt-1">Overall Grade</div>
            </div>
            <div className="card p-5 text-center">
              <div className="text-4xl font-bold text-white font-display">{avg}%</div>
              <div className="text-xs text-slate-400 mt-1">Average Score</div>
            </div>
            <div className="card p-5 text-center">
              <div className="text-4xl font-bold text-green-400 font-display">{highest}%</div>
              <div className="text-xs text-slate-400 mt-1">Highest Score</div>
            </div>
          </div>

          {/* Bar chart */}
          {chartData.length > 1 && (
            <div className="card p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-400" /> Performance Chart
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 40, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} angle={-35} textAnchor="end" />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', color: '#e2e8f0' }}
                    formatter={(val: any) => [`${val}%`, 'Score']}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={gradeColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Grade table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] grid grid-cols-5 text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <span className="col-span-2">Assignment</span>
              <span>Subject</span>
              <span className="text-center">Marks</span>
              <span className="text-center">Grade</span>
            </div>
            {grades.map(g => (
              <div key={g.assignment_id} className="px-5 py-4 border-b border-[var(--border)] last:border-0 grid grid-cols-5 items-center hover:bg-[var(--surface-700)] transition-colors">
                <div className="col-span-2">
                  <div className="text-sm font-medium text-white">{g.assignment_title}</div>
                  {g.feedback && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{g.feedback}</div>}
                </div>
                <div className="text-xs text-slate-400">{g.subject}</div>
                <div className="text-center text-sm font-semibold text-white">
                  {g.marks_obtained}/{g.max_marks}
                </div>
                <div className="text-center">
                  <span className={`badge`} style={{ color: gradeColor(g.percentage), background: `${gradeColor(g.percentage)}18`, border: `1px solid ${gradeColor(g.percentage)}30` }}>
                    {g.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
