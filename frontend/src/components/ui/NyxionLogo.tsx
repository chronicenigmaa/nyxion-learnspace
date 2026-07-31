'use client'

interface NyxionLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  sub?: string
  /**
   * 'dark'  — dark ink, for the light surfaces used throughout the app (default)
   * 'light' — white ink, for the indigo brand panel on the sign-in screen
   */
  tone?: 'dark' | 'light'
}

export default function NyxionLogo({
  size = 'md',
  showText = true,
  sub = 'LearnSpace',
  tone = 'dark',
}: NyxionLogoProps) {
  const dotSizes = { sm: 5, md: 7, lg: 10 }
  const gapSizes = { sm: 3, md: 4, lg: 6 }
  const textSizes = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl' }
  const subSizes = { sm: 'text-[9px]', md: 'text-[11px]', lg: 'text-sm' }

  const d = dotSizes[size]
  const g = gapSizes[size]
  const step = d + g

  // Staircase: col 1 = 1 dot (bottom), col 2 = 2 dots, col 3 = 3 dots, col 4 = 4 dots
  // Ascending left to right, aligned to bottom
  const cols = [
    { dots: 1, brightness: [0.95] },
    { dots: 2, brightness: [0.5, 0.7] },
    { dots: 3, brightness: [0.3, 0.5, 0.7] },
    { dots: 4, brightness: [0.2, 0.35, 0.55, 0.8] },
  ]
  const maxDots = 4
  const svgW = cols.length * step - g
  const svgH = maxDots * step - g

  // `brightness` runs 0 → 1 up the staircase. On a dark panel that ramps
  // indigo → white; on the app's light surfaces it has to ramp the other way
  // (pale indigo → deep indigo) or the brightest dots disappear into the page.
  const dotFill = (b: number) => {
    if (tone === 'light') {
      const r = Math.round(99 + 157 * b)
      const g2 = Math.round(102 + 154 * b)
      const b2 = Math.round(241 + 14 * b)
      return `rgba(${r}, ${g2}, ${b2}, ${0.4 + b * 0.6})`
    }
    // #c7d2fe (pale) → #4338ca (deep)
    const r = Math.round(199 - 132 * b)
    const g2 = Math.round(210 - 154 * b)
    const b2 = Math.round(254 - 52 * b)
    return `rgba(${r}, ${g2}, ${b2}, ${0.65 + b * 0.35})`
  }

  return (
    <div className="flex items-center gap-3">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg">
        {cols.map((col, ci) => {
          const x = ci * step + d / 2
          // Align to bottom of SVG
          const startRow = maxDots - col.dots
          return col.brightness.map((b, di) => {
            const row = startRow + di
            const y = row * step + d / 2
            return (
              <circle
                key={`${ci}-${di}`}
                cx={x}
                cy={y}
                r={d / 2}
                fill={dotFill(b)}
              />
            )
          })
        })}
      </svg>
      {showText && (
        <div className="leading-none">
          <div className={`font-display font-bold tracking-tight ${textSizes[size]} ${
            tone === 'light' ? 'text-white' : 'text-[var(--text-primary)]'
          }`}>
            NYXION
          </div>
          <div className={`font-mono font-medium tracking-widest uppercase ${subSizes[size]} ${
            tone === 'light' ? 'text-indigo-200' : 'text-indigo-600'
          }`}>
            {sub}
          </div>
        </div>
      )}
    </div>
  )
}
