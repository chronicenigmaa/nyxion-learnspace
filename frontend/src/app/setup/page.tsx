'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { bootstrapSuperAdmin, getSetupStatus } from '@/lib/api'
import NyxionLogo from '@/components/ui/NyxionLogo'
import { CheckCircle2, Eye, EyeOff, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'

/**
 * One-time setup screen for the very first super admin.
 *
 * The server only honours this while zero active super admins exist, and only
 * when the request carries the BOOTSTRAP_SECRET set on the backend. Once the
 * first account is created the route locks itself permanently — every super
 * admin after this one is created from Users → Administrators.
 */
export default function SetupPage() {
  const router = useRouter()
  const [status, setStatus] = useState<any>(null)
  const [checking, setChecking] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [secret, setSecret] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    getSetupStatus()
      .then(res => setStatus(res.data))
      .catch(() => setStatus(null))
      .finally(() => setChecking(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 10) {
      toast.error('Password must be at least 10 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await bootstrapSuperAdmin({ name, email, password }, secret)
      setDone(true)
      toast.success('Super admin created')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--surface-900)' }}>
      <div className="w-full max-w-md">
        <div className="mb-8"><NyxionLogo size="md" sub="LearnSpace" /></div>
        {children}
      </div>
    </div>
  )

  if (checking) {
    return shell(<div className="card p-8"><div className="skeleton h-40" /></div>)
  }

  if (done) {
    return shell(
      <div className="card p-8 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-50">
          <CheckCircle2 size={26} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">You&apos;re all set</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          Sign in as <span className="text-[var(--text-primary)] font-medium">{email}</span>.
          Remove <code className="font-mono text-xs">BOOTSTRAP_SECRET</code> from your server
          environment now — it is no longer needed.
        </p>
        <button onClick={() => router.push('/auth/login')} className="btn-primary w-full justify-center py-3">
          Go to sign in
        </button>
      </div>
    )
  }

  if (status && !status.needs_bootstrap) {
    return shell(
      <div className="card p-8 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-indigo-50">
          <ShieldCheck size={26} className="text-indigo-600" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Setup already complete</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          A super admin already exists. Sign in and use <strong>Users → Administrators</strong> to add more.
        </p>
        <Link href="/auth/login" className="btn-primary w-full justify-center py-3">Go to sign in</Link>
      </div>
    )
  }

  if (status && !status.bootstrap_enabled) {
    return shell(
      <div className="card p-8 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-50">
          <ShieldAlert size={26} className="text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Bootstrap is disabled</h2>
        <p className="text-[var(--text-secondary)] text-sm text-left">
          No super admin exists yet, but the server has no{' '}
          <code className="font-mono text-xs bg-[var(--surface-700)] px-1.5 py-0.5 rounded">BOOTSTRAP_SECRET</code>{' '}
          set. Add one to your backend environment and reload this page, or create the
          account directly with:
        </p>
        <pre className="mt-4 text-left text-xs font-mono bg-[var(--surface-700)] border border-[var(--border)] rounded-lg p-3 overflow-x-auto text-[var(--text-secondary)]">
{`python scripts/init_db.py \\
  --super-admin-email you@school.com \\
  --super-admin-password 'strong-password'`}
        </pre>
      </div>
    )
  }

  return shell(
    <div className="card p-8">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={18} className="text-indigo-600" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Create the first super admin</h2>
      </div>
      <p className="text-[var(--text-secondary)] text-sm mb-6">
        This screen works only once, while no super admin exists.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)}
            placeholder="Jane Doe" required minLength={2} autoFocus />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@school.com" required />
        </div>
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
        <div>
          <label className="label">Confirm password</label>
          <input type={showPass ? 'text' : 'password'} className="input"
            value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat password" required />
        </div>
        <div>
          <label className="label">Bootstrap secret</label>
          <input type="password" className="input font-mono" value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="Value of BOOTSTRAP_SECRET" required />
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            The value you set as <code className="font-mono">BOOTSTRAP_SECRET</code> on the backend.
          </p>
        </div>

        <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
          {loading ? 'Creating...' : 'Create super admin'}
        </button>
      </form>
    </div>
  )
}
