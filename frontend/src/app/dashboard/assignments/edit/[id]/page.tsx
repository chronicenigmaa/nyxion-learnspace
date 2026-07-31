'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getAssignment, updateAssignment } from '@/lib/api'
import toast from 'react-hot-toast'
import { Upload, X, ArrowLeft, FileText, Trash2 } from 'lucide-react'
import Link from 'next/link'

const SUBJECT_OPTIONS = ['Mathematics', 'Physics', 'English', 'Chemistry', 'Biology', 'Science']
const CLASS_OPTIONS = ['Class 8A', 'Class 8B', 'Class 9A', 'Class 9B', 'Class 10A', 'Class 10B']

export default function EditAssignmentPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<any[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [form, setForm] = useState({
    title: '', description: '', subject: '', class_name: '',
    due_date: '', due_time: '23:59', max_marks: '100', allow_late: false
  })

  useEffect(() => {
    async function load() {
      try {
        const r = await getAssignment(id)
        const a = r.data
        const due = new Date(a.due_date)
        const pad = (n: number) => String(n).padStart(2, '0')
        setForm({
          title: a.title,
          description: a.description || '',
          subject: a.subject || '',
          class_name: a.class_name || '',
          due_date: `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`,
          due_time: `${pad(due.getHours())}:${pad(due.getMinutes())}`,
          max_marks: String(a.max_marks),
          allow_late: a.allow_late,
        })
        setExistingAttachments(a.attachments || [])
      } catch {
        toast.error('Failed to load assignment')
        router.push('/dashboard/assignments')
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [id, router])

  function set(k: string, v: any) { setForm(p => ({ ...p, [k]: v })) }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setNewFiles(prev => [...prev, ...Array.from(e.target.files!)])
  }

  function removeNewFile(i: number) { setNewFiles(f => f.filter((_, j) => j !== i)) }

  function removeExisting(attId: string) {
    setExistingAttachments(a => a.filter(x => x.id !== attId))
    setRemovedIds(r => [...r, attId])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.subject || !form.class_name || !form.due_date || !form.due_time) {
      toast.error('Please fill all required fields')
      return
    }
    setLoading(true)
    try {
      const data = new FormData()
      const dueDateTime = `${form.due_date}T${form.due_time}:00`
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'due_time') return
        if (k === 'due_date') { data.append('due_date', dueDateTime); return }
        data.append(k, String(v))
      })
      data.append('remove_attachment_ids', removedIds.join(','))
      newFiles.forEach(f => data.append('files', f))
      await updateAssignment(id, data)
      toast.success('Assignment updated!')
      router.push('/dashboard/assignments')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update')
    } finally { setLoading(false) }
  }

  if (fetching) {
    return (
      <div className="animate-fade-in max-w-2xl space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/assignments" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] font-display">Edit Assignment</h1>
          <p className="text-[var(--text-secondary)] text-sm">Changes are saved immediately</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--text-secondary)]">Details</h3>

          <div>
            <label className="label">Title *</label>
            <input className="input" placeholder="e.g. Chapter 5 Exercises" value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>

          <div>
            <label className="label">Instructions</label>
            <textarea className="input" rows={4} placeholder="Describe the assignment, requirements, format..." value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Subject *</label>
              <select className="input" value={form.subject} onChange={e => set('subject', e.target.value)} required>
                <option value="">Select subject</option>
                {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Class *</label>
              <select className="input" value={form.class_name} onChange={e => set('class_name', e.target.value)} required>
                <option value="">Select class</option>
                {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Max Marks</label>
            <input type="number" className="input" value={form.max_marks} onChange={e => set('max_marks', e.target.value)} min="1" max="1000" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-[var(--border)] hover:border-indigo-500/30 transition-colors"
            style={{ background: 'var(--surface-700)' }}>
            <input type="checkbox" className="w-4 h-4 accent-indigo-500" checked={form.allow_late} onChange={e => set('allow_late', e.target.checked)} />
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Allow late submissions</div>
              <div className="text-xs text-[var(--text-secondary)]">Students can still submit after the deadline</div>
            </div>
          </label>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--text-secondary)]">Deadline</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Due Date *</label>
              <input type="date" className="input" value={form.due_date} onChange={e => set('due_date', e.target.value)} required />
            </div>
            <div>
              <label className="label">Due Time *</label>
              <input type="time" className="input" value={form.due_time} onChange={e => set('due_time', e.target.value)} required />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-secondary)]" style={{ background: 'var(--surface-700)' }}>
            Students will see this assignment due on
            <span className="ml-1 text-[var(--text-primary)]">{form.due_date || 'select a date'} {form.due_time || 'select a time'}</span>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--text-secondary)] mb-4">Attachments</h3>

          {existingAttachments.length > 0 && (
            <div className="mb-3 space-y-2">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Current files</p>
              {existingAttachments.map(att => (
                <div key={att.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'var(--surface-600)' }}>
                  <FileText size={14} className="text-indigo-600 flex-shrink-0" />
                  <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{att.name}</span>
                  <button type="button" onClick={() => removeExisting(att.id)} className="text-[var(--text-secondary)] hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-indigo-500/50 transition-colors cursor-pointer"
            style={{ background: 'var(--surface-700)' }}>
            <Upload size={24} className="text-indigo-600" />
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">Add more files</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">PDF, DOCX, images, any format</p>
            </div>
            <input type="file" multiple className="hidden" onChange={handleFiles} />
          </label>

          {newFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {newFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'var(--surface-600)' }}>
                  <FileText size={14} className="text-green-600 flex-shrink-0" />
                  <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{(f.size / 1024).toFixed(0)} KB</span>
                  <button type="button" onClick={() => removeNewFile(i)} className="text-[var(--text-secondary)] hover:text-red-600">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link href="/dashboard/assignments" className="btn-secondary flex-1 justify-center">Cancel</Link>
          <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
