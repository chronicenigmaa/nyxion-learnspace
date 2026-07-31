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
  section?: string
  roll_number?: string
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const user = getUser()
  const canView = ['teacher', 'school_admin', 'super_admin'].includes(user?.role)
  const studentsByClass = students.reduce<Record<string, Student[]>>((acc, student) => {
    const key = student.class_name
      ? `${student.class_name}${student.section ? `-${student.section}` : ''}`
      : 'Unassigned'
    if (!acc[key]) acc[key] = []
    acc[key].push(student)
    return acc
  }, {})
  const classEntries = Object.entries(studentsByClass).sort(([a], [b]) => a.localeCompare(b))

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
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Students</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">You do not have access to this page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl p-2" style={{ background: 'rgba(16,185,129,0.15)' }}>
          <GraduationCap size={18} className="text-emerald-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Students</h1>
          <p className="text-sm text-[var(--text-secondary)]">View student class and roll information.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Class</th>
                <th className="pb-3 font-medium">Section</th>
                <th className="pb-3 font-medium">Roll No.</th>
              </tr>
            </thead>
            <tbody>
              {!loading && students.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-[var(--text-muted)]">No students found.</td>
                </tr>
              )}
              {students.map((student) => (
                <tr key={student.id} className="border-b border-[var(--border)]/60 text-[var(--text-primary)]">
                  <td className="py-3">{student.name}</td>
                  <td className="py-3">{student.email}</td>
                  <td className="py-3">Student</td>
                  <td className="py-3">{student.class_name || '-'}</td>
                  <td className="py-3">{student.section || '-'}</td>
                  <td className="py-3">{student.roll_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Assigned Students By Class</h2>
          <p className="text-sm text-[var(--text-secondary)]">Roster view for checking which students are placed in each class.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {!loading && classEntries.length === 0 && (
            <div className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
              No class roster data found.
            </div>
          )}
          {classEntries.map(([className, roster]) => (
            <div key={className} className="rounded-xl border border-[var(--border)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-[var(--text-primary)]">{className}</h3>
                <span className="badge badge-green">{roster.length} students</span>
              </div>
              <div className="space-y-2">
                {roster.map((student) => (
                  <div key={student.id} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-900)' }}>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{student.name}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {student.section ? `Section ${student.section}` : 'No section'} · {student.roll_number || 'No roll number'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
