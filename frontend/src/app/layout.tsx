import type { Metadata } from 'next'
import { Outfit, DM_Mono, Syne } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-dm-mono' })
const syne = Syne({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-syne' })

export const metadata: Metadata = {
  title: 'Nyxion LearnSpace',
  description: 'Assignment & Learning Portal — Powered by Nyxion EduOS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${dmMono.variable} ${syne.variable} font-sans`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1a1a2e', color: '#e2e8f0', border: '1px solid #2d2d4e', borderRadius: '10px' },
            success: { iconTheme: { primary: '#6366f1', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
