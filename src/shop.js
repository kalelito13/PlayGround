// ---------------------------------------------------------------------------
// Lumen Isles — Grove Market
// ---------------------------------------------------------------------------
// The market has two halves:
//   • Supplies & one-off curios bought with Lumen, the currency you earn while
//     exploring (catching creatures, winning battles, finding shards).
//   • Supporter packs paid with real money through YOUR OWN checkout link.
//
// IMPORTANT — real money
// This game is a static site, so it cannot hold card data or move money by
// itself. Paste your own checkout URL below (Stripe Payment Link, PayPal.me,
// Ko-fi, Mercado Pago, etc.). Every payment goes straight to that account.
// After payment you send the buyer a redeem code (edit REDEEM_CODES) and they
// unlock the pack in-game. For automatic delivery you would need a small
// backend that verifies the payment webhook and returns a signed code.
// ---------------------------------------------------------------------------

export const PAYMENT = {
  // 👇 PEGA AQUÍ TU ENLACE DE COBRO. Ej: 'https://buy.stripe.com/xxxx'
  link: '',
  provider: 'Stripe · PayPal · Mercado Pago',
  currency: 'USD',
  note: 'Payments are sent directly to the creator’s account. After paying, enter the redeem code you receive.',
};

// Optional per-pack checkout links (leave empty to use PAYMENT.link).
export const SUPPORTER_PACKS = [
  {
    id: 'starlight-pack',
    name: 'Starlight Pack',
    priceUSD: 4.99,
    glyph: '✦',
    blurb: 'A little light for the journey.',
    perks: ['500 Lumen', '5 Grove Tonics', 'Starlight Aura (unique cosmetic)'],
    link: '',
    effect: { lumen: 500, potions: 5, skin: 'starlight-aura', badge: 'starlight' },
  },
  {
    id: 'grove-patron',
    name: 'Grove Patron',
    priceUSD: 9.99,
    glyph: '❖',
    blurb: 'For those who keep the grove alive.',
    perks: ['1,200 Lumen', '10 Grove Tonics', 'Patron’s Ring (unique)', '+2% resonance forever'],
    link: '',
    effect: { lumen: 1200, potions: 10, skin: 'patron-ring', badge: 'patron', resonance: 0.02 },
  },
  {
    id: 'isles-founder',
    name: 'Isles Founder',
    priceUSD: 19.99,
    glyph: '♛',
    blurb: 'Your name belongs in the first field journal.',
    perks: ['3,000 Lumen', '20 Grove Tonics', 'Founder Crown (unique)', 'All flute skins', '+5% resonance forever'],
    link: '',
    effect: { lumen: 3000, potions: 20, skin: 'founder-crown', badge: 'founder', resonance: 0.05, allSkins: true },
  },
];

// Redeem codes delivered after a real-money payment. Edit freely.
// Keep them private-ish: anyone with the code can unlock the pack.
export const REDEEM_CODES = {
  'LUMEN-STAR-2026': 'starlight-pack',
  'LUMEN-GROVE-2026': 'grove-patron',
  'LUMEN-FOUNDER-2026': 'isles-founder',
};

// ---------------------------------------------------------------------------
// Lumen shop
// ---------------------------------------------------------------------------

export const SHOP_ITEMS = [
  {
    id: 'grove-tonic',
    section: 'supplies',
    kind: 'consumable',
    name: 'Grove Tonic',
    glyph: '✚',
    price: 45,
    blurb: 'Restores 28 + 2× level HP to one creature.',
    effect: { potions: 1 },
    repeatable: true,
  },
  {
    id: 'resonance-charm',
    section: 'supplies',
    kind: 'consumable',
    name: 'Resonance Charm',
    glyph: '◎',
    price: 95,
    blurb: 'A humming charm. +4% capture resonance (max +16%).',
    effect: { resonance: 0.04, resonanceCap: 0.16 },
    repeatable: true,
  },
  {
    id: 'starlight-lure',
    section: 'supplies',
    kind: 'consumable',
    name: 'Starlight Lure',
    glyph: '✧',
    price: 240,
    blurb: 'Doubles shiny odds for 15 minutes. Stacks with nothing — it just glows.',
    effect: { lureMs: 15 * 60 * 1000 },
    repeatable: true,
  },
  {
    id: 'gilded-willow',
    section: 'curios',
    kind: 'unique',
    name: 'Gilded Willow',
    glyph: '♪',
    price: 320,
    blurb: 'A one-off golden willow flute. Cosmetic, with a whisper of resonance.',
    effect: { skin: 'gilded-willow', resonance: 0.01, resonanceCap: 0.17 },
    unique: true,
  },
  {
    id: 'moonweave-mantle',
    section: 'curios',
    kind: 'unique',
    name: 'Moonweave Mantle',
    glyph: '☾',
    price: 520,
    blurb: 'A mantle of woven moonlight that circles your trainer.',
    effect: { skin: 'moonweave-mantle', resonance: 0.02, resonanceCap: 0.18 },
    unique: true,
  },
  {
    id: 'starcrown',
    section: 'curios',
    kind: 'unique',
    name: 'Starcrown',
    glyph: '✦',
    price: 760,
    blurb: 'A tiny constellation crowns your trainer. Purely, gloriously unnecessary.',
    effect: { skin: 'starcrown', resonance: 0.02, resonanceCap: 0.19 },
    unique: true,
  },
  {
    id: 'astral-flute',
    section: 'curios',
    kind: 'unique',
    name: 'Astral Flute Skin',
    glyph: '♬',
    price: 980,
    blurb: 'A one-of-one astral finish for every flute you own. Cosmetic.',
    effect: { skin: 'astral-flute', resonance: 0.03, resonanceCap: 0.2 },
    unique: true,
  },
];

export function defaultInventory() {
  return {
    flutes: ['willow'],
    potions: 2,
    resonance: 0,
    lumen: 180,
    owned: [],
    skins: [],
    lureUntil: 0,
    badges: [],
  };
}

export function formatLumen(n) {
  return Math.max(0, Math.round(n)).toLocaleString('en-US');
}

export function ownsItem(inventory, id) {
  return (inventory.owned || []).some((o) => (typeof o === 'string' ? o === id : o.id === id));
}

export function ownedEntry(inventory, id) {
  return (inventory.owned || []).find((o) => (typeof o === 'string' ? o === id : o.id === id)) || null;
}

export function hasSkin(inventory, skin) {
  return (inventory.skins || []).includes(skin);
}

export function itemById(id) {
  return SHOP_ITEMS.find((i) => i.id === id) || SUPPORTER_PACKS.find((i) => i.id === id) || null;
}

function makeSerial(id) {
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const salt = Math.floor(Math.random() * 46655).toString(36).toUpperCase().padStart(3, '0');
  return `LI-${id.slice(0, 3).toUpperCase()}-${stamp}${salt}`;
}

function applyEffect(inventory, effect = {}) {
  if (effect.potions) inventory.potions = (inventory.potions || 0) + effect.potions;
  if (effect.lumen) inventory.lumen = (inventory.lumen || 0) + effect.lumen;
  if (effect.resonance) {
    const cap = effect.resonanceCap ?? 0.25;
    inventory.resonance = Math.min(cap, (inventory.resonance || 0) + effect.resonance);
  }
  if (effect.lureMs) {
    const now = Date.now();
    inventory.lureUntil = Math.max(inventory.lureUntil || 0, now) + effect.lureMs;
  }
  if (effect.skin && !inventory.skins.includes(effect.skin)) inventory.skins.push(effect.skin);
  if (effect.allSkins) {
    for (const skin of ['gilded-willow', 'moonweave-mantle', 'starcrown', 'astral-flute', 'starlight-aura', 'patron-ring', 'founder-crown']) {
      if (!inventory.skins.includes(skin)) inventory.skins.push(skin);
    }
  }
  if (effect.badge && !inventory.badges.includes(effect.badge)) inventory.badges.push(effect.badge);
}

/** Buy a Lumen item. Returns { ok, message, item, serial }. */
export function purchase(itemId, state) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return { ok: false, message: 'Unknown item.' };
  const inv = state.inventory;
  if (item.unique && ownsItem(inv, item.id)) {
    return { ok: false, message: 'You already own this one-of-one curiosity.' };
  }
  if ((inv.lumen || 0) < item.price) {
    return { ok: false, message: `You need ${formatLumen(item.price - (inv.lumen || 0))} more Lumen.` };
  }
  inv.lumen -= item.price;
  applyEffect(inv, item.effect);
  let serial = null;
  if (item.unique) {
    serial = makeSerial(item.id);
    inv.owned.push({ id: item.id, serial, at: Date.now() });
  }
  return { ok: true, message: `${item.name} is yours.`, item, serial };
}

/** Redeem a code received after a real-money payment. */
export function redeem(code, state) {
  const key = String(code || '').trim().toUpperCase();
  const packId = REDEEM_CODES[key];
  if (!packId) return { ok: false, message: 'That code is not in the market ledger.' };
  const pack = SUPPORTER_PACKS.find((p) => p.id === packId);
  if (!pack) return { ok: false, message: 'That pack is no longer available.' };
  if (ownsItem(state.inventory, pack.id)) {
    return { ok: false, message: 'This pack is already linked to your journal.' };
  }
  applyEffect(state.inventory, pack.effect);
  state.inventory.owned.push({ id: pack.id, serial: makeSerial(pack.id), at: Date.now(), supporter: true });
  return { ok: true, message: `${pack.name} unlocked. Thank you for supporting the isles!`, pack };
}

export function paymentLinkFor(pack) {
  return pack?.link || PAYMENT.link || '';
}

export function shopSections() {
  return [
    { id: 'supplies', name: 'Supplies', note: 'Spend Lumen earned in the isles.' },
    { id: 'curios', name: 'One-of-one Curios', note: 'Each can be bought once per journal.' },
    { id: 'supporter', name: 'Supporter Packs', note: 'Real money, paid to the creator.' },
  ];
}
