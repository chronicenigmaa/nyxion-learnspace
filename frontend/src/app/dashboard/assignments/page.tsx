'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getUser, getAssignments, deleteAssignment, updateAssignmentStatus } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, FileText, Trash2, Eye, ToggleLeft, ToggleRight, AlertTriangle, Download } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

export default function AssignmentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    setUser(getUser())
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await getAssignments()
      setAssignments(r.data)
    } catch { toast.error('Failed to load assignments') }
    finally { setLoading(false) }
  }

  const isTeacher = user?.role === 'teacher' || user?.role === 'school_admin'

  const filtered = assignments.filter(a => {
    if (filter === 'all') return true
    if (filter === 'active') return a.status === 'published' && new Date(a.due_date) > new Date()
    if (filter === 'overdue') return new Date(a.due_date) < new Date()
    return a.status === filter
  })

  async function handleDelete(id: string) {
    if (!confirm('Delete this assignment?')) return
    try {
      await deleteAssignment(id)
      toast.success('Assignment deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  async function handleToggleStatus(a: any) {
    const newStatus = a.status === 'published' ? 'closed' : 'published'
    try {
      await updateAssignmentStatus(a.id, newStatus)
      toast.success(`Assignment ${newStatus}`)
      load()
    } catch { toast.error('Failed to update') }
  }

  const FILTERS = ['all', 'active', 'published', 'closed', 'overdue']

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Assignments</h1>
          <p className="text-slate-400 text-sm mt-0.5">{filtered.length} assignment{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {isTeacher && (
          <Link href="/dashboard/assignments/create" className="btn-primary">
            <Plus size={16} /> New Assignment
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white border border-[var(--border)]'}`}
            style={filter === f ? {} : { background: 'var(--surface-700)' }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No assignments found</p>
          {isTeacher && <Link href="/dashboard/assignments/create" className="btn-primary mt-4 inline-flex">Create one</Link>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const due = new Date(a.due_date)
            const overdue = due < new Date()
            const dueText = overdue
              ? `Overdue by ${formatDistanceToNow(due)}`
              : `Due in ${formatDistanceToNow(due)}`

            return (
              <div
                key={a.id}
                onClick={() => router.push(`/dashboard/assignments/${a.id}`)}
                className="card group cursor-pointer p-5 transition-colors hover:border-indigo-500/30"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.15)' }}>
                    <FileText size={18} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {a.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {a.subject} · {a.class_name} · {a.max_marks} marks
                          {isTeacher && ` · ${a.submission_count} submissions`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`badge ${a.status === 'published' ? 'badge-green' : 'badge-gray'}`}>{a.status}</span>
                        {overdue && <span className="badge badge-red"><AlertTriangle size={10} className="mr-1" />Overdue</span>}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{dueText} · {format(due, 'MMM d, yyyy h:mm a')}</p>

                    {/* Attachments */}
                    {a.attachments?.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {a.attachments.map((f: any) => (
                          <a key={f.id} href={f.path} download={f.name}
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/50 transition-colors"
                            style={{ background: 'rgba(99,102,241,0.08)' }}>
                            <Download size={11} /> {f.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link href={`/dashboard/assignments/${a.id}`}
                      onClick={e => e.stopPropagation()}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--surface-700)] transition-all">
                      <Eye size={16} />
                    </Link>
                    {isTeacher && (
                      <>
                        <button onClick={e => { e.stopPropagation(); handleToggleStatus(a) }}
                          className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 transition-all">
                          {a.status === 'published' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(a.id) }}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all">
                          <Trash2 size={16} />
                        </button>
                      </>
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
