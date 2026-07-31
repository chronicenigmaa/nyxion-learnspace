'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { forgotPassword, resetPassword } from '@/lib/api'
import NyxionLogo from '@/components/ui/NyxionLogo'
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail, MailCheck } from 'lucide-react'

// 'request' → 'sent'  is the normal path: we email a reset link.
// 'request' → 'reset' only happens when the server has no mail provider
//             configured and an operator opted into returning the token.
type Step = 'request' | 'sent' | 'reset' | 'done'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await forgotPassword(email)
      const token = res.data?.reset_token
      if (token) {
        // Dev / unconfigured-mail fallback.
        setResetToken(token)
        setStep('reset')
        toast('Email delivery is off on this server — reset inline instead.')
      } else {
        setStep('sent')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
      await resetPassword(resetToken, newPassword)
      setStep('done')
      toast.success('Password reset successfully!')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Reset failed. The token may have expired.')
    } finally {
      setLoading(false)
    }
  }

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

        {step === 'request' && (
          <div className="card p-8">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Forgot your password?</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>

            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <div className="relative">
                  <input
                    type="email"
                    className="input pl-10"
                    placeholder="you@school.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          </div>
        )}

        {step === 'sent' && (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-indigo-50">
              <MailCheck size={26} className="text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Check your inbox</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-2">
              If <span className="text-[var(--text-primary)] font-medium">{email}</span> is registered,
              a reset link is on its way. It expires in 1 hour.
            </p>
            <p className="text-[var(--text-muted)] text-xs mb-6">
              Nothing after a few minutes? Check spam, or contact your school admin.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStep('request')} className="btn-secondary flex-1 justify-center py-3">
                Try another email
              </button>
              <Link href="/auth/login" className="btn-primary flex-1 justify-center py-3">
                Back to sign in
              </Link>
            </div>
          </div>
        )}

        {step === 'reset' && (
          <div className="card p-8">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Set a new password</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              For <span className="text-[var(--text-primary)] font-medium">{email}</span>.
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
                {loading ? 'Resetting...' : 'Reset password'}
              </button>

              <button type="button" onClick={() => setStep('request')}
                className="w-full text-center text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                Use a different email
              </button>
            </form>
          </div>
        )}

        {step === 'done' && (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-50">
              <KeyRound size={26} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Password reset</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              Your password has been updated. You can now sign in with it.
            </p>
            <button onClick={() => router.push('/auth/login')} className="btn-primary px-8 py-3 justify-center w-full">
              Go to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
