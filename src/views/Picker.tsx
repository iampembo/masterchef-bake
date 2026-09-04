import { useState } from 'react'
import { motion } from 'framer-motion'
import { ALL_PARTICIPANTS } from '../config'
import { clearIdentity, setIdentity } from '../lib/store'
import { StickerImg } from '../components/StickerImg'
import type { Participant } from '../config'

export function Picker({ onPick }: { onPick: (p: Participant) => void }) {
  const [pending, setPending] = useState<Participant | null>(null)

  return (
    <div className="min-h-dvh bg-[#0d0d1a] flex flex-col items-center justify-center gap-8 p-6 pb-safe pt-safe">
      <div className="text-center">
        <div className="text-4xl mb-3">📦</div>
        <h1 className="text-cream text-2xl font-display tracking-wide">Who are you?</h1>
        <p className="text-white/40 text-sm mt-2">Tap your face. No passwords, no accounts.</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-8">
        {ALL_PARTICIPANTS.map((p, i) => (
          <motion.button
            key={p.id}
            onClick={() => setPending(p)}
            whileTap={{ scale: 0.93 }}
            className="flex flex-col items-center gap-3 focus:outline-none"
          >
            <StickerImg src={`/faces/${p.face}`} alt={p.name} size={110} index={i} />
            <span className="text-white text-lg font-semibold">{p.name}</span>
            <span className="text-white/30 text-xs -mt-2">
              {p.role === 'contestant' ? '👨‍🍳 contestant' : '😈 critic'}
            </span>
          </motion.button>
        ))}
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-xs text-center"
          >
            <p className="text-cream text-lg">
              Playing as <span className="font-bold text-gold">{pending.name}</span>?
            </p>
            <p className="text-white/40 text-sm mt-1">That's you?</p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setPending(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold"
              >
                Nah
              </button>
              <button
                onClick={() => {
                  setIdentity(pending.id)
                  onPick(pending)
                }}
                className="flex-1 py-3 rounded-xl bg-gold text-black font-bold"
              >
                Yes ✓
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <button
        onClick={() => {
          clearIdentity()
          window.location.reload()
        }}
        className="text-white/20 text-xs mt-2"
      >
        not you? — reset this device
      </button>
    </div>
  )
}
