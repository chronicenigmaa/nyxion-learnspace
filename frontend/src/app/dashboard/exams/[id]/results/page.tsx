'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getExamResults, getExams } from '@/lib/api'
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function ExamResultsPage() {
  const { id } = useParams() as { id: string }
  const [results, setResults] = useState<any[]>([])
  const [exam, setExam] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getExamResults(id), getExams()])
      .then(([rRes, eRes]) => {
        setResults(rRes.data)
        setExam(eRes.data.find((e: any) => e.id === id))
      }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const avg = results.length ? Math.round(results.reduce((s, r) => s + (r.score || 0), 0) / results.length) : 0

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/exams" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white font-display">{exam?.title} — Results</h1>
          <p className="text-slate-400 text-sm">{results.length} students attempted · Avg score: {avg}</p>
        </div>
      </div>

      {loading ? <div className="skeleton h-40 rounded-xl" /> : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] grid grid-cols-5 text-xs text-slate-400 uppercase tracking-wider font-semibold">
            <span className="col-span-2">Student</span>
            <span className="text-center">Score</span>
            <span className="text-center">Violations</span>
            <span className="text-center">Status</span>
          </div>
          {results.map(r => (
            <div key={r.student_id} className="px-5 py-4 border-b border-[var(--border)] last:border-0 grid grid-cols-5 items-center hover:bg-[var(--surface-700)] transition-colors">
              <div className="col-span-2 text-sm font-medium text-white">{r.student_name}</div>
              <div className="text-center font-bold text-white">{r.score ?? '—'}</div>
              <div className="text-center">
                {r.violations > 0
                  ? <span className="badge badge-yellow"><AlertTriangle size={10} className="mr-1" />{r.violations}</span>
                  : <span className="text-slate-500 text-xs">0</span>}
              </div>
              <div className="text-center">
                {r.terminated
                  ? <span className="badge badge-red">Terminated</span>
                  : r.submitted_at
                    ? <span className="badge badge-green">Submitted</span>
                    : <span className="badge badge-gray">In Progress</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
