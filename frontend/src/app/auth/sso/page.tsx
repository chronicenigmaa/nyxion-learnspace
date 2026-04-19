'use client'
import React, { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SSOHandler() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const token = params.get('token')
    if (!token) { router.replace('/auth/login'); return }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      localStorage.setItem('ls_token', token)
      localStorage.setItem('ls_user', JSON.stringify({
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        role: payload.role,
      }))
      router.replace('/dashboard')
    } catch {
      router.replace('/auth/login')
    }
  }, [])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f0f23', color:'#6366f1', fontFamily:'monospace' }}>
      Connecting to LearnSpace...
    </div>
  )
}

export default function SSOPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'#0f0f23' }} />}>
      <SSOHandler />
    </Suspense>
  )
}