import {
  CHAPTERS, CREATURE_BY_ID, CREATURES, DUNGEONS, ELEMENTS, FAMILIES, ITEMS,
  MYTHICS, NPCS, POIS, RARITIES, RELIC_BY_ID, RELICS, SAVE_KEY, SAVE_VERSION,
  SIDEQUEST_BY_ID, SIDEQUESTS, STARTER_IDS, TECHNIQUES, TRAPS, TRAINERS, WEATHERS,
  WORLD, ZONES, ZONE_BY_ID,
} from './data.js'
import {
  chance, clamp, createCreature, creatureFromInvite, decodeInvite, displayName,
  elementMultiplier, encodeInvite, isNight, learnableMoves, movePowerForDisplay,
  pct, pick, rand, randInt, rarityRank, recalcCreature, serializeCreature, sleep,
  spawnWeight, stageForLevel, statsForCreature, uid, weightedPick, xpNeed, zoneAt,
} from './core.js'

export const bus = new EventTarget()
export const emit = (type, detail = {}) => bus.dispatchEvent(new CustomEvent(type, { detail }))
export const on = (type, fn) => bus.addEventListener(type, fn)

export const SHOP_STOCK = {
  traps: TRAPS.map(t => t.id),
  items: ['potion', 'elixir', 'revive', 'ration', 'incense'],
  relics: ['relic_swift_feather', 'relic_aegis_scale', 'relic_capture_lens'],
}

const STARTER_LORE = {
  'brasal-1': 'Un compañero valiente y directo. Su llama crece cuando protege a alguien.',
  'aquil-1': 'Un espíritu tranquilo y adaptable. Escucha corrientes que otros no perciben.',
  'brot-1': 'Un corazón paciente y curioso. Todo lo que toca tiende a florecer.',
}

function freshState(name = 'Aria') {
  return {
    version: SAVE_VERSION,
    started: true,
    player: {
      name: name || 'Aria',
      x: 1290,
      y: 1370,
      dir: 'down',
      title: 'Novato del Nexo',
      rank: 1000,
      coins: 320,
      shards: 0,
      wins: 0,
      losses: 0,
      createdAt: Date.now(),
    },
    roster: [],
    team: [],
    inventory: {
      traps: { fibra: 6, runa: 2, prisma: 1, nexo: 0, celestial: 0 },
      items: { potion: 3, elixir: 1, revive: 1, ration: 2, incense: 0 },
    },
    relics: [],
    codex: {},
    quests: { main: 0, side: {}, completed: [], ready: null, advancing: false },
    stats: {
      captures: 0, capturesByElement: {}, capturesByRarity: {}, weatherCaptures: 0,
      dungeonClears: [], relicsFound: 0, arenaWins: 0, arenaLosses: 0,
      pvpWins: 0, pvpLosses: 0, maxLevel: 5, battles: 0, wildDefeats: 0,
      distance: 0, shardsFound: 0, itemsFound: 0, randomEncounters: 0,
    },
    world: {
      seed: Math.floor(Math.random() * 999999937),
      time: 8.4,
      day: 1,
      weather: 'clear',
      weatherTimer: 105,
      eventTimer: 70,
      event: null,
      spawns: [],
      loot: [],
      spawnTimer: 6,
      lastZone: 'pradera',
      encounterMeter: 0,
      encounterThreshold: 900,
      encounterCooldown: 8,
      encounters: 0,
    },
    settings: { sound: true, particles: true, quality: 1, encounters: true },
    flags: { title: 'Novato del Nexo', ending: false },
    npcs: NPCS.map(n => ({ ...n })),
    battle: null,
    dungeon: null,
    pendingInvite: null,
    lastSave: 0,
    log: [],
  }
}

class Game {
  constructor() {
    this.state = null
    this.starterInfo = STARTER_LORE
    this.saveTimer = 0
  }

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY) } catch { return false }
  }

  newGame(name, starterId) {
    if (!STARTER_IDS.includes(starterId)) starterId = STARTER_IDS[0]
    const s = freshState(name)
    this.state = s
    const starter = createCreature(starterId, 5, { origin: 'starter', bond: 25, nickname: null })
    s.roster.push(starter)
    s.team.push(starter.uid)
    s.codex[starterId] = { seen: true, caught: true, firstAt: Date.now() }
    s.stats.capturesByElement[CREATURE_BY_ID[starterId].element] = 0
    s.stats.maxLevel = 5
    this.populateWorld()
    this.seedLoot()
    this.save()
    emit('game:start', { state: s })
    emit('toast', { text: `Tu vínculo con ${CREATURE_BY_ID[starterId].name} ha comenzado.`, kind: 'good' })
    return s
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || parsed.version !== SAVE_VERSION) return null
      const base = freshState(parsed.player?.name)
      this.state = {
        ...base,
        ...parsed,
        player: { ...base.player, ...(parsed.player || {}) },
        inventory: { ...base.inventory, ...(parsed.inventory || {}) },
        stats: { ...base.stats, ...(parsed.stats || {}) },
        world: { ...base.world, ...(parsed.world || {}), spawns: [], loot: parsed.world?.loot || [] },
        quests: { ...base.quests, ...(parsed.quests || {}) },
        settings: { ...base.settings, ...(parsed.settings || {}) },
        flags: { ...base.flags, ...(parsed.flags || {}) },
        npcs: NPCS.map(n => ({ ...n })),
        battle: null,
        dungeon: null,
      }
      this.state.roster = (parsed.roster || []).map(c => recalcCreature(c))
      this.state.team = (parsed.team || []).filter(id => this.state.roster.some(c => c.uid === id))
      if (!this.state.team.length && this.state.roster.length) this.state.team.push(this.state.roster[0].uid)
      this.populateWorld()
      if (!this.state.world.loot?.length) this.seedLoot()
      emit('game:loaded', { state: this.state })
      return this.state
    } catch (error) {
      console.error('No se pudo cargar la partida', error)
      return null
    }
  }

  save() {
    if (!this.state?.started) return
    try {
      const snapshot = {
        ...this.state,
        battle: null,
        dungeon: null,
        world: { ...this.state.world, spawns: [] },
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot))
      this.state.lastSave = Date.now()
      emit('save:ok', { at: this.state.lastSave })
    } catch (error) {
      console.warn('No se pudo guardar', error)
    }
  }

  resetSave() {
    try { localStorage.removeItem(SAVE_KEY) } catch {}
  }

  // ---------- world ----------

  populateWorld() {
    const s = this.state
    if (!s) return
    s.world.spawns = []
    for (const zone of ZONES) {
      const count = zone.tier <= 2 ? 5 : 4
      for (let i = 0; i < count; i++) this.spawnInZone(zone.id)
    }
  }

  pickWildSpecies(zone, opts = {}) {
    const s = this.state
    const families = FAMILIES.filter(f => f.habitat === zone.id || zone.elements.includes(f.element))
    const weather = opts.weather || s.world.weather
    const playerLevel = this.maxLevel()
    let family = weightedPick(families, (f) => {
      let weight = spawnWeight(f.rarity, weather)
      if (zone.elements.includes(f.element)) weight *= 1.45
      if (weather === 'rain' && f.element === 'agua') weight *= 2
      if ((weather === 'storm' || weather === 'eclipse') && (f.element === 'rayo' || f.element === 'sombra')) weight *= 2.2
      if (weather === 'snow' && (f.element === 'hielo' || f.element === 'aire')) weight *= 2.1
      if (weather === 'sand' && (f.element === 'tierra' || f.element === 'fuego')) weight *= 2.1
      if (weather === 'fog' && (f.element === 'sombra' || f.element === 'veneno')) weight *= 2.2
      return weight
    })
    if (!family) family = pick(families)
    let level = randInt(zone.level[0], zone.level[1]) + Math.floor(playerLevel * 0.22)
    if (opts.level) level = opts.level
    level = clamp(level, 1, 999)
    let species = stageForLevel(CREATURES.find(c => c.family === family.id), level)
    if (opts.mythic || (weather === 'eclipse' && chance(0.035))) {
      const mythic = pick(MYTHICS)
      species = CREATURE_BY_ID[`${mythic.id}`] || mythic
      level = Math.max(level, 30)
    }
    if (opts.speciesId) species = CREATURE_BY_ID[opts.speciesId]
    return { species, level }
  }

  spawnInZone(zoneId, opts = {}) {
    const s = this.state
    const zone = ZONE_BY_ID[zoneId] || ZONES[0]
    const { species, level } = this.pickWildSpecies(zone, opts)
    const angle = rand(0, Math.PI * 2)
    const dist = opts.near ? rand(180, 320) : Math.sqrt(Math.random()) * zone.r * 0.78
    let x = (opts.x ?? zone.x + Math.cos(angle) * dist)
    let y = (opts.y ?? zone.y + Math.sin(angle) * dist)
    if (!opts.x) {
      x = clamp(x, 90, WORLD.w - 90)
      y = clamp(y, 90, WORLD.h - 90)
    }
    // Keep wild creatures out of buildings and settlements.
    if (!opts.x && !opts.near) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const blocked = POIS.some(poi => Math.hypot(x - poi.x, y - poi.y) < (poi.type === 'dungeon' ? 170 : 210))
        if (!blocked) break
        const a2 = rand(0, Math.PI * 2)
        const d2 = Math.sqrt(Math.random()) * zone.r * 0.78
        x = clamp(zone.x + Math.cos(a2) * d2, 90, WORLD.w - 90)
        y = clamp(zone.y + Math.sin(a2) * d2, 90, WORLD.h - 90)
      }
    }
    const wild = {
      uid: uid('wild'),
      speciesId: species.id,
      level,
      x, y,
      homeX: x, homeY: y,
      zone: zone.id,
      vx: 0, vy: 0,
      phase: rand(0, 10),
      wander: rand(1, 4),
      rare: rarityRank(species.rarity) >= 2,
      createdAt: Date.now(),
    }
    s.world.spawns.push(wild)
    return wild
  }

  seedLoot() {
    const s = this.state
    const spots = [
      [1040, 990], [2100, 1520], [2680, 1380], [1250, 2020], [810, 1220], [2050, 660], [1580, 780], [980, 1780],
    ]
    s.world.loot = spots.map(([x, y], i) => ({
      uid: uid('loot'), x, y, kind: i % 4 === 0 ? 'relic' : i % 3 === 0 ? 'shards' : 'cache', opened: false,
    }))
  }

  update(dt) {
    const s = this.state
    if (!s || !s.started || s.battle) return
    s.world.time += dt / 60
    if (s.world.time >= 24) {
      s.world.time -= 24
      s.world.day++
      emit('toast', { text: `Amanece el día ${s.world.day} en Vértice.`, kind: 'info' })
      this.healTeam(false)
    }
    const phaseNight = isNight(s.world.time)
    if (s.world.lastNight !== phaseNight) {
      s.world.lastNight = phaseNight
      if (phaseNight) emit('toast', { text: 'La noche cae. Las criaturas de Sombra despiertan.', kind: 'info' })
    }

    s.world.weatherTimer -= dt
    if (s.world.weatherTimer <= 0) this.changeWeather()
    s.world.eventTimer -= dt
    if (s.world.eventTimer <= 0 && !s.dungeon) this.triggerWorldEvent()
    if (s.world.event) {
      s.world.event.remaining = Math.max(0, s.world.event.remaining - dt)
      if (s.world.event.remaining <= 0) s.world.event = null
    }

    // creature wandering
    for (const wild of s.world.spawns) {
      wild.wander -= dt
      if (wild.wander <= 0) {
        wild.wander = rand(1.8, 4.6)
        const a = rand(0, Math.PI * 2)
        const speed = rand(3, 13)
        wild.vx = Math.cos(a) * speed
        wild.vy = Math.sin(a) * speed
      }
      wild.x += wild.vx * dt
      wild.y += wild.vy * dt
      const homeDist = Math.hypot(wild.x - wild.homeX, wild.y - wild.homeY)
      if (homeDist > 120) {
        wild.vx += (wild.homeX - wild.x) * 0.02 * dt
        wild.vy += (wild.homeY - wild.y) * 0.02 * dt
      }
      const zone = ZONE_BY_ID[wild.zone]
      if (zone) {
        const d = Math.hypot(wild.x - zone.x, wild.y - zone.y)
        if (d > zone.r * 0.9) {
          wild.vx += (zone.x - wild.x) * 0.05 * dt
          wild.vy += (zone.y - wild.y) * 0.05 * dt
        }
      }
      wild.x = clamp(wild.x, 80, WORLD.w - 80)
      wild.y = clamp(wild.y, 80, WORLD.h - 80)
    }

    s.world.spawnTimer -= dt
    if (s.world.spawnTimer <= 0) {
      s.world.spawnTimer = 8
      for (const zone of ZONES) {
        const count = s.world.spawns.filter(w => w.zone === zone.id).length
        const target = zone.tier <= 2 ? 5 : 4
        if (count < target) this.spawnInZone(zone.id)
      }
      if (s.world.spawns.length > 36) s.world.spawns.splice(0, s.world.spawns.length - 36)
    }

    this.saveTimer += dt
    if (this.saveTimer > 25) { this.saveTimer = 0; this.save() }
  }

  changeWeather(forced) {
    const s = this.state
    const zone = zoneAt(s.player.x, s.player.y)
    const options = ['clear', 'clear', 'rain', 'fog', 'storm', 'snow', 'sand']
    if (zone.id === 'desierto') options.push('sand', 'sand', 'clear')
    if (zone.id === 'cumbre') options.push('snow', 'snow', 'storm')
    if (zone.id === 'bosque') options.push('fog', 'fog', 'rain')
    if (zone.id === 'costa') options.push('rain', 'rain', 'storm')
    let weather = forced || pick(options.filter(w => w !== s.world.weather))
    if (chance(0.035)) weather = 'eclipse'
    s.world.weather = weather
    s.world.weatherTimer = weather === 'eclipse' ? rand(55, 80) : rand(85, 155)
    emit('weather:change', { weather, meta: WEATHERS[weather] })
    emit('toast', { text: `El clima cambia: ${WEATHERS[weather].name}. ${WEATHERS[weather].desc}`, kind: 'weather' })
    // a few new creatures react to the new weather
    for (let i = 0; i < 2; i++) this.spawnInZone(zone.id, { near: true })
    this.save()
  }

  triggerWorldEvent() {
    const s = this.state
    const roll = Math.random()
    s.world.eventTimer = rand(95, 170)
    if (roll < 0.18) {
      s.world.weather = 'eclipse'
      s.world.weatherTimer = 60
      s.world.event = { id: 'eclipse', name: 'ECLIPSE DEL NEXO', desc: 'La luz se retira. Criaturas míticas han sido vistas.', color: '#c084fc', remaining: 60 }
      emit('weather:change', { weather: 'eclipse', meta: WEATHERS.eclipse })
      for (let i = 0; i < 3; i++) this.spawnInZone(zoneAt(s.player.x, s.player.y).id, { near: true })
    } else if (roll < 0.48) {
      const zone = zoneAt(s.player.x, s.player.y)
      for (let i = 0; i < 3; i++) this.spawnInZone(zone.id, { near: true, level: this.maxLevel() + randInt(2, 7) })
      s.world.event = { id: 'migration', name: 'MIGRACIÓN SALVAJE', desc: 'Criaturas inusuales se acercan a tu posición.', color: '#5eead4', remaining: 50 }
    } else if (roll < 0.7) {
      const a = rand(0, Math.PI * 2)
      const loot = {
        uid: uid('loot'), x: clamp(s.player.x + Math.cos(a) * rand(130, 260), 80, WORLD.w - 80),
        y: clamp(s.player.y + Math.sin(a) * rand(130, 260), 80, WORLD.h - 80),
        kind: chance(0.55) ? 'relic' : 'shards', opened: false, meteor: true,
      }
      s.world.loot.push(loot)
      s.world.event = { id: 'meteor', name: 'FRAGMENTO CAÍDO', desc: 'Un meteorito de Nexo ha caído cerca. Búscalo.', color: '#fbbf24', remaining: 70 }
    } else if (roll < 0.86) {
      this.healTeam(false)
      s.player.shards += 1
      s.stats.shardsFound += 1
      s.world.event = { id: 'blessing', name: 'BENDICIÓN DE VÉRTICE', desc: 'El Nexo restaura a tu equipo y deja un fragmento.', color: '#5eead4', remaining: 35 }
    } else {
      const zone = zoneAt(s.player.x, s.player.y)
      this.spawnInZone(zone.id, { near: true, mythic: true })
      s.world.event = { id: 'myth', name: 'PRESENCIA IMPOSIBLE', desc: 'Algo antiguo ha cruzado el velo. Está muy cerca.', color: '#fb7185', remaining: 55 }
    }
    emit('world:event', s.world.event)
    emit('toast', { text: `${s.world.event.name}: ${s.world.event.desc}`, kind: 'event' })
  }

  collectLoot(lootUid) {
    const s = this.state
    const loot = s.world.loot.find(l => l.uid === lootUid)
    if (!loot) return null
    s.world.loot = s.world.loot.filter(l => l.uid !== lootUid)
    let result
    if (loot.kind === 'relic' || loot.meteor && chance(0.5)) {
      const relic = pick(RELICS)
      s.relics.push(relic.id)
      s.stats.relicsFound++
      result = { type: 'relic', relic, text: `Has encontrado ${relic.name}.` }
      emit('toast', { text: `Reliquia obtenida: ${relic.name}`, kind: 'relic' })
    } else if (loot.kind === 'shards') {
      const n = randInt(2, 5)
      s.player.shards += n
      s.stats.shardsFound += n
      result = { type: 'shards', amount: n, text: `Has encontrado ${n} fragmentos de Nexo.` }
      emit('toast', { text: `+${n} fragmentos de Nexo`, kind: 'good' })
    } else {
      const trap = pick(TRAPS)
      s.inventory.traps[trap.id] = (s.inventory.traps[trap.id] || 0) + 1
      s.player.coins += randInt(30, 90)
      result = { type: 'trap', trap, text: `Cofre antiguo: ${trap.name} y monedas.` }
      emit('toast', { text: `Cofre: ${trap.name}`, kind: 'good' })
    }
    this.checkQuests()
    this.save()
    return result
  }

  movePlayer(dx, dy, dt, sprint = false) {
    const s = this.state
    if (!s || s.battle) return false
    let len = Math.hypot(dx, dy)
    if (!len) return false
    dx /= len; dy /= len
    const speed = sprint ? 315 : 215
    s.player.x = clamp(s.player.x + dx * speed * dt, 70, WORLD.w - 70)
    s.player.y = clamp(s.player.y + dy * speed * dt, 70, WORLD.h - 70)
    s.player.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
    s.stats.distance += speed * dt
    const zone = zoneAt(s.player.x, s.player.y)
    if (zone.id !== s.world.lastZone) {
      s.world.lastZone = zone.id
      emit('zone:change', { zone })
      emit('toast', { text: `${zone.name} — ${zone.subtitle}`, kind: 'zone' })
    }
    this.advanceEncounter(dt, speed * dt)
    return true
  }

  // ---------- random exploration encounters ----------

  advanceEncounter(dt, distance) {
    const s = this.state
    if (!s || s.battle || s.dungeon) return
    if (s.settings?.encounters === false) return
    s.world.encounterCooldown = Math.max(0, (s.world.encounterCooldown || 0) - dt)
    const p = s.player
    const safe = POIS.some(poi => ['ranch', 'arena', 'village'].includes(poi.type)
      && Math.hypot(p.x - poi.x, p.y - poi.y) < 210)
    if (safe) {
      s.world.encounterMeter = Math.max(0, (s.world.encounterMeter || 0) - distance * 1.5)
      return
    }
    const zone = zoneAt(p.x, p.y)
    if (!zone) return
    const tierMult = 1 + (zone.tier - 1) * 0.22
    const weatherMult = ['storm', 'eclipse', 'fog'].includes(s.world.weather) ? 1.18 : 1
    s.world.encounterMeter = (s.world.encounterMeter || 0) + distance * tierMult * weatherMult
    const threshold = s.world.encounterThreshold || 900
    if (s.world.encounterMeter < threshold) return
    s.world.encounterMeter = 0
    s.world.encounterThreshold = rand(620, 1180)
    if ((s.world.encounterCooldown || 0) > 0) return
    if (!this.getTeam().some(c => c.hp > 0)) return
    if (!chance(0.92)) return
    this.triggerRandomEncounter(zone)
  }

  triggerRandomEncounter(zone) {
    const s = this.state
    if (!s || s.battle || s.dungeon) return null
    if (!this.getTeam().some(c => c.hp > 0)) return null
    const { species, level } = this.pickWildSpecies(zone)
    if (!species) return null
    const enemy = this.makeEnemy(species.id, level, { shiny: chance(0.035), origin: 'wild' })
    this.seeSpecies(species.id)
    s.world.encounters = (s.world.encounters || 0) + 1
    s.world.encounterCooldown = rand(15, 26)
    s.stats.randomEncounters = (s.stats.randomEncounters || 0) + 1
    emit('encounter:start', { species, level, zone })
    emit('toast', { text: `¡${species.name} salvaje apareció!`, kind: 'encounter' })
    return this.beginBattle({
      enemyTeam: [enemy], mode: 'wild', canCapture: true,
      context: { random: true, zone: zone.id }, zone: zone.id,
    })
  }

  nearestInteractable() {
    const s = this.state
    if (!s) return null
    const p = s.player
    const list = []
    for (const npc of s.npcs) list.push({ type: 'npc', id: npc.id, name: npc.name, x: npc.x, y: npc.y, range: 78, data: npc })
    for (const poi of POIS) {
      if (poi.hidden && s.quests.main < 9) {
        list.push({ type: 'poi', id: poi.id, name: 'Sello del Nexo', x: poi.x, y: poi.y, range: 140, data: poi, locked: true })
      } else {
        list.push({ type: 'poi', id: poi.id, name: poi.name, x: poi.x, y: poi.y, range: 145, data: poi })
      }
    }
    for (const wild of s.world.spawns) list.push({ type: 'wild', id: wild.uid, name: CREATURE_BY_ID[wild.speciesId]?.name || 'Criatura', x: wild.x, y: wild.y, range: 68, data: wild })
    for (const loot of s.world.loot) list.push({ type: 'loot', id: loot.uid, name: 'Hallazgo', x: loot.x, y: loot.y, range: 62, data: loot })
    let best = null, bestScore = Infinity
    let bestSpecific = null, bestSpecificScore = Infinity
    for (const item of list) {
      const d = Math.hypot(p.x - item.x, p.y - item.y)
      if (d <= item.range) {
        const score = d / item.range
        if (score < bestScore) { best = { ...item, dist: d }; bestScore = score }
        if (item.type !== 'poi' && score < bestSpecificScore) {
          bestSpecific = { ...item, dist: d }
          bestSpecificScore = score
        }
      }
    }
    // Creatures, loot and NPCs are precise targets; broad POIs only win when
    // nothing more specific is within reach.
    return bestSpecific || best
  }

  interactNearest() {
    const target = this.nearestInteractable()
    if (!target) return { type: 'none' }
    if (target.type === 'npc') return { type: 'npc', result: this.interactNPC(target.id) }
    if (target.type === 'wild') return { type: 'wild', result: this.startWildBattle(target.id) }
    if (target.type === 'loot') return { type: 'loot', result: this.collectLoot(target.id) }
    if (target.type === 'poi') {
      const poi = target.data
      if (poi.locked) {
        emit('toast', { text: 'El sello no responde. Debes completar el capítulo 9.', kind: 'bad' })
        return { type: 'locked' }
      }
      if (poi.type === 'ranch') return { type: 'ranch' }
      if (poi.type === 'arena') return { type: 'arena' }
      if (poi.type === 'village') return { type: 'shop' }
      if (poi.type === 'dungeon') {
        const ok = this.enterDungeon(poi.dungeon)
        return { type: ok ? 'dungeon' : 'locked' }
      }
    }
    return { type: 'none' }
  }

  // ---------- creatures ----------

  getCreature(uidValue) { return this.state.roster.find(c => c.uid === uidValue) }
  getTeam() { return this.state.team.map(id => this.getCreature(id)).filter(Boolean) }
  getActive() { return this.getTeam().find(c => c.hp > 0) || this.getTeam()[0] || null }
  maxLevel() { return Math.max(1, ...this.getTeam().map(c => c.level), ...this.state.roster.map(c => c.level)) }

  addCreature(creature, { toTeam = true, countCapture = true } = {}) {
    const s = this.state
    s.roster.push(creature)
    if (toTeam && s.team.length < 6) s.team.push(creature.uid)
    const species = CREATURE_BY_ID[creature.speciesId]
    s.codex[creature.speciesId] = { ...(s.codex[creature.speciesId] || {}), seen: true, caught: true, firstAt: s.codex[creature.speciesId]?.firstAt || Date.now() }
    if (countCapture) {
      s.stats.captures++
      s.stats.capturesByElement[species.element] = (s.stats.capturesByElement[species.element] || 0) + 1
      s.stats.capturesByRarity[species.rarity] = (s.stats.capturesByRarity[species.rarity] || 0) + 1
      if (['rain', 'storm', 'snow', 'sand'].includes(s.world.weather)) s.stats.weatherCaptures++
      emit('capture:success', { creature, species })
    }
    s.stats.maxLevel = Math.max(s.stats.maxLevel, creature.level)
    this.checkQuests()
    this.save()
    return creature
  }

  seeSpecies(speciesId) {
    if (!this.state.codex[speciesId]) this.state.codex[speciesId] = { seen: true, caught: false, firstAt: Date.now() }
    else this.state.codex[speciesId].seen = true
  }

  codexCount(caughtOnly = true) {
    return Object.values(this.state.codex).filter(e => caughtOnly ? e.caught : e.seen).length
  }

  gainXp(creature, amount, { silent = false } = {}) {
    const s = this.state
    let gained = 0
    const learned = []
    const levels = []
    creature.xp += Math.max(1, Math.round(amount))
    while (creature.xp >= xpNeed(creature.level) && creature.level < 999) {
      creature.xp -= xpNeed(creature.level)
      creature.level++
      levels.push(creature.level)
      const before = new Set(creature.known)
      const known = learnableMoves(creature.speciesId, creature.level)
      for (const id of known) {
        if (!before.has(id) && !creature.known.includes(id)) {
          creature.known.push(id)
          learned.push(id)
          if (creature.moveset.length < 4) creature.moveset.push(id)
        }
      }
      const oldMax = creature.maxHp
      recalcCreature(creature, { keepRatio: true })
      creature.hp = Math.min(creature.maxHp, creature.hp + Math.max(0, creature.maxHp - oldMax))
      gained += 1
    }
    s.stats.maxLevel = Math.max(s.stats.maxLevel, creature.level)
    if (gained && !silent) {
      emit('level:up', { creature, levels, learned: learned.map(id => TECHNIQUES[id]).filter(Boolean) })
    }
    return { levels, learned, xp: creature.xp, leveled: gained }
  }

  evolutionReady(creature) {
    const species = CREATURE_BY_ID[creature.speciesId]
    return !!species?.next && creature.level >= (species.evoLevel || 999)
  }

  evolveCreature(uidValue, { silent = false } = {}) {
    const creature = this.getCreature(uidValue)
    if (!creature) return null
    const species = CREATURE_BY_ID[creature.speciesId]
    if (!species?.next || creature.level < (species.evoLevel || 999)) return null
    const oldSpecies = species
    const next = CREATURE_BY_ID[species.next]
    if (!next) return null
    creature.speciesId = next.id
    const known = learnableMoves(next.id, creature.level)
    for (const id of known) if (!creature.known.includes(id)) creature.known.push(id)
    if (creature.moveset.length < 4) {
      for (const id of known) {
        if (!creature.moveset.includes(id) && creature.moveset.length < 4) creature.moveset.push(id)
      }
    }
    const signature = `sig_${next.family}_${next.stage + 1}`
    if (TECHNIQUES[signature] && !creature.known.includes(signature)) {
      creature.known.push(signature)
      if (creature.moveset.length < 4) creature.moveset.push(signature)
    }
    const ratio = creature.hp / creature.maxHp
    recalcCreature(creature, { keepRatio: false })
    creature.hp = Math.max(1, Math.round(creature.maxHp * Math.max(ratio, 0.65)))
    creature.bond = clamp(creature.bond + 8, 0, 100)
    this.state.codex[next.id] = { seen: true, caught: true, firstAt: Date.now() }
    if (!silent) emit('creature:evolved', { creature, oldSpecies, newSpecies: next })
    emit('toast', { text: `¡${oldSpecies.name} ha evolucionado a ${next.name}!`, kind: 'evolve' })
    this.save()
    return { creature, oldSpecies, newSpecies: next }
  }

  setTeamOrder(uids) {
    const s = this.state
    const valid = uids.filter(id => s.team.includes(id)).slice(0, 6)
    for (const id of s.team) if (!valid.includes(id)) valid.push(id)
    s.team = [...new Set(valid)].slice(0, 6)
    this.save()
  }

  toggleTeam(uidValue) {
    const s = this.state
    if (s.team.includes(uidValue)) {
      if (s.team.length <= 1) return false
      s.team = s.team.filter(id => id !== uidValue)
    } else {
      if (s.team.length >= 6) return false
      s.team.push(uidValue)
    }
    this.save()
    return true
  }

  healTeam(announce = true, ratio = 1) {
    for (const c of this.state.roster) {
      c.hp = Math.min(c.maxHp, Math.max(c.hp, Math.round(c.maxHp * ratio)))
    }
    if (announce) emit('toast', { text: 'Tu equipo recupera energía en el Rancho Vértice.', kind: 'good' })
  }

  feedCreature(uidValue) {
    const c = this.getCreature(uidValue)
    if (!c) return null
    c.bond = clamp(c.bond + 6, 0, 100)
    c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.18))
    emit('toast', { text: `${displayName(c)} comparte una ración contigo. Vínculo +6.`, kind: 'good' })
    this.save()
    return c
  }

  trainCreature(uidValue) {
    const c = this.getCreature(uidValue)
    if (!c) return null
    const cost = 40 + c.level * 14
    if (this.state.player.coins < cost) {
      emit('toast', { text: 'No tienes suficientes monedas para entrenar.', kind: 'bad' })
      return null
    }
    this.state.player.coins -= cost
    const result = this.gainXp(c, 55 + c.level * 26)
    c.bond = clamp(c.bond + 4, 0, 100)
    emit('toast', { text: `Entrenamiento completado. ${displayName(c)} gana experiencia.`, kind: 'good' })
    this.checkQuests()
    this.save()
    return { creature: c, ...result, cost }
  }

  equipRelic(uidValue, relicId) {
    const c = this.getCreature(uidValue)
    if (!c || !this.state.relics.includes(relicId)) return false
    c.relic = relicId
    const oldRatio = c.hp / c.maxHp
    recalcCreature(c, { keepRatio: false })
    c.hp = Math.max(1, Math.round(c.maxHp * oldRatio))
    emit('toast', { text: `${displayName(c)} equipa ${RELIC_BY_ID[relicId].name}.`, kind: 'relic' })
    this.save()
    return true
  }

  unequipRelic(uidValue) {
    const c = this.getCreature(uidValue)
    if (!c) return false
    const ratio = c.hp / c.maxHp
    c.relic = null
    recalcCreature(c, { keepRatio: false })
    c.hp = Math.max(1, Math.round(c.maxHp * ratio))
    this.save()
    return true
  }

  useItemOutside(itemId, uidValue) {
    const s = this.state
    const item = ITEMS[itemId]
    const c = this.getCreature(uidValue)
    if (!item || !c || !s.inventory.items[itemId]) return null
    if (item.revive) {
      if (c.hp > 0) return null
      c.hp = Math.round(c.maxHp * item.revive)
    } else {
      if (c.hp <= 0) return null
      c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * (item.heal || 0)))
      if (item.bond) c.bond = clamp(c.bond + item.bond, 0, 100)
    }
    s.inventory.items[itemId]--
    emit('toast', { text: `${item.name} usado en ${displayName(c)}.`, kind: 'good' })
    this.save()
    return c
  }

  // ---------- shop ----------

  buy(kind, id, qty = 1) {
    const s = this.state
    let price = 0, label = ''
    if (kind === 'trap') {
      const trap = TRAPS.find(t => t.id === id)
      if (!trap) return false
      price = trap.cost * qty
      label = trap.name
    } else if (kind === 'item') {
      const item = ITEMS[id]
      if (!item) return false
      price = item.price * qty
      label = item.name
    } else if (kind === 'relic') {
      const relic = RELIC_BY_ID[id]
      if (!relic) return false
      price = { raro: 700, epico: 1400, legendario: 3000 }[relic.rarity] || 1000
      label = relic.name
    } else return false
    if (s.player.coins < price) {
      emit('toast', { text: 'No tienes suficientes monedas.', kind: 'bad' })
      return false
    }
    s.player.coins -= price
    if (kind === 'trap') s.inventory.traps[id] = (s.inventory.traps[id] || 0) + qty
    if (kind === 'item') s.inventory.items[id] = (s.inventory.items[id] || 0) + qty
    if (kind === 'relic') s.relics.push(id)
    emit('toast', { text: `Compraste ${label}.`, kind: 'good' })
    this.save()
    return true
  }

  // ---------- quests ----------

  sideBase() {
    const s = this.state
    return {
      captures: s.stats.captures,
      arenaWins: s.stats.arenaWins,
      relics: s.stats.relicsFound,
      weather: s.stats.weatherCaptures,
      rarity: this.highRarityCaptures(),
      elements: { ...s.stats.capturesByElement },
      dungeons: [...s.stats.dungeonClears],
      targetClears: {},
    }
  }

  highRarityCaptures(minRarity = 'raro') {
    const s = this.state
    return Object.entries(s.stats.capturesByRarity)
      .filter(([r]) => rarityRank(r) >= rarityRank(minRarity))
      .reduce((sum, [, n]) => sum + n, 0)
  }

  startSideQuest(id) {
    const s = this.state
    const q = SIDEQUEST_BY_ID[id]
    if (!q || s.quests.side[id]) return false
    s.quests.side[id] = { status: 'active', startedAt: Date.now(), ready: false, base: this.sideBase() }
    emit('toast', { text: `Nueva misión: ${q.title}`, kind: 'quest' })
    this.save()
    return true
  }

  sideProgress(id) {
    const s = this.state
    const q = SIDEQUEST_BY_ID[id]
    const data = s.quests.side[id]
    if (!q || !data) return { current: 0, target: 1, ready: false }
    const b = data.base || this.sideBase()
    let current = 0, target = q.count || 1
    if (q.type === 'captureElement') {
      current = (s.stats.capturesByElement[q.element] || 0) - (b.elements?.[q.element] || 0)
      target = q.count
    } else if (q.type === 'arenaWins') {
      current = s.stats.arenaWins - b.arenaWins
      target = q.count
    } else if (q.type === 'dungeon') {
      const before = b.dungeons?.includes(q.target) ? 1 : 0
      current = s.stats.dungeonClears.includes(q.target) ? Math.max(1, 1 - before) : 0
      target = 1
    } else if (q.type === 'relics') {
      current = s.stats.relicsFound - b.relics
      target = q.count
    } else if (q.type === 'weatherCapture') {
      current = s.stats.weatherCaptures - b.weather
      target = q.count
    } else if (q.type === 'captureRarity') {
      current = this.highRarityCaptures(q.minRarity) - b.rarity
      target = q.count
    } else if (q.type === 'codex') {
      current = this.codexCount(true)
      target = q.count
    } else if (q.type === 'level') {
      current = this.maxLevel()
      target = q.count
    } else if (q.type === 'dungeons') {
      current = new Set(s.stats.dungeonClears).size
      target = q.count
    }
    return { current: clamp(current, 0, target), target, ready: current >= target }
  }

  checkQuests() {
    const s = this.state
    if (!s) return
    for (const [id, data] of Object.entries(s.quests.side)) {
      if (data.status !== 'active') continue
      const p = this.sideProgress(id)
      if (p.ready && !data.ready) {
        data.ready = true
        const q = SIDEQUEST_BY_ID[id]
        emit('toast', { text: `Misión lista para entregar: ${q.title}`, kind: 'quest' })
      }
    }
    const chapter = CHAPTERS[s.quests.main]
    if (!chapter) return
    if (chapter.type === 'talk') return
    let ready = false
    if (chapter.type === 'captures') ready = s.stats.captures >= chapter.count
    if (chapter.type === 'dungeon') ready = s.stats.dungeonClears.includes(chapter.target)
    if (chapter.type === 'arenaWins') ready = s.stats.arenaWins >= chapter.count
    if (chapter.type === 'weatherCapture') ready = s.stats.weatherCaptures >= chapter.count
    if (chapter.type === 'relics') ready = s.stats.relicsFound >= chapter.count
    if (ready && !s.quests.ready) {
      s.quests.ready = chapter.id
      emit('toast', { text: `Objetivo principal completado: ${chapter.title}`, kind: 'quest' })
      if (!s.battle && !s.dungeon) {
        setTimeout(() => this.completeMainChapter(), 1300)
      }
    }
  }

  completeMainChapter() {
    const s = this.state
    if (!s || s.quests.advancing) return null
    const chapter = CHAPTERS[s.quests.main]
    if (!chapter) return null
    s.quests.advancing = true
    this.applyReward(chapter.reward, false)
    s.quests.completed.push(chapter.id)
    s.quests.main++
    s.quests.ready = null
    if (chapter.id === 9) {
      s.flags.ending = true
      s.player.title = chapter.reward.title || 'Guardián del Nexo'
    }
    const next = CHAPTERS[s.quests.main] || null
    emit('story:chapter', { chapter, next })
    setTimeout(() => { if (this.state) this.state.quests.advancing = false }, 600)
    this.save()
    return { chapter, next }
  }

  talkToMainNPC(npcId) {
    const s = this.state
    const chapter = CHAPTERS[s.quests.main]
    if (!chapter) return false
    if (chapter.type === 'talk' && chapter.target === npcId) {
      this.completeMainChapter()
      return true
    }
    return false
  }

  interactNPC(npcId) {
    const s = this.state
    const npc = s.npcs.find(n => n.id === npcId)
    if (!npc) return { lines: [] }
    if (this.talkToMainNPC(npcId)) {
      return { lines: [`${npc.name}: El Nexo te ha reconocido, ${s.player.name}.`], kind: 'main' }
    }
    const q = SIDEQUEST_BY_ID[npc.quest]
    if (q) {
      const data = s.quests.side[q.id]
      if (!data) {
        this.startSideQuest(q.id)
        return { lines: [`${npc.name}: ${q.desc}`, 'Acepta la misión en tu Diario.'], kind: 'quest-start', quest: q }
      }
      if (data.status === 'done') return { lines: [`${npc.name}: Gracias de nuevo. Vértice está un poco más seguro.`], kind: 'done' }
      const p = this.sideProgress(q.id)
      if (data.ready) {
        this.turnInSideQuest(q.id)
        return { lines: [`${npc.name}: Sabía que podía contar contigo.`], kind: 'quest-done', quest: q }
      }
      return { lines: [`${npc.name}: ${q.desc}`, `Progreso: ${p.current} / ${p.target}.`], kind: 'quest-progress', quest: q, progress: p }
    }
    return { lines: [`${npc.name}: ${pick(npc.lines)}`], kind: 'flavor' }
  }

  turnInSideQuest(id) {
    const s = this.state
    const q = SIDEQUEST_BY_ID[id]
    const data = s.quests.side[id]
    if (!q || !data || !data.ready) return false
    data.status = 'done'
    data.ready = false
    data.doneAt = Date.now()
    s.quests.completed.push(id)
    this.applyReward(q.reward)
    emit('toast', { text: `Misión completada: ${q.title}`, kind: 'quest' })
    this.save()
    return true
  }

  applyReward(reward = {}, announce = true) {
    const s = this.state
    if (!reward) return
    if (reward.coins) s.player.coins += reward.coins
    if (reward.shards) { s.player.shards += reward.shards; s.stats.shardsFound += reward.shards }
    if (reward.traps) for (const [id, n] of Object.entries(reward.traps)) s.inventory.traps[id] = (s.inventory.traps[id] || 0) + n
    if (reward.items) for (const [id, n] of Object.entries(reward.items)) s.inventory.items[id] = (s.inventory.items[id] || 0) + n
    if (reward.xp) {
      for (const c of this.getTeam()) this.gainXp(c, reward.xp, { silent: true })
    }
    if (reward.title) s.player.title = reward.title
    if (announce) emit('toast', { text: 'Recompensas recibidas.', kind: 'good' })
  }

  mainProgress() {
    const s = this.state
    const chapter = CHAPTERS[s.quests.main]
    if (!chapter) return { current: 1, target: 1, ready: true }
    if (chapter.type === 'talk') return { current: 0, target: 1, ready: false }
    let current = 0, target = chapter.count || 1
    if (chapter.type === 'captures') current = s.stats.captures
    if (chapter.type === 'dungeon') current = s.stats.dungeonClears.includes(chapter.target) ? 1 : 0
    if (chapter.type === 'arenaWins') current = s.stats.arenaWins
    if (chapter.type === 'weatherCapture') current = s.stats.weatherCaptures
    if (chapter.type === 'relics') current = s.stats.relicsFound
    return { current: Math.min(current, target), target, ready: current >= target }
  }

  // ---------- battle ----------

  makeEnemy(speciesId, level, opts = {}) {
    const creature = createCreature(speciesId, level, { origin: opts.origin || 'enemy', bond: 20 })
    creature.nickname = opts.nickname || null
    if (opts.shiny) creature.shiny = true
    return creature
  }

  startWildBattle(wildUid) {
    const s = this.state
    const wild = s.world.spawns.find(w => w.uid === wildUid)
    if (!wild) return null
    if (!this.getTeam().some(c => c.hp > 0)) {
      emit('toast', { text: 'Tu equipo está agotado. Descansa en el Rancho.', kind: 'bad' })
      return null
    }
    const enemy = this.makeEnemy(wild.speciesId, wild.level, { shiny: chance(0.04) })
    this.seeSpecies(wild.speciesId)
    return this.beginBattle({
      enemyTeam: [enemy], mode: 'wild', canCapture: true,
      context: { wildUid, zone: wild.zone }, zone: wild.zone,
    })
  }

  beginBattle({ enemyTeam, mode, canCapture = false, context = {}, zone, trainer = null }) {
    const s = this.state
    const team = this.getTeam()
    const firstIndex = Math.max(0, team.findIndex(c => c.hp > 0))
    if (firstIndex < 0) return null
    const activeEnemy = enemyTeam.find(c => c.hp > 0)
    if (!activeEnemy) return null
    s.stats.battles++
    s.battle = {
      id: uid('battle'),
      mode,
      context,
      canCapture,
      zone: zone || s.world.lastZone,
      weather: s.world.weather,
      trainer,
      playerTeam: team,
      playerIndex: firstIndex,
      enemyTeam,
      enemyIndex: Math.max(0, enemyTeam.findIndex(c => c.hp > 0)),
      turn: 1,
      over: false,
      result: null,
      status: { player: null, enemy: null },
      buffs: { player: {}, enemy: {} },
      log: [],
      startedAt: Date.now(),
      captured: false,
    }
    emit('battle:start', { battle: s.battle })
    return s.battle
  }

  battleActive(side) {
    const b = this.state.battle
    if (!b) return null
    return side === 'player' ? b.playerTeam[b.playerIndex] : b.enemyTeam[b.enemyIndex]
  }

  battleStats(side) {
    const b = this.state.battle
    const c = this.battleActive(side)
    if (!c) return { atk: 1, def: 1, spd: 1, maxHp: 1 }
    const base = statsForCreature(c)
    const buffs = b.buffs[side] || {}
    const stat = (key) => {
      let value = base[key]
      if (buffs[key]) value *= 1 + buffs[key].amount
      return Math.max(1, Math.round(value))
    }
    return { ...base, atk: stat('atk'), def: stat('def'), spd: stat('spd') }
  }

  battleLog(text, events, kind = 'info') {
    const b = this.state.battle
    if (b) b.log.push({ text, kind, turn: b.turn })
    events.push({ type: 'log', text, kind })
  }

  computeDamage(attackerSide, targetSide, move) {
    const b = this.state.battle
    const attacker = this.battleActive(attackerSide)
    const target = this.battleActive(targetSide)
    if (!attacker || !target) return { damage: 0, mult: 1, crit: false }
    const aStats = this.battleStats(attackerSide)
    const dStats = this.battleStats(targetSide)
    const power = move.scaling ? move.power + attacker.level * 0.6 : (move.power || 40)
    const pierce = move.pierce || 0
    const def = Math.max(1, dStats.def * (1 - pierce))
    let damage = (((2 * attacker.level / 5 + 2) * power * aStats.atk / def) / 50 + 2)
    const mult = elementMultiplier(move.element, CREATURE_BY_ID[target.speciesId].element)
    damage *= mult
    const crit = chance(0.075)
    if (crit) damage *= 1.6
    damage *= rand(0.9, 1.1)
    const relicDmg = attacker.relic ? (RELIC_BY_ID[attacker.relic]?.bonus?.dmg || 0) + (RELIC_BY_ID[attacker.relic]?.bonus?.all || 0) : 0
    if (relicDmg && (RELIC_BY_ID[attacker.relic]?.element === move.element || RELIC_BY_ID[attacker.relic]?.bonus?.all)) damage *= 1 + relicDmg
    const shield = b.buffs[targetSide]?.shield
    if (shield) damage *= 1 - shield.amount
    return { damage: Math.max(1, Math.round(damage)), mult, crit }
  }

  applyStatus(side, type, turns, extra = {}) {
    const b = this.state.battle
    if (!b) return
    b.status[side] = { type, turns, ...extra }
    if (type === 'ralentizado') b.buffs[side].spd = { amount: -0.3, turns }
  }

  executeAttack(side, moveId, events) {
    const b = this.state.battle
    const attacker = this.battleActive(side)
    const targetSide = side === 'player' ? 'enemy' : 'player'
    const target = this.battleActive(targetSide)
    if (!attacker || !target || b.over) return
    const move = TECHNIQUES[moveId]
    if (!move) return
    const aName = displayName(attacker)
    const tName = displayName(target)

    if (b.status[side]?.type === 'aturdido' && chance(0.5)) {
      b.status[side].turns--
      this.battleLog(`${aName} está aturdido y pierde el turno.`, events, 'status')
      if (b.status[side].turns <= 0) b.status[side] = null
      return
    }

    if (move.kind === 'heal') {
      const amount = Math.round(attacker.maxHp * move.amount)
      const before = attacker.hp
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + amount)
      const healed = attacker.hp - before
      this.battleLog(`${aName} usa ${move.name} y recupera ${healed} PS.`, events, 'heal')
      events.push({ type: 'heal', side, amount: healed, hpBefore: before, hpAfter: attacker.hp, move })
      return
    }

    if (move.kind === 'buff') {
      b.buffs[side][move.stat] = { amount: move.amount, turns: move.turns }
      this.battleLog(`${aName} usa ${move.name}. ${move.desc}`, events, 'buff')
      events.push({ type: 'buff', side, move, stats: this.battleStats(side) })
      return
    }

    if (move.kind === 'shield') {
      b.buffs[side].shield = { amount: move.amount, turns: move.turns }
      this.battleLog(`${aName} crea ${move.name}.`, events, 'buff')
      events.push({ type: 'buff', side, move })
      return
    }

    if (move.kind === 'debuff') {
      b.buffs[targetSide][move.stat] = { amount: move.amount, turns: move.turns }
      this.battleLog(`${aName} usa ${move.name} sobre ${tName}.`, events, 'debuff')
      events.push({ type: 'debuff', side: targetSide, move })
      return
    }

    if (move.kind === 'drain' || move.kind === 'attack') {
      const accuracy = move.accuracy ?? 95
      if (!chance(accuracy / 100)) {
        this.battleLog(`${aName} usa ${move.name}, pero falla.`, events, 'miss')
        events.push({ type: 'miss', side, move })
        return
      }
      const { damage, mult, crit } = this.computeDamage(side, targetSide, move)
      const hpBefore = target.hp
      target.hp = Math.max(0, target.hp - damage)
      this.battleLog(`${aName} usa ${move.name}. ${damage} de daño${crit ? ' ¡Crítico!' : ''}${mult > 1.5 ? ' ¡Muy eficaz!' : mult < 0.7 ? ' Poco eficaz…' : ''}`, events, 'attack')
      events.push({ type: 'attack', side, targetSide, move, damage, hpBefore, hpAfter: target.hp, crit, mult, effectiveness: mult > 1.5 ? 'super' : mult < 0.7 ? 'weak' : 'normal' })
      if (move.kind === 'drain') {
        const heal = Math.max(1, Math.round(damage * 0.5))
        const before = attacker.hp
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal)
        this.battleLog(`${aName} absorbe ${attacker.hp - before} PS.`, events, 'heal')
        events.push({ type: 'heal', side, amount: attacker.hp - before, hpBefore: before, hpAfter: attacker.hp, move })
      }
      // Elemental after-effects
      if (target.hp > 0) {
        const statusRoll = chance(0.16)
        if (statusRoll) {
          if (move.element === 'fuego') { this.applyStatus(targetSide, 'quemado', 3); this.battleLog(`${tName} queda quemado.`, events, 'status') }
          else if (move.element === 'veneno') { this.applyStatus(targetSide, 'envenenado', 4); this.battleLog(`${tName} queda envenenado.`, events, 'status') }
          else if (move.element === 'hielo') { this.applyStatus(targetSide, 'ralentizado', 2); this.battleLog(`${tName} queda ralentizado.`, events, 'status') }
          else if (move.element === 'rayo') { this.applyStatus(targetSide, 'aturdido', 1); this.battleLog(`${tName} queda aturdido.`, events, 'status') }
          else if (move.element === 'sombra') { b.buffs[targetSide].atk = { amount: -0.18, turns: 3 }; this.battleLog(`La sombra debilita a ${tName}.`, events, 'status') }
          else if (move.element === 'luz') { b.buffs[targetSide].def = { amount: -0.14, turns: 3 }; this.battleLog(`La luz quiebra la guardia de ${tName}.`, events, 'status') }
          else if (move.element === 'tierra') { b.buffs[targetSide].spd = { amount: -0.2, turns: 3 }; this.battleLog(`${tName} pierde velocidad.`, events, 'status') }
        }
      }
      return
    }
  }

  enemyChooseMove() {
    const b = this.state.battle
    const enemy = this.battleActive('enemy')
    if (!enemy) return null
    const moves = enemy.moveset.map(id => TECHNIQUES[id]).filter(Boolean)
    const attacks = moves.filter(m => m.kind === 'attack' || m.kind === 'drain')
    const heals = moves.filter(m => m.kind === 'heal')
    const buffs = moves.filter(m => m.kind === 'buff' || m.kind === 'shield')
    if (enemy.hp / enemy.maxHp < 0.34 && heals.length && chance(0.45)) return pick(heals)
    if (!b.buffs.enemy.atk && buffs.length && chance(0.18)) return pick(buffs)
    if (!attacks.length) return moves[0] || null
    return weightedPick(attacks, (m) => {
      const power = movePowerForDisplay(m.id, enemy.level)
      return Math.max(4, power / 18)
    })
  }

  endOfTurn(events) {
    const b = this.state.battle
    if (!b || b.over) return
    for (const side of ['player', 'enemy']) {
      const status = b.status[side]
      if (!status) continue
      if (status.type === 'quemado' || status.type === 'envenenado') {
        const c = this.battleActive(side)
        if (c && c.hp > 0) {
          const dmg = Math.max(1, Math.round(c.maxHp * (status.type === 'quemado' ? 0.055 : 0.045)))
          c.hp = Math.max(0, c.hp - dmg)
          this.battleLog(`${displayName(c)} sufre ${dmg} de daño por ${status.type}.`, events, 'status')
          events.push({ type: 'statusDamage', side, amount: dmg, hpAfter: c.hp, status: status.type })
        }
      }
      status.turns--
      if (status.turns <= 0) b.status[side] = null
      for (const [key, buff] of Object.entries(b.buffs[side])) {
        buff.turns--
        if (buff.turns <= 0) delete b.buffs[side][key]
      }
    }
    this.checkFaints(events)
  }

  checkFaints(events) {
    const b = this.state.battle
    if (!b || b.over) return
    for (const side of ['player', 'enemy']) {
      const active = this.battleActive(side)
      if (active && active.hp <= 0) {
        this.battleLog(`${displayName(active)} ha caído.`, events, 'faint')
        events.push({ type: 'faint', side, name: displayName(active) })
        const team = side === 'player' ? b.playerTeam : b.enemyTeam
        const nextIndex = team.findIndex((c, i) => c.hp > 0 && i !== (side === 'player' ? b.playerIndex : b.enemyIndex))
        if (nextIndex >= 0) {
          if (side === 'player') b.playerIndex = nextIndex
          else b.enemyIndex = nextIndex
          b.status[side] = null
          b.buffs[side] = {}
          const next = team[nextIndex]
          this.battleLog(`${displayName(next)} entra al combate.`, events, 'switch')
          events.push({ type: 'switch', side, name: displayName(next), hpAfter: next.hp, maxHp: next.maxHp, level: next.level, speciesId: next.speciesId })
        } else {
          const result = side === 'player' ? 'loss' : 'win'
          this.endBattle(result, events)
          return
        }
      }
    }
  }

  endBattle(result, events = []) {
    const b = this.state.battle
    if (!b || b.over) return
    b.over = true
    b.result = result
    const text = result === 'win' ? '¡Has ganado el combate!' : result === 'loss' ? 'Tu equipo ha caído…' : result === 'captured' ? '¡Captura exitosa!' : result === 'fled' ? 'Has escapado.' : 'Fin del combate.'
    this.battleLog(text, events, 'end')
    events.push({ type: 'end', result, text })
  }

  playerMove(moveId) {
    const b = this.state.battle
    if (!b || b.over) return []
    const events = []
    const player = this.battleActive('player')
    const enemy = this.battleActive('enemy')
    if (!player || !enemy) return events
    const pSpd = this.battleStats('player').spd
    const eSpd = this.battleStats('enemy').spd
    const enemyFirst = eSpd > pSpd
    if (enemyFirst) {
      const enemyMove = this.enemyChooseMove()
      if (enemyMove) this.executeAttack('enemy', enemyMove.id, events)
      this.checkFaints(events)
      if (b.over) return this.finishTurn(events)
      if (this.battleActive('player')?.hp > 0) this.executeAttack('player', moveId, events)
    } else {
      this.executeAttack('player', moveId, events)
      this.checkFaints(events)
      if (b.over) return this.finishTurn(events)
      if (this.battleActive('enemy')?.hp > 0) {
        const enemyMove = this.enemyChooseMove()
        if (enemyMove) this.executeAttack('enemy', enemyMove.id, events)
      }
    }
    this.endOfTurn(events)
    return this.finishTurn(events)
  }

  finishTurn(events) {
    const b = this.state.battle
    if (b) b.turn++
    if (!b?.over) events.push({ type: 'turn', turn: b.turn })
    return events
  }

  playerItem(itemId, targetUid) {
    const b = this.state.battle
    if (!b || b.over) return []
    const s = this.state
    const events = []
    const item = ITEMS[itemId]
    const target = targetUid ? this.getCreature(targetUid) : this.battleActive('player')
    if (!item || !target || !s.inventory.items[itemId]) return events
    s.inventory.items[itemId]--
    if (item.revive) {
      if (target.hp > 0) {
        s.inventory.items[itemId]++
        emit('toast', { text: 'Esa criatura no está debilitada.', kind: 'bad' })
        return events
      }
      target.hp = Math.round(target.maxHp * item.revive)
      this.battleLog(`Usas ${item.name}. ${displayName(target)} vuelve al combate.`, events, 'item')
      events.push({ type: 'item', item, targetName: displayName(target), hpAfter: target.hp })
    } else {
      if (target.hp <= 0) {
        s.inventory.items[itemId]++
        return events
      }
      const before = target.hp
      target.hp = Math.min(target.maxHp, target.hp + Math.round(target.maxHp * (item.heal || 0)))
      this.battleLog(`Usas ${item.name} en ${displayName(target)}. +${target.hp - before} PS.`, events, 'item')
      events.push({ type: 'item', item, targetName: displayName(target), hpBefore: before, hpAfter: target.hp })
    }
    if (this.battleActive('enemy')?.hp > 0) {
      const enemyMove = this.enemyChooseMove()
      if (enemyMove) this.executeAttack('enemy', enemyMove.id, events)
    }
    this.endOfTurn(events)
    return this.finishTurn(events)
  }

  playerSwitch(uidValue) {
    const b = this.state.battle
    if (!b || b.over) return []
    const s = this.state
    const idx = b.playerTeam.findIndex(c => c.uid === uidValue)
    if (idx < 0 || idx === b.playerIndex) return []
    const next = b.playerTeam[idx]
    if (!next || next.hp <= 0) return []
    const events = []
    const old = this.battleActive('player')
    b.playerIndex = idx
    b.status.player = null
    b.buffs.player = {}
    this.battleLog(`Cambias a ${displayName(old)} por ${displayName(next)}.`, events, 'switch')
    events.push({ type: 'switch', side: 'player', name: displayName(next), hpAfter: next.hp, maxHp: next.maxHp, level: next.level, speciesId: next.speciesId })
    if (this.battleActive('enemy')?.hp > 0) {
      const enemyMove = this.enemyChooseMove()
      if (enemyMove) this.executeAttack('enemy', enemyMove.id, events)
    }
    this.endOfTurn(events)
    return this.finishTurn(events)
  }

  captureChance(trapId, enemy = null) {
    const s = this.state
    const b = s.battle
    const trap = TRAPS.find(t => t.id === trapId)
    if (!trap || !b) return { chance: 0, trap, factors: {} }
    const target = enemy || this.battleActive('enemy')
    const player = this.battleActive('player')
    if (!target || !player) return { chance: 0, trap, factors: {} }
    const species = CREATURE_BY_ID[target.speciesId]
    const hpRatio = target.hp / target.maxHp
    const rarity = RARITIES[species.rarity]
    const levelFactor = clamp(1 - (target.level - player.level) / 45, 0.38, 1.18)
    const hpBonus = (1 - hpRatio) * 0.55
    const trapBonus = trap.bonus
    const relicCapture = player.relic ? (RELIC_BY_ID[player.relic]?.bonus?.capture || 0) + (RELIC_BY_ID[player.relic]?.bonus?.all || 0) : 0
    let value = (trapBonus + hpBonus) * rarity.catch * levelFactor + relicCapture
    if (s.world.weather === 'storm') value -= 0.035
    if (s.world.weather === 'eclipse') value += 0.04
    value = clamp(value, 0.02, 0.97)
    return {
      chance: value,
      trap,
      factors: { hpRatio, rarity: rarity.name, levelFactor, trapBonus, relicCapture },
    }
  }

  playerCapture(trapId) {
    const b = this.state.battle
    if (!b || b.over || !b.canCapture) return []
    const s = this.state
    const events = []
    if (!s.inventory.traps[trapId]) {
      emit('toast', { text: 'No te quedan trampas de ese tipo.', kind: 'bad' })
      return events
    }
    const { chance: catchChance } = this.captureChance(trapId)
    s.inventory.traps[trapId]--
    const trap = TRAPS.find(t => t.id === trapId)
    this.battleLog(`Lanzas ${trap.name}… (${pct(catchChance)} de probabilidad)`, events, 'capture')
    events.push({ type: 'captureThrow', trap, chance: catchChance })
    const success = chance(catchChance)
    if (success) {
      const enemy = this.battleActive('enemy')
      const species = CREATURE_BY_ID[enemy.speciesId]
      const captured = createCreature(enemy.speciesId, enemy.level, {
        nickname: null, moveset: enemy.moveset, bond: 8, shiny: enemy.shiny, origin: 'captured',
      })
      this.addCreature(captured, { toTeam: true, countCapture: true })
      b.captured = true
      this.battleLog(`¡${species.name} ha sido capturada!`, events, 'capture-success')
      events.push({ type: 'captureSuccess', creature: captured, species, trap })
      this.endBattle('captured', events)
      this.finishTurn(events)
      return events
    }
    this.battleLog(`La trampa se rompe. ${displayName(this.battleActive('enemy'))} contraataca.`, events, 'capture-fail')
    events.push({ type: 'captureFail', trap })
    if (this.battleActive('enemy')?.hp > 0) {
      const enemyMove = this.enemyChooseMove()
      if (enemyMove) this.executeAttack('enemy', enemyMove.id, events)
    }
    this.endOfTurn(events)
    return this.finishTurn(events)
  }

  playerFlee() {
    const b = this.state.battle
    if (!b || b.over) return []
    const events = []
    if (b.mode === 'arena' || b.mode === 'invite') {
      this.battleLog('No puedes huir de un duelo oficial.', events, 'flee')
      return events
    }
    const pSpd = this.battleStats('player').spd
    const eSpd = this.battleStats('enemy').spd
    const escapeChance = clamp(0.52 + (pSpd - eSpd) / 200, 0.22, 0.94)
    if (chance(escapeChance)) {
      this.battleLog('Escapas con éxito.', events, 'flee')
      events.push({ type: 'flee', success: true })
      this.endBattle('fled', events)
      return this.finishTurn(events)
    }
    this.battleLog('No consigues escapar.', events, 'flee')
    events.push({ type: 'flee', success: false })
    if (this.battleActive('enemy')?.hp > 0) {
      const enemyMove = this.enemyChooseMove()
      if (enemyMove) this.executeAttack('enemy', enemyMove.id, events)
    }
    this.endOfTurn(events)
    return this.finishTurn(events)
  }

  finishBattle() {
    const s = this.state
    const b = s.battle
    if (!b) return null
    const result = b.result
    const active = b.playerTeam[b.playerIndex]
    const enemy = b.enemyTeam[b.enemyIndex]
    const rewards = { xp: 0, coins: 0, shards: 0, levels: [], learned: [], evolutions: [], items: [] }
    if (result === 'win' || result === 'captured') {
      const enemyLevel = enemy?.level || 1
      const enemyRarity = CREATURE_BY_ID[enemy?.speciesId]?.rarity || 'comun'
      const rarityMult = RARITIES[enemyRarity].mult
      let xpTotal = Math.round((24 + enemyLevel * 7.5) * rarityMult)
      if (b.mode === 'arena' || b.mode === 'invite') xpTotal = Math.round(xpTotal * 1.25)
      if (b.mode === 'dungeon') xpTotal = Math.round(xpTotal * 1.15)
      rewards.xp = xpTotal
      rewards.coins = Math.round((14 + enemyLevel * 4.2) * rarityMult) + (b.mode === 'arena' ? 90 : 0)
      if (b.mode === 'arena') {
        s.stats.arenaWins++
        s.player.wins++
        s.player.rank += 26
        s.player.title = this.rankTitle(s.player.rank)
        rewards.rank = 26
      } else if (b.mode === 'invite') {
        s.stats.pvpWins++
        s.player.wins++
        s.player.rank += 18
        rewards.rank = 18
      } else if (b.mode === 'wild') {
        s.stats.wildDefeats++
        if (chance(0.26)) {
          const trap = pick(TRAPS.slice(0, 4))
          s.inventory.traps[trap.id] = (s.inventory.traps[trap.id] || 0) + 1
          rewards.items.push({ type: 'trap', item: trap })
        }
      }
      if (chance(0.35)) {
        const n = randInt(1, 3)
        s.player.shards += n
        s.stats.shardsFound += n
        rewards.shards += n
      }
      s.player.coins += rewards.coins
      const team = this.getTeam().filter(c => c.hp > 0)
      for (const c of team) {
        const xp = Math.round(rewards.xp * (c.uid === active?.uid ? 1 : 0.62) * (1 + (c.relic ? (RELIC_BY_ID[c.relic]?.bonus?.xp || 0) : 0)))
        const gained = this.gainXp(c, xp)
        if (gained.leveled) {
          rewards.levels.push({ creature: c, levels: gained.levels, learned: gained.learned.map(id => TECHNIQUES[id]).filter(Boolean) })
        }
        if (this.evolutionReady(c)) rewards.evolutions.push(c)
      }
      this.checkQuests()
    } else if (result === 'loss') {
      if (b.mode === 'arena') {
        s.stats.arenaLosses++
        s.player.losses++
        s.player.rank = Math.max(0, s.player.rank - 14)
        rewards.rank = -14
      } else if (b.mode === 'invite') {
        s.stats.pvpLosses++
        s.player.losses++
      }
      const lossCoins = Math.min(s.player.coins, Math.round(12 + (enemy?.level || 1) * 2.5))
      s.player.coins -= lossCoins
      rewards.coins = -lossCoins
      if (b.mode === 'dungeon') {
        this.failDungeon()
      }
    }
    if (b.mode === 'dungeon') this.resolveDungeonBattle(b, result)
    if ((result === 'win' || result === 'captured') && b.context?.wildUid) {
      s.world.spawns = s.world.spawns.filter(w => w.uid !== b.context.wildUid)
    }
    s.battle = null
    s.stats.maxLevel = Math.max(s.stats.maxLevel, ...s.roster.map(c => c.level))
    this.save()
    const detail = { result, rewards, mode: b.mode, battle: b }
    emit('battle:finished', detail)
    return detail
  }

  rankTitle(rank) {
    if (rank >= 1800) return 'Leyenda del Nexo'
    if (rank >= 1500) return 'Maestro de la Arena'
    if (rank >= 1300) return 'Campeón de Cristal'
    if (rank >= 1150) return 'Duelista Veterano'
    if (rank >= 1000) return 'Guardián'
    return 'Novato del Nexo'
  }

  // ---------- arena / invites ----------

  makeTrainerTeam(trainer, level) {
    const team = []
    for (const baseId of trainer.team) {
      const base = CREATURE_BY_ID[baseId]
      if (!base) continue
      let speciesId = baseId
      if (level < 16) speciesId = `${base.family}-1`
      else if (level < 36) speciesId = `${base.family}-2`
      else speciesId = `${base.family}-3`
      if (!CREATURE_BY_ID[speciesId]) speciesId = baseId
      team.push(this.makeEnemy(speciesId, level + randInt(-1, 2), { origin: 'arena' }))
    }
    return team
  }

  startArenaBattle(trainerIndex = null) {
    const s = this.state
    if (!this.getTeam().some(c => c.hp > 0)) {
      emit('toast', { text: 'Tu equipo necesita descansar antes de entrar al Coliseo.', kind: 'bad' })
      return null
    }
    const trainer = trainerIndex == null ? pick(TRAINERS) : TRAINERS[trainerIndex % TRAINERS.length]
    const level = Math.max(8, this.maxLevel() + randInt(0, 2))
    const enemyTeam = this.makeTrainerTeam(trainer, level)
    emit('toast', { text: `NexoLink: ${trainer.name} ha aceptado tu desafío.`, kind: 'arena' })
    return this.beginBattle({
      enemyTeam, mode: 'arena', canCapture: false,
      context: { trainerName: trainer.name, trainerTitle: trainer.title },
      zone: 'pradera', trainer,
    })
  }

  createInvite() {
    const s = this.state
    const payload = {
      v: 1,
      n: s.player.name,
      t: this.getTeam().map(serializeCreature),
      r: s.player.rank,
      title: s.player.title,
      ts: Date.now(),
    }
    return encodeInvite(payload)
  }

  acceptInvite(code) {
    const s = this.state
    const data = decodeInvite(code)
    if (!data || !Array.isArray(data.t) || !data.t.length) {
      emit('toast', { text: 'Código de invitación inválido.', kind: 'bad' })
      return null
    }
    if (!this.getTeam().some(c => c.hp > 0)) {
      emit('toast', { text: 'Tu equipo está agotado. Descansa antes del duelo.', kind: 'bad' })
      return null
    }
    const enemyTeam = data.t.slice(0, 6).map(entry => {
      const c = creatureFromInvite(entry)
      c.nickname = entry.n || null
      return c
    }).filter(Boolean)
    const trainer = { name: data.n || 'Guardián invitado', title: data.title || 'Invitado del Nexo' }
    emit('toast', { text: `Duelo por invitación: ${trainer.name} te desafía.`, kind: 'arena' })
    return this.beginBattle({
      enemyTeam, mode: 'invite', canCapture: false,
      context: { invite: true, trainerName: trainer.name }, zone: 'pradera', trainer,
    })
  }

  // ---------- dungeons ----------

  dungeonAvailable(id) {
    const d = DUNGEONS[id]
    if (!d) return false
    if (id === 'nexo') return this.state.quests.main >= 9
    return true
  }

  enterDungeon(id) {
    const s = this.state
    const d = DUNGEONS[id]
    if (!d || !this.dungeonAvailable(id)) {
      emit('toast', { text: 'El acceso aún está sellado.', kind: 'bad' })
      return false
    }
    if (!this.getTeam().some(c => c.hp > 0)) {
      emit('toast', { text: 'Tu equipo está agotado. Descansa en el Rancho.', kind: 'bad' })
      return false
    }
    s.dungeon = {
      id,
      floor: 1,
      floors: d.floors,
      nodes: this.generateDungeonFloor(d, 1),
      pos: { x: 0, y: 3 },
      visited: ['0,3'],
      log: [`Entras en ${d.name}. ${d.desc}`],
      cleared: false,
      current: null,
      startedAt: Date.now(),
    }
    s.dungeon.nodes[3][0].visited = true
    s.dungeon.nodes[3][0].revealed = true
    this.revealAround(s.dungeon, 0, 3)
    emit('dungeon:enter', { dungeon: s.dungeon, meta: d })
    return true
  }

  generateDungeonFloor(dungeon, floor) {
    const nodes = []
    for (let y = 0; y < 4; y++) {
      nodes[y] = []
      for (let x = 0; x < 4; x++) {
        let type = 'battle'
        if (x === 0 && y === 3) type = 'start'
        else if (x === 3 && y === 0) type = 'boss'
        else {
          const r = Math.random()
          if (r < 0.32) type = 'battle'
          else if (r < 0.45) type = 'elite'
          else if (r < 0.61) type = 'chest'
          else if (r < 0.7) type = 'shrine'
          else if (r < 0.8) type = 'trap'
          else if (r < 0.9) type = 'lore'
          else type = 'battle'
        }
        nodes[y][x] = { x, y, type, revealed: false, visited: false, resolved: false, floor }
      }
    }
    return nodes
  }

  revealAround(dungeon, x, y) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (dungeon.nodes[ny]?.[nx]) dungeon.nodes[ny][nx].revealed = true
    }
  }

  dungeonNode(x, y) {
    return this.state.dungeon?.nodes?.[y]?.[x] || null
  }

  moveDungeon(x, y) {
    const s = this.state
    const d = s.dungeon
    if (!d) return { type: 'none' }
    const dist = Math.abs(d.pos.x - x) + Math.abs(d.pos.y - y)
    if (dist !== 1) return { type: 'invalid' }
    const node = this.dungeonNode(x, y)
    if (!node) return { type: 'invalid' }
    d.pos = { x, y }
    node.revealed = true
    d.visited.push(`${x},${y}`)
    this.revealAround(d, x, y)
    if (node.visited) return { type: 'visited', node }
    node.visited = true
    d.current = { x, y }
    if (node.type === 'boss' && !node.resolved) {
      this.startDungeonBattle(node, 'boss')
      return { type: 'battle', node }
    }
    if (node.type === 'elite' && !node.resolved) {
      this.startDungeonBattle(node, 'elite')
      return { type: 'battle', node }
    }
    if (node.type === 'battle' && !node.resolved) {
      this.startDungeonBattle(node, 'battle')
      return { type: 'battle', node }
    }
    const result = this.resolveDungeonNode(node)
    node.resolved = true
    emit('dungeon:node', { node, result, dungeon: d })
    this.save()
    return { type: 'resolved', node, result }
  }

  resolveDungeonNode(node) {
    const s = this.state
    const d = s.dungeon
    const meta = DUNGEONS[d.id]
    if (node.type === 'chest') {
      const roll = Math.random()
      if (roll < 0.35) {
        const relic = pick(RELICS.filter(r => r.rarity !== 'legendario' || d.floor >= 3))
        s.relics.push(relic.id)
        s.stats.relicsFound++
        s.player.coins += randInt(40, 120)
        d.log.push(`Cofre: ${relic.name}.`)
        emit('toast', { text: `Cofre raro: ${relic.name}`, kind: 'relic' })
        return { type: 'relic', relic }
      } else if (roll < 0.7) {
        const trap = pick(TRAPS.slice(1, 5))
        s.inventory.traps[trap.id] = (s.inventory.traps[trap.id] || 0) + 1
        const shards = randInt(1, 3)
        s.player.shards += shards
        s.stats.shardsFound += shards
        d.log.push(`Cofre: ${trap.name} y ${shards} fragmentos.`)
        emit('toast', { text: `Cofre: ${trap.name} + ${shards} fragmentos`, kind: 'good' })
        return { type: 'trap', trap, shards }
      }
      const coins = randInt(70, 180)
      s.player.coins += coins
      d.log.push(`Cofre: ${coins} monedas.`)
      emit('toast', { text: `Cofre: +${coins} monedas`, kind: 'good' })
      return { type: 'coins', coins }
    }
    if (node.type === 'shrine') {
      this.healTeam(false, 0.42)
      const shards = randInt(1, 2)
      s.player.shards += shards
      s.stats.shardsFound += shards
      d.log.push('Un santuario restaura a tu equipo.')
      emit('toast', { text: `Santuario: equipo restaurado y +${shards} fragmentos.`, kind: 'good' })
      return { type: 'shrine', shards }
    }
    if (node.type === 'trap') {
      if (chance(0.45)) {
        const trap = pick(TRAPS)
        s.inventory.traps[trap.id] = (s.inventory.traps[trap.id] || 0) + 1
        d.log.push(`Encuentras una ${trap.name} abandonada.`)
        emit('toast', { text: `Encuentras ${trap.name}`, kind: 'good' })
        return { type: 'trap', trap }
      }
      const active = this.getActive()
      if (active) active.hp = Math.max(1, active.hp - Math.round(active.maxHp * 0.12))
      d.log.push('Una trampa antigua hiere a tu criatura líder.')
      emit('toast', { text: 'Una trampa antigua te hiere. -12% PS.', kind: 'bad' })
      return { type: 'damage' }
    }
    if (node.type === 'lore') {
      const shards = randInt(2, 5)
      s.player.shards += shards
      s.stats.shardsFound += shards
      const lines = [
        'Inscripción: «El Nexo no se abre. Se recuerda.»',
        'Un mural muestra criaturas que ya no existen.',
        'Una voz antigua pronuncia tu nombre y luego lo olvida.',
        'El cuarzo vibra con el pulso de tu equipo.',
      ]
      const line = pick(lines)
      d.log.push(line)
      emit('toast', { text: `${line} +${shards} fragmentos.`, kind: 'lore' })
      return { type: 'lore', text: line, shards }
    }
    return { type: 'empty' }
  }

  startDungeonBattle(node, kind) {
    const s = this.state
    const d = s.dungeon
    const meta = DUNGEONS[d.id]
    const level = meta.level + (d.floor - 1) * 4 + (kind === 'boss' ? 7 : kind === 'elite' ? 4 : randInt(-1, 2))
    let speciesId
    if (kind === 'boss') {
      speciesId = meta.boss
    } else {
      const zone = ZONE_BY_ID[meta.zone]
      const families = FAMILIES.filter(f => f.habitat === meta.zone || zone.elements.includes(f.element))
      const family = pick(families)
      const species = stageForLevel(CREATURES.find(c => c.family === family.id), level)
      speciesId = species.id
    }
    const enemy = this.makeEnemy(speciesId, level, { origin: 'dungeon' })
    this.seeSpecies(speciesId)
    return this.beginBattle({
      enemyTeam: [enemy], mode: 'dungeon', canCapture: kind !== 'boss',
      context: { type: 'dungeon', dungeonId: d.id, floor: d.floor, x: node.x, y: node.y, nodeType: kind, boss: kind === 'boss' },
      zone: meta.zone,
    })
  }

  resolveDungeonBattle(battle, result) {
    const s = this.state
    const ctx = battle.context
    if (ctx?.type !== 'dungeon') return
    const d = s.dungeon
    if (!d) return
    if (result !== 'win' && result !== 'captured') return
    const node = this.dungeonNode(ctx.x, ctx.y)
    if (node) node.resolved = true
    if (ctx.boss) {
      if (d.floor < d.floors) {
        d.floor++
        d.nodes = this.generateDungeonFloor(DUNGEONS[d.id], d.floor)
        d.pos = { x: 0, y: 3 }
        d.visited = ['0,3']
        d.nodes[3][0].visited = true
        d.nodes[3][0].revealed = true
        d.log.push(`Guardianes derrotados. Desciendes al piso ${d.floor}.`)
        emit('dungeon:floor', { dungeon: d, meta: DUNGEONS[d.id] })
        emit('toast', { text: `Piso ${d.floor} de ${d.floors} desbloqueado.`, kind: 'dungeon' })
      } else {
        this.clearDungeon()
      }
    } else {
      emit('dungeon:node', { node, result: { type: 'battle-win' }, dungeon: d })
    }
    this.save()
  }

  clearDungeon() {
    const s = this.state
    const d = s.dungeon
    if (!d) return
    const meta = DUNGEONS[d.id]
    s.stats.dungeonClears.push(d.id)
    const coins = 300 + meta.level * 18
    const shards = 6 + d.floors * 2
    s.player.coins += coins
    s.player.shards += shards
    s.stats.shardsFound += shards
    const trap = pick(TRAPS.slice(2))
    s.inventory.traps[trap.id] = (s.inventory.traps[trap.id] || 0) + 1
    let relic = null
    if (chance(0.62)) {
      relic = pick(RELICS.filter(r => meta.loot.includes(r.id) || rarityRank(r.rarity) <= 3))
      s.relics.push(relic.id)
      s.stats.relicsFound++
    }
    s.dungeon = null
    emit('dungeon:cleared', { dungeon: meta, coins, shards, trap, relic })
    emit('toast', { text: `${meta.name} completada. +${coins} monedas, +${shards} fragmentos.`, kind: 'dungeon' })
    this.checkQuests()
    this.save()
  }

  failDungeon() {
    const s = this.state
    const d = s.dungeon
    if (!d) return
    const meta = DUNGEONS[d.id]
    const lost = Math.min(s.player.coins, 120)
    s.player.coins -= lost
    s.dungeon = null
    s.player.x = 1290
    s.player.y = 1370
    s.player.dir = 'down'
    this.healTeam(false)
    emit('toast', { text: `Has sido expulsado de ${meta.name}. Pierdes ${lost} monedas, pero tu equipo se recupera.`, kind: 'bad' })
    emit('dungeon:failed', { dungeon: meta, lost })
    this.save()
  }

  exitDungeon() {
    const s = this.state
    if (!s.dungeon) return
    const meta = DUNGEONS[s.dungeon.id]
    s.dungeon = null
    emit('toast', { text: `Abandonas ${meta.name}.`, kind: 'info' })
    this.save()
  }

  // ---------- misc ----------

  useIncense() {
    const s = this.state
    if (!s.inventory.items.incense) {
      emit('toast', { text: 'No tienes incienso de encuentro.', kind: 'bad' })
      return null
    }
    s.inventory.items.incense--
    const zone = zoneAt(s.player.x, s.player.y)
    const wild = this.spawnInZone(zone.id, { near: true, level: this.maxLevel() + randInt(2, 5) })
    wild.rare = true
    emit('toast', { text: 'El incienso atrae una presencia rara…', kind: 'event' })
    this.save()
    return wild
  }

  teleport(poiId) {
    const poi = POIS.find(p => p.id === poiId)
    if (!poi) return false
    const s = this.state
    if (poi.hidden && s.quests.main < 9) return false
    s.player.x = poi.x
    s.player.y = poi.y + 80
    s.player.dir = 'up'
    s.world.lastZone = zoneAt(s.player.x, s.player.y).id
    emit('toast', { text: `Viajas a ${poi.name}.`, kind: 'info' })
    this.save()
    return true
  }
}

export const game = new Game()
export { freshState }
