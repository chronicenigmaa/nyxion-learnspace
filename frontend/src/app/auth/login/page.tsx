'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { login } from '@/lib/api'
import NyxionLogo from '@/components/ui/NyxionLogo'
import { Eye, EyeOff, GraduationCap, BookOpen, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

type Portal = 'student' | 'teacher' | 'admin'

const PORTALS = [
  { id: 'student', label: 'Student', icon: GraduationCap, color: '#10b981', desc: 'View assignments & exams' },
  { id: 'teacher', label: 'Teacher', icon: BookOpen, color: '#6366f1', desc: 'Manage class & grade work' },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, color: '#f59e0b', desc: 'School administration' },
]

const EMAIL_PLACEHOLDERS: Record<Portal, string> = {
  student: 'you@school.com',
  teacher: 'you@school.com',
  admin: 'you@school.com',
}

export default function LoginPage() {
  const router = useRouter()
  const [portal, setPortal] = useState<Portal>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await login(email, password)
      const { access_token, role, name, user_id } = res.data
      localStorage.setItem('ls_token', access_token)
      localStorage.setItem('ls_user', JSON.stringify({ id: user_id, name, role, email }))

    const routes: Record<string, string> = {
      student: '/dashboard',
      teacher: '/dashboard',
      school_admin: '/dashboard',
      super_admin: '/dashboard',
      parent: '/dashboard/children',   // ADD
}
      toast.success(`Welcome back, ${name}!`)
      router.push(routes[role] || '/dashboard/student')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-900)' }}>
      {/* Left panel — deep indigo brand surface, deliberately the one dark
          area of the product so the sign-in screen still reads as branded. */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #312e81 0%, #4338ca 55%, #4f46e5 100%)' }}>
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.55) 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <NyxionLogo size="lg" sub="LearnSpace" tone="light" />
        </div>

        <div className="relative z-10">
          <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
            Your classroom,<br />
            <span className="text-indigo-200">anywhere.</span>
          </h1>
          <p className="text-indigo-100/80 text-lg leading-relaxed mb-8">
            Assignments, exams, notes, attendance — all in one place for every student and teacher.
          </p>
          <div className="space-y-3">
            {['Submit & grade assignments', 'Live exams with anti-cheat', 'Download notes & slides', 'Track attendance & grades'].map(f => (
              <div key={f} className="flex items-center gap-3 text-indigo-100/90">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-indigo-200/60 text-xs font-mono">
          Powered by Nyxion EduOS · nyxionlabs.com
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <NyxionLogo size="md" sub="LearnSpace" />
          </div>

          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Sign in</h2>
          <p className="text-[var(--text-secondary)] text-sm mb-8">Select your portal and enter your credentials</p>

          {/* Portal selector */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {PORTALS.map(p => {
              const Icon = p.icon
              return (
                <button
                  key={p.id}
                  onClick={() => setPortal(p.id as Portal)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-sm font-medium ${portal === p.id
                    ? 'border-indigo-500 text-[var(--text-primary)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-indigo-500/50'}`}
                  style={portal === p.id ? { background: `${p.color}18`, borderColor: p.color, color: p.color } : {}}
                >
                  <Icon size={18} />
                  <span>{p.label}</span>
                </button>
              )
            })}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder={EMAIL_PLACEHOLDERS[portal]}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                School accounts like <span className="text-[var(--text-primary)]">zara@alnooracademy.com</span> sign in with their EduOS credentials.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-3 mt-2" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-[var(--text-muted)] text-xs mt-8">
            Part of Nyxion EduOS · Contact admin for account setup
          </p>
        </div>
      </div>
    </div>
  )
}
