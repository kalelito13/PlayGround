// ---------------------------------------------------------------------------
// Lumen Isles — game data
// All creatures, moves, types and artwork are original procedural creations.
// ---------------------------------------------------------------------------

export const TYPES = {
  normal: { name: 'Normal', color: '#b7ac95', light: '#f2ecdf' },
  leaf:   { name: 'Leaf',   color: '#54b96b', light: '#dff3d9' },
  ember:  { name: 'Ember',  color: '#ef6f3c', light: '#ffe0d1' },
  aqua:   { name: 'Aqua',   color: '#3d9fdc', light: '#d6efff' },
  spark:  { name: 'Spark',  color: '#dfa92b', light: '#fff0be' },
  stone:  { name: 'Stone',  color: '#8f8272', light: '#eee5d7' },
};

// ---------------------------------------------------------------------------
// Rarity & capture flutes
// Capture is performed by playing a flute whose rank matches the creature's
// rarity and level. Flutes are reusable instruments; higher flutes are kinder.
// ---------------------------------------------------------------------------

export const RARITIES = {
  common:    { name: 'Common',    tier: 1, color: '#96a18f', soft: '#e1e7dc', stars: 1 },
  uncommon:  { name: 'Uncommon',  tier: 1, color: '#69b174', soft: '#dff0dd', stars: 2 },
  rare:      { name: 'Rare',      tier: 2, color: '#4b9fd4', soft: '#d8ecf8', stars: 3 },
  epic:      { name: 'Epic',      tier: 3, color: '#a879d6', soft: '#ecdefa', stars: 4 },
  legendary: { name: 'Legendary', tier: 4, color: '#e0a52f', soft: '#faecc4', stars: 5 },
  mythical:  { name: 'Mythical',  tier: 5, color: '#e87ab7', soft: '#fadfec', stars: 6 },
  divine:    { name: 'Divine',    tier: 6, color: '#f0dc8a', soft: '#fff8cf', stars: 7 },
};

export const FLUTES = {
  willow: {
    name: 'Willow Flute', short: 'Willow', tier: 1, color: '#8ab86a', power: 0.64,
    notes: [392, 440, 523, 440], desc: 'A soft reed melody. Soothes everyday creatures.',
  },
  silver: {
    name: 'Silver Flute', short: 'Silver', tier: 2, color: '#a9c9d8', power: 0.61,
    notes: [494, 587, 659, 587], desc: 'Cool, clear notes that carry through the thicket.',
  },
  amber: {
    name: 'Amber Flute', short: 'Amber', tier: 3, color: '#e0a54a', power: 0.58,
    notes: [523, 659, 784, 659], desc: 'Warm resin notes for proud and powerful creatures.',
  },
  moonstone: {
    name: 'Moonstone Flute', short: 'Moon', tier: 4, color: '#9ab7ea', power: 0.55,
    notes: [440, 554, 659, 880], desc: 'A silver-blue song that only legends answer.',
  },
  aurora: {
    name: 'Aurora Flute', short: 'Aurora', tier: 5, color: '#e58bc4', power: 0.52,
    notes: [659, 784, 988, 1319], desc: 'A shimmering melody from beyond the stars.',
  },
  celestial: {
    name: 'Celestial Flute', short: 'Celestial', tier: 6, color: '#f4e7a4', power: 0.49,
    notes: [523, 784, 1047, 1568], desc: 'The first song of the grove. It can calm a god.',
  },
};

export const FLUTE_ORDER = ['willow', 'silver', 'amber', 'moonstone', 'aurora', 'celestial'];

// Shiny spawn odds by rarity (1 in N). Rarer creatures shine even brighter,
// but are far harder to find.
export const SHINY_ODDS = {
  common: 150,
  uncommon: 240,
  rare: 420,
  epic: 750,
  legendary: 1600,
  mythical: 3000,
  divine: 5000,
};

export function shinyOdds(speciesId) {
  const rarity = SPECIES[speciesId]?.rarity || 'common';
  return SHINY_ODDS[rarity] || 150;
}

export function rarityOf(speciesId) {
  return RARITIES[SPECIES[speciesId]?.rarity || 'common'];
}

// Higher-level creatures of lower rarities demand a finer instrument.
export function requiredFluteTier(speciesId, level) {
  const rarity = rarityOf(speciesId);
  let tier = rarity.tier;
  if (tier < 4 && level >= 10) tier += 1;
  return Math.min(6, tier);
}

export function requiredFlute(speciesId, level) {
  const tier = requiredFluteTier(speciesId, level);
  return FLUTE_ORDER.find((id) => FLUTES[id].tier === tier) || 'willow';
}

export function catchChance(mon, fluteId, resonance = 0) {
  const need = requiredFluteTier(mon.species, mon.level);
  const flute = FLUTES[fluteId];
  if (!flute || flute.tier < need) return 0;
  const rarity = rarityOf(mon.species);
  const hpRatio = Math.max(0, mon.hp / mon.maxHp);
  let chance = flute.power + (1 - hpRatio) * 0.42 - mon.level * 0.012 + (flute.tier - need) * 0.07 + resonance;
  chance *= 1 - rarity.tier * 0.025;
  return Math.min(0.95, Math.max(0.03, chance));
}


// Attacking a type in strong[attacker] deals x2. Attacking a type that is
// strong against the attacker deals x0.5.
const STRONG = {
  normal: [],
  leaf: ['aqua', 'stone'],
  ember: ['leaf'],
  aqua: ['ember', 'stone'],
  spark: ['aqua'],
  stone: ['spark', 'ember'],
};

export function typeMultiplier(attackType, defendType) {
  if (STRONG[attackType]?.includes(defendType)) return 2;
  if (STRONG[defendType]?.includes(attackType)) return 0.5;
  return 1;
}

export const MOVES = {
  tackle:   { name: 'Tackle',    type: 'normal', power: 38, accuracy: 0.96, pp: 30, desc: 'A sturdy full-body charge.' },
  scratch:  { name: 'Scratch',   type: 'normal', power: 42, accuracy: 0.94, pp: 25, desc: 'Rakes with tiny claws.' },
  leafwhip: { name: 'Leaf Whip', type: 'leaf',   power: 48, accuracy: 0.94, pp: 20, desc: 'A spinning blade of leaves.' },
  ember:    { name: 'Ember',     type: 'ember',  power: 48, accuracy: 0.92, pp: 20, desc: 'A warm burst of sparks.' },
  bubble:   { name: 'Bubble',    type: 'aqua',   power: 48, accuracy: 0.95, pp: 20, desc: 'A volley of pressurised bubbles.' },
  spark:    { name: 'Spark',     type: 'spark',  power: 46, accuracy: 0.94, pp: 20, desc: 'A crackling static zap.' },
  rocktoss: { name: 'Rock Toss', type: 'stone',  power: 52, accuracy: 0.88, pp: 15, desc: 'Hurls a heavy pebble.' },
  gust:     { name: 'Gust',      type: 'normal', power: 44, accuracy: 0.95, pp: 20, desc: 'A buffeting flap of wings.' },
  bite:     { name: 'Bite',      type: 'normal', power: 50, accuracy: 0.9,  pp: 20, desc: 'A surprisingly toothy nibble.' },
  growl:    { name: 'Growl',     type: 'normal', power: 0,  accuracy: 1,    pp: 20, effect: 'atkDown', desc: 'A tiny roar. Lowers Attack.' },
  harden:   { name: 'Harden',    type: 'stone',  power: 0,  accuracy: 1,    pp: 20, effect: 'defUp', desc: 'Tenses up. Raises Defense.' },
  pollen:   { name: 'Pollen Puff', type: 'leaf', power: 0,  accuracy: 0.95, pp: 15, effect: 'drain', desc: 'Steals a little vitality.' },
  moonbeam: { name: 'Moonbeam',  type: 'normal', power: 58, accuracy: 0.9,  pp: 10, desc: 'A focused beam of pale light.' },
  antler:   { name: 'Antler Rush', type: 'leaf', power: 60, accuracy: 0.92, pp: 10, desc: 'A guardian charge.' },
  stomp:    { name: 'Stomp',     type: 'normal', power: 55, accuracy: 0.9,  pp: 15, desc: 'A ground-shaking stomp.' },
  lunarray: { name: 'Lunar Ray', type: 'spark',  power: 60, accuracy: 0.94, pp: 10, desc: 'A ribbon of cold starlight.' },
  solarflare: { name: 'Solar Flare', type: 'ember', power: 66, accuracy: 0.9, pp: 8, desc: 'A burst of daylight itself.' },
  radiance: { name: 'Radiance',  type: 'normal', power: 0,  accuracy: 1,    pp: 10, effect: 'defUp', desc: 'A holy glow. Raises Defense.' },
};

export const SPECIES = {
  spriglet: {
    name: 'Spriglet', type: 'leaf', model: 'spriglet', rarity: 'epic',
    base: { hp: 52, atk: 15, def: 15, spd: 16 },
    catch: 0.62, scale: 0.95,
    evolvesTo: 'sylvanox', evolveLevel: 18,
    lore: 'A curious leaf-fox. Its tail sprouts anew every spring.',
    moves: [[1, 'tackle'], [1, 'leafwhip'], [8, 'growl'], [13, 'pollen']],
  },
  sylvanox: {
    name: 'Sylvanox', type: 'leaf', model: 'sylvanox', rarity: 'legendary',
    base: { hp: 82, atk: 27, def: 24, spd: 25 },
    catch: 0.22, scale: 1.05, evolved: true,
    evolvesFrom: 'spriglet',
    lore: 'The first grove-keeper. Antlers of living oak crown a fox woven from dawn light.',
    moves: [[1, 'tackle'], [1, 'leafwhip'], [1, 'growl'], [20, 'pollen']],
  },
  emberpup: {
    name: 'Emberpup', type: 'ember', model: 'emberpup', rarity: 'epic',
    base: { hp: 50, atk: 18, def: 13, spd: 17 },
    catch: 0.62, scale: 0.95,
    evolvesTo: 'pyrohound', evolveLevel: 18,
    lore: 'The ember on its tail burns brighter when it is happy.',
    moves: [[1, 'scratch'], [1, 'ember'], [8, 'growl'], [13, 'bite']],
  },
  pyrohound: {
    name: 'Pyrohound', type: 'ember', model: 'pyrohound', rarity: 'legendary',
    base: { hp: 78, atk: 31, def: 21, spd: 27 },
    catch: 0.22, scale: 1.05, evolved: true,
    evolvesFrom: 'emberpup',
    lore: 'A hound of the first bonfire. Its mane writes ember-runes on the night air.',
    moves: [[1, 'scratch'], [1, 'ember'], [1, 'growl'], [20, 'bite']],
  },
  dropplet: {
    name: 'Dropplet', type: 'aqua', model: 'dropplet', rarity: 'uncommon',
    base: { hp: 56, atk: 14, def: 17, spd: 14 },
    catch: 0.62, scale: 0.95,
    evolvesTo: 'tidalyn', evolveLevel: 16,
    lore: 'A river otter that keeps pebbles as tiny treasures.',
    moves: [[1, 'tackle'], [1, 'bubble'], [8, 'harden'], [13, 'bite']],
  },
  tidalyn: {
    name: 'Tidalyn', type: 'aqua', model: 'tidalyn', rarity: 'rare',
    base: { hp: 78, atk: 22, def: 25, spd: 19 },
    catch: 0.34, scale: 1.0, evolved: true,
    evolvesFrom: 'dropplet',
    lore: 'It carries a whole tide in its chest. Sailors follow its fins home.',
    moves: [[1, 'tackle'], [1, 'bubble'], [1, 'harden'], [18, 'moonbeam']],
  },
  mossling: {
    name: 'Mossling', type: 'leaf', model: 'mossling', rarity: 'common',
    base: { hp: 44, atk: 13, def: 12, spd: 19 },
    catch: 0.72, scale: 0.85,
    evolvesTo: 'mosswarden', evolveLevel: 14,
    lore: 'Mossling naps in the sun and photosynthesises its lunch.',
    moves: [[1, 'tackle'], [1, 'pollen'], [7, 'growl']],
  },
  mosswarden: {
    name: 'Mosswarden', type: 'leaf', model: 'mosswarden', rarity: 'uncommon',
    base: { hp: 68, atk: 21, def: 20, spd: 18 },
    catch: 0.4, scale: 0.95, evolved: true,
    evolvesFrom: 'mossling',
    lore: 'Its cap became a grove. Entire families of fireflies sleep beneath it.',
    moves: [[1, 'tackle'], [1, 'pollen'], [1, 'growl'], [16, 'leafwhip']],
  },
  pebblit: {
    name: 'Pebblit', type: 'stone', model: 'pebblit', rarity: 'uncommon',
    base: { hp: 60, atk: 17, def: 22, spd: 8 },
    catch: 0.66, scale: 0.9,
    evolvesTo: 'cragwarden', evolveLevel: 16,
    lore: 'It pretends to be a rock, badly. Moss loves it anyway.',
    moves: [[1, 'tackle'], [1, 'rocktoss'], [8, 'harden']],
  },
  cragwarden: {
    name: 'Cragwarden', type: 'stone', model: 'cragwarden', rarity: 'rare',
    base: { hp: 82, atk: 26, def: 30, spd: 9 },
    catch: 0.36, scale: 1.0, evolved: true,
    evolvesFrom: 'pebblit',
    lore: 'A walking cliff face. The crystals on its back sing when the tide turns.',
    moves: [[1, 'tackle'], [1, 'rocktoss'], [1, 'harden'], [18, 'stomp']],
  },
  zapmouse: {
    name: 'Zapmouse', type: 'spark', model: 'zapmouse', rarity: 'common',
    base: { hp: 46, atk: 18, def: 12, spd: 22 },
    catch: 0.6, scale: 0.85,
    evolvesTo: 'voltrix', evolveLevel: 14,
    lore: 'Its zig-zag tail stores just enough charge for one big zap.',
    moves: [[1, 'scratch'], [1, 'spark'], [8, 'growl']],
  },
  voltrix: {
    name: 'Voltrix', type: 'spark', model: 'voltrix', rarity: 'uncommon',
    base: { hp: 62, atk: 27, def: 17, spd: 29 },
    catch: 0.38, scale: 0.95, evolved: true,
    evolvesFrom: 'zapmouse',
    lore: 'Storm marks spiral down its flanks. It runs faster than thunder can answer.',
    moves: [[1, 'scratch'], [1, 'spark'], [1, 'growl'], [16, 'bite']],
  },
  fluffbat: {
    name: 'Fluffbat', type: 'normal', model: 'fluffbat', rarity: 'rare',
    base: { hp: 46, atk: 16, def: 12, spd: 21 },
    catch: 0.64, scale: 0.8,
    evolvesTo: 'nocturne', evolveLevel: 20,
    lore: 'Fluffbat is mostly fluff, but it flies with tremendous pride.',
    moves: [[1, 'gust'], [1, 'bite'], [8, 'growl']],
  },
  nocturne: {
    name: 'Nocturne', type: 'normal', model: 'nocturne', rarity: 'epic',
    base: { hp: 68, atk: 25, def: 19, spd: 32 },
    catch: 0.3, scale: 1.0, evolved: true,
    evolvesFrom: 'fluffbat',
    lore: 'Its wings are cut from the space between stars. It sings the moon to sleep.',
    moves: [[1, 'gust'], [1, 'bite'], [1, 'growl'], [22, 'moonbeam']],
  },
  lunari: {
    name: 'Lunari', type: 'spark', model: 'lunari', rarity: 'mythical',
    base: { hp: 62, atk: 22, def: 16, spd: 27 },
    catch: 0.18, scale: 1.0,
    lore: 'A moon-fox that walks only where moonlight pools. Its crescent horns hum with old songs.',
    moves: [[1, 'lunarray'], [1, 'moonbeam'], [8, 'growl'], [12, 'spark']],
  },
  solaris: {
    name: 'Solaris', type: 'ember', model: 'solaris', rarity: 'divine',
    base: { hp: 78, atk: 27, def: 21, spd: 22 },
    catch: 0.1, scale: 1.05,
    lore: 'The sun-bird of the grove. It appears only when the isles are at peace.',
    moves: [[1, 'solarflare'], [1, 'moonbeam'], [8, 'radiance'], [12, 'gust']],
  },
  elderwood: {
    name: 'Elderwood', type: 'leaf', model: 'elderwood', rarity: 'legendary',
    base: { hp: 96, atk: 23, def: 21, spd: 15 },
    catch: 0.04, scale: 1.0, boss: true,
    lore: 'The grove remembers. The grove protects.',
    moves: [[1, 'antler'], [1, 'stomp'], [10, 'harden'], [12, 'moonbeam']],
  },
};

export const XP_TO_NEXT = (level) => Math.round(22 + level * level * 2.6);

export const MAX_LEVEL = 30;

export function statsFor(speciesId, level) {
  const base = SPECIES[speciesId].base;
  return {
    maxHp: Math.round(base.hp * 0.55 + level * 4.2),
    atk: Math.round(base.atk * 0.7 + level * 1.1),
    def: Math.round(base.def * 0.7 + level * 1.0),
    spd: Math.round(base.spd * 0.7 + level * 0.9),
  };
}

let nextUid = 1;
const usedShinySeeds = new Set();

export function makeShinySeed() {
  let seed = 0;
  do {
    seed = (Math.floor(Math.random() * 900000000) + 100000000) ^ (nextUid * 2654435761);
    seed = Math.abs(seed) % 900000000 + 100000000;
  } while (usedShinySeeds.has(seed));
  usedShinySeeds.add(seed);
  return seed;
}

export function createCreature(speciesId, level, opts = {}) {
  const species = SPECIES[speciesId];
  const stats = statsFor(speciesId, level);
  const learned = species.moves.filter(([lvl]) => lvl <= level);
  while (learned.length < 2) learned.push(species.moves[learned.length]);
  const moves = learned.slice(-4).map(([, id]) => ({
    id,
    pp: MOVES[id].pp,
    maxPp: MOVES[id].pp,
  }));
  const shiny = opts.shiny ?? Math.random() < 1 / shinyOdds(speciesId);
  const shinySeed = shiny ? makeShinySeed() : null;
  return {
    uid: nextUid++,
    species: speciesId,
    level,
    exp: 0,
    hp: stats.maxHp,
    ...stats,
    atkStage: 0,
    defStage: 0,
    moves,
    shiny,
    shinySeed,
    appearance: shiny ? { shiny: true, seed: shinySeed } : null,
    nickname: null,
  };
}

export function displayName(mon) {
  return mon.nickname || SPECIES[mon.species].name;
}

export function healCreature(mon) {
  mon.hp = mon.maxHp;
  mon.atkStage = 0;
  mon.defStage = 0;
  for (const m of mon.moves) m.pp = m.maxPp;
}

export function stageMultiplier(stage) {
  return Math.max(0.4, 1 + stage * 0.33);
}

export function xpGain(defeated, isBoss = false) {
  const base = 16 + defeated.level * 6 + (isBoss ? 70 : 0);
  return Math.round(base);
}

export function levelUp(mon) {
  if (mon.level >= MAX_LEVEL) return null;
  const hpRatio = mon.maxHp > 0 ? mon.hp / mon.maxHp : 1;
  mon.level += 1;
  let evolvedTo = null;
  const species = SPECIES[mon.species];
  if (species.evolvesTo && mon.level >= (species.evolveLevel || 99)) {
    mon.species = species.evolvesTo;
    evolvedTo = mon.species;
  }
  const next = statsFor(mon.species, mon.level);
  mon.maxHp = next.maxHp;
  mon.atk = next.atk;
  mon.def = next.def;
  mon.spd = next.spd;
  mon.hp = Math.min(mon.maxHp, Math.max(1, Math.round(mon.maxHp * hpRatio) + (evolvedTo ? 4 : 0)));
  const learned = [];
  for (const [lvl, moveId] of SPECIES[mon.species].moves) {
    if (lvl === mon.level) {
      if (mon.moves.length < 4) {
        mon.moves.push({ id: moveId, pp: MOVES[moveId].pp, maxPp: MOVES[moveId].pp });
        learned.push(moveId);
      } else {
        mon.moves.shift();
        mon.moves.push({ id: moveId, pp: MOVES[moveId].pp, maxPp: MOVES[moveId].pp });
        learned.push(moveId);
      }
    }
  }
  return { learned, evolvedTo };
}

export function starterOptions() {
  return ['spriglet', 'emberpup', 'dropplet'];
}
