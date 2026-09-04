import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MAX_NOTE, WILDCARDS, wildcardById } from '../data'
import { supabase, type Box } from '../lib/store'
import { BrandButton, Chip, TileButton } from '../components/Brand'
import type { Participant } from '../config'

interface Props {
  critic: Participant
  contestant: Participant
  existingBox: Box | undefined
  onSubmitted: () => void
}

export function SetupView({ critic, contestant, existingBox, onSubmitted }: Props) {
  const [ranked, setRanked] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastTapped, setLastTapped] = useState<string | null>(null)

  const customActive = custom.trim().length > 0

  function toggle(id: string) {
    if (customActive) return
    setLastTapped(id)
    setRanked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const valid = useMemo(
    () => customActive || ranked.length === 2,
    [customActive, ranked.length],
  )

  const tappedTooltip = lastTapped
    ? WILDCARDS.find((w) => w.id === lastTapped)?.tooltip
    : null

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
      setError(e instanceof Error ? e.message : 'Could not seal the box. Try again.')
      setSaving(false)
    }
  }

  if (existingBox?.submitted_at) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 pb-safe text-center max-w-lg mx-auto w-full">
        <img src="/boxes/box-closed.png" alt="Sealed mystery box" className="w-44 object-contain" draggable={false} />
        <div>
          <Chip tone="ink">Sealed</Chip>
        </div>
        <h2 className="font-bubble font-extrabold text-2xl text-ink">
          {contestant.name}'s box is set
        </h2>
        <p className="text-ink/60 text-sm max-w-xs">
          Your picks are locked in. The other box stays hidden until 8am.
        </p>
        <p className="font-brush text-2xl text-oxblood">See you at 8am.</p>
      </div>
    )
  }

  return (
    <div className="p-5 pb-safe flex flex-col gap-5 max-w-lg mx-auto w-full">
      <div className="text-center pt-1">
        <h2 className="font-bubble font-extrabold text-2xl text-ink">
          {contestant.name}'s mystery box
        </h2>
        <p className="text-ink/60 text-sm mt-1">
          Pick two wildcards, in order. If both critics pick the same first wildcard, the box
          sealed first keeps it.
        </p>
      </div>

      {tappedTooltip && !customActive && (
        <div className="brand-card px-4 py-2.5 text-center">
          <p className="text-sm text-ink/75">{tappedTooltip}</p>
        </div>
      )}

      <div className={`grid grid-cols-3 gap-3 ${customActive ? 'opacity-30 pointer-events-none' : ''}`}>
        {WILDCARDS.map((w, i) => {
          const rank = ranked.indexOf(w.id)
          return (
            <TileButton
              key={w.id}
              img={`/ingredients/${w.imageKey}`}
              alt={w.name}
              label={w.name}
              index={i}
              selected={rank !== -1}
              badge={rank !== -1 ? String(rank + 1) : null}
              onTap={() => toggle(w.id)}
              title={w.tooltip}
            />
          )
        })}
      </div>

      <div>
        <label className="font-bubble font-bold text-ink">
          Or write in your own <span className="font-body font-normal text-ink/50 text-sm">(replaces the grid picks)</span>
        </label>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={80}
          placeholder="Something from your imagination"
          className="brand-input mt-1.5 w-full p-3"
        />
      </div>

      {valid && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <label className="font-bubble font-bold text-ink">Add a note for {contestant.name}</label>
          <textarea
            maxLength={MAX_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Give them something to think about."
            className="brand-input mt-1.5 w-full p-3 h-20 resize-none"
          />
          <div className="text-right text-ink/40 text-xs">{note.length}/{MAX_NOTE}</div>
        </motion.div>
      )}

      {error && <p className="text-cherry text-sm text-center font-semibold">{error}</p>}

      <BrandButton disabled={!valid || saving} onClick={submit}>
        {saving ? 'Sealing…' : 'Seal the box'}
      </BrandButton>
    </div>
  )
}
