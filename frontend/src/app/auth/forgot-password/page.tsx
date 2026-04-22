'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { forgotPassword, resetPassword } from '@/lib/api'
import NyxionLogo from '@/components/ui/NyxionLogo'
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail } from 'lucide-react'

type Step = 'request' | 'reset' | 'done'

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
      const token = res.data.reset_token
      if (token) {
        setResetToken(token)
        setStep('reset')
        toast.success('Reset token generated. Enter your new password below.')
      } else {
        toast('If that email is registered, check with your admin for the reset token.')
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

        <Link href="/auth/login" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to login
        </Link>

        {step === 'request' && (
          <>
            <h2 className="text-2xl font-bold text-white mb-1">Forgot password?</h2>
            <p className="text-slate-400 text-sm mb-8">Enter your email to get a password reset token.</p>

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
                  />
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
                {loading ? 'Generating token...' : 'Get reset token'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <h2 className="text-2xl font-bold text-white mb-1">Set new password</h2>
            <p className="text-slate-400 text-sm mb-8">Enter your new password for <span className="text-slate-200">{email}</span>.</p>

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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
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
                className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors">
                Use a different email
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(16,185,129,0.15)' }}>
              <KeyRound size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Password reset!</h2>
            <p className="text-slate-400 text-sm mb-8">Your password has been updated. You can now log in with your new password.</p>
            <button onClick={() => router.push('/auth/login')} className="btn-primary px-8 py-3">
              Go to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
