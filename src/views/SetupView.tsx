import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MAX_NOTE, WILDCARDS, wildcardById } from '../data'
import { supabase, type Box } from '../lib/store'
import { StickerImg } from '../components/StickerImg'
import type { Participant } from '../config'

interface Props {
  critic: Participant
  contestant: Participant
  existingBox: Box | undefined
  onSubmitted: () => void
}

/**
 * Critic setup: pick TOP TWO (tap order = rank) OR type a custom wildcard
 * (custom replaces both — typing clears the grid). Earliest submitter wins
 * any clash; the later box silently falls back to its choice2.
 */
export function SetupView({ critic, contestant, existingBox, onSubmitted }: Props) {
  const [ranked, setRanked] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const customActive = custom.trim().length > 0

  function toggle(id: string) {
    if (customActive) return
    setRanked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id) // deselect; #2 promotes
      if (prev.length >= 2) return [prev[1], id] // third tap replaces #2, keeps #1
      return [...prev, id]
    })
  }

  const valid = useMemo(
    () => customActive || ranked.length === 2,
    [customActive, ranked.length],
  )

  async function submit() {
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      const choice1 = customActive
        ? custom.trim().slice(0, 80)
        : (wildcardById(ranked[0])?.name ?? '')
      const choice2 = customActive ? null : (wildcardById(ranked[1])?.name ?? null)
      const { error: upErr } = await supabase.from('boxes').upsert(
        {
          contestant_id: contestant.id,
          choice1,
          choice2,
          challenge_note: note.trim().slice(0, MAX_NOTE),
          submitted_by: critic.id,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'contestant_id' },
      )
      if (upErr) throw upErr
      onSubmitted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not lock in — try again.')
      setSaving(false)
    }
  }

  // Already submitted (e.g. reopened app): show sealed confirmation, no edits.
  if (existingBox?.submitted_at) {
    return (
      <div className="min-h-dvh bg-[#0d0d1a] flex flex-col items-center justify-center gap-4 p-6 pb-safe pt-safe text-center">
        <div className="text-5xl">🔒</div>
        <h2 className="text-cream text-xl font-display">Sealed for {contestant.name}</h2>
        <p className="text-white/50 text-sm max-w-xs">
          Your pick is locked in. You won't see {contestant.name === 'Ethan' ? 'Prash' : 'Ethan'}
          's box until the reveal. Sleep tight 😈
        </p>
        <div className="text-white/30 text-xs mt-2">
          Your #{customActive ? 'custom' : 'ranked'} pick is hidden until 8am.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#0d0d1a] p-5 pb-safe pt-safe flex flex-col gap-5 max-w-lg mx-auto">
      <div className="text-center pt-4">
        <div className="text-3xl">😈</div>
        <h2 className="text-cream text-xl font-display mt-2">
          Pick <span className="text-gold">two</span> wildcards for{' '}
          <span className="text-gold">{contestant.name}</span>
        </h2>
        <p className="text-white/40 text-xs mt-1">
          Tap in order — 1st tap = 1st choice. If both critics pick the same #1, whoever locks in
          first keeps it.
        </p>
      </div>

      <div className={`grid grid-cols-3 gap-3 ${customActive ? 'opacity-30 pointer-events-none' : ''}`}>
        {WILDCARDS.map((w, i) => {
          const rank = ranked.indexOf(w.id)
          const selected = rank !== -1
          return (
            <motion.button
              key={w.id}
              onClick={() => toggle(w.id)}
              whileTap={{ scale: 0.94 }}
              title={w.tooltip}
              className={`relative flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-colors ${
                selected ? 'border-gold bg-white/5' : 'border-transparent'
              }`}
            >
              <StickerImg
                src={`/ingredients/${w.imageKey}`}
                alt={w.name}
                size={72}
                index={i}
                wiggle={!selected}
              />
              <span className="text-[11px] text-center text-white/80 font-medium leading-tight">
                {w.name}
              </span>
              {selected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-0 right-0 bg-gold text-black rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                >
                  {rank + 1}
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </div>

      <div>
        <label className="text-white/60 text-xs font-semibold">
          …or invent your own wildcard <span className="text-white/30">(replaces grid picks)</span>
        </label>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={80}
          placeholder="e.g. yuzu kosho 😈"
          className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/25 text-base focus:outline-none focus:border-gold/60"
        />
      </div>

      {valid && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <label className="text-white/60 text-xs font-semibold">
            Challenge note for {contestant.name} <span className="text-white/30">(smack talk / hint)</span>
          </label>
          <textarea
            maxLength={MAX_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Leave a message for them... 😈"
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/25 text-base resize-none h-20 focus:outline-none focus:border-gold/60"
          />
          <div className="text-right text-white/30 text-xs">{note.length}/{MAX_NOTE}</div>
        </motion.div>
      )}

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button
        disabled={!valid || saving}
        onClick={submit}
        className="w-full py-4 rounded-2xl bg-gold text-black font-bold disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {saving ? 'Sealing…' : '🔒 Lock It In'}
      </button>
    </div>
  )
}
