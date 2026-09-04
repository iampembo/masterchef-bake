# Mystery Box App — Technical Specification

> Read `brainstorm.md` first for full context, challenge format, and UX intent.
> This document covers everything needed to implement the app.

---

## Project Setup

```bash
npm create vite@latest mystery-box -- --template react-ts
cd mystery-box
npm install @supabase/supabase-js framer-motion tailwindcss @tailwindcss/vite
```

Add Tailwind to `vite.config.ts`:
```ts
import tailwindcss from '@tailwindcss/vite'
export default { plugins: [react(), tailwindcss()] }
```

**Dependencies:**
| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | DB + Realtime client |
| `framer-motion` | Reveal animation, wiggle, transitions |
| `tailwindcss` | Styling |

No router needed — single page, state-driven.

---

## Environment Variables

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Create a `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

---

## File Structure

```
src/
  lib/
    supabase.ts          # Supabase client
    identity.ts          # localStorage identity helpers
    phase.ts             # App phase computation
  components/
    IdentityPicker.tsx   # Who are you? screen
    SetupView.tsx        # Critic wildcard selection
    WildcardCard.tsx     # Sticker-style ingredient card
    LockedView.tsx       # Sealed box + countdown
    RevealView.tsx       # Hold-to-open + animation sequence
    ActiveView.tsx       # Status ticker + day view
  App.tsx                # PhaseRouter
  main.tsx
public/
  faces/
    ethan.png            # Cutout face PNGs (transparent bg)
    [mate].png
    [critic-a].png
    [critic-b].png
  ingredients/
    white-miso-paste.png  # Cutout ingredient PNGs (transparent bg)
    tahini.png
    vegemite.png
    ... (one per wildcard)
  sounds/
    reveal.mp3            # Whoosh + chime on box burst
```

---

## Supabase Setup

### Tables

Run in Supabase SQL editor:

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('contestant', 'critic')),
  picks_for UUID REFERENCES participants(id),
  image_key TEXT NOT NULL  -- filename under /public/faces/ e.g. 'ethan.png'
);

CREATE TABLE mystery_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  contestant_id UUID UNIQUE REFERENCES participants(id),
  wildcard TEXT,
  challenge_note TEXT CHECK (char_length(challenge_note) <= 175),
  submitted_by UUID REFERENCES participants(id),
  submitted_at TIMESTAMPTZ,
  revealed_at TIMESTAMPTZ  -- set when contestant triggers the reveal
);

CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contestant_id UUID REFERENCES participants(id),
  status TEXT NOT NULL CHECK (status IN ('researching', 'shopping', 'cooking', 'plating', 'done')),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security

Keep it simple — anon key can read/write everything. This is a private app for 4 people; RLS would add complexity without meaningful security benefit.

```sql
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mystery_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon users (4-person private app)
CREATE POLICY "allow all" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON mystery_boxes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON status_updates FOR ALL USING (true) WITH CHECK (true);
```

### Seed Script

Run once before the app is shared. Replace names and UUIDs as needed:

```sql
-- Insert event (unlock 8am AEST Saturday 6 Sep 2025 = UTC+10)
INSERT INTO events (id, unlock_at) VALUES
  ('evt-001', '2025-09-06 22:00:00+00');  -- 8am AEST = 10pm Friday UTC

-- Insert participants
-- Step 1: insert without picks_for (self-referential FK)
INSERT INTO participants (id, event_id, name, role, image_key) VALUES
  ('p-ethan',    'evt-001', 'Ethan',   'contestant', 'ethan.png'),
  ('p-mate',     'evt-001', '[Mate]',  'contestant', 'mate.png'),
  ('p-critic-a', 'evt-001', '[Critic A name]', 'critic', 'critic-a.png'),
  ('p-critic-b', 'evt-001', '[Critic B name]', 'critic', 'critic-b.png');

-- Step 2: set cross-assignment (Critic A picks for Ethan's mate, Critic B picks for Ethan)
UPDATE participants SET picks_for = 'p-mate'  WHERE id = 'p-critic-a';
UPDATE participants SET picks_for = 'p-ethan' WHERE id = 'p-critic-b';

-- Step 3: create empty mystery boxes for each contestant
INSERT INTO mystery_boxes (event_id, contestant_id) VALUES
  ('evt-001', 'p-ethan'),
  ('evt-001', 'p-mate');
```

> **Note on unlock_at timezone**: AEST is UTC+10, AEDT (daylight saving) is UTC+11. Double-check which applies on the event date. If AEDT is in effect, 8am local = `21:00:00+00` the night before.

---

## Identity — localStorage

`src/lib/identity.ts`:

```ts
const KEY = 'mb_participant_id'

export function getIdentity(): string | null {
  return localStorage.getItem(KEY)
}

export function setIdentity(participantId: string): void {
  localStorage.setItem(KEY, participantId)
}

export function clearIdentity(): void {
  localStorage.removeItem(KEY)
}
```

On app load: if `getIdentity()` returns null, render `<IdentityPicker />`. Otherwise, fetch that participant from Supabase and proceed to `<PhaseRouter />`.

---

## App Phase Computation

`src/lib/phase.ts`:

```ts
export type Phase = 'setup' | 'locked' | 'reveal' | 'active'

export function computePhase(params: {
  boxes: { submitted_at: string | null; revealed_at: string | null }[]
  unlockAt: Date
  role: 'contestant' | 'critic'
}): Phase {
  const { boxes, unlockAt, role } = params
  const allSubmitted = boxes.every(b => b.submitted_at !== null)
  const now = new Date()

  if (!allSubmitted) return 'setup'
  if (now < unlockAt) return 'locked'

  // For contestants: check if they've triggered their own reveal
  if (role === 'contestant') {
    const myBox = boxes[0] // filtered to their box
    if (!myBox.revealed_at) return 'reveal'
  }

  return 'active'
}
```

`App.tsx` fetches all required data on mount, recomputes phase reactively, and renders the appropriate view.

---

## Sticker Visual Effect

Both face photos (identity picker) and ingredient cards (wildcard grid) use the same "Apple sticker" treatment:
- Cutout PNG with transparent background
- White outline border created via SVG filter
- Wiggle animation via Framer Motion

### SVG Filter for White Outline

Place once in `index.html` (or in a `<StickerFilters />` component rendered at app root):

```html
<svg style="display:none" aria-hidden="true">
  <defs>
    <filter id="sticker-border" x="-15%" y="-15%" width="130%" height="130%">
      <!-- Dilate the alpha channel to create outline shape -->
      <feMorphology in="SourceAlpha" operator="dilate" radius="6" result="dilated"/>
      <!-- Fill outline shape with white -->
      <feFlood flood-color="white" result="white"/>
      <feComposite in="white" in2="dilated" operator="in" result="outline"/>
      <!-- Stack: outline below, original image on top -->
      <feMerge>
        <feMergeNode in="outline"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
</svg>
```

Apply to any image: `style={{ filter: 'url(#sticker-border)' }}`

Adjust `radius="6"` to control border thickness (larger = thicker).

### Wiggle Animation

`WildcardCard.tsx` (also used for face buttons in the identity picker):

```tsx
import { motion } from 'framer-motion'

const wiggleVariants = {
  wiggle: (i: number) => ({
    rotate: [-1.5, 1.5, -1, 1, -1.5],
    scale: [1, 1.02, 1, 1.02, 1],
    transition: {
      duration: 0.55,
      repeat: Infinity,
      ease: 'easeInOut',
      delay: i * 0.07,  // stagger — each card wiggles slightly out of phase
    },
  }),
  selected: {
    rotate: 0,
    scale: 1.08,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
}

interface Props {
  name: string        // display name
  imageKey: string    // filename under /ingredients/ or /faces/
  tooltip?: string    // shown on long-press or hover
  index: number       // for stagger delay
  selected?: boolean
  onSelect?: () => void
}

export function WildcardCard({ name, imageKey, tooltip, index, selected, onSelect }: Props) {
  return (
    <motion.button
      custom={index}
      variants={wiggleVariants}
      animate={selected ? 'selected' : 'wiggle'}
      onClick={onSelect}
      className="relative flex flex-col items-center gap-2 p-3 rounded-2xl
                 bg-transparent border-2 border-transparent
                 focus:outline-none"
      style={selected ? { borderColor: '#FFD700' } : {}}
      title={tooltip}
    >
      <img
        src={`/ingredients/${imageKey}`}
        alt={name}
        style={{ filter: 'url(#sticker-border)', width: 80, height: 80, objectFit: 'contain' }}
        draggable={false}
      />
      <span className="text-xs text-center text-white/80 font-medium leading-tight">
        {name}
      </span>
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1 right-1 bg-yellow-400 rounded-full w-5 h-5 flex items-center justify-center text-xs"
        >
          ✓
        </motion.div>
      )}
    </motion.button>
  )
}
```

---

## Identity Picker Screen

2×2 grid. Same sticker treatment as ingredient cards. On selection: confirm modal ("Playing as [Name]? That's you?"), then `setIdentity(id)`.

```tsx
export function IdentityPicker({ participants, onSelect }) {
  const [pending, setPending] = useState<Participant | null>(null)

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-white text-2xl font-serif tracking-wide">Who are you?</h1>
      <div className="grid grid-cols-2 gap-6">
        {participants.map((p, i) => (
          <motion.button
            key={p.id}
            custom={i}
            variants={wiggleVariants}
            animate="wiggle"
            onClick={() => setPending(p)}
            className="flex flex-col items-center gap-3"
          >
            <img
              src={`/faces/${p.image_key}`}
              alt={p.name}
              style={{ filter: 'url(#sticker-border)', width: 110, height: 110, objectFit: 'contain' }}
              draggable={false}
            />
            <span className="text-white text-lg font-semibold">{p.name}</span>
          </motion.button>
        ))}
      </div>

      {pending && (
        <ConfirmModal
          name={pending.name}
          onConfirm={() => { setIdentity(pending.id); onSelect(pending) }}
          onCancel={() => setPending(null)}
        />
      )}

      {/* Small reset link for "not you?" recovery */}
      <button onClick={clearIdentity} className="text-white/20 text-xs mt-4">
        not you?
      </button>
    </div>
  )
}
```

---

## Reveal Animation Sequence

`RevealView.tsx` — only rendered for contestants when `phase === 'reveal'`.

**State machine within the reveal:**
```
idle → holding → charging → burst → card_flip → active
```

```tsx
type RevealState = 'idle' | 'holding' | 'burst' | 'done'
```

**Implementation:**

```tsx
export function RevealView({ box, onComplete }) {
  const [state, setState] = useState<RevealState>('idle')
  const [holdProgress, setHoldProgress] = useState(0)
  const holdRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef(new Audio('/sounds/reveal.mp3'))

  function startHold() {
    let progress = 0
    holdRef.current = setInterval(() => {
      progress += 2  // fills in ~1.5s
      setHoldProgress(Math.min(progress, 100))
      if (progress >= 100) {
        clearInterval(holdRef.current!)
        triggerBurst()
      }
    }, 30)
    setState('holding')
  }

  function releaseHold() {
    if (holdRef.current) clearInterval(holdRef.current)
    if (state !== 'burst' && state !== 'done') {
      setState('idle')
      setHoldProgress(0)
    }
  }

  async function triggerBurst() {
    setState('burst')
    audioRef.current.play().catch(() => {})  // user gesture unlocks audio

    // Mark revealed in DB
    await supabase
      .from('mystery_boxes')
      .update({ revealed_at: new Date().toISOString() })
      .eq('id', box.id)

    // After animation completes
    setTimeout(() => {
      setState('done')
      onComplete()
    }, 3000)
  }

  return (
    <div
      className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center select-none"
      onMouseUp={releaseHold}
      onTouchEnd={releaseHold}
    >
      {state !== 'burst' && state !== 'done' && (
        <>
          {/* Sealed box — glows and pulses while idle */}
          <motion.div
            animate={state === 'holding'
              ? { scale: [1, 1.04, 1], rotate: [-1, 1, -1], transition: { repeat: Infinity, duration: 0.15 } }
              : { scale: [1, 1.02, 1], transition: { repeat: Infinity, duration: 2 } }
            }
            className="relative"
          >
            <BoxSVG glowIntensity={holdProgress / 100} />
          </motion.div>

          {/* Hold-to-open button */}
          <button
            onMouseDown={startHold}
            onTouchStart={startHold}
            className="mt-10 relative w-48 h-14 rounded-full bg-white/10 border border-white/20
                       text-white font-semibold text-sm overflow-hidden"
          >
            <motion.div
              className="absolute inset-0 bg-yellow-400/30 origin-left"
              style={{ scaleX: holdProgress / 100 }}
            />
            <span className="relative z-10">
              {state === 'idle' ? 'Hold to Open' : 'Keep holding...'}
            </span>
          </button>
        </>
      )}

      {state === 'burst' && <BurstAnimation onComplete={onComplete} box={box} />}
    </div>
  )
}
```

**`BurstAnimation` component:**
- Frame 0–200ms: white flash (`opacity: 1 → 0` on a full-screen white div)
- Frame 0–500ms: particle burst (tsparticles confetti or a canvas-based burst — golden/warm particles)
- Frame 400ms: wildcard card animates in from scale 0 with a 3D flip (`rotateY: 180 → 0`)
- Frame 1200ms: challenge note fades in below the card
- After 3s total: `onComplete()` transitions to `ActiveView`

**Particle burst (simple canvas approach, no library):**
```ts
function burstParticles(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const particles = Array.from({ length: 60 }, () => ({
    x: canvas.width / 2, y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 0.5) * 12,
    size: Math.random() * 6 + 2,
    color: ['#FFD700', '#FFA500', '#FFFACD', '#FF8C00'][Math.floor(Math.random() * 4)],
    life: 1,
  }))

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.2  // gravity
      p.life -= 0.02
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    })
    if (particles.some(p => p.life > 0)) requestAnimationFrame(tick)
  }
  tick()
}
```

---

## Wildcard Grid (Critic Setup View)

```tsx
export function SetupView({ critic, contestant, onSubmit }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')

  return (
    <div className="min-h-screen bg-[#0d0d1a] p-6 flex flex-col gap-6">
      <h2 className="text-white text-xl font-serif text-center">
        Pick a wildcard for <span className="text-yellow-400">{contestant.name}</span>
      </h2>

      {/* Sticker grid */}
      <div className="grid grid-cols-3 gap-4">
        {WILDCARDS.map((w, i) => (
          <WildcardCard
            key={w.id}
            name={w.name}
            imageKey={w.imageKey}
            tooltip={w.tooltip}
            index={i}
            selected={selected === w.id}
            onSelect={() => setSelected(w.id)}
          />
        ))}
      </div>

      {/* Challenge note */}
      {selected && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <textarea
            maxLength={175}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Leave a message for them... 😈"
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4
                       text-white placeholder-white/30 text-sm resize-none h-24"
          />
          <div className="text-right text-white/30 text-xs">{note.length}/175</div>
        </motion.div>
      )}

      <button
        disabled={!selected}
        onClick={() => onSubmit({ wildcard: selected!, note })}
        className="w-full py-4 rounded-2xl bg-yellow-400 text-black font-bold
                   disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Lock It In
      </button>
    </div>
  )
}
```

---

## Realtime Subscriptions

Subscribe to status updates and box submissions so all 4 devices stay in sync without polling.

```ts
// In App.tsx or ActiveView.tsx
useEffect(() => {
  const channel = supabase
    .channel('app-updates')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'status_updates' },
      (payload) => updateStatusLocally(payload.new as StatusUpdate)
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'mystery_boxes' },
      () => refetchBoxes()  // triggers phase recomputation
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [])
```

---

## Status Ticker (Active Day View)

Simple, visible to all 4 participants. Contestants can update their own; Critics see both as read-only.

```tsx
const STATUS_OPTIONS = [
  { id: 'researching', label: 'Researching', emoji: '🔍' },
  { id: 'shopping',    label: 'Shopping',    emoji: '🛒' },
  { id: 'cooking',     label: 'Cooking',     emoji: '🔥' },
  { id: 'plating',     label: 'Plating',     emoji: '🍽️' },
  { id: 'done',        label: 'Done',         emoji: '✅' },
]
```

For the current user's status: render the 5 options as tappable chips. Selected state is highlighted. Tapping sends an INSERT to `status_updates`.

For the other contestant's status: read-only display of their latest `status_updates` row, updated via Realtime.

---

## Wildcard Data

Define in `src/data/wildcards.ts`:

```ts
export const WILDCARDS = [
  { id: 'white-miso-paste',     name: 'White Miso Paste',     imageKey: 'white-miso-paste.png',     tooltip: 'Salty-sweet — killer in caramel or brownies' },
  { id: 'tahini',               name: 'Tahini',               imageKey: 'tahini.png',               tooltip: 'Nutty and rich — big in Middle Eastern sweets' },
  { id: 'vegemite',             name: 'Vegemite',             imageKey: 'vegemite.png',             tooltip: 'Australian wildcard — surprisingly works in fudgy chocolate' },
  { id: 'soy-sauce',            name: 'Soy Sauce',            imageKey: 'soy-sauce.png',            tooltip: 'Deepens chocolate and caramel in unexpected ways' },
  { id: 'black-sesame-seeds',   name: 'Black Sesame Seeds',   imageKey: 'black-sesame-seeds.png',   tooltip: 'Earthy and nutty — Japanese-inspired' },
  { id: 'cardamom',             name: 'Cardamom',             imageKey: 'cardamom.png',             tooltip: 'Warm, floral spice — Scandinavian and Middle Eastern baking' },
  { id: 'dried-chili-flakes',   name: 'Dried Chili Flakes',   imageKey: 'dried-chili-flakes.png',   tooltip: 'Mexican chocolate territory' },
  { id: 'black-pepper',         name: 'Black Pepper',         imageKey: 'black-pepper.png',         tooltip: 'Shockingly good with strawberry, honey, or lemon' },
  { id: 'cayenne',              name: 'Cayenne',              imageKey: 'cayenne.png',              tooltip: 'Subtler heat than chili — pairs with chocolate' },
  { id: 'rosewater',            name: 'Rosewater',            imageKey: 'rosewater.png',            tooltip: 'Persian and Middle Eastern — delicate and fragrant' },
  { id: 'matcha-powder',        name: 'Matcha Powder',        imageKey: 'matcha-powder.png',        tooltip: 'Earthy Japanese green tea — pairs with chocolate or white choc' },
  { id: 'earl-grey-tea',        name: 'Earl Grey Tea',        imageKey: 'earl-grey-tea.png',        tooltip: 'Bergamot citrus — beautiful in cakes and panna cotta' },
  { id: 'fresh-rosemary',       name: 'Fresh Rosemary',       imageKey: 'fresh-rosemary.png',       tooltip: 'Herbal and resinous — works with lemon and honey' },
  { id: 'fresh-basil',          name: 'Fresh Basil',          imageKey: 'fresh-basil.png',          tooltip: 'Surprisingly good with strawberry or in ice cream' },
  { id: 'lavender',             name: 'Lavender',             imageKey: 'lavender.png',             tooltip: 'Floral and Provençal — shortbread, honey, panna cotta' },
  { id: 'balsamic-vinegar',     name: 'Balsamic Vinegar',     imageKey: 'balsamic-vinegar.png',     tooltip: 'Strawberry balsamic is a thing — also works with chocolate' },
  { id: 'pomegranate-molasses', name: 'Pomegranate Molasses', imageKey: 'pomegranate-molasses.png', tooltip: 'Tart and fruity — Middle Eastern depth' },
  { id: 'olive-oil',            name: 'Olive Oil',            imageKey: 'olive-oil.png',            tooltip: 'Olive oil cake is genuinely excellent' },
  { id: 'ricotta',              name: 'Ricotta',              imageKey: 'ricotta.png',              tooltip: 'Light and creamy — classic in Italian baking' },
  { id: 'milo',                 name: 'Milo',                 imageKey: 'milo.png',                 tooltip: 'Malted chocolate — nostalgic and very fun to elevate' },
  { id: 'peanut-butter',        name: 'Peanut Butter',        imageKey: 'peanut-butter.png',        tooltip: 'Crowd-pleasing — easy to play it too safe, though' },
]
```

---

## Asset Requirements

These assets must be prepared before development begins.

### Face Photos (`/public/faces/`)

4 PNG files with transparent backgrounds — one per participant. The "cutout" look can be:
- **Circular crop**: easiest. Crop to a circle in Figma, Canva, or any editor. Export as PNG with transparency.
- **Irregular cutout**: more sticker-like. Use [remove.bg](https://remove.bg) on a portrait photo, then crop tightly. Export as PNG.

Recommended size: **400×400px**. The app renders them at ~110px but high-res looks sharp on retina screens.

Filenames must match `image_key` values set in the seed script.

### Ingredient Photos (`/public/ingredients/`)

21 PNG files with transparent backgrounds. Best source approach:

1. Google Image Search for each ingredient with `"[ingredient name] png transparent"` or `"[ingredient] cutout"`
2. Alternatively: photograph each ingredient on a white surface and run through [remove.bg](https://remove.bg) (free tier: 50 images/month)
3. Recommended size: **300×300px**

Filenames must exactly match `imageKey` values in `wildcards.ts` above.

### Sound (`/public/sounds/`)

`reveal.mp3` — a short (1–2s) satisfying burst sound. Options:
- Source from [freesound.org](https://freesound.org) (search "whoosh chime", "magic reveal", "card flip")
- Generate with an AI sound tool

Keep file size under 200KB.

---

## UI Design Tokens

Apply globally in `index.css` or Tailwind config:

```css
:root {
  --bg-deep: #0d0d1a;       /* near-black navy — main background */
  --gold: #FFD700;           /* primary accent — selected states, highlights */
  --gold-dim: #B8860B;       /* secondary accent */
  --cream: #FFF8E7;          /* text on dark */
  --surface: rgba(255,255,255,0.05);  /* card/panel backgrounds */
  --border: rgba(255,255,255,0.10);
}
```

**Typography:**
- Display / reveal: `'Playfair Display'` or `'Cormorant Garamond'` (load from Google Fonts)
- UI chrome: System sans-serif (`font-sans` in Tailwind)

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
```

---

## Deployment

1. Push repo to GitHub
2. Connect to [Vercel](https://vercel.com) — import repo, framework preset: Vite
3. Add env vars in Vercel dashboard (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
4. Deploy. Vercel assigns a URL — share this in the group chat.
5. Run the seed SQL in Supabase dashboard before sharing the link.

---

## What the Implementing Developer Should Do First

1. Set up Supabase project, create tables, run seed script
2. Prepare all assets (faces + ingredients + sound) and drop into `/public/`
3. Scaffold Vite + React + Tailwind project
4. Build `IdentityPicker` first — it's self-contained and exercises the sticker effect
5. Build `SetupView` (wildcard grid) — tests the full sticker + wiggle + selection flow
6. Build `LockedView` (sealed box + countdown) — mostly static
7. Build `RevealView` (the hero moment) — most complex, do this carefully
8. Build `ActiveView` (status ticker) — simple, but needs Realtime wired up
9. Wire up `App.tsx` phase routing last, once all views are built in isolation
