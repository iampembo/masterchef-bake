// Single-event configuration. Everything about this one night lives here —
// no events/participants tables in the DB (YAGNI: one-off, 4 friends).

export interface Participant {
  id: string
  name: string
  role: 'contestant' | 'critic'
  face: string
  /** critics only: contestant they pick for */
  picksFor?: string
}

/** 8am Saturday local (Sydney, AEST UTC+10 — DST starts Oct, so +10:00 applies). */
export const UNLOCK_AT = new Date('2026-09-05T08:00:00+10:00')

export const CONTESTANTS: Participant[] = [
  { id: 'ethan', name: 'Ethan', role: 'contestant', face: 'ethan.png' },
  { id: 'prash', name: 'Prash', role: 'contestant', face: 'prash.png' },
]

export const CRITICS: Participant[] = [
  { id: 'paige', name: 'Paige', role: 'critic', face: 'paige.png', picksFor: 'ethan' },
  { id: 'simran', name: 'Simran', role: 'critic', face: 'simran.png', picksFor: 'prash' },
]

export const ALL_PARTICIPANTS: Participant[] = [...CONTESTANTS, ...CRITICS]

export function getParticipant(id: string): Participant | undefined {
  return ALL_PARTICIPANTS.find((p) => p.id === id)
}

/** Dev/test override: open with ?unlock=1 to skip the time gate. */
export function unlockOverridden(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('unlock') === '1'
  } catch {
    return false
  }
}
