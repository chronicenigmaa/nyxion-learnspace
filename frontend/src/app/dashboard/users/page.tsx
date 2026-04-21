'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { GraduationCap, BookOpen } from 'lucide-react'
import { getTeachers, getStudents, getUser } from '@/lib/api'

type Teacher = {
  id: string
  name: string
  email: string
  subject?: string
}

type Student = {
  id: string
  name: string
  email: string
  class_name?: string
  roll_number?: string
}

export default function UsersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const user = getUser()
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin'

  useEffect(() => {
    if (!isAdmin) return

    ;(async () => {
      try {
        const [teachersRes, studentsRes] = await Promise.all([
          getTeachers(),
          getStudents(),
        ])
        setTeachers(teachersRes.data || [])
        setStudents(studentsRes.data || [])
      } catch {
        toast.error('Failed to load users')
      } finally {
        setLoading(false)
      }
    })()
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-[var(--border)] p-6" style={{ background: 'var(--surface-850)' }}>
        <h1 className="text-xl font-bold text-white">Users</h1>
        <p className="mt-2 text-sm text-slate-400">Only admins can view the full users list.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-slate-400">Review teachers and students in one place.</p>
        </div>
        <div className="badge badge-yellow">
          {teachers.length + students.length} users
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl p-2" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <BookOpen size={18} className="text-indigo-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Teachers</h2>
            <p className="text-sm text-slate-400">Subject and role details for teaching staff.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-slate-400">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Subject</th>
                <th className="pb-3 font-medium">Class</th>
              </tr>
            </thead>
            <tbody>
              {!loading && teachers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">No teachers found.</td>
                </tr>
              )}
              {teachers.map((teacher) => (
                <tr key={teacher.id} className="border-b border-[var(--border)]/60 text-slate-200">
                  <td className="py-3">{teacher.name}</td>
                  <td className="py-3">{teacher.email}</td>
                  <td className="py-3">Teacher</td>
                  <td className="py-3">{teacher.subject || '-'}</td>
                  <td className="py-3 text-slate-400">Not assigned</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl p-2" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <GraduationCap size={18} className="text-emerald-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Students</h2>
            <p className="text-sm text-slate-400">Class and roll information for enrolled students.</p>
          </div>
        </div>

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

      {loading && (
        <div className="rounded-2xl border border-[var(--border)] p-5 text-sm text-slate-400" style={{ background: 'var(--surface-850)' }}>
          Loading users...
        </div>
      )}
    </div>
  )
}
