import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { clearIdentity } from '../lib/store'

// ---------------------------------------------------------------------------
// Brand primitives — chunky ink outlines, hard offset shadows, cream tiles.
// ---------------------------------------------------------------------------

export const wiggleVariants = {
  wiggle: (i: number) => ({
    rotate: [-1.5, 1.5, -1, 1, -1.5],
    scale: [1, 1.02, 1, 1.02, 1],
    transition: {
      duration: 0.55,
      repeat: Infinity,
      ease: 'easeInOut' as const,
      delay: (i % 8) * 0.07,
    },
  }),
  still: { rotate: 0, scale: 1 },
}

interface ChipProps {
  children: ReactNode
  tone?: 'ink' | 'gold' | 'red' | 'cream'
}

export function Chip({ children, tone = 'ink' }: ChipProps) {
  const tones: Record<string, string> = {
    ink: 'bg-ink text-paper',
    gold: 'bg-gold text-ink',
    red: 'bg-cherry text-paper',
    cream: 'bg-cream text-ink',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border-2 border-ink text-[11px] font-bold tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function BrandButton({ variant = 'primary', className = '', ...rest }: BrandButtonProps) {
  return (
    <button
      className={`brand-btn ${variant === 'primary' ? 'brand-btn-primary' : 'brand-btn-secondary'} w-full py-4 text-lg ${className}`}
      {...rest}
    />
  )
}

interface TileButtonProps {
  img: string
  alt: string
  label: string
  sub?: string
  index?: number
  selected?: boolean
  badge?: string | null
  onTap?: () => void
  title?: string
}

/** 1:1 clickable tile for faces and ingredients. */
export function TileButton({
  img,
  alt,
  label,
  sub,
  index = 0,
  selected = false,
  badge = null,
  onTap,
  title,
}: TileButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onTap}
      title={title}
      custom={index}
      variants={wiggleVariants}
      animate={selected ? 'still' : 'wiggle'}
      whileTap={{ scale: 0.94 }}
      className={`no-callout relative flex flex-col items-center rounded-2xl border-[3px] p-2 transition-colors focus:outline-none ${
        selected
          ? 'border-ink bg-gold shadow-[5px_5px_0_#8B0D1E]'
          : 'border-ink bg-cream shadow-[4px_4px_0_#1A1A22]'
      }`}
    >
      <div className="w-full aspect-square flex items-center justify-center overflow-hidden">
        <img
          src={img}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain pointer-events-none"
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        />
      </div>
      <span className="font-bubble font-bold text-[13px] leading-tight text-center text-ink mt-1">
        {label}
      </span>
      {sub && <span className="text-[11px] text-ink/50 -mt-0.5">{sub}</span>}
      {badge && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 bg-ink text-paper rounded-full w-7 h-7 flex items-center justify-center font-bubble font-extrabold border-2 border-paper shadow"
        >
          {badge}
        </motion.span>
      )}
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// Persistent header — wordmark on top of every screen.
// ---------------------------------------------------------------------------

export function Header({ signedIn, name }: { signedIn: boolean; name?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur border-b-[3px] border-ink">
      <div className="max-w-lg mx-auto px-4 pt-safe pb-2 flex items-center justify-center relative">
        <img src="/logo-wordmark.png" alt="The Great Bakeoff" className="h-12 object-contain" draggable={false} />
        {signedIn && (
          <button
            onClick={() => {
              clearIdentity()
              window.location.reload()
            }}
            className="absolute right-3 bottom-2 text-[11px] font-semibold text-ink/40 underline underline-offset-2"
          >
            {name ? `Not ${name}? Switch` : 'Switch'}
          </button>
        )}
      </div>
    </header>
  )
}
