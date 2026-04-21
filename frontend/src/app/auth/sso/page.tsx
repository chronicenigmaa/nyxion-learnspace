'use client'
import React, { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ssoLogin } from '@/lib/api'

function SSOHandler() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      router.replace('/auth/login')
      return
    }

    let active = true
    ;(async () => {
      try {
        const res = await ssoLogin(token)
        const { access_token, user_id, name, role, email } = res.data
        if (!active) return
        localStorage.setItem('ls_token', access_token)
        localStorage.setItem('ls_user', JSON.stringify({
          id: user_id,
          name,
          email,
          role,
        }))
        router.replace('/dashboard')
      } catch {
        router.replace('/auth/login')
      }
    })()

    return () => {
      active = false
    }
  }, [params, router])

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
