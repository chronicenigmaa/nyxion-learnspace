'use client'
// PRODUCT: LearnSpace frontend (Vercel)
// PATH:    src/app/dashboard/parents/page.tsx   (NEW FILE)
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Users, UserPlus, Link2, X, Check } from 'lucide-react'
import {
  getUser, listParents, createParent, linkChild, unlinkChild, getStudents,
} from '@/lib/api'

type Child = { id: string; name: string; class_name?: string; roll_number?: string }
type Parent = { id: string; name: string; email: string; children: Child[] }
type Student = { id: string; name: string; class_name?: string; section?: string; roll_number?: string }

export default function ParentsAdminPage() {
  const user = getUser()
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin'

  const [parents, setParents] = useState<Parent[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  // create form
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // link picker (per existing parent)
  const [linkingParentId, setLinkingParentId] = useState<string | null>(null)
  const [linkStudentId, setLinkStudentId] = useState('')

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    load()
  }, [isAdmin])

  async function load() {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([listParents(), getStudents()])
      setParents(p.data || [])
      setStudents(s.data || [])
    } catch {
      toast.error('Could not load parents')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.name || !form.email || !form.password) {
      toast.error('Name, email and password are required')
      return
    }
    setSaving(true)
    try {
      await createParent({ ...form, child_ids: selectedChildIds })
      toast.success('Parent created')
      setShowCreate(false)
      setForm({ name: '', email: '', password: '' })
      setSelectedChildIds([])
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not create parent')
    } finally {
      setSaving(false)
    }
  }

  async function handleLink(parentId: string) {
    if (!linkStudentId) return
    try {
      await linkChild(parentId, linkStudentId)
      toast.success('Child linked')
      setLinkingParentId(null)
      setLinkStudentId('')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not link child')
    }
  }

  async function handleUnlink(parentId: string, studentId: string) {
    try {
      await unlinkChild(parentId, studentId)
      toast.success('Child unlinked')
      load()
    } catch {
      toast.error('Could not unlink child')
    }
  }

  function toggleChild(id: string) {
    setSelectedChildIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-[var(--border)] p-6" style={{ background: 'var(--surface-850)' }}>
        <h1 className="text-xl font-bold text-white">Parents</h1>
        <p className="mt-2 text-sm text-slate-400">Only admins can manage parent accounts.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Parents</h1>
          <p className="text-sm text-slate-400">Create parent accounts and link them to students.</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)} className="btn-primary flex items-center gap-2">
          <UserPlus size={16} /> New parent
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <section className="rounded-2xl border border-[var(--border)] p-5 space-y-4" style={{ background: 'var(--surface-850)' }}>
          <h2 className="text-lg font-semibold text-white">New parent account</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Parent name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="parent@example.com" />
            </div>
            <div>
              <label className="label">Temporary password</label>
              <input className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="At least 6 characters" />
            </div>
          </div>

          <div>
            <label className="label">Link children (optional)</label>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 max-h-56 overflow-y-auto mt-1">
              {students.map(s => {
                const on = selectedChildIds.includes(s.id)
                return (
                  <button key={s.id} onClick={() => toggleChild(s.id)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm border transition-colors ${on ? 'border-indigo-500 text-white' : 'border-[var(--border)] text-slate-300 hover:bg-[var(--surface-900)]'}`}
                    style={on ? { background: 'rgba(99,102,241,0.15)' } : {}}>
                    <span className="min-w-0">
                      <span className="block truncate">{s.name}</span>
                      <span className="block text-xs text-slate-500">
                        {s.class_name || 'No class'}{s.roll_number ? ` · ${s.roll_number}` : ''}
                      </span>
                    </span>
                    {on && <Check size={14} className="text-indigo-400 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? 'Creating…' : 'Create parent'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </section>
      )}

      {/* Parent list */}
      <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl p-2" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <Users size={18} className="text-indigo-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Parent accounts</h2>
            <p className="text-sm text-slate-400">Each parent and the children linked to them.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading parents…</p>
        ) : parents.length === 0 ? (
          <p className="text-sm text-slate-500">No parents yet. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {parents.map(p => (
              <div key={p.id} className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.email}</div>
                  </div>
                  <button
                    onClick={() => { setLinkingParentId(linkingParentId === p.id ? null : p.id); setLinkStudentId('') }}
                    className="btn-secondary flex items-center gap-2 text-xs">
                    <Link2 size={14} /> Link child
                  </button>
                </div>

                {/* linked children chips */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.children.length === 0 ? (
                    <span className="text-xs text-slate-500">No children linked</span>
                  ) : p.children.map(c => (
                    <span key={c.id} className="badge badge-green flex items-center gap-1.5">
                      {c.name}{c.class_name ? ` · ${c.class_name}` : ''}
                      <button onClick={() => handleUnlink(p.id, c.id)} className="hover:text-red-400">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>

                {/* link picker */}
                {linkingParentId === p.id && (
                  <div className="mt-3 flex items-center gap-2">
                    <select className="input py-1.5 text-sm flex-1" value={linkStudentId} onChange={e => setLinkStudentId(e.target.value)}>
                      <option value="">Select a student…</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.class_name ? ` (${s.class_name})` : ''}{s.roll_number ? ` · ${s.roll_number}` : ''}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => handleLink(p.id)} disabled={!linkStudentId} className="btn-primary text-sm">Link</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}