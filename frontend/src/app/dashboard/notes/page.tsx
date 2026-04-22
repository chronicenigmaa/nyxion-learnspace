'use client'
import { useEffect, useState } from 'react'
import { getUser, getMe, getNotes, uploadNotes, deleteNote } from '@/lib/api'
import toast from 'react-hot-toast'
import { BookOpen, Upload, Trash2, Download, FileText, Plus, X, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

const SUBJECT_OPTIONS = ['Mathematics', 'Physics', 'English', 'Chemistry', 'Biology', 'Science']
const CLASS_OPTIONS = ['Class 8A', 'Class 8B', 'Class 9A', 'Class 9B', 'Class 10A', 'Class 10B']

export default function NotesPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [form, setForm] = useState({ title: '', description: '', subject: '', class_name: '' })

  useEffect(() => {
    setUser(getUser())
    getMe().then(r => setProfile(r.data)).catch(() => {})
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      const r = await getNotes()
      setNotes(r.data)
    } catch {
      setLoadError(true)
      toast.error('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) { toast.error('Please select files to upload'); return }
    setUploading(true)
    try {
      const data = new FormData()
      Object.entries(form).forEach(([k, v]) => data.append(k, v))
      files.forEach(f => data.append('files', f))
      await uploadNotes(data)
      toast.success('Notes uploaded!')
      setShowForm(false)
      setFiles([])
      setForm({ title: '', description: '', subject: '', class_name: '' })
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Upload failed')
    } finally { setUploading(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return
    try { await deleteNote(id); toast.success('Deleted'); load() } catch { toast.error('Failed') }
  }

  const isTeacher = user?.role === 'teacher' || user?.role === 'school_admin'

  const FILE_ICONS: Record<string, string> = {
    pdf: '📄', pptx: '📊', ppt: '📊', docx: '📝', doc: '📝',
    jpg: '🖼', jpeg: '🖼', png: '🖼', mp4: '🎥', zip: '🗜',
  }

  function fileIcon(name: string) {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    return FILE_ICONS[ext] || '📎'
  }

  function fileSize(bytes: number) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Notes & Slides</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {isTeacher ? 'Upload resources for your students' : 'Download resources from your teachers'}
          </p>
        </div>
        {isTeacher && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={16} /> Upload Notes
          </button>
        )}
      </div>

      {/* Upload form */}
      {isTeacher && showForm && (
        <div className="card p-5 animate-slide-up">
          <h3 className="font-semibold text-white mb-4">Upload Notes / Slides</h3>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Title *</label>
                <input className="input" placeholder="e.g. Chapter 3 Lecture Slides" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Subject *</label>
                <select className="input" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} required>
                  <option value="">Select subject</option>
                  {SUBJECT_OPTIONS.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Class *</label>
                <select className="input" value={form.class_name} onChange={e => setForm(p => ({ ...p, class_name: e.target.value }))} required>
                  <option value="">Select class</option>
                  {CLASS_OPTIONS.map(className => (
                    <option key={className} value={className}>{className}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" placeholder="Optional notes..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>

            <label className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-indigo-500/50 cursor-pointer transition-colors"
              style={{ background: 'var(--surface-700)' }}>
              <Upload size={24} className="text-indigo-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Upload files</p>
                <p className="text-xs text-slate-400">PDF, PPTX, DOCX, images — any format</p>
              </div>
              <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) setFiles(p => [...p, ...Array.from(e.target.files!)]) }} />
            </label>

            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'var(--surface-600)' }}>
                    <span className="text-base">{fileIcon(f.name)}</span>
                    <span className="text-sm text-white flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-slate-400">{fileSize(f.size)}</span>
                    <button type="button" onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}><X size={13} className="text-slate-400 hover:text-red-400" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={uploading}>
                {uploading ? 'Uploading...' : `Upload ${files.length > 0 ? `(${files.length} files)` : ''}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notes grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
        </div>
      ) : loadError ? (
        <div className="card p-12 text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">Failed to load notes</p>
          <p className="text-slate-500 text-sm mt-1">Check your connection and try again.</p>
          <button onClick={load} className="btn-secondary mt-4">Retry</button>
        </div>
      ) : notes.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen size={32} className="text-slate-600 mx-auto mb-3" />
          {!isTeacher && profile && !profile.class_name ? (
            <>
              <p className="text-slate-300 font-medium">No class assigned to your account</p>
              <p className="text-slate-500 text-sm mt-1">Ask your admin to assign you to a class so notes appear here.</p>
            </>
          ) : (
            <>
              <p className="text-slate-400">No notes available yet</p>
              {isTeacher && <button onClick={() => setShowForm(true)} className="btn-primary mt-4">Upload first notes</button>}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notes.map(note => (
            <div key={note.id} className="card p-5 hover:border-indigo-500/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: 'rgba(99,102,241,0.15)' }}>
                  📚
                </div>
                {isTeacher && (
                  <button onClick={() => handleDelete(note.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <h3 className="font-semibold text-white">{note.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{note.subject} · {note.class_name}</p>
              {note.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{note.description}</p>}
              <p className="text-xs text-slate-600 mt-2 font-mono">By {note.teacher_name} · {format(new Date(note.created_at), 'MMM d, yyyy')}</p>

              {/* Files */}
              <div className="mt-3 space-y-1.5">
                {(note.files || []).map((f: any) => (
                  <a key={f.id} href={f.path} download={f.name}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--surface-600)] transition-colors group"
                    style={{ background: 'var(--surface-700)' }}>
                    <span className="text-base">{fileIcon(f.name)}</span>
                    <span className="text-sm text-slate-300 flex-1 truncate group-hover:text-white">{f.name}</span>
                    {f.size && <span className="text-xs text-slate-500">{fileSize(f.size)}</span>}
                    <Download size={12} className="text-slate-500 group-hover:text-indigo-400" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
