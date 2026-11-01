import {
  CREATURE_BY_ID, CREATURES, ELEMENTS, RARITIES, RELIC_BY_ID, TECHNIQUES, ZONE_BY_ID,
} from './data.js'

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a)
export const randInt = (a, b) => Math.floor(rand(a, b + 1))
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
export const chance = (p) => Math.random() < p
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
export const deepClone = (obj) => JSON.parse(JSON.stringify(obj))
export const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1)
export const formatNumber = (n) => new Intl.NumberFormat('es').format(Math.floor(n))
export const pct = (n) => `${Math.round(n * 100)}%`

export const RARITY_ORDER = ['comun', 'poco', 'raro', 'epico', 'legendario', 'mitico']
export const rarityRank = (rarity) => RARITY_ORDER.indexOf(rarity)

export function xpNeed(level) {
  return Math.floor(28 + level * level * 1.15 + level * 9)
}

export function learnableMoves(speciesId, level) {
  const species = CREATURE_BY_ID[speciesId]
  if (!species) return []
  return species.learnset.filter(entry => entry.level <= level).map(entry => entry.id)
}

export function defaultMoveset(speciesId, level) {
  const known = learnableMoves(speciesId, level)
  const unique = [...new Set(known)]
  const attacks = unique.filter(id => TECHNIQUES[id]?.kind === 'attack')
  const support = unique.filter(id => TECHNIQUES[id]?.kind !== 'attack')
  const chosen = []
  // Keep the strongest attacks and one signature if possible.
  const sorted = [...attacks].sort((a, b) => (TECHNIQUES[a].tier || 0) - (TECHNIQUES[b].tier || 0))
  if (sorted.length) chosen.push(sorted[sorted.length - 1])
  const signature = sorted.find(id => TECHNIQUES[id].signature)
  if (signature && !chosen.includes(signature)) chosen.push(signature)
  for (const id of sorted.reverse()) {
    if (chosen.length >= 3) break
    if (!chosen.includes(id)) chosen.push(id)
  }
  for (const id of support.reverse()) {
    if (chosen.length >= 4) break
    if (!chosen.includes(id)) chosen.push(id)
  }
  return chosen.length ? chosen : unique.slice(-4)
}

export function relicBonus(creature, key) {
  if (!creature?.relic) return 0
  const relic = RELIC_BY_ID[creature.relic]
  if (!relic) return 0
  return (relic.bonus?.[key] || 0) + (relic.bonus?.all || 0)
}

export function statsForCreature(creature) {
  const species = CREATURE_BY_ID[creature.speciesId]
  if (!species) return { hp: 1, atk: 1, def: 1, spd: 1 }
  const base = species.statsAt(creature.level)
  const hp = Math.round(base.hp * (1 + relicBonus(creature, 'hp')))
  const atk = Math.round(base.atk * (1 + relicBonus(creature, 'atk')))
  const def = Math.round(base.def * (1 + relicBonus(creature, 'def')))
  const spd = Math.round(base.spd * (1 + relicBonus(creature, 'spd')))
  return { hp, atk, def, spd }
}

export function recalcCreature(creature, { heal = false, keepRatio = true } = {}) {
  const species = CREATURE_BY_ID[creature.speciesId]
  if (!species) return creature
  const oldMax = creature.maxHp || 1
  const ratio = creature.hp != null ? creature.hp / oldMax : 1
  const stats = statsForCreature(creature)
  creature.maxHp = stats.hp
  creature.stats = { atk: stats.atk, def: stats.def, spd: stats.spd }
  if (heal) creature.hp = creature.maxHp
  else creature.hp = clamp(Math.round(stats.hp * (keepRatio ? ratio : 1)), 0, stats.hp)
  return creature
}

export function createCreature(speciesId, level = 5, opts = {}) {
  const species = CREATURE_BY_ID[speciesId]
  if (!species) throw new Error(`Unknown species ${speciesId}`)
  const known = [...new Set(learnableMoves(speciesId, level))]
  const moveset = opts.moveset ? [...opts.moveset].slice(0, 4) : defaultMoveset(speciesId, level)
  const creature = {
    uid: opts.uid || uid('crt'),
    speciesId,
    nickname: opts.nickname || null,
    level,
    xp: opts.xp || 0,
    hp: 1,
    maxHp: 1,
    stats: { atk: 1, def: 1, spd: 1 },
    known,
    moveset,
    bond: opts.bond ?? 10,
    relic: opts.relic || null,
    capturedAt: opts.capturedAt || Date.now(),
    shiny: !!opts.shiny,
    origin: opts.origin || 'wild',
  }
  recalcCreature(creature, { heal: true })
  return creature
}

export function displayName(creature) {
  return creature.nickname || CREATURE_BY_ID[creature.speciesId]?.name || 'Criatura'
}

export function elementMultiplier(attackElement, defenderElement) {
  if (!attackElement || attackElement === 'neutro') return 1
  const attacker = ELEMENTS[attackElement]
  const defender = ELEMENTS[defenderElement]
  if (!attacker || !defender) return 1
  if (attacker.strong?.includes(defenderElement)) return 1.65
  if (attacker.weak?.includes(defenderElement)) return 0.62
  if (attackElement === defenderElement) return 1.15
  return 1
}

export function effectivenessText(mult) {
  if (mult >= 1.55) return '¡Es muy eficaz!'
  if (mult <= 0.7) return 'No es muy eficaz…'
  return ''
}

export function zoneAt(x, y) {
  let best = null
  let bestDist = Infinity
  for (const zone of Object.values(ZONE_BY_ID)) {
    const d = Math.hypot(x - zone.x, y - zone.y)
    if (d < zone.r && d < bestDist) { best = zone; bestDist = d }
  }
  return best || Object.values(ZONE_BY_ID)[0]
}

export function isNight(time) {
  return time < 6 || time >= 19
}

export function timeLabel(time) {
  const h = Math.floor(time)
  const m = Math.floor((time - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function phaseLabel(time) {
  if (time < 5) return 'Madrugada'
  if (time < 8) return 'Amanecer'
  if (time < 12) return 'Mañana'
  if (time < 17) return 'Tarde'
  if (time < 20) return 'Atardecer'
  return 'Noche'
}

export function weatherRarityBoost(weather) {
  return weather === 'eclipse' ? 3.2 : weather === 'storm' ? 1.6 : weather === 'fog' ? 1.35 : 1
}

export function spawnWeight(rarity, weather) {
  const base = { comun: 58, poco: 27, raro: 10.5, epico: 3.5, legendario: 0.8, mitico: 0.18 }
  const boost = weatherRarityBoost(weather)
  const index = rarityRank(rarity)
  return base[rarity] * (index >= 2 ? boost : 1)
}

export function weightedPick(entries, weightFn) {
  const total = entries.reduce((sum, entry) => sum + weightFn(entry), 0)
  let roll = Math.random() * total
  for (const entry of entries) {
    roll -= weightFn(entry)
    if (roll <= 0) return entry
  }
  return entries[entries.length - 1]
}

export function speciesByFamily(familyId) {
  return CREATURES.filter(c => c.family === familyId)
}

export function stageForLevel(species, level) {
  if (species.mythic) return species
  const stages = CREATURES.filter(c => c.family === species.family)
  if (level >= 36 && stages[2]) return stages[2]
  if (level >= 16 && stages[1]) return stages[1]
  return stages[0]
}

export function encodeInvite(payload) {
  const json = JSON.stringify(payload)
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeInvite(code) {
  try {
    const normalized = code.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    return JSON.parse(decodeURIComponent(escape(atob(padded))))
  } catch {
    return null
  }
}

export function serializeCreature(c) {
  return {
    s: c.speciesId, l: c.level, m: c.moveset, n: c.nickname || undefined,
    r: c.relic || undefined, b: c.bond, sh: c.shiny || undefined,
  }
}

export function creatureFromInvite(data) {
  return createCreature(data.s, data.l, {
    nickname: data.n,
    moveset: data.m,
    relic: data.r,
    bond: data.b ?? 30,
    shiny: data.sh,
    origin: 'invite',
  })
}

export function slug(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
}

export function shadeColor(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = clamp((n >> 16) + amt, 0, 255)
  const g = clamp(((n >> 8) & 0xff) + amt, 0, 255)
  const b = clamp((n & 0xff) + amt, 0, 255)
  return `rgb(${r},${g},${b})`
}

export function hpColor(ratio) {
  if (ratio > 0.55) return '#5ee08a'
  if (ratio > 0.25) return '#fbbf24'
  return '#fb7185'
}

export function movePowerForDisplay(moveId, level) {
  const move = TECHNIQUES[moveId]
  if (!move) return 0
  if (move.scaling) return Math.round(move.power + level * 0.6)
  return move.power || 0
}
