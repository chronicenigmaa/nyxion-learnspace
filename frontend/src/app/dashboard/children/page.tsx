'use client'
// PRODUCT: LearnSpace frontend (Vercel)
// PATH:    src/app/dashboard/children/page.tsx   (NEW FILE)
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMyChildren } from '@/lib/api'
import { Users, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

type Child = {
  id: string
  name: string
  class_name?: string
  roll_number?: string
}

export default function MyChildrenPage() {
  const router = useRouter()
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const r = await getMyChildren()
      setChildren(r.data || [])
    } catch {
      setError(true)
      toast.error('Could not load your children')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="animate-fade-in space-y-4">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">{[1, 2].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
    </div>
  )

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] font-display">My Children</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">Select a child to see their progress</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-700)] transition-all">
          <RefreshCw size={16} />
        </button>
      </div>

      {error ? (
        <div className="card p-12 text-center">
          <AlertTriangle size={32} className="text-red-600 mx-auto mb-3" />
          <p className="text-[var(--text-secondary)] font-medium">Could not load your children</p>
          <p className="text-[var(--text-muted)] text-sm mt-1">Check your connection and try again.</p>
          <button onClick={load} className="btn-secondary mt-4">Retry</button>
        </div>
      ) : children.length === 0 ? (
        <div className="card p-12 text-center">
          <Users size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)] font-medium">No children linked yet</p>
          <p className="text-[var(--text-muted)] text-sm mt-1">Ask your school admin to link your child to this account.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => router.push(`/dashboard/children/${child.id}`)}
              className="card p-5 text-left flex items-center gap-4 hover:bg-[var(--surface-700)] transition-colors"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-on-brand text-lg font-bold flex-shrink-0"
                style={{ background: '#6366f1' }}>
                {child.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-[var(--text-primary)] truncate">{child.name}</div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {child.class_name || 'No class'}{child.roll_number ? ` · Roll ${child.roll_number}` : ''}
                </div>
              </div>
              <ChevronRight size={18} className="text-[var(--text-muted)] flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}