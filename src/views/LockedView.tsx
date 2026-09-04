import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { UNLOCK_AT } from '../config'
import type { Participant } from '../config'
import type { Box } from '../lib/store'

function msLeft(): number {
  return UNLOCK_AT.getTime() - Date.now()
}

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

  return (
    <div className="min-h-dvh bg-[#0d0d1a] flex flex-col items-center justify-center gap-6 p-6 text-center">
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ repeat: Infinity, duration: 2.5 }}
        className="text-7xl"
      >
        📦
      </motion.div>
      <h2 className="text-cream text-2xl font-display">Boxes sealed</h2>
      <div className="text-gold text-4xl font-mono tabular-nums">{fmt(msLeft())}</div>
      <p className="text-white/40 text-sm">until the 8am reveal</p>

      {me.role === 'contestant' ? (
        <p className="text-white/60 text-sm max-w-xs">
          {me.name}, your fate is decided. Get some sleep — you'll need it. 🔥
        </p>
      ) : (
        <p className="text-white/60 text-sm max-w-xs">
          {mine?.choice1 ? (
            <>
              Your pick for <span className="text-gold">{mine.contestant_id}</span> is locked in.
              No edits. No mercy. 😈
            </>
          ) : (
            'Waiting on the other critic…'
          )}
        </p>
      )}
    </div>
  )
}
