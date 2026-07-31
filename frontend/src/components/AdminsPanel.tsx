'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Copy, Eye, EyeOff, MailWarning, Plus, ShieldCheck,
  Trash2, ToggleLeft, ToggleRight, X,
} from 'lucide-react'
import {
  createSuperAdmin, deleteSuperAdmin, listSuperAdmins, setUserActive,
} from '@/lib/api'

type Admin = {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  created_at?: string | null
}

/**
 * Super-admin-only panel for managing administrator accounts.
 * Rendered on the Users page; the backend enforces the same restriction, so
 * hiding it here is presentation only.
 */
export default function AdminsPanel() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [autoPassword, setAutoPassword] = useState(true)
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  async function load() {
    try {
      const res = await listSuperAdmins()
      setAdmins(res.data.admins || [])
      setCurrentUserId(res.data.current_user_id || '')
      setEmailEnabled(!!res.data.email_enabled)
    } catch {
      toast.error('Failed to load administrators')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setName(''); setEmail(''); setPassword(''); setAutoPassword(true); setShowPass(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!autoPassword && password.length < 10) {
      toast.error('Password must be at least 10 characters')
      return
    }
    setSubmitting(true)
    try {
      const res = await createSuperAdmin({
        name,
        email,
        password: autoPassword ? null : password,
        send_invite_email: true,
      })
      setTempPassword(res.data.temporary_password || null)
      toast.success(res.data.invite_emailed
        ? 'Super admin created — invite emailed'
        : 'Super admin created')
      resetForm()
      setShowForm(false)
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not create super admin')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(admin: Admin) {
    setBusyId(admin.id)
    try {
      await setUserActive(admin.id, !admin.is_active)
      setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, is_active: !a.is_active } : a))
      toast.success(admin.is_active ? 'Account disabled' : 'Account enabled')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not update account')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(admin: Admin) {
    if (!confirm(`Permanently delete the super admin "${admin.name}" (${admin.email})?`)) return
    setBusyId(admin.id)
    try {
      await deleteSuperAdmin(admin.id)
      setAdmins(prev => prev.filter(a => a.id !== admin.id))
      toast.success('Super admin deleted')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not delete super admin')
    } finally {
      setBusyId(null)
    }
  }

  const superAdmins = admins.filter(a => a.role === 'super_admin')
  const schoolAdmins = admins.filter(a => a.role === 'school_admin')

  return (
    <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2 bg-indigo-50">
            <ShieldCheck size={18} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Administrators</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Super admins have full access to every school and setting.
            </p>
          </div>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary">
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Cancel' : 'New super admin'}
        </button>
      </div>

      {!emailEnabled && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <MailWarning size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">
            Email delivery is not configured (<code className="font-mono">RESEND_API_KEY</code> is unset),
            so invites and password resets cannot be sent. Generated passwords will be shown here once instead.
          </p>
        </div>
      )}

      {tempPassword && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            Temporary password — shown only once
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-2.5 py-1.5 font-mono text-sm text-[var(--text-primary)] border border-indigo-200">
              {tempPassword}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success('Copied') }}
              className="btn-secondary py-1.5 px-3 text-xs">
              <Copy size={13} /> Copy
            </button>
            <button onClick={() => setTempPassword(null)}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate}
          className="mb-5 grid gap-4 rounded-xl border border-[var(--border)] p-4"
          style={{ background: 'var(--surface-700)' }}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)}
                placeholder="Jane Doe" required minLength={2} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="jane@school.com" required />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={autoPassword}
              onChange={e => setAutoPassword(e.target.checked)}
              className="h-4 w-4 accent-indigo-600 cursor-pointer" />
            Generate a strong password and email it to them
          </label>

          {!autoPassword && (
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 10 characters" required minLength={10} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create super admin'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Email</th>
              <th className="pb-3 font-medium">Role</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="py-4 text-[var(--text-muted)]">Loading administrators...</td></tr>
            )}
            {!loading && admins.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-[var(--text-muted)]">No administrators found.</td></tr>
            )}
            {[...superAdmins, ...schoolAdmins].map(admin => {
              const isSelf = admin.id === currentUserId
              return (
                <tr key={admin.id} className="border-b border-[var(--border)]/60 text-[var(--text-primary)]">
                  <td className="py-3 font-medium">
                    {admin.name}
                    {isSelf && <span className="ml-2 text-xs text-[var(--text-muted)]">(you)</span>}
                  </td>
                  <td className="py-3 text-[var(--text-secondary)]">{admin.email}</td>
                  <td className="py-3">
                    <span className={`badge ${admin.role === 'super_admin' ? 'badge-blue' : 'badge-gray'}`}>
                      {admin.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`badge ${admin.is_active ? 'badge-green' : 'badge-red'}`}>
                      {admin.is_active ? 'active' : 'disabled'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleActive(admin)}
                        disabled={isSelf || busyId === admin.id}
                        title={isSelf ? 'You cannot disable your own account' : admin.is_active ? 'Disable' : 'Enable'}
                        className="p-1.5 rounded text-[var(--text-secondary)] transition-colors hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed">
                        {admin.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      {admin.role === 'super_admin' && (
                        <button
                          onClick={() => handleDelete(admin)}
                          disabled={isSelf || busyId === admin.id}
                          title={isSelf ? 'You cannot delete your own account' : 'Delete'}
                          className="p-1.5 rounded text-[var(--text-secondary)] transition-colors hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
