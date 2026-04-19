'use client'
import { useEffect } from 'react'
import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SSOPage() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const token = params.get('token')
    if (!token) { router.replace('/auth/login'); return }

    try {
      // Decode payload from JWT (middle part)
      const payload = JSON.parse(atob(token.split('.')[1]))
      
      // Store in localStorage exactly like a normal login
      localStorage.setItem('ls_token', token)
      localStorage.setItem('ls_user', JSON.stringify({
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        role: payload.role,
      }))

      // Redirect based on role
      const routes: Record<string, string> = {
        student: '/dashboard',
        teacher: '/dashboard',
        school_admin: '/dashboard',
        super_admin: '/dashboard',
      }
      router.replace(routes[payload.role] || '/dashboard')
    } catch {
      router.replace('/auth/login')
    }
  }, [])

  return (
    <div style={{ 
      minHeight: '100vh', display: 'flex', 
      alignItems: 'center', justifyContent: 'center',
      background: '#0f0f23', color: '#6366f1',
      fontFamily: 'monospace', fontSize: '14px'
    }}>
      Connecting to LearnSpace...
    </div>
  )
}