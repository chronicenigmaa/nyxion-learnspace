'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, BookOpen, GraduationCap } from 'lucide-react'
import { getTeacherDetail, getUser } from '@/lib/api'

type TeacherDetail = {
  teacher: {
    id: string
    name: string
    email: string
    subject?: string
  }
  assigned_sections: Array<{
    id: string
    class_name?: string
    section?: string
  }>
  assigned_students: Array<{
    id: string
    name: string
    email?: string
    class_name?: string
    section?: string
    roll_number?: string
  }>
}

export default function TeacherDetailPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<TeacherDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const user = getUser()
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin'

  useEffect(() => {
    if (!isAdmin || !params?.id) return

    ;(async () => {
      try {
        const res = await getTeacherDetail(params.id)
        setData(res.data)
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || 'Failed to load teacher profile')
      } finally {
        setLoading(false)
      }
    })()
  }, [isAdmin, params])

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-[var(--border)] p-6" style={{ background: 'var(--surface-850)' }}>
        <h1 className="text-xl font-bold text-white">Teacher Profile</h1>
        <p className="mt-2 text-sm text-slate-400">Only admins can view teacher profiles.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/users" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} />
          Back to Users
        </Link>
      </div>

      <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{data?.teacher.name || 'Teacher Profile'}</h1>
            <p className="mt-1 text-sm text-slate-400">{data?.teacher.email || 'Loading teacher details...'}</p>
          </div>
          <div className="badge badge-blue">{data?.teacher.subject || 'No subject'}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl p-2" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <BookOpen size={18} className="text-indigo-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Assigned Sections</h2>
            <p className="text-sm text-slate-400">Sections where this teacher is the class teacher in EduOS.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {!loading && (!data?.assigned_sections || data.assigned_sections.length === 0) && (
            <div className="text-sm text-slate-500">No assigned sections found.</div>
          )}
          {data?.assigned_sections.map((section) => (
            <div key={section.id} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-slate-200">
              Class {section.class_name}{section.section ? `-${section.section}` : ''}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: 'var(--surface-850)' }}>
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl p-2" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <GraduationCap size={18} className="text-emerald-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Assigned Students</h2>
            <p className="text-sm text-slate-400">Students matched from EduOS by this teacher&apos;s assigned class sections.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-slate-400">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Class</th>
                <th className="pb-3 font-medium">Section</th>
                <th className="pb-3 font-medium">Roll No.</th>
              </tr>
            </thead>
            <tbody>
              {!loading && (!data?.assigned_students || data.assigned_students.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">No assigned students found.</td>
                </tr>
              )}
              {data?.assigned_students.map((student) => (
                <tr key={student.id} className="border-b border-[var(--border)]/60 text-slate-200">
                  <td className="py-3">{student.name}</td>
                  <td className="py-3">{student.email || '-'}</td>
                  <td className="py-3">{student.class_name || '-'}</td>
                  <td className="py-3">{student.section || '-'}</td>
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
