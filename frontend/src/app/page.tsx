'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, getUser } from '@/lib/api'

export default function HomePage() {
  const router = useRouter()
  useEffect(() => {
    const token = getToken()
    const user = getUser()
    if (!token || !user) { router.replace('/auth/login'); return }
    router.replace('/dashboard')
  }, [])
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-900)' }}>
      <div className="text-indigo-400 text-sm font-mono animate-pulse">Loading Nyxion LearnSpace...</div>
    </div>
  )
}
