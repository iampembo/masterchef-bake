import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { UNLOCK_AT, unlockOverridden, type Participant } from '../config'

// ---------------------------------------------------------------------------
// Supabase client (placeholder URL so `dev`/`build` work before creds land)
// ---------------------------------------------------------------------------

const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

export const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL)

export const supabase: SupabaseClient = createClient(url, anonKey)

// ---------------------------------------------------------------------------
// Types (mirror supabase.sql)
// ---------------------------------------------------------------------------

export interface Box {
  contestant_id: string
  choice1: string | null
  choice2: string | null
  challenge_note: string | null
  submitted_by: string | null
  submitted_at: string | null
}

export interface ContestantStatus {
  contestant_id: string
  status: string | null
  updated_at: string | null
}

// ---------------------------------------------------------------------------
// Identity — localStorage, no auth
// ---------------------------------------------------------------------------

const ID_KEY = 'mb_participant_id'

export function getIdentity(): string | null {
  try {
    return localStorage.getItem(ID_KEY)
  } catch {
    return null
  }
}

export function setIdentity(id: string): void {
  localStorage.setItem(ID_KEY, id)
}

export function clearIdentity(): void {
  localStorage.removeItem(ID_KEY)
}

// ---------------------------------------------------------------------------
// Reveal flag — per-device, NOT in the DB (YAGNI: seeing your animation
// is device-local state, not shared state)
// ---------------------------------------------------------------------------

export function hasRevealed(contestantId: string): boolean {
  try {
    return localStorage.getItem(`mb_revealed_${contestantId}`) === '1'
  } catch {
    return false
  }
}

export function markRevealed(contestantId: string): void {
  try {
    localStorage.setItem(`mb_revealed_${contestantId}`, '1')
  } catch {
    /* private mode — reveal will replay, harmless */
  }
}

// ---------------------------------------------------------------------------
// Wildcard clash resolution (pure — unit-testable)
// Rule: earliest submitted_at keeps choice1; later submitter falls back to
// choice2 if present. Custom singles have choice2 = null, so a clash on two
// customs (or a double-clash) resolves to an allowed duplicate.
// ---------------------------------------------------------------------------

export const normWildcard = (s: string | null | undefined): string =>
  (s ?? '').trim().toLowerCase()

export interface Resolved {
  effA: string
  effB: string
  fellBack: 'a' | 'b' | null
}

export function resolveEffective(a: Box, b: Box): Resolved {
  const a1raw = (a.choice1 ?? '').trim()
  const b1raw = (b.choice1 ?? '').trim()
  if (!a1raw || !b1raw || normWildcard(a1raw) !== normWildcard(b1raw)) {
    return { effA: a1raw, effB: b1raw, fellBack: null }
  }
  const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
  const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
  // Tie (same ms — vanishingly rare) is deterministic: b falls back.
  if (aTime <= bTime) {
    const fb = (b.choice2 ?? '').trim() || b1raw
    return { effA: a1raw, effB: fb, fellBack: fb.toLowerCase() !== b1raw.toLowerCase() ? 'b' : null }
  }
  const fa = (a.choice2 ?? '').trim() || a1raw
  return { effA: fa, effB: b1raw, fellBack: fa.toLowerCase() !== a1raw.toLowerCase() ? 'a' : null }
}

/** Convenience: resolve for a named contestant against their opponent. */
export function effectiveFor(
  boxes: Box[],
  contestantId: string,
): { wildcard: string; fellBack: boolean } {
  const mine = boxes.find((x) => x.contestant_id === contestantId)
  const other = boxes.find((x) => x.contestant_id !== contestantId)
  if (!mine || !other) return { wildcard: (mine?.choice1 ?? '').trim(), fellBack: false }
  const r = resolveEffective(
    mine.contestant_id <= other.contestant_id ? mine : other,
    mine.contestant_id <= other.contestant_id ? other : mine,
  )
  const mineIsA = mine.contestant_id <= other.contestant_id
  return {
    wildcard: mineIsA ? r.effA : r.effB,
    fellBack: r.fellBack === (mineIsA ? 'a' : 'b'),
  }
}

// ---------------------------------------------------------------------------
// Phase computation (pure apart from the ?unlock=1 override)
// ---------------------------------------------------------------------------

export type Phase = 'setup' | 'locked' | 'reveal' | 'active'

export function allSubmitted(boxes: Box[]): boolean {
  return boxes.length > 0 && boxes.every((b) => b.submitted_at && normWildcard(b.choice1) !== '')
}

export function computePhase(params: {
  me: Participant
  boxes: Box[]
  revealed: boolean
  now?: Date
}): Phase {
  const { me, boxes, revealed, now = new Date() } = params
  if (!allSubmitted(boxes)) return 'setup'
  if (now < UNLOCK_AT && !unlockOverridden()) return 'locked'
  if (me.role === 'contestant' && !revealed) return 'reveal'
  return 'active'
}

// ---------------------------------------------------------------------------
// Reveal chime — synthesised with Web Audio, no mp3 asset needed.
// iOS Safari suspends AudioContexts created outside a user gesture, so the
// context is created/resumed inside the hold gesture (ensureAudio) and the
// notes play later on the already-unlocked context.
// ---------------------------------------------------------------------------

let sharedCtx: AudioContext | null = null

export function ensureAudio(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!sharedCtx) sharedCtx = new Ctx()
    if (sharedCtx.state === 'suspended') void sharedCtx.resume()
  } catch {
    /* audio unavailable — animation carries the moment */
  }
}

export function playRevealChime(): void {
  try {
    ensureAudio()
    const ctx = sharedCtx
    if (!ctx) return
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.7)
    })
  } catch {
    /* audio unavailable — animation carries the moment */
  }
}
