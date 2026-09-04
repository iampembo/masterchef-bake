import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { wildcardArtFor } from '../data'
import { markRevealed, ensureAudio, playRevealChime } from '../lib/store'

interface Props {
  contestantId: string
  contestantName: string
  wildcard: string
  note: string | null
  fellBack: boolean
  onComplete: () => void
}

type Stage = 'sealed' | 'burst'

function burstParticles(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  const colors = ['#FFD700', '#FFA500', '#FFFACD', '#FF8C00', '#FFFFFF']
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

export function RevealView({ contestantId, contestantName, wildcard, note, fellBack, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>('sealed')
  const [progress, setProgress] = useState(0)
  const timer = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const art = wildcardArtFor(wildcard)

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current)
  }, [])

  function startHold(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    ensureAudio() // unlock iOS audio inside the gesture
    if (stage !== 'sealed' || timer.current) return
    let p = 0
    timer.current = window.setInterval(() => {
      p += 2.5 // ~1.2s to fill
      setProgress(Math.min(p, 100))
      if (p >= 100) {
        if (timer.current) window.clearInterval(timer.current)
        timer.current = null
        triggerBurst()
      }
    }, 30)
  }

  function releaseHold() {
    if (timer.current) {
      window.clearInterval(timer.current)
      timer.current = null
    }
    if (stage === 'sealed') setProgress(0)
  }

  function triggerBurst() {
    setStage('burst')
    playRevealChime()
    markRevealed(contestantId)
    requestAnimationFrame(() => {
      if (canvasRef.current) burstParticles(canvasRef.current)
    })
    window.setTimeout(onComplete, 6000)
  }

  if (stage === 'burst') {
    return (
      <div className="min-h-dvh bg-[#0d0d1a] relative overflow-hidden flex flex-col items-center justify-center p-6 pb-safe text-center">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 bg-white pointer-events-none"
        />
        <motion.div
          initial={{ scale: 0, rotateY: 180 }}
          animate={{ scale: 1, rotateY: 0 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 160, damping: 16 }}
          className="relative bg-[#FFF8E7] rounded-3xl p-8 w-full max-w-xs shadow-[0_0_80px_rgba(255,215,0,0.45)]"
        >
          <div className="text-xs tracking-[0.3em] text-black/40 font-bold">WILDCARD</div>
          {art && (
            <img src={art} alt={wildcard} className="w-32 h-32 object-contain mx-auto my-4" draggable={false} />
          )}
          <h2 className="font-display text-3xl text-black leading-tight">{wildcard}</h2>
          {fellBack && <div className="text-xs text-black/40 mt-2">🔀 fallback pick — the other box clashed</div>}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="relative mt-6 max-w-xs"
        >
          {note && (
            <div className="bg-[#fffdf5] -rotate-2 rounded-lg px-5 py-4 shadow-lg">
              <p className="font-hand text-lg text-black/80 leading-snug">“{note}”</p>
            </div>
          )}
        </motion.div>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          onClick={onComplete}
          className="relative mt-8 px-8 py-3 rounded-full bg-gold text-black font-bold"
        >
          Let's cook 🔥
        </motion.button>
      </div>
    )
  }

  return (
    <div
      className="min-h-dvh bg-[#0d0d1a] flex flex-col items-center justify-center gap-8 p-6 pb-safe select-none no-callout"
      onMouseUp={releaseHold}
      onTouchEnd={releaseHold}
      onMouseLeave={releaseHold}
    >
      <p className="text-cream/80 text-lg">
        {contestantName}, your box is <span className="text-gold font-bold">ready</span>
      </p>
      <motion.div
        animate={
          progress > 0
            ? { scale: [1, 1.05, 1], rotate: [-1.5, 1.5, -1.5], transition: { repeat: Infinity, duration: 0.16 } }
            : { scale: [1, 1.03, 1], transition: { repeat: Infinity, duration: 2 } }
        }
        className="relative text-8xl"
        style={{ filter: `drop-shadow(0 0 ${12 + progress * 0.6}px rgba(255,215,0,${0.25 + progress / 160}))` }}
      >
        📦
      </motion.div>
      <button
        onMouseDown={startHold}
        onTouchStart={startHold}
        onContextMenu={(e) => e.preventDefault()}
        className="relative w-52 h-14 rounded-full bg-white/10 border border-white/20 text-white font-semibold text-sm overflow-hidden touch-none"
      >
        <div className="absolute inset-0 bg-gold/40 origin-left" style={{ transform: `scaleX(${progress / 100})` }} />
        <span className="relative z-10">{progress > 0 ? 'Keep holding…' : 'Hold to Open'}</span>
      </button>
      <p className="text-white/25 text-xs">sound on 🔊</p>
    </div>
  )
}
