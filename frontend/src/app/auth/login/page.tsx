'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { login } from '@/lib/api'
import NyxionLogo from '@/components/ui/NyxionLogo'
import { Eye, EyeOff, GraduationCap, BookOpen, ShieldCheck } from 'lucide-react'

type Portal = 'student' | 'teacher' | 'admin'

const PORTALS = [
  { id: 'student', label: 'Student', icon: GraduationCap, color: '#10b981', desc: 'View assignments & exams' },
  { id: 'teacher', label: 'Teacher', icon: BookOpen, color: '#6366f1', desc: 'Manage class & grade work' },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, color: '#f59e0b', desc: 'School administration' },
]

const EMAIL_PLACEHOLDERS: Record<Portal, string> = {
  student: 'student@demo.com',
  teacher: 'teacher@demo.com',
  admin: 'admin@demo.com',
}

export default function LoginPage() {
  const router = useRouter()
  const [portal, setPortal] = useState<Portal>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const DEMO = {
    student: { email: 'student@demo.com', password: 'demo123' },
    teacher: { email: 'teacher@demo.com', password: 'demo123' },
    admin: { email: 'admin@demo.com', password: 'demo123' },
  }

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
    }
      toast.success(`Welcome back, ${name}!`)
      router.push(routes[role] || '/dashboard/student')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo() {
    setEmail(DEMO[portal].email)
    setPassword(DEMO[portal].password)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-900)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)' }}>
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.5) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />

        <NyxionLogo size="lg" sub="LearnSpace" />

        <div className="relative z-10">
          <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
            Your classroom,<br />
            <span className="gradient-text">anywhere.</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Assignments, exams, notes, attendance — all in one place for every student and teacher.
          </p>
          <div className="space-y-3">
            {['Submit & grade assignments', 'Live exams with anti-cheat', 'Download notes & slides', 'Track attendance & grades'].map(f => (
              <div key={f} className="flex items-center gap-3 text-slate-300">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-slate-600 text-xs font-mono">
          Powered by Nyxion EduOS · nyxionlabs.com
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <NyxionLogo size="md" sub="LearnSpace" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Sign in</h2>
          <p className="text-slate-400 text-sm mb-8">Select your portal and enter your credentials</p>

          {/* Portal selector */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {PORTALS.map(p => {
              const Icon = p.icon
              return (
                <button
                  key={p.id}
                  onClick={() => setPortal(p.id as Portal)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-sm font-medium ${portal === p.id
                    ? 'border-indigo-500 text-white'
                    : 'border-[var(--border)] text-slate-400 hover:border-indigo-500/50'}`}
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
              <p className="mt-2 text-xs text-slate-400">
                School accounts like <span className="text-slate-200">zara@alnooracademy.com</span> sign in with their EduOS credentials.
              </p>
            </div>
            <div>
              <label className="label">Password</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
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

          <div className="mt-6 p-4 rounded-xl border border-dashed border-indigo-500/30"
            style={{ background: 'rgba(99,102,241,0.05)' }}>
            <p className="text-xs text-slate-400 mb-2 font-mono uppercase tracking-wider">Demo accounts</p>
            <button onClick={fillDemo} className="text-indigo-400 text-sm hover:text-indigo-300 underline underline-offset-2">
              Fill {portal} demo credentials
            </button>
          </div>

          <p className="text-center text-slate-500 text-xs mt-8">
            Part of Nyxion EduOS · Contact admin for account setup
          </p>
        </div>
      </div>
    </div>
  )
}
