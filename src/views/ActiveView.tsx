import { useState } from 'react'
import { CONTESTANTS, getParticipant } from '../config'
import { PANTRY, STATUS_OPTIONS, wildcardArtFor } from '../data'
import { clearIdentity, supabase, type Box, type ContestantStatus } from '../lib/store'
import { Chip } from '../components/Brand'
import type { Participant } from '../config'

interface Props {
  me: Participant
  boxes: Box[]
  statuses: ContestantStatus[]
  resolved: Map<string, { wildcard: string; fellBack: boolean }>
  onStatus: (contestantId: string, status: string) => void
}

function Stepper({
  value,
  interactive,
  onPick,
}: {
  value: string | null
  interactive: boolean
  onPick?: (id: string) => void
}) {
  const current = Math.max(
    0,
    STATUS_OPTIONS.findIndex((s) => s.id === value),
  )
  return (
    <div>
      <div className="flex items-center">
        {STATUS_OPTIONS.map((s, i) => {
          const done = value !== null && i <= current
          const isCurrent = value !== null && i === current
          const dot = (
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full border-[3px] font-bubble font-extrabold text-xs transition-colors ${
                done ? 'bg-cherry border-ink text-paper' : 'bg-paper border-ink/25 text-ink/30'
              }`}
            >
              {i + 1}
            </span>
          )
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onPick?.(s.id)}
                  className={`rounded-full focus:outline-none no-callout ${isCurrent ? 'ring-2 ring-gold ring-offset-2 ring-offset-paper' : ''}`}
                  aria-label={`Set status to ${s.label}`}
                  aria-pressed={isCurrent}
                >
                  {dot}
                </button>
              ) : (
                dot
              )}
              {i < STATUS_OPTIONS.length - 1 && (
                <span className={`flex-1 h-[3px] mx-0.5 rounded ${i < current ? 'bg-cherry' : 'bg-ink/15'}`} />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-ink">
        {value ? STATUS_OPTIONS[current]?.label : 'Not started'}
      </div>
    </div>
  )
}

export function ActiveView({ me, boxes, statuses, resolved, onStatus }: Props) {
  const [saving, setSaving] = useState(false)
  const isContestant = me.role === 'contestant'

  async function setMyStatus(status: string) {
    if (!isContestant || saving) return
    setSaving(true)
    onStatus(me.id, status)
    const { error } = await supabase
      .from('contestant_status')
      .upsert({ contestant_id: me.id, status, updated_at: new Date().toISOString() }, { onConflict: 'contestant_id' })
    setSaving(false)
    if (error) console.error('status save failed', error)
  }

  const myBox = boxes.find((b) => b.contestant_id === me.id)

  return (
    <div className="p-5 pb-safe flex flex-col gap-5 max-w-lg mx-auto w-full">
      <div className="text-center pt-1">
        <h1 className="font-bubble font-extrabold text-3xl text-ink">Cook day</h1>
        <button
          onClick={() => {
            clearIdentity()
            window.location.reload()
          }}
          className="text-ink/40 text-xs mt-1 underline underline-offset-2"
        >
          Playing as {me.name}. Not you? Switch.
        </button>
      </div>

      <section className="brand-card p-4">
        <h2 className="font-bubble font-bold text-ink/60 text-sm tracking-wide">AT THE BENCHES</h2>
        <div className="flex flex-col gap-5 mt-3">
          {CONTESTANTS.map((c) => {
            const st = statuses.find((s) => s.contestant_id === c.id)?.status ?? null
            const face = getParticipant(c.id)
            const self = c.id === me.id && isContestant
            return (
              <div key={c.id}>
                <div className="flex items-center gap-3 mb-2">
                  <img
                    src={`/faces/${face?.face}`}
                    alt={c.name}
                    className="w-11 h-11 object-contain rounded-full bg-cream border-2 border-ink"
                    draggable={false}
                  />
                  <div className="font-bubble font-bold text-lg text-ink">{c.name}</div>
                  {self && <Chip tone="gold">You</Chip>}
                </div>
                <Stepper value={st} interactive={self} onPick={(id) => void setMyStatus(id)} />
              </div>
            )
          })}
        </div>
        {isContestant && (
          <div className="mt-4 rounded-2xl border-[3px] border-ink bg-gold px-4 py-2.5 shadow-[3px_3px_0_#1A1A22]">
            <p className="text-ink text-sm font-semibold text-center">
              This board is live. Tap a step under your name to show where you're at.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        {(isContestant ? [me] : CONTESTANTS).map((c) => {
          const box = boxes.find((b) => b.contestant_id === c.id)
          const r = resolved.get(c.id)
          const art = r ? wildcardArtFor(r.wildcard) : null
          if (!box || !r) return null
          return (
            <div key={c.id} className="brand-card p-4">
              <div className="text-[11px] font-bold tracking-widest text-ink/45">
                {isContestant ? 'YOUR WILDCARD' : `${c.name.toUpperCase()}'S WILDCARD`}
              </div>
              <div className="flex items-center gap-3 mt-2">
                <img src="/boxes/box-open.png" alt="" aria-hidden className="w-12 object-contain" draggable={false} />
                {art && <img src={art} alt={r.wildcard} className="w-14 h-14 object-contain" draggable={false} />}
                <div>
                  <div className="font-bubble font-extrabold text-2xl text-ink leading-tight">{r.wildcard}</div>
                  {r.fellBack && (
                    <div className="mt-1">
                      <Chip tone="gold">Second pick. First choices matched.</Chip>
                    </div>
                  )}
                </div>
              </div>
              {box.challenge_note && (
                <div className="bg-cream border-2 border-ink rounded-xl px-4 py-3 mt-3 -rotate-1">
                  <p className="font-brush text-xl text-ink leading-snug">{box.challenge_note}</p>
                </div>
              )}
            </div>
          )
        })}
        {isContestant && myBox && (
          <div className="brand-card p-4">
            <div className="text-[11px] font-bold tracking-widest text-ink/45">THE PANTRY</div>
            <ul className="text-ink/75 text-sm grid grid-cols-1 gap-1 mt-2">
              {PANTRY.map((p) => (
                <li key={p}>· {p}</li>
              ))}
            </ul>
            <p className="text-ink/60 text-sm mt-2">
              The pantry is a guide, not a rule. Cook with whatever you need. The wildcard
              is the only requirement.
            </p>
          </div>
        )}
      </section>

    </div>
  )
}
