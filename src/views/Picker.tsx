import { ALL_PARTICIPANTS } from '../config'
import { setIdentity } from '../lib/store'
import { TileButton } from '../components/Brand'
import type { Participant } from '../config'

export function Picker({ onPick }: { onPick: (p: Participant) => void }) {
  return (
    <div className="min-h-dvh flex flex-col items-center p-5 pb-safe gap-6 max-w-lg mx-auto w-full">
      <div className="text-center mt-2">
        <h1 className="font-bubble font-extrabold text-3xl text-ink">Who are you?</h1>
        <p className="text-ink/60 text-sm mt-1">Tap your face to get in.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full">
        {ALL_PARTICIPANTS.map((p, i) => (
          <TileButton
            key={p.id}
            img={`/faces/${p.face}`}
            alt={p.name}
            label={p.name}
            sub={p.role === 'contestant' ? 'Cook' : 'Critic'}
            index={i}
            onTap={() => {
              setIdentity(p.id)
              onPick(p)
            }}
          />
        ))}
      </div>

      <section className="brand-card w-full p-5">
        <h2 className="font-bubble font-extrabold text-xl text-ink">How it runs</h2>
        <ol className="mt-3 flex flex-col gap-3 text-sm text-ink/80 leading-snug">
          <li className="flex gap-3">
            <span className="font-bubble font-extrabold text-cherry text-lg leading-none">1</span>
            <span>
              Tonight, the critics choose. Paige picks Ethan's wildcard. Simran picks Prash's. Each
              adds a short note.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-bubble font-extrabold text-cherry text-lg leading-none">2</span>
            <span>The boxes seal overnight and open at 8am Saturday.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bubble font-extrabold text-cherry text-lg leading-none">3</span>
            <span>Cook day: same pantry, one wildcard each. Tasting is in person.</span>
          </li>
        </ol>
        <p className="font-brush text-2xl text-oxblood mt-4 text-center">May the best dessert win.</p>
      </section>
    </div>
  )
}
