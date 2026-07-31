'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { resetPassword } from '@/lib/api'
import NyxionLogo from '@/components/ui/NyxionLogo'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, ShieldAlert } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setToken(params.get('token') || '')
  }, [params])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await resetPassword(token, newPassword)
      setDone(true)
      toast.success('Password updated')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'This reset link is invalid or has expired.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="card p-8 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-50">
          <CheckCircle2 size={26} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Password updated</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          You can now sign in with your new password.
        </p>
        <button onClick={() => router.push('/auth/login')} className="btn-primary px-8 py-3 justify-center w-full">
          Go to sign in
        </button>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="card p-8 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-50">
          <ShieldAlert size={26} className="text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Reset link is missing</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          Open the link from your reset email, or request a new one.
        </p>
        <Link href="/auth/forgot-password" className="btn-primary px-8 py-3 justify-center w-full">
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="card p-8">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Choose a new password</h2>
      <p className="text-[var(--text-secondary)] text-sm mb-6">
        Pick something you haven&apos;t used on this account before.
      </p>

      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label className="label">New password</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              className="input pr-10"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Confirm new password</label>
          <input
            type={showPass ? 'text' : 'password'}
            className="input"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--surface-900)' }}>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <NyxionLogo size="md" sub="LearnSpace" />
        </div>

        <Link href="/auth/login"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to sign in
        </Link>

        <Suspense fallback={<div className="card p-8 skeleton h-64" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
