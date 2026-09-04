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
import { BrandButton, Header } from './components/Brand'
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

  if (!me) {
    return (
      <>
        <Header signedIn={false} />
        <Picker onPick={setMe} />
      </>
    )
  }

  const shell = (body: React.ReactNode) => (
    <>
      <Header signedIn name={me.name} />
      {body}
    </>
  )

  if (!supabaseConfigured) {
    return shell(
      <div className="min-h-dvh flex items-center justify-center p-6 text-center">
        <div className="brand-card p-6 max-w-xs">
          <p className="font-bubble font-bold text-lg text-ink">Not connected yet.</p>
          <p className="text-ink/60 text-sm mt-2">
            Add the Supabase URL and anon key to .env, then run supabase.sql.
          </p>
        </div>
      </div>,
    )
  }

  if (loadError && boxes.length === 0) {
    return shell(
      <div className="min-h-dvh flex items-center justify-center p-6 text-center">
        <div className="brand-card p-6 max-w-xs flex flex-col gap-4">
          <div>
            <p className="font-bubble font-bold text-lg text-ink">No signal to the kitchen.</p>
            <p className="text-ink/60 text-sm mt-1">{loadError}</p>
          </div>
          <BrandButton onClick={() => void fetchAll()}>Retry</BrandButton>
        </div>
      </div>,
    )
  }

  const submitted = allSubmitted(boxes)
  const revealed = me.role === 'contestant' ? hasRevealed(me.id) : true
  const phase = submitted ? computePhase({ me, boxes, revealed }) : 'setup'

  if (phase === 'setup') {
    if (me.role === 'critic') {
      const target = getParticipant(me.picksFor ?? '') ?? CONTESTANTS[0]
      const existing = boxes.find((b) => b.contestant_id === target.id)
      return shell(
        <SetupView critic={me} contestant={target} existingBox={existing} onSubmitted={() => void fetchAll()} />,
      )
    }
    return shell(
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 pb-safe text-center max-w-lg mx-auto">
        <img src="/boxes/box-closed.png" alt="Sealed mystery box" className="w-40 object-contain" draggable={false} />
        <h2 className="font-bubble font-extrabold text-2xl text-ink">The critics are deciding.</h2>
        <p className="text-ink/60 text-sm max-w-xs">
          Paige and Simran are choosing your wildcards. The boxes seal overnight and open at 8am.
        </p>
        <button onClick={() => void fetchAll()} className="mt-1 text-ink/35 text-xs underline underline-offset-2">
          Check again
        </button>
      </div>,
    )
  }

  if (phase === 'locked') return shell(<LockedView me={me} boxes={boxes} />)

  if (phase === 'reveal' && me.role === 'contestant') {
    const r = resolved.get(me.id) ?? { wildcard: '', fellBack: false }
    const box = boxes.find((b) => b.contestant_id === me.id)
    const criticName = getParticipant(box?.submitted_by ?? '')?.name ?? 'Your critic'
    return shell(
      <RevealView
        contestantId={me.id}
        contestantName={me.name}
        criticName={criticName}
        wildcard={r.wildcard}
        note={box?.challenge_note ?? null}
        fellBack={r.fellBack}
        onComplete={() => {
          markRevealed(me.id)
          setRevealedTick((x) => x + 1)
        }}
      />,
    )
  }

  return shell(
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
    />,
  )
}
