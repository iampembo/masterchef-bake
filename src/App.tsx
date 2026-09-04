import { useCallback, useEffect, useMemo, useState } from 'react'
import { CONTESTANTS, getParticipant } from './config'
import {
  allSubmitted,
  computePhase,
  effectiveFor,
  getIdentity,
  hasRevealed,
  markRevealed,
  supabase,
  supabaseConfigured,
  type Box,
  type ContestantStatus,
} from './lib/store'
import type { Participant } from './config'
import { Picker } from './views/Picker'
import { SetupView } from './views/SetupView'
import { LockedView } from './views/LockedView'
import { RevealView } from './views/RevealView'
import { ActiveView } from './views/ActiveView'

export default function App() {
  const [me, setMe] = useState<Participant | null>(() => {
    const id = getIdentity()
    return id ? getParticipant(id) ?? null : null
  })
  const [boxes, setBoxes] = useState<Box[]>([])
  const [statuses, setStatuses] = useState<ContestantStatus[]>([])
  const [revealedTick, setRevealedTick] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  void revealedTick

  const fetchAll = useCallback(async () => {
    if (!supabaseConfigured) return
    const [{ data: b, error: bErr }, { data: s, error: sErr }] = await Promise.all([
      supabase.from('boxes').select('*'),
      supabase.from('contestant_status').select('*'),
    ])
    if (bErr) setLoadError(bErr.message)
    else if (b) setBoxes(b as Box[])
    if (sErr) setLoadError(sErr.message)
    else if (s) setStatuses(s as ContestantStatus[])
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // Realtime: instant sync across the 4 devices, with a visibility-change
  // refetch as a backstop for dropped channels.
  useEffect(() => {
    if (!supabaseConfigured) return
    const ch = supabase
      .channel('app-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boxes' }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contestant_status' }, (payload) => {
        const row = payload.new as ContestantStatus
        setStatuses((prev) => {
          const i = prev.findIndex((s) => s.contestant_id === row.contestant_id)
          if (i === -1) return [...prev, row]
          const next = [...prev]
          next[i] = row
          return next
        })
      })
      .subscribe()
    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchAll()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void supabase.removeChannel(ch)
    }
  }, [fetchAll])

  const resolved = useMemo(() => {
    const m = new Map<string, { wildcard: string; fellBack: boolean }>()
    for (const c of CONTESTANTS) m.set(c.id, effectiveFor(boxes, c.id))
    return m
  }, [boxes])

  if (!me) return <Picker onPick={setMe} />

  if (!supabaseConfigured) {
    return (
      <div className="min-h-dvh bg-[#0d0d1a] flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-4xl mb-3">🔧</div>
          <p className="text-cream">Hey {me.name} — backend not connected yet.</p>
          <p className="text-white/40 text-sm mt-2 max-w-xs">
            Add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to .env, then run supabase.sql in the
            Supabase SQL editor.
          </p>
        </div>
      </div>
    )
  }

  if (loadError && boxes.length === 0) {
    return (
      <div className="min-h-dvh bg-[#0d0d1a] flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-4xl mb-3">📡</div>
          <p className="text-cream">Couldn't reach the box…</p>
          <p className="text-white/40 text-sm mt-2">{loadError}</p>
          <button onClick={() => void fetchAll()} className="mt-4 px-6 py-3 rounded-xl bg-gold text-black font-bold">
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Critic setup takes precedence: a critic who hasn't submitted sees SetupView
  // even while boxes.length is still loading-ish, as long as we have data.
  const submitted = allSubmitted(boxes)
  const revealed = me.role === 'contestant' ? hasRevealed(me.id) : true
  const phase = submitted ? computePhase({ me, boxes, revealed }) : 'setup'

  if (phase === 'setup') {
    if (me.role === 'critic') {
      const target = getParticipant(me.picksFor ?? '') ?? CONTESTANTS[0]
      const existing = boxes.find((b) => b.contestant_id === target.id)
      // If the OTHER critic hasn't created rows yet / still loading, still render.
      return <SetupView critic={me} contestant={target} existingBox={existing} onSubmitted={() => void fetchAll()} />
    }
    return (
      <div className="min-h-dvh bg-[#0d0d1a] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-6xl">😈</div>
        <h2 className="text-cream text-xl font-display">The critics are plotting…</h2>
        <p className="text-white/50 text-sm max-w-xs">
          Paige and Simran are picking your wildcard. Your box seals overnight and opens at 8am.
        </p>
        <button onClick={() => void fetchAll()} className="mt-2 text-white/30 text-xs underline">
          refresh
        </button>
      </div>
    )
  }

  if (phase === 'locked') return <LockedView me={me} boxes={boxes} />

  if (phase === 'reveal' && me.role === 'contestant') {
    const r = resolved.get(me.id) ?? { wildcard: '', fellBack: false }
    const box = boxes.find((b) => b.contestant_id === me.id)
    return (
      <RevealView
        contestantId={me.id}
        contestantName={me.name}
        wildcard={r.wildcard}
        note={box?.challenge_note ?? null}
        fellBack={r.fellBack}
        onComplete={() => {
          markRevealed(me.id)
          setRevealedTick((x) => x + 1)
        }}
      />
    )
  }

  return (
    <ActiveView
      me={me}
      boxes={boxes}
      statuses={statuses}
      resolved={resolved}
      onStatus={(contestantId, status) =>
        setStatuses((prev) => {
          const i = prev.findIndex((s) => s.contestant_id === contestantId)
          const row = { contestant_id: contestantId, status, updated_at: new Date().toISOString() }
          if (i === -1) return [...prev, row]
          const next = [...prev]
          next[i] = row
          return next
        })
      }
    />
  )
}
