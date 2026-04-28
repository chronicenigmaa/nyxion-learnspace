'use client'
import Link from 'next/link'
import { FileText, BookOpen, Search, MessageSquare, ClipboardList, Layout } from 'lucide-react'

const tools = [
  {
    href: '/dashboard/ai/exam-generator',
    icon: ClipboardList,
    label: 'Exam Generator',
    desc: 'Generate exam questions by subject, topic, and difficulty',
    color: '#6366f1',
  },
  {
    href: '/dashboard/ai/homework-generator',
    icon: FileText,
    label: 'Homework Generator',
    desc: 'Create homework assignments with answer keys',
    color: '#8b5cf6',
  },
  {
    href: '/dashboard/ai/lesson-planner',
    icon: Layout,
    label: 'Lesson Planner',
    desc: 'Build structured lesson plans with objectives and activities',
    color: '#0ea5e9',
  },
  {
    href: '/dashboard/ai/plagiarism',
    icon: Search,
    label: 'Plagiarism Checker',
    desc: 'Detect copied or AI-generated content in submissions',
    color: '#f59e0b',
  },
  {
    href: '/dashboard/ai/feedback',
    icon: MessageSquare,
    label: 'Feedback Writer',
    desc: 'Generate personalised student feedback based on marks',
    color: '#10b981',
  },
  {
    href: '/dashboard/ai/rubric',
    icon: BookOpen,
    label: 'Rubric Generator',
    desc: 'Create detailed marking rubrics for any assignment',
    color: '#ec4899',
  },
]

export default function AIToolsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">AI Tools</h1>
        <p className="text-slate-400 text-sm">Powered by Llama 3.3 70B via Groq</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="text-white font-medium mb-1 group-hover:text-indigo-400 transition-colors">
                {tool.label}
              </div>
              <div className="text-slate-400 text-sm">{tool.desc}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}