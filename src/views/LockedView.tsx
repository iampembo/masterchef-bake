import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { UNLOCK_AT } from '../config'
import { Chip } from '../components/Brand'
import type { Participant } from '../config'
import type { Box } from '../lib/store'

function fmt(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${ss}`
}

export function LockedView({ me, boxes }: { me: Participant; boxes: Box[] }) {
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const mine =
    me.role === 'critic'
      ? boxes.find((b) => b.submitted_by === me.id)
      : boxes.find((b) => b.contestant_id === me.id)
  const targetName = mine
    ? mine.contestant_id.charAt(0).toUpperCase() + mine.contestant_id.slice(1)
    : null

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-5 p-6 pb-safe text-center max-w-lg mx-auto w-full relative overflow-hidden">
      <div className="burst-rays absolute inset-0 pointer-events-none" />
      <motion.img
        src="/boxes/box-closed.png"
        alt="Sealed mystery box"
        draggable={false}
        animate={{ rotate: [-1.2, 1.2, -1.2], y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
        className="relative w-52 object-contain"
        style={{ filter: 'drop-shadow(0 0 26px rgba(242,169,0,0.55))' }}
      />
      <div className="relative">
        <Chip tone="red">Sealed</Chip>
      </div>
      <div className="relative">
        <div className="font-bubble font-extrabold text-5xl text-ink tabular-nums">
          {fmt(UNLOCK_AT.getTime() - Date.now())}
        </div>
        <p className="text-ink/50 text-sm mt-1">until the boxes open</p>
      </div>
      <p className="relative text-ink/70 text-sm max-w-xs">
        {me.role === 'contestant' ? (
          'Your box opens at 8am. Get some rest.'
        ) : (
          <>Your pick for {targetName} is locked in.</>
        )}
      </p>
    </div>
  )
}
