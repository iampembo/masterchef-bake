# Mystery Box App — Technical Brainstorm

## Context

Two mates (Ethan and a friend) are running a Masterchef-style mystery box dessert challenge. Their partners set the challenge; the judging happens in person at the end of the night. This app handles the mystery box setup, the dramatic morning reveal, and live status updates throughout the cooking day.

The experience is for exactly **4 people**. It is a one-off event (potentially repeatable). It must be simple, fun, and require zero accounts or passwords.

---

## The Challenge Format

- Both contestants get the same **base pantry** (standard baking ingredients they buy themselves — listed in the app).
- Each contestant is assigned one **wildcard ingredient** by a Critic (see roles below).
- Wildcards are chosen the night before. The mystery box **locks** overnight and **unlocks** at 8am Saturday with a gamified reveal.
- Contestants can look up any recipe they want, but the wildcard must be a **hero flavour** — identifiable on tasting, not a garnish.
- Critics write a short **challenge note** (smack talk / hint / reason for picking, max 175 chars) alongside the wildcard pick.
- Judging happens in person at the end of the night. The app plays no role in scoring.

---

## User Roles

### Contestants
The two people doing the cooking. They:
- See their mystery box (locked until 8am Saturday)
- Watch the animated reveal at unlock
- Can update their status throughout the day (e.g., "Researching 🔍", "Shopping 🛒", "Cooking 🔥", "Done ✅")
- See their wildcard, challenge note, and base pantry after unlock

### The Critics
The two partners who design the challenge. They:
- Each pick a wildcard **for the other person's contestant** (cross-assignment — keeps it mischievous)
- Write a short challenge note (max 175 chars — smack talk, a hint, or why they picked it)
- See both boxes are sealed overnight
- See both boxes open after the reveal (but not each other's picks until then)

> **Naming note**: "The Critics" was chosen over "wife" or "partner" because one person isn't married and "partner" felt flat. It leans into the Masterchef/food-show vibe without being literal. Singular: "Critic". Alternatives considered: Mastermind, The Jury, Saboteurs, Curators, The Commissioners.

---

## Identity — One Link, Name Picker

**One link** is dropped into the group chat. Everyone opens the same URL.

On first open, the app shows a **"Who are you?"** screen — four name cards, one per participant. Tap yours, confirm, done. The selection is stored in `localStorage` and the app remembers you on that device from then on.

No tokens, no magic links, no backend auth. For 4 friends sharing a link, this is the right level of complexity. If someone accidentally picks the wrong name, they can reset via a small "not you?" link that clears localStorage and returns to the picker.

**Integrity note (optional, low priority):** The backend can track which participant IDs have been "claimed" and grey out already-selected names on the picker screen. Prevents double-claiming without any real auth overhead.

---

## App Flow

### Phase 1 — Critic Setup (Night Before)

1. Critics open the link and identify themselves on the name picker.
2. Each Critic sees the contestant they are picking **for** (cross-assigned: Critic A picks for Contestant B, and vice versa).
3. They scroll a grid of wildcard cards. Each card shows the ingredient name and a short tooltip.
4. They tap to select one wildcard.
5. They type a challenge note (max 175 chars).
6. They submit. Both Critics must submit before the boxes seal.
7. Once both have submitted, the app transitions to the **Locked** state.

### Phase 2 — Locked State (Overnight)

- All 4 people see a sealed mystery box UI with a countdown to 8am.
- Contestants see their box is sealed.
- Critics see confirmation their picks are locked in, but not the other Critic's pick.
- No edits allowed once both Critics have submitted.

### Phase 3 — The Reveal (8am Saturday)

- At 8am, the app transitions to the **Reveal** state.
- Contestants open the app and are greeted with the gamified opening animation (see UX notes below).
- After the animation, they see:
  - Their wildcard (large, front and centre)
  - The challenge note from their Critic
  - The base pantry list
- Critics see both boxes are now open and can see what each contestant got.

### Phase 4 — Active Day

- Contestants can tap a status button to update where they're at:
  - 🔍 Researching
  - 🛒 Shopping
  - 🔥 Cooking
  - 🍽️ Plating
  - ✅ Done
- All 4 people can see both contestants' live statuses — creates a fun spectator feel throughout the day.
- No other functionality. Keep it light.

---

## Technical Architecture

### Stack Recommendation

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React + Vite | Lightweight, no server-side complexity needed, fast to build beautiful UIs |
| Styling | Tailwind CSS | Utility-first, fast iteration on custom artsy UI |
| Animation | Framer Motion | Handles the reveal animation, card flips, and transitions cleanly |
| Backend / DB | Supabase | Managed Postgres + REST API + Realtime subscriptions, generous free tier, no server to run |
| Hosting | Vercel | Static frontend deploy, CI from GitHub, free tier easily covers this |
| Realtime | Supabase Realtime | Status updates sync live across all 4 devices without polling |

**Why not something simpler (e.g., Firebase, Cloudflare Workers)?**
Supabase + Vercel is the lightest credible stack for persistent relational state + realtime + a good developer experience. Firebase is a valid alternative. Cloudflare Workers + D1 works too but has more setup friction for realtime.

**Why not a pure Artifact (Claude's published pages)?**
Shared realtime state across 4 devices and persistent box data need a real backend. A static artifact can't hold that state durably across sessions and devices.

---

## Data Model

```sql
-- One per event (could extend later for repeat events)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_at TIMESTAMPTZ NOT NULL DEFAULT '2025-09-06 08:00:00+10', -- 8am Saturday AEST, update per event
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One row per participant (seeded manually for MVP)
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('contestant', 'critic')),
  picks_for UUID REFERENCES participants(id) -- critic → contestant they pick for
);

-- One per contestant, populated by their assigned critic
CREATE TABLE mystery_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  contestant_id UUID UNIQUE REFERENCES participants(id),
  wildcard TEXT NOT NULL,
  challenge_note TEXT CHECK (char_length(challenge_note) <= 175),
  submitted_by UUID REFERENCES participants(id),
  submitted_at TIMESTAMPTZ
);

-- Contestant status — only the latest matters, but history is cheap to keep
CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contestant_id UUID REFERENCES participants(id),
  status TEXT NOT NULL CHECK (status IN ('researching', 'shopping', 'cooking', 'plating', 'done')),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Seeding for MVP:** The `events` and `participants` rows are inserted manually (via Supabase dashboard or a seed script) before the app is shared. No admin UI needed. The 4 participant names and their cross-assignment (`picks_for`) are hardcoded for the event.

---

## The Reveal Animation

This is the hero moment. Think: Pokémon card pack opening, CS:GO case opening — sustained tension before the payoff.

**Suggested sequence:**

1. Contestant opens the app at or after 8am.
2. They're greeted with a sealed mystery box — glowing, slightly pulsing.
3. A **"Hold to Open"** interaction. Holding builds a glow/progress effect with increasing rumble.
4. The box shakes, cracks appear, light spills out.
5. The box bursts open — particle effect, flash of light, satisfying sound (whoosh + chime).
6. A **card flips into view** — the wildcard ingredient in large display typeface, styled like a game card (name, short flavour descriptor).
7. The challenge note fades in below, styled as handwriting or a torn paper label.
8. Transition to the active day view.

**Implementation notes:**
- Framer Motion handles shake, flip, and entrance animations cleanly.
- Canvas-based particle burst on reveal (tsparticles or a small custom canvas element).
- Sound: a short audio file triggered on burst. Use the Web Audio API or a simple `<audio>` element.
- The hold mechanic is a `mousedown`/`touchstart` with a CSS progress fill — no complex state needed.

---

## UI / UX Direction

- **Mobile-first** — one link in a group chat; everyone opens on their phone
- **Dark background** — deep navy or near-black, warm gold and cream accents. Feels like a premium game / trophy case.
- **Typography** — a display serif for the wildcard reveal (editorial, weighty), clean sans-serif for UI chrome
- **Card motif** — the wildcard presented as a physical card with depth, texture, slight shadow
- **No nav, no menus** — the app knows who you are (via localStorage) and shows exactly your view. No choices about where to go.
- **State-driven UI** — the page renders entirely based on the current phase (setup / locked / reveal / active). One URL, one page, different states.
- **Tactile micro-interactions** — status buttons feel like a physical press; wildcard cards feel satisfying to tap during selection

---

## The Wildcard List

These are the selectable wildcards for Critics. Each has a short tooltip shown during selection.

| Wildcard | Tooltip |
|----------|---------|
| White miso paste | Salty-sweet — killer in caramel or brownies |
| Tahini | Nutty and rich — big in Middle Eastern sweets |
| Vegemite | Australian wildcard — surprisingly works in fudgy chocolate |
| Soy sauce | Deepens chocolate and caramel in unexpected ways |
| Black sesame seeds | Earthy and nutty — Japanese-inspired |
| Cardamom | Warm, floral spice — Scandinavian and Middle Eastern baking |
| Dried chili flakes | Mexican chocolate territory |
| Black pepper | Shockingly good with strawberry, honey, or lemon |
| Cayenne | Subtler heat than chili — pairs with chocolate |
| Rosewater | Persian and Middle Eastern — delicate and fragrant |
| Matcha powder | Earthy Japanese green tea — pairs with chocolate or white choc |
| Earl Grey tea | Bergamot citrus — beautiful in cakes and panna cotta |
| Fresh rosemary | Herbal and resinous — works with lemon and honey |
| Fresh basil | Surprisingly good with strawberry or in ice cream |
| Lavender | Floral and Provençal — shortbread, honey, panna cotta |
| Balsamic vinegar | Strawberry balsamic is a thing — also works with chocolate |
| Pomegranate molasses | Tart and fruity — Middle Eastern depth |
| Olive oil | Olive oil cake is genuinely excellent |
| Ricotta | Light and creamy — classic in Italian baking |
| Milo | Malted chocolate — nostalgic and very fun to elevate |
| Peanut butter | Crowd-pleasing — easy to play it too safe, though |

---

## Base Pantry List (Shown to Contestants After Unlock)

Both contestants are expected to have these on hand (they buy themselves):

- Butter (150g)
- Eggs (3)
- Caster sugar
- Plain flour
- Cocoa powder
- Thickened cream (200ml)
- Vanilla extract
- Salt
- Dark chocolate (100g block)
- Lemon (1)
- Fresh raspberries or strawberries (punnet)
- Milk (200ml)

These are guidelines, not rules. Contestants can supplement with additional ingredients as needed to complement their wildcard.

---

## What's In Scope (MVP)

- One shared link → name picker on first open → localStorage session
- Participant records seeded manually into DB (no admin UI)
- Critic setup flow: wildcard selection + challenge note (175 char limit)
- Locked state with countdown to 8am Saturday
- Gamified reveal animation with sound
- Live status ticker during the day (visible to all 4)

## What's Out of Scope (YAGNI)

- In-app judging or scoring (happens in person)
- User-generated events (seed the DB manually per event)
- Push notifications (group chat handles this)
- Photo uploads of finished dishes
- Admin panel
- Repeat event history
- Anything requiring a native mobile app

---

## Resolved Decisions

| Decision | Resolution |
|----------|-----------|
| Role name | **The Critics** (singular: Critic) |
| Unlock timing | **Fixed: 8am Saturday** — hardcoded per event, no UI to set it |
| Identity / auth | **One shared link → name picker → localStorage** — no magic links, no tokens |
| Sound effects | **Yes** — whoosh + chime on the reveal burst |
| Challenge note length | **175 characters** |
| In-app judging | **Out of scope** — judging happens in person |
