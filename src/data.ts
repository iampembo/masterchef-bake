// Static event data — lives in code, not the DB.

export interface Wildcard {
  id: string
  name: string
  imageKey: string
  tooltip: string
}

export const WILDCARDS: Wildcard[] = [
  { id: 'white-miso-paste', name: 'White Miso Paste', imageKey: 'white-miso-paste.png', tooltip: 'Salty-sweet — killer in caramel or brownies' },
  { id: 'tahini', name: 'Tahini', imageKey: 'tahini.png', tooltip: 'Nutty and rich — big in Middle Eastern sweets' },
  { id: 'vegemite', name: 'Vegemite', imageKey: 'vegemite.png', tooltip: 'Australian wildcard — surprisingly works in fudgy chocolate' },
  { id: 'soy-sauce', name: 'Soy Sauce', imageKey: 'soy-sauce.png', tooltip: 'Deepens chocolate and caramel in unexpected ways' },
  { id: 'black-sesame-seeds', name: 'Black Sesame Seeds', imageKey: 'black-sesame-seeds.png', tooltip: 'Earthy and nutty — Japanese-inspired' },
  { id: 'cardamom', name: 'Cardamom', imageKey: 'cardamom.png', tooltip: 'Warm, floral spice — Scandinavian and Middle Eastern baking' },
  { id: 'dried-chili-flakes', name: 'Dried Chili Flakes', imageKey: 'dried-chili-flakes.png', tooltip: 'Mexican chocolate territory' },
  { id: 'black-pepper', name: 'Black Pepper', imageKey: 'black-pepper.png', tooltip: 'Shockingly good with strawberry, honey, or lemon' },
  { id: 'cayenne', name: 'Cayenne', imageKey: 'cayenne.png', tooltip: 'Subtler heat than chili — pairs with chocolate' },
  { id: 'rosewater', name: 'Rosewater', imageKey: 'rosewater.png', tooltip: 'Persian and Middle Eastern — delicate and fragrant' },
  { id: 'matcha-powder', name: 'Matcha Powder', imageKey: 'matcha-powder.png', tooltip: 'Earthy Japanese green tea — pairs with chocolate or white choc' },
  { id: 'earl-grey-tea', name: 'Earl Grey Tea', imageKey: 'earl-grey-tea.png', tooltip: 'Bergamot citrus — beautiful in cakes and panna cotta' },
  { id: 'fresh-rosemary', name: 'Fresh Rosemary', imageKey: 'fresh-rosemary.png', tooltip: 'Herbal and resinous — works with lemon and honey' },
  { id: 'fresh-basil', name: 'Fresh Basil', imageKey: 'fresh-basil.png', tooltip: 'Surprisingly good with strawberry or in ice cream' },
  { id: 'lavender', name: 'Lavender', imageKey: 'lavender.png', tooltip: 'Floral and Provençal — shortbread, honey, panna cotta' },
  { id: 'balsamic-vinegar', name: 'Balsamic Vinegar', imageKey: 'balsamic-vinegar.png', tooltip: 'Strawberry balsamic is a thing — also works with chocolate' },
  { id: 'pomegranate-molasses', name: 'Pomegranate Molasses', imageKey: 'pomegranate-molasses.png', tooltip: 'Tart and fruity — Middle Eastern depth' },
  { id: 'olive-oil', name: 'Olive Oil', imageKey: 'olive-oil.png', tooltip: 'Olive oil cake is genuinely excellent' },
  { id: 'ricotta', name: 'Ricotta', imageKey: 'ricotta.png', tooltip: 'Light and creamy — classic in Italian baking' },
  { id: 'milo', name: 'Milo', imageKey: 'milo.png', tooltip: 'Malted chocolate — nostalgic and very fun to elevate' },
  { id: 'peanut-butter', name: 'Peanut Butter', imageKey: 'peanut-butter.png', tooltip: 'Crowd-pleasing — easy to play it too safe, though' },
]

export function wildcardById(id: string): Wildcard | undefined {
  return WILDCARDS.find((w) => w.id === id)
}

/** Match an effective wildcard name back to its card art (custom entries get no art). */
export function wildcardArtFor(name: string): string | null {
  const hit = WILDCARDS.find((w) => w.name.toLowerCase() === name.trim().toLowerCase())
  return hit ? `/ingredients/${hit.imageKey}` : null
}

export const PANTRY: string[] = [
  'Butter (150g)',
  'Eggs (3)',
  'Caster sugar',
  'Plain flour',
  'Cocoa powder',
  'Thickened cream (200ml)',
  'Vanilla extract',
  'Salt',
  'Dark chocolate (100g block)',
  'Lemon (1)',
  'Fresh raspberries or strawberries (punnet)',
  'Milk (200ml)',
]

export interface StatusOption {
  id: string
  label: string
  emoji: string
}

export const STATUS_OPTIONS: StatusOption[] = [
  { id: 'researching', label: 'Researching', emoji: '🔍' },
  { id: 'shopping', label: 'Shopping', emoji: '🛒' },
  { id: 'cooking', label: 'Cooking', emoji: '🔥' },
  { id: 'plating', label: 'Plating', emoji: '🍽️' },
  { id: 'done', label: 'Done', emoji: '✅' },
]

export const MAX_NOTE = 175
