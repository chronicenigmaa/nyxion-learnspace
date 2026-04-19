'use client'

interface NyxionLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  sub?: string
}

export default function NyxionLogo({ size = 'md', showText = true, sub = 'LearnSpace' }: NyxionLogoProps) {
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
                fill={`rgba(${Math.round(99 + (157 * b))}, ${Math.round(102 + (154 * b))}, ${Math.round(241 + (14 * b))}, ${0.4 + b * 0.6})`}
              />
            )
          })
        })}
      </svg>
      {showText && (
        <div className="leading-none">
          <div className={`font-display font-bold tracking-tight text-white ${textSizes[size]}`}>
            NYXION
          </div>
          <div className={`font-mono font-medium tracking-widest text-indigo-400 uppercase ${subSizes[size]}`}>
            {sub}
          </div>
        </div>
      )}
    </div>
  )
}
