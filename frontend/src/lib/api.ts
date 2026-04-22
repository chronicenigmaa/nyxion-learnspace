import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

// Attach token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ls_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('ls_token')
      localStorage.removeItem('ls_user')
      window.location.href = '/auth/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (email: string, password: string) =>
  api.post('/api/v1/auth/login', { email, password })
export const ssoLogin = (token: string) =>
  api.post('/api/v1/auth/sso', { token })

export const getMe = () => api.get('/api/v1/auth/me')
export const forgotPassword = (email: string) =>
  api.post('/api/v1/auth/forgot-password', { email })
export const resetPassword = (token: string, new_password: string) =>
  api.post('/api/v1/auth/reset-password', { token, new_password })

// Assignments
export const getAssignments = () => api.get('/api/v1/assignments/')
export const getAssignment = (id: string) => api.get(`/api/v1/assignments/${id}`)
export const createAssignment = (data: FormData) =>
  api.post('/api/v1/assignments/', data)
export const updateAssignmentStatus = (id: string, status: string) =>
  api.patch(`/api/v1/assignments/${id}/status?status=${status}`)
export const updateAssignment = (id: string, data: FormData) =>
  api.put(`/api/v1/assignments/${id}`, data)
export const deleteAssignment = (id: string) => api.delete(`/api/v1/assignments/${id}`)

// Submissions
export const submitAssignment = (data: FormData) =>
  api.post('/api/v1/submissions/submit', data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const getSubmissionsForAssignment = (id: string) =>
  api.get(`/api/v1/submissions/assignment/${id}`)
export const getMySubmission = (assignmentId: string) =>
  api.get(`/api/v1/submissions/my/${assignmentId}`)
export const gradeSubmission = (id: string, data: FormData) =>
  api.post(`/api/v1/submissions/${id}/grade`, data, { headers: { 'Content-Type': 'multipart/form-data' } })

// Notes
export const getNotes = () => api.get('/api/v1/notes/')
export const uploadNotes = (data: FormData) =>
  api.post('/api/v1/notes/', data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const deleteNote = (id: string) => api.delete(`/api/v1/notes/${id}`)

export const buildApiFileUrl = (path: string) => {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE}${path}`
}

// Exams
export const getExams = () => api.get('/api/v1/exams/')
export const createExam = (data: any) => api.post('/api/v1/exams/', data)
export const startExam = (id: string) => api.patch(`/api/v1/exams/${id}/start`)
export const endExam = (id: string) => api.patch(`/api/v1/exams/${id}/end`)
export const startExamAttempt = (examId: string) =>
  api.post(`/api/v1/exams/${examId}/attempt/start`)
export const logViolation = (examId: string, data: any) =>
  api.post(`/api/v1/exams/${examId}/attempt/violation`, data)
export const submitExam = (examId: string, answers: any) =>
  api.post(`/api/v1/exams/${examId}/attempt/submit`, answers)
export const getExamResults = (examId: string) =>
  api.get(`/api/v1/exams/${examId}/results`)
export const getExamAttemptDetail = (examId: string, attemptId: string) =>
  api.get(`/api/v1/exams/${examId}/results/${attemptId}`)
export const gradeExamAttempt = (examId: string, attemptId: string, data: { question_grades: Array<{ question_id: string; awarded_marks: number }> }) =>
  api.patch(`/api/v1/exams/${examId}/results/${attemptId}/grade`, data)

// Attendance
export const markAttendance = (data: any) => api.post('/api/v1/attendance/bulk', data)
export const getClassAttendance = (className: string) =>
  api.get(`/api/v1/attendance/class/${encodeURIComponent(className)}`)
export const getMyAttendance = () => api.get('/api/v1/attendance/my')

// Grades
export const getMyGrades = () => api.get('/api/v1/grades/my')
export const getStudentGrades = (id: string) => api.get(`/api/v1/grades/student/${id}`)

// Users
export const getStudents = (className?: string) =>
  api.get('/api/v1/users/students' + (className ? `?class_name=${encodeURIComponent(className)}` : ''))
export const updateStudent = (id: string, data: { class_name?: string; roll_number?: string }) =>
  api.patch(`/api/v1/users/students/${id}`, data)
export const getTeachers = () => api.get('/api/v1/users/teachers')
export const getTeacherDetail = (id: string) => api.get(`/api/v1/users/teachers/${id}`)

// Auth helpers
export const getUser = () => {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem('ls_user') || 'null') } catch { return null }
}
export const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('ls_token') : null
export const isLoggedIn = () => !!getToken()
export const logout = () => {
  localStorage.removeItem('ls_token')
  localStorage.removeItem('ls_user')
  window.location.href = '/auth/login'
}
