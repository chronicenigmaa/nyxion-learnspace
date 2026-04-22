'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { GraduationCap, BookOpen, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { getTeachers, getStudents, updateStudent, getUser } from '@/lib/api'

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
  section?: string
  roll_number?: string
}

const CLASS_OPTIONS = ['Class 8A', 'Class 8B', 'Class 9A', 'Class 9B', 'Class 10A', 'Class 10B']

export default function UsersPage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ class_name: '', roll_number: '' })
  const [saving, setSaving] = useState(false)
  const user = getUser()
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin'
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

  async function handleSaveStudent(id: string) {
    setSaving(true)
    try {
      await updateStudent(id, { class_name: editForm.class_name, roll_number: editForm.roll_number })
      setStudents(prev => prev.map(s => s.id === id
        ? { ...s, class_name: editForm.class_name || undefined, roll_number: editForm.roll_number || undefined }
        : s
      ))
      setEditingId(null)
      toast.success('Student updated')
    } catch {
      toast.error('Failed to update student')
    } finally {
      setSaving(false)
    }
  }

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
                <th className="pb-3 font-medium">Class</th>
                <th className="pb-3 font-medium">Roll No.</th>
                <th className="pb-3 font-medium w-16"></th>
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
                  <td className="py-3 font-medium">{student.name}</td>
                  <td className="py-3 text-slate-400">{student.email}</td>
                  <td className="py-2">
                    {editingId === student.id ? (
                      <select
                        className="input py-1 text-xs"
                        value={editForm.class_name}
                        onChange={e => setEditForm(f => ({ ...f, class_name: e.target.value }))}
                      >
                        <option value="">No class</option>
                        {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span className={student.class_name ? 'text-white' : 'text-red-400 font-medium'}>
                        {student.class_name || 'Not assigned'}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    {editingId === student.id ? (
                      <input
                        className="input py-1 text-xs w-24"
                        placeholder="Roll no."
                        value={editForm.roll_number}
                        onChange={e => setEditForm(f => ({ ...f, roll_number: e.target.value }))}
                      />
                    ) : (
                      student.roll_number || '-'
                    )}
                  </td>
                  <td className="py-2">
                    {editingId === student.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleSaveStudent(student.id)} disabled={saving}
                          className="p-1.5 rounded text-green-400 hover:bg-green-400/10 transition-colors">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1.5 rounded text-slate-400 hover:bg-slate-400/10 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(student.id); setEditForm({ class_name: student.class_name || '', roll_number: student.roll_number || '' }) }}
                        className="p-1.5 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
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
                      {student.section ? `Section ${student.section}` : 'No section'} · {student.roll_number || 'No roll number'}
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
