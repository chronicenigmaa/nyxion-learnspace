'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { GraduationCap } from 'lucide-react'
import { getStudents, getUser } from '@/lib/api'

type Student = {
  id: string
  name: string
  email: string
  class_name?: string
  roll_number?: string
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const user = getUser()
  const canView = ['teacher', 'school_admin', 'super_admin'].includes(user?.role)

  useEffect(() => {
    if (!canView) return

    ;(async () => {
      try {
        const res = await getStudents()
        setStudents(res.data || [])
      } catch {
        toast.error('Failed to load students')
      } finally {
        setLoading(false)
      }
    })()
  }, [canView])

  if (!canView) {
    return (
      <div className="rounded-2xl border border-[var(--border)] p-6" style={{ background: 'var(--surface-850)' }}>
        <h1 className="text-xl font-bold text-white">Students</h1>
        <p className="mt-2 text-sm text-slate-400">You do not have access to this page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl p-2" style={{ background: 'rgba(16,185,129,0.15)' }}>
          <GraduationCap size={18} className="text-emerald-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-sm text-slate-400">View student class and roll information.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-slate-400">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Class</th>
                <th className="pb-3 font-medium">Roll No.</th>
              </tr>
            </thead>
            <tbody>
              {!loading && students.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">No students found.</td>
                </tr>
              )}
              {students.map((student) => (
                <tr key={student.id} className="border-b border-[var(--border)]/60 text-slate-200">
                  <td className="py-3">{student.name}</td>
                  <td className="py-3">{student.email}</td>
                  <td className="py-3">Student</td>
                  <td className="py-3">{student.class_name || '-'}</td>
                  <td className="py-3">{student.roll_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
