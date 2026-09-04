import { useState } from 'react'
import { CONTESTANTS, getParticipant } from '../config'
import { PANTRY, STATUS_OPTIONS, wildcardArtFor } from '../data'
import { clearIdentity, supabase, type Box, type ContestantStatus } from '../lib/store'
import type { Participant } from '../config'

interface Props {
  me: Participant
  boxes: Box[]
  statuses: ContestantStatus[]
  resolved: Map<string, { wildcard: string; fellBack: boolean }>
  onStatus: (contestantId: string, status: string) => void
}

function statusLabel(id: string | null): string {
  if (!id) return '— yet to start —'
  const hit = STATUS_OPTIONS.find((s) => s.id === id)
  return hit ? `${hit.emoji} ${hit.label}` : id
}

export function ActiveView({ me, boxes, statuses, resolved, onStatus }: Props) {
  const [saving, setSaving] = useState(false)
  const isContestant = me.role === 'contestant'
  const myStatus = statuses.find((s) => s.contestant_id === me.id)?.status ?? null

  async function setMyStatus(status: string) {
    if (!isContestant || saving) return
    setSaving(true)
    onStatus(me.id, status) // optimistic
    const { error } = await supabase
      .from('contestant_status')
      .upsert({ contestant_id: me.id, status, updated_at: new Date().toISOString() }, { onConflict: 'contestant_id' })
    setSaving(false)
    if (error) console.error('status save failed', error)
  }

  const myBox = boxes.find((b) => b.contestant_id === me.id)

  return (
    <div className="min-h-dvh bg-[#0d0d1a] p-5 pb-12 max-w-lg mx-auto flex flex-col gap-6">
      <header className="text-center pt-3">
        <div className="text-3xl">🔥</div>
        <h1 className="text-cream text-xl font-display mt-1">Cook day is live</h1>
        <button
          onClick={() => {
            clearIdentity()
            window.location.reload()
          }}
          className="text-white/20 text-xs mt-1"
        >
          playing as {me.name} — not you?
        </button>
      </header>

      {/* Live status board */}
      <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <h2 className="text-white/50 text-xs font-bold tracking-widest mb-3">LIVE STATUS</h2>
        <div className="flex flex-col gap-3">
          {CONTESTANTS.map((c) => {
            const st = statuses.find((s) => s.contestant_id === c.id)?.status ?? null
            const face = getParticipant(c.id)
            return (
              <div key={c.id} className="flex items-center gap-3">
                <img
                  src={`/faces/${face?.face}`}
                  alt={c.name}
                  className="w-10 h-10 object-contain rounded-full bg-white/10"
                  draggable={false}
                />
                <div className="flex-1">
                  <div className="text-white text-sm font-semibold">{c.name}</div>
                  <div className="text-white/60 text-sm">{statusLabel(st)}</div>
                </div>
                {c.id === me.id && isContestant && <span className="text-gold text-xs">you</span>}
              </div>
            )
          })}
        </div>

        {isContestant && (
          <div className="flex flex-wrap gap-2 mt-4">
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => void setMyStatus(o.id)}
                disabled={saving}
                className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
                  myStatus === o.id
                    ? 'bg-gold text-black border-gold'
                    : 'bg-white/5 text-white/70 border-white/15 active:scale-95'
                }`}
              >
                {o.emoji} {o.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* My box recap (contestants) / both boxes (critics) */}
      <section className="flex flex-col gap-3">
        {(isContestant ? [me] : CONTESTANTS).map((c) => {
          const box = boxes.find((b) => b.contestant_id === c.id)
          const r = resolved.get(c.id)
          const art = r ? wildcardArtFor(r.wildcard) : null
          if (!box || !r) return null
          return (
            <div key={c.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="text-white/50 text-xs font-bold tracking-widest">
                {isContestant ? 'YOUR WILDCARD' : `${c.name.toUpperCase()}'S WILDCARD`}
              </div>
              <div className="flex items-center gap-3 mt-2">
                {art && <img src={art} alt={r.wildcard} className="w-14 h-14 object-contain" draggable={false} />}
                <div>
                  <div className="font-display text-2xl text-cream leading-tight">{r.wildcard}</div>
                  {r.fellBack && <div className="text-white/35 text-xs">🔀 fallback pick (first choices clashed)</div>}
                </div>
              </div>
              {box.challenge_note && (
                <div className="bg-[#fffdf5] -rotate-1 rounded-lg px-4 py-3 mt-3">
                  <p className="font-hand text-base text-black/80 leading-snug">“{box.challenge_note}”</p>
                </div>
              )}
            </div>
          )
        })}
        {isContestant && myBox && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-white/50 text-xs font-bold tracking-widest mb-2">BASE PANTRY</div>
            <ul className="text-white/70 text-sm grid grid-cols-1 gap-1">
              {PANTRY.map((p) => (
                <li key={p}>· {p}</li>
              ))}
            </ul>
            <p className="text-white/30 text-xs mt-2">
              Guidelines, not rules — supplement as needed to make your wildcard sing.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
