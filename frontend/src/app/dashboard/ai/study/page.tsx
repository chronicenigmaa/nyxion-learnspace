'use client'
import Link from 'next/link'
import { BookOpen, Layers, CalendarDays } from 'lucide-react'

const tools = [
  {
    href: '/dashboard/ai/study/summarise',
    icon: BookOpen,
    label: 'Notes Summariser',
    desc: 'Paste your notes and get a concise summary with key points',
    color: '#6366f1',
  },
  {
    href: '/dashboard/ai/study/flashcards',
    icon: Layers,
    label: 'Flashcard Generator',
    desc: 'Turn your notes into Q&A flashcards for revision',
    color: '#10b981',
  },
  {
    href: '/dashboard/ai/study/study-plan',
    icon: CalendarDays,
    label: 'Study Plan',
    desc: 'Get a personalised day-by-day study plan based on your deadlines',
    color: '#f59e0b',
  },
]

export default function StudentAIPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">AI Study Tools</h1>
        <p className="text-slate-400 text-sm">Powered by Llama 3.3 70B via Groq</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tools.map(tool => {
          const Icon = tool.icon
          return (
            <Link key={tool.href} href={tool.href}
              className="block p-5 rounded-xl border border-[var(--border)] hover:border-indigo-500/50 transition-all group"
              style={{ background: 'var(--surface-850)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ background: tool.color + '22' }}>
                <Icon size={20} style={{ color: tool.color }} />
              </div>
              <div className="text-white font-medium mb-1 group-hover:text-indigo-400 transition-colors">{tool.label}</div>
              <div className="text-slate-400 text-sm">{tool.desc}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}