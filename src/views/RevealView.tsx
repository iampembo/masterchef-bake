import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { wildcardArtFor } from '../data'
import { ensureAudio, markRevealed, playRevealChime } from '../lib/store'
import { BrandButton, Chip } from '../components/Brand'

interface Props {
  contestantId: string
  contestantName: string
  criticName: string
  wildcard: string
  note: string | null
  fellBack: boolean
  onComplete: () => void
}

type Stage = 'ready' | 'shaking' | 'open'

function burstParticles(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  const colors = ['#E63946', '#F2A900', '#8B0D1E', '#E8CBA8', '#1A1A22']
  const parts = Array.from({ length: 90 }, () => ({
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 14 * dpr,
    vy: (Math.random() - 0.5) * 14 * dpr,
    size: (Math.random() * 5 + 2) * dpr,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 1,
  }))
  ;(function tick() {
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    parts.forEach((p) => {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.25 * dpr
      p.life -= 0.018
      ctx.globalAlpha = Math.max(p.life, 0)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.globalAlpha = 1
    if (parts.some((p) => p.life > 0)) requestAnimationFrame(tick)
  })()
}

export function RevealView({
  contestantId,
  contestantName,
  criticName,
  wildcard,
  note,
  fellBack,
  onComplete,
}: Props) {
  const [stage, setStage] = useState<Stage>('ready')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const art = wildcardArtFor(wildcard)

  useEffect(() => {
    if (stage !== 'open') return
    const t = window.setTimeout(onComplete, 12000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  function tapBox() {
    if (stage !== 'ready') return
    ensureAudio()
    setStage('shaking')
    window.setTimeout(() => {
      setStage('open')
      playRevealChime()
      markRevealed(contestantId)
      requestAnimationFrame(() => {
        if (canvasRef.current) burstParticles(canvasRef.current)
      })
    }, 950)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-5 p-6 pb-safe max-w-lg mx-auto w-full relative overflow-hidden">
      {stage === 'open' && (
        <>
          <div className="burst-rays absolute inset-0 pointer-events-none" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <motion.div
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-paper pointer-events-none"
          />
        </>
      )}

      {stage !== 'open' ? (
        <>
          <h2 className="font-bubble font-extrabold text-2xl text-ink text-center">
            {contestantName}, your box is ready.
          </h2>
          <div className="w-full max-w-[280px] aspect-[3/4] flex items-center justify-center">
            <motion.button
              type="button"
              onTap={tapBox}
              onClick={tapBox}
              animate={
                stage === 'ready'
                  ? { y: [0, -8, 0] }
                  : { rotate: [-5, 5, -4, 4, -2, 2, 0] }
              }
              transition={
                stage === 'ready'
                  ? { repeat: Infinity, duration: 2.2, ease: 'easeInOut' }
                  : { duration: 0.9, ease: 'easeInOut' }
              }
              whileTap={{ scale: 0.96 }}
              className="no-callout focus:outline-none"
              style={{
                filter:
                  stage === 'shaking'
                    ? 'drop-shadow(0 0 45px rgba(230,57,70,0.85))'
                    : 'drop-shadow(0 0 26px rgba(242,169,0,0.6))',
              }}
              aria-label="Tap to open your mystery box"
            >
              <img
                src="/boxes/box-closed.png"
                alt="Your sealed mystery box"
                draggable={false}
                className="w-full object-contain pointer-events-none"
              />
            </motion.button>
          </div>
          <div>
            <Chip tone="gold">Ready</Chip>
          </div>
          <p className="text-ink/60 text-sm">Tap to open.</p>
          <p className="text-ink/30 text-xs">Sound on.</p>
        </>
      ) : (
        <>
          <div className="w-full max-w-[240px] aspect-[3/4] flex items-center justify-center relative">
            <motion.img
              src="/boxes/box-open.png"
              alt="Your mystery box, open"
              draggable={false}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 170, damping: 14 }}
              className="w-full object-contain"
            />
          </div>
          <motion.div
            initial={{ scale: 0, rotateY: 120 }}
            animate={{ scale: 1, rotateY: 0 }}
            transition={{ delay: 0.45, type: 'spring', stiffness: 160, damping: 16 }}
            className="brand-card relative p-6 w-full text-center"
          >
            <div className="text-[11px] tracking-[0.3em] font-bold text-ink/40">YOUR WILDCARD</div>
            {art && (
              <img src={art} alt={wildcard} className="w-28 h-28 object-contain mx-auto my-3" draggable={false} />
            )}
            <h2 className="font-bubble font-extrabold text-3xl text-ink leading-tight">{wildcard}</h2>
            {fellBack && (
              <div className="mt-2">
                <Chip tone="gold">Second pick. First choices matched.</Chip>
              </div>
            )}
          </motion.div>
          {note && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
              className="w-full bg-cream border-[3px] border-ink rounded-2xl px-5 py-4 -rotate-1 shadow-[4px_4px_0_#1A1A22]"
            >
              <div className="text-[11px] font-bold tracking-widest text-ink/50">
                {criticName.toUpperCase()} WROTE
              </div>
              <p className="font-brush text-2xl text-ink leading-snug mt-1">{note}</p>
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2 }}
            className="w-full"
          >
            <BrandButton onClick={onComplete}>Your time starts now</BrandButton>
          </motion.div>
        </>
      )}
    </div>
  )
}
