'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout, getUser } from '@/lib/api'
import NyxionLogo from '@/components/ui/NyxionLogo'
import {
  LayoutDashboard, BookOpen, FileText, BarChart2,
  Calendar, ClipboardList, LogOut, Menu, X,
  GraduationCap, Upload, Video, Users, Settings, Sparkles
} from 'lucide-react'
import ChatbotWidget from '@/components/ChatbotWidget'
import AIDropdown from '@/components/AIDropdown'

interface NavItem { label: string; href: string; icon: any; roles: string[] }

const NAV: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',              icon: LayoutDashboard, roles: ['student', 'teacher', 'school_admin', 'super_admin'] },
  { label: 'Assignments',    href: '/dashboard/assignments',  icon: FileText,        roles: ['student', 'teacher', 'school_admin'] },
  { label: 'Exams',          href: '/dashboard/exams',        icon: ClipboardList,   roles: ['student', 'teacher', 'school_admin'] },
  { label: 'Notes & Slides', href: '/dashboard/notes',        icon: BookOpen,        roles: ['student', 'teacher', 'school_admin'] },
  { label: 'Timetable',      href: '/dashboard/timetable',   icon: Calendar,        roles: ['student', 'teacher', 'school_admin'] },
  { label: 'Coursebooks',    href: '/dashboard/coursebooks',  icon: GraduationCap,   roles: ['student', 'teacher', 'school_admin'] },
  { label: 'Attendance',     href: '/dashboard/attendance',   icon: Calendar,        roles: ['teacher', 'school_admin'] },
  { label: 'My Attendance',  href: '/dashboard/attendance/my',icon: Calendar,        roles: ['student'] },
  { label: 'Grades',         href: '/dashboard/grades',       icon: BarChart2,       roles: ['student', 'teacher', 'school_admin'] },
  { label: 'Calendar',       href: '/dashboard/calendar',     icon: Calendar,        roles: ['student', 'teacher', 'school_admin', 'super_admin'] },
  { label: 'AI Tools',       href: '/dashboard/ai',           icon: Settings,        roles: ['teacher', 'school_admin'] },
  { label: 'AI Study',       href: '/dashboard/ai/study',     icon: BookOpen,        roles: ['student'] },
  { label: 'Users',          href: '/dashboard/users',        icon: Users,           roles: ['school_admin', 'super_admin'] },
  { label: 'Students',       href: '/dashboard/students',     icon: Users,           roles: ['teacher', 'school_admin', 'super_admin'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const u = getUser()
    if (!u) { router.push('/auth/login'); return }
    setUser(u)
  }, [])

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-900)' }}>
      <div className="text-indigo-400 text-sm font-mono animate-pulse">Loading LearnSpace...</div>
    </div>
  )

  const visibleNav = NAV.filter(n => n.roles.includes(user.role))

  const Sidebar = () => (
    <div className="flex flex-col h-full py-6 px-4">
      <div className="mb-8 px-2">
        <NyxionLogo size="sm" sub="LearnSpace" />
      </div>
      <nav className="flex-1 space-y-1">
        {visibleNav.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-[var(--surface-700)]'}`}>
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[var(--border)] pt-4 mt-4">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ background: user.avatar_color || '#6366f1' }}>
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-white truncate max-w-[140px]">{user.name}</div>
            <div className="text-xs text-slate-500 capitalize">{user.role?.replace('_', ' ')}</div>
          </div>
        </div>
        <button onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 text-sm w-full transition-all">
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-900)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-[var(--border)] flex-shrink-0"
        style={{ background: 'var(--surface-850)' }}>
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-56 border-r border-[var(--border)]"
            style={{ background: 'var(--surface-850)' }}>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)]"
          style={{ background: 'var(--surface-850)' }}>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className={`badge ${user.role === 'teacher' ? 'badge-blue' : user.role === 'student' ? 'badge-green' : 'badge-yellow'}`}>
              {user.role?.replace('_', ' ')}
            </span>
            <span className="text-sm text-slate-300 font-medium">{user.name}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
            <ChatbotWidget />
    </div>
  )
}
