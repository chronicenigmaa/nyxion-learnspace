'use client'
import { useEffect, useState } from 'react'
import { api, getUser } from '@/lib/api'
import toast from 'react-hot-toast'
import { BookOpen, Plus, Trash2, Download, Sparkles, FileText } from 'lucide-react'

interface Coursebook {
  id: string
  title: string
  subject: string
  class_name: string
  description: string
  file_path: string
  file_name: string
  uploaded_by: string
  created_at: string
}

export default function CoursebooksPage() {
  const user = getUser()
  const isTeacher = user?.role === 'teacher' || user?.role === 'school_admin' || user?.role === 'super_admin'
  const [books, setBooks] = useState<Coursebook[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', subject: '', class_name: '', description: '' })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState('')
  const [ai, setAi] = useState({ open: false, subject: '', class_name: '', topic: '', loading: false, result: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/api/v1/coursebooks/')
      setBooks(data)
    } catch { toast.error('Failed to load coursebooks') }
    finally { setLoading(false) }
  }

  async function handleUpload() {
    if (!form.title || !form.subject || !form.class_name) { toast.error('Fill in title, subject, and class'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (file) fd.append('file', file)
      await api.post('/api/v1/coursebooks/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Coursebook added')
      setShowAdd(false)
      setForm({ title: '', subject: '', class_name: '', description: '' })
      setFile(null)
      load()
    } catch { toast.error('Failed to upload') }
    finally { setUploading(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this coursebook?')) return
    try {
      await api.delete(`/api/v1/coursebooks/${id}`)
      toast.success('Deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  async function generateLessonPlan() {
    if (!ai.subject || !ai.class_name || !ai.topic) { toast.error('Fill in all fields'); return }
    setAi(a => ({ ...a, loading: true, result: '' }))
    try {
      const { data } = await api.post('/api/v1/ai/lesson-planner', {
        subject: ai.subject, class_name: ai.class_name, topic: ai.topic, duration_minutes: 45
      })
      setAi(a => ({ ...a, loading: false, result: data.response }))
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'AI error')
      setAi(a => ({ ...a, loading: false }))
    }
  }

  const subjects = [...new Set(books.map(b => b.subject))].filter(Boolean)
  const filtered = filter ? books.filter(b => b.subject === filter) : books

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Coursebooks</h1>
          <p className="text-slate-400 text-sm mt-0.5">{filtered.length} resource{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAi(a => ({ ...a, open: true }))}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-all">
            <Sparkles size={15} /> Lesson Planner
          </button>
          {isTeacher && (
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus size={16} /> Add Book
            </button>
          )}
        </div>
      </div>

      {/* Subject filter pills */}
      {subjects.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${!filter ? 'bg-indigo-600 text-white' : 'text-slate-400 border border-[var(--border)]'}`}
            style={!filter ? {} : { background: 'var(--surface-700)' }}>All</button>
          {subjects.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${filter === s ? 'bg-indigo-600 text-white' : 'text-slate-400 border border-[var(--border)]'}`}
              style={filter === s ? {} : { background: 'var(--surface-700)' }}>{s}</button>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card p-5 border-indigo-500/30">
          <h3 className="text-white font-medium mb-4">Add Coursebook</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Title</label>
              <input className="input w-full" placeholder="e.g. Physics Textbook Grade 10"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Subject</label>
              <input className="input w-full" placeholder="e.g. Physics"
                value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Class</label>
              <input className="input w-full" placeholder="e.g. Grade 10"
                value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
              <input className="input w-full" placeholder="Brief description..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">File (optional)</label>
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx"
                className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 w-full"
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Save'}
            </button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Books grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No coursebooks found</p>
          {isTeacher && <button onClick={() => setShowAdd(true)} className="btn-primary mt-4">Add one</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(book => (
            <div key={book.id} className="card p-5 flex flex-col gap-3 group hover:border-indigo-500/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.15)' }}>
                  <BookOpen size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{book.title}</h3>
                  <p className="text-xs text-slate-400">{book.subject} · {book.class_name}</p>
                </div>
              </div>
              {book.description && <p className="text-xs text-slate-500 leading-relaxed">{book.description}</p>}
              <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[var(--border)]">
                {book.file_path && (
                  <a href={`${process.env.NEXT_PUBLIC_API_URL}${book.file_path}`} target="_blank"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/10 transition-all">
                    <Download size={11} /> Download
                  </a>
                )}
                <button
                  onClick={() => setAi(a => ({ ...a, open: true, subject: book.subject, class_name: book.class_name }))}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-purple-400 border border-purple-500/20 hover:bg-purple-500/10 transition-all">
                  <Sparkles size={11} /> Plan Lesson
                </button>
                {isTeacher && (
                  <button onClick={() => handleDelete(book.id)}
                    className="ml-auto p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lesson Planner Modal */}
      {ai.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] overflow-hidden" style={{ background: 'var(--surface-850)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <span className="text-white font-medium">AI Lesson Planner</span>
              </div>
              <button onClick={() => setAi(a => ({ ...a, open: false, result: '' }))} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Subject</label>
                  <input className="input w-full" placeholder="e.g. Biology" value={ai.subject}
                    onChange={e => setAi(a => ({ ...a, subject: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Class</label>
                  <input className="input w-full" placeholder="e.g. Grade 9" value={ai.class_name}
                    onChange={e => setAi(a => ({ ...a, class_name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Topic</label>
                  <input className="input w-full" placeholder="e.g. Cell Division" value={ai.topic}
                    onChange={e => setAi(a => ({ ...a, topic: e.target.value }))} />
                </div>
              </div>
              <button className="btn-primary w-full" onClick={generateLessonPlan} disabled={ai.loading}>
                {ai.loading ? 'Generating...' : 'Generate Lesson Plan'}
              </button>
              {ai.result && (
                <div className="rounded-xl border border-[var(--border)] p-4 max-h-96 overflow-y-auto" style={{ background: 'var(--surface-900)' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-400">Lesson Plan</span>
                    <button className="text-xs text-slate-400 hover:text-white" onClick={() => navigator.clipboard.writeText(ai.result)}>Copy</button>
                  </div>
                  <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{ai.result}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}