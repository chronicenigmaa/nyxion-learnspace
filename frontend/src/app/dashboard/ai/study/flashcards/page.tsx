'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

interface Flashcard { question: string; answer: string }

export default function FlashcardsPage() {
  const [text, setText] = useState('')
  const [subject, setSubject] = useState('')
  const [numCards, setNumCards] = useState(10)
  const [cards, setCards] = useState<Flashcard[]>([])
  const [flipped, setFlipped] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!text) { setError('Please paste your notes first.'); return }
    setLoading(true); setError(''); setCards([]); setFlipped({})
    try {
      const { data } = await api.post('/api/v1/ai/flashcards', { text, subject, num_cards: numCards })
      const parsed: Flashcard[] = JSON.parse(data.flashcards)
      setCards(parsed)
    } catch (e: any) { setError('Could not parse flashcards. Try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Flashcard Generator</h1>
      <p className="text-slate-400 text-sm mb-6">Turn your notes into interactive flashcards. Click a card to flip it.</p>
      <div className="p-5 rounded-xl border border-[var(--border)] mb-6" style={{ background: 'var(--surface-850)' }}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Subject (optional)</label>
            <input className="input w-full" placeholder="e.g. Biology"
              value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Number of cards</label>
            <input className="input w-full" type="number" min={5} max={20}
              value={numCards} onChange={e => setNumCards(parseInt(e.target.value))} />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1">Your Notes</label>
          <textarea className="input w-full h-40 resize-none" placeholder="Paste your notes here..."
            value={text} onChange={e => setText(e.target.value)} />
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Flashcards'}
        </button>
      </div>

      {cards.length > 0 && (
        <div>
          <p className="text-slate-400 text-sm mb-4">{cards.length} cards — click to flip</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cards.map((card, i) => (
              <div key={i}
                onClick={() => setFlipped(f => ({ ...f, [i]: !f[i] }))}
                className="p-4 rounded-xl border border-[var(--border)] cursor-pointer hover:border-indigo-500/50 transition-all min-h-[100px] flex items-center justify-center"
                style={{ background: flipped[i] ? '#1e1b4b' : 'var(--surface-850)' }}>
                <p className="text-sm text-center text-white leading-relaxed">
                  {flipped[i] ? card.answer : card.question}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}