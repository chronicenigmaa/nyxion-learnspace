'use client'
import { useEffect, useState } from 'react'
import { getUser, api } from '@/lib/api'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const EVENT_TYPES = [
  { value: 'holiday',      label: 'Holiday',      color: '#ef4444' },
  { value: 'exam',         label: 'Exam',         color: '#f59e0b' },
  { value: 'event',        label: 'Event',        color: '#10b981' },
  { value: 'deadline',     label: 'Deadline',     color: '#8b5cf6' },
  { value: 'announcement', label: 'Announcement', color: '#06b6d4' },
  { value: 'assignment',   label: 'Assignment',   color: '#6366f1' },
]

function typeColor(type: string) {
  return EVENT_TYPES.find(t => t.value === type)?.color || '#6366f1'
}

export default function CalendarPage() {
  const [user, setUser] = useState<any>(null)
  const [current, setCurrent] = useState(new Date())
  const [events, setEvents] = useState<any[]>([])
  const [selected, setSelected] = useState<Date | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', event_type: 'event', date: '', end_date: '' })

  useEffect(() => { setUser(getUser()); loadEvents() }, [current])

  async function loadEvents() {
    setLoading(true)
    try {
      const month = format(current, 'yyyy-MM')
      // load current month + adjacent months for multi-day events
      const [r1, r2] = await Promise.all([
        api.get(`/api/v1/events/?month=${month}`),
        api.get(`/api/v1/events/`),
      ])
      setEvents(r2.data)
    } catch { }
    finally { setLoading(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.date) { toast.error('Title and date required'); return }
    try {
      await api.post('/api/v1/events/', {
        ...form,
        color: typeColor(form.event_type),
        end_date: form.end_date || null,
      })
      toast.success('Event added!')
      setShowForm(false)
      setForm({ title: '', description: '', event_type: 'event', date: '', end_date: '' })
      loadEvents()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create')
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/v1/events/${id}`)
      toast.success('Deleted')
      loadEvents()
    } catch { toast.error('Failed to delete') }
  }

  // Build calendar grid
  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  function eventsForDay(day: Date) {
    const dayStr = format(day, 'yyyy-MM-dd')
    return events.filter(e => {
      if (e.date === dayStr) return true
      if (e.end_date && e.date <= dayStr && e.end_date >= dayStr) return true
      return false
    })
  }

  const selectedEvents = selected ? eventsForDay(selected) : []
  const isTeacher = user?.role === 'teacher' || user?.role === 'school_admin' || user?.role === 'super_admin'

  // Upcoming events (next 30 days)
  const today = format(new Date(), 'yyyy-MM-dd')
  const in30 = format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd')
  const upcoming = events
    .filter(e => e.date >= today && e.date <= in30)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8)

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Calendar</h1>
          <p className="text-slate-400 text-sm mt-0.5">School events, holidays and deadlines</p>
        </div>
        {isTeacher && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} /> Add Event
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap">
        {EVENT_TYPES.map(t => (
          <div key={t.value} className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
            {t.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Calendar grid */}
        <div className="xl:col-span-3 card p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--surface-700)] transition-all">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-lg font-bold text-white font-display">
              {format(current, 'MMMM yyyy')}
            </h2>
            <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--surface-700)] transition-all">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-px" style={{ background: 'var(--border)' }}>
            {days.map(day => {
              const dayEvents = eventsForDay(day)
              const inMonth = isSameMonth(day, current)
              const isSelected = selected && isSameDay(day, selected)
              const todayDay = isToday(day)

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelected(isSameDay(day, selected || new Date(0)) ? null : day)}
                  className="min-h-[80px] p-1.5 cursor-pointer transition-colors"
                  style={{
                    background: isSelected
                      ? 'rgba(99,102,241,0.12)'
                      : 'var(--surface-800)',
                  }}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ${
                    todayDay ? 'bg-indigo-600 text-white' :
                    inMonth ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.id}
                        className="text-[10px] px-1 py-0.5 rounded truncate font-medium"
                        style={{ background: `${e.color}25`, color: e.color }}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-slate-500">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Selected day events */}
          {selected && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <h3 className="text-sm font-semibold text-white mb-3">
                {format(selected, 'EEEE, MMMM d')}
                {selectedEvents.length === 0 && <span className="text-slate-500 font-normal ml-2">— No events</span>}
              </h3>
              <div className="space-y-2">
                {selectedEvents.map(e => (
                  <div key={e.id} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: `${e.color}10`, border: `1px solid ${e.color}25` }}>
                    <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: e.color }} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{e.title}</div>
                      {e.description && <div className="text-xs text-slate-400 mt-0.5">{e.description}</div>}
                      {e.end_date && e.end_date !== e.date && (
                        <div className="text-xs text-slate-500 mt-0.5">Until {e.end_date}</div>
                      )}
                    </div>
                    {isTeacher && (
                      <button onClick={() => handleDelete(e.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isTeacher && (
                <button onClick={() => {
                  setForm(f => ({ ...f, date: format(selected, 'yyyy-MM-dd') }))
                  setShowForm(true)
                }} className="btn-secondary mt-3 text-sm py-1.5">
                  <Plus size={13} /> Add event on this day
                </button>
              )}
            </div>
          )}
        </div>

        {/* Upcoming events sidebar */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-white text-sm mb-3">Upcoming (30 days)</h3>
            {upcoming.length === 0 ? (
              <p className="text-slate-500 text-xs">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(e => (
                  <div key={e.id} className="flex items-start gap-2.5 py-2 border-b border-[var(--border)] last:border-0 cursor-pointer hover:opacity-80"
                    onClick={() => { setCurrent(parseISO(e.date)); setSelected(parseISO(e.date)) }}>
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: e.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{e.title}</div>
                      <div className="text-xs text-slate-500 font-mono">{e.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today button */}
          <button onClick={() => { setCurrent(new Date()); setSelected(new Date()) }}
            className="btn-secondary w-full justify-center text-sm">
            Jump to Today
          </button>
        </div>
      </div>

      {/* Add event modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
          <div className="relative z-10 w-full max-w-md card p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white text-lg">Add Event</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Title *</label>
                <input className="input" placeholder="Event title" value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.event_type}
                  onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))}>
                  {EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Date *</label>
                  <input type="date" className="input" value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} placeholder="Optional details..."
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>

              {/* Color preview */}
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: `${typeColor(form.event_type)}15`, border: `1px solid ${typeColor(form.event_type)}30` }}>
                <div className="w-3 h-3 rounded-full" style={{ background: typeColor(form.event_type) }} />
                <span className="text-sm" style={{ color: typeColor(form.event_type) }}>
                  {EVENT_TYPES.find(t => t.value === form.event_type)?.label}
                </span>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center">Add Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
