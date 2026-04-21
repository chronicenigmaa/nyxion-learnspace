'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { GraduationCap, BookOpen, ChevronRight } from 'lucide-react'
import { getTeachers, getStudents, getUser } from '@/lib/api'

type Teacher = {
  id: string
  name: string
  email: string
  subject?: string
  assigned_sections?: Array<{
    id: string
    class_name?: string
    section?: string
  }>
}

type Student = {
  id: string
  name: string
  email: string
  class_name?: string
  roll_number?: string
}

export default function UsersPage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const user = getUser()
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin'
  const studentsByClass = students.reduce<Record<string, Student[]>>((acc, student) => {
    const key = student.class_name || 'Unassigned'
    if (!acc[key]) acc[key] = []
    acc[key].push(student)
    return acc
  }, {})
  const classEntries = Object.entries(studentsByClass).sort(([a], [b]) => a.localeCompare(b))

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
                <tr
                  key={teacher.id}
                  onClick={() => router.push(`/dashboard/users/teachers/${teacher.id}`)}
                  className="cursor-pointer border-b border-[var(--border)]/60 text-slate-200 transition-colors hover:bg-[var(--surface-900)]/70"
                >
                  <td className="py-3">
                    <div className="inline-flex items-center gap-2 text-slate-100">
                      <span>{teacher.name}</span>
                      <ChevronRight size={14} />
                    </div>
                  </td>
                  <td className="py-3">{teacher.email}</td>
                  <td className="py-3">Teacher</td>
                  <td className="py-3">{teacher.subject || '-'}</td>
                  <td className="py-3 text-slate-400">
                    {teacher.assigned_sections && teacher.assigned_sections.length > 0
                      ? teacher.assigned_sections
                          .map((section) => `${section.class_name || '-'}${section.section ? `-${section.section}` : ''}`)
                          .join(', ')
                      : 'Not assigned'}
                  </td>
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

      <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Assigned Students By Class</h2>
          <p className="text-sm text-slate-400">Quick roster view so you can verify which students are assigned to each class.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {!loading && classEntries.length === 0 && (
            <div className="rounded-xl border border-[var(--border)] p-4 text-sm text-slate-500">
              No class roster data found.
            </div>
          )}
          {classEntries.map(([className, roster]) => (
            <div key={className} className="rounded-xl border border-[var(--border)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">{className}</h3>
                <span className="badge badge-green">{roster.length} students</span>
              </div>
              <div className="space-y-2">
                {roster.map((student) => (
                  <div key={student.id} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-900)' }}>
                    <div className="text-sm font-medium text-slate-100">{student.name}</div>
                    <div className="text-xs text-slate-400">
                      {student.roll_number || 'No roll number'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
