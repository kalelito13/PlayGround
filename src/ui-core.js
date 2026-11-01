import {
  CHAPTERS, CREATURE_BY_ID, ELEMENTS, RARITIES, STARTER_IDS, TRAPS, WEATHERS, ZONES,
} from './data.js'
import {
  clamp, formatNumber, hpColor, isNight, phaseLabel, timeLabel, zoneAt,
} from './core.js'
import { creatureDataURL } from './art.js'
import { game } from './engine.js'
import {
  getLang, localizedChapter, localizedSideQuestById, setLang, t,
} from './i18n.js'

export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))

export const tr = (es, en) => getLang() === 'en' ? en : es
export const img = (speciesId, size = 128) => creatureDataURL(speciesId, size)
export const fmt = (n) => formatNumber(n || 0)

export function elementChip(element) {
  const meta = ELEMENTS[element]
  return `<span class="chip" style="color:${meta?.color || '#94a3b8'}">${meta?.icon || '◇'} ${esc(meta?.name || element)}</span>`
}

export function rarityChip(rarity) {
  const meta = RARITIES[rarity]
  return `<span class="chip" style="color:${meta?.color || '#94a3b8'}">${esc(meta?.name || rarity)}</span>`
}

export function hpBar(current, max, extra = '') {
  const ratio = max ? clamp(current / max, 0, 1) : 0
  return `<div class="bar ${extra}"><i style="width:${ratio * 100}%;background:${hpColor(ratio)}"></i></div>`
}

export function rewardLine(reward = {}) {
  const bits = []
  if (reward.coins) bits.push(`<span>◉ ${fmt(reward.coins)}</span>`)
  if (reward.shards) bits.push(`<span>✧ ${fmt(reward.shards)}</span>`)
  if (reward.xp) bits.push(`<span>XP ${fmt(reward.xp)}</span>`)
  if (reward.traps) for (const [id, n] of Object.entries(reward.traps)) {
    const trap = TRAPS.find(tr => tr.id === id)
    bits.push(`<span>◈ ${esc(trap?.name || id)} ×${n}</span>`)
  }
  if (reward.items) for (const [id, n] of Object.entries(reward.items)) bits.push(`<span>▣ ${esc(id)} ×${n}</span>`)
  if (reward.title) bits.push(`<span>♛ ${esc(reward.title)}</span>`)
  return bits.length ? `<div class="reward-line">${bits.join('')}</div>` : ''
}

export function phaseText(time) {
  const es = phaseLabel(time)
  if (getLang() !== 'en') return es
  return ({ Madrugada: 'Dawn', Amanecer: 'Sunrise', Mañana: 'Morning', Tarde: 'Afternoon', Atardecer: 'Dusk', Noche: 'Night' })[es] || es
}

/* ---------------- toasts ---------------- */

export function toast(text, kind = 'info') {
  const stack = $('#toast-stack')
  if (!stack || !text) return
  const node = document.createElement('div')
  node.className = `toast ${kind}`
  node.textContent = text
  stack.appendChild(node)
  while (stack.children.length > 5) stack.firstElementChild.remove()
  setTimeout(() => node.classList.add('fade'), 4200)
  setTimeout(() => node.remove(), 4600)
}

/* ---------------- modal system ---------------- */

let modalRenderer = null
let modalOpen = false
let modalCloseHook = null

export function isModalOpen() { return modalOpen }
export function setModalCloseHook(fn) { modalCloseHook = fn }

export function openModal(renderer, opts = {}) {
  modalRenderer = renderer
  modalOpen = true
  const root = $('#modal-root')
  root.classList.add('open')
  renderModal(opts)
}

export function refreshModal() {
  if (!modalOpen) return
  const root = $('#modal-root')
  const scroll = root.querySelector('.modal-body')?.scrollTop || 0
  renderModal()
  const body = root.querySelector('.modal-body')
  if (body) body.scrollTop = scroll
}

function renderModal() {
  const root = $('#modal-root')
  if (!modalRenderer) return
  const data = modalRenderer()
  if (!data) return
  const size = data.wide ? 'wide' : data.narrow ? 'narrow' : ''
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal ${size} ${data.className || ''}" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            ${data.kicker ? `<div class="modal-kicker">${data.kicker}</div>` : ''}
            <h2>${data.title || ''}</h2>
            ${data.sub ? `<p>${data.sub}</p>` : ''}
          </div>
          <button class="modal-close" data-modal-close aria-label="${esc(t('modal.close'))}">✕</button>
        </div>
        <div class="modal-body">${data.body || ''}</div>
        ${data.footer ? `<div class="modal-footer">${data.footer}</div>` : ''}
      </div>
    </div>`
  root.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal())
  const backdrop = root.querySelector('.modal-backdrop')
  backdrop?.addEventListener('mousedown', (event) => {
    if (event.target === backdrop && data.closeable !== false) closeModal()
  })
  data.onMount?.(root)
}

export function closeModal({ silent = false } = {}) {
  const root = $('#modal-root')
  modalRenderer = null
  modalOpen = false
  if (root) {
    root.classList.remove('open')
    root.innerHTML = ''
  }
  refreshAll()
  if (!silent) modalCloseHook?.()
}

export function openConfirm({ title, body, confirmLabel, cancelLabel, danger = false, onConfirm }) {
  openModal(() => ({
    narrow: true,
    kicker: tr('CONFIRMACIÓN', 'CONFIRMATION'),
    title: esc(title),
    body: `<p class="muted" style="line-height:1.7;font-size:12px">${body}</p>`,
    footer: `<button class="btn btn-ghost" data-confirm-cancel>${esc(cancelLabel || t('common.cancel'))}</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm-ok>${esc(confirmLabel || t('common.confirm'))}</button>`,
    onMount: (root) => {
      root.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => closeModal())
      root.querySelector('[data-confirm-ok]')?.addEventListener('click', () => {
        closeModal()
        onConfirm?.()
      })
    },
  }))
}

/* ---------------- HUD ---------------- */

export function refreshHUD() {
  const s = game.state
  if (!s?.started) return
  const p = s.player
  const zone = zoneAt(p.x, p.y) || ZONES[0]
  const weather = WEATHERS[s.world.weather] || WEATHERS.clear
  const set = (id, value) => { const node = $(`#${id}`); if (node) node.textContent = value }
  set('hud-player-name', p.name)
  set('hud-player-title', p.title || 'Novato del Nexo')
  set('hud-coins', fmt(p.coins))
  set('hud-shards', fmt(p.shards))
  set('hud-zone', zone.name)
  set('hud-weather', `${weather.name} · ${t('hud.day')} ${s.world.day}`)
  set('hud-weather-icon', weather.icon)
  set('hud-time', timeLabel(s.world.time))
  set('hud-phase', phaseText(s.world.time))
  const avatar = $('#player-avatar')
  if (avatar) avatar.textContent = (p.name || 'A').trim().charAt(0).toUpperCase()
  const vignette = $('#night-vignette')
  if (vignette) vignette.style.opacity = isNight(s.world.time) ? '1' : '0.45'
  refreshQuest()
  refreshParty()
}

export function refreshQuest() {
  const s = game.state
  if (!s) return
  const chapter = CHAPTERS[s.quests.main]
  const kicker = $('#quest-kicker')
  const chapterNo = $('#quest-chapter')
  const title = $('#quest-title')
  const objective = $('#quest-objective')
  const bar = $('#quest-bar')
  if (kicker) kicker.textContent = t('hud.quest')
  if (!chapter) {
    if (chapterNo) chapterNo.textContent = '★'
    if (title) title.textContent = tr('El Nexo está en calma', 'The Nexus is at peace')
    if (objective) objective.textContent = tr('La historia principal ha concluido. Vértice sigue abierto.', 'The main story is complete. Vértice remains open.')
    if (bar) bar.style.width = '100%'
  } else {
    const loc = localizedChapter(chapter)
    const p = game.mainProgress()
    if (chapterNo) chapterNo.textContent = String(chapter.id + 1).padStart(2, '0')
    if (title) title.textContent = loc?.title || chapter.title
    if (objective) objective.textContent = loc?.objective || chapter.objective
    if (bar) bar.style.width = `${chapter.type === 'talk' ? 8 : Math.round((p.current / Math.max(1, p.target)) * 100)}%`
  }
  const sideBox = $('#quest-side')
  if (!sideBox) return
  const activeSides = Object.entries(s.quests.side || {}).filter(([, data]) => data.status === 'active')
  const active = activeSides.find(([, data]) => data.ready) || activeSides[0]
  if (!active) {
    sideBox.hidden = true
    return
  }
  const [id, data] = active
  const q = localizedSideQuestById(id)
  sideBox.hidden = false
  const label = $('#quest-side-label')
  const sideTitle = $('#quest-side-title')
  const ready = $('#quest-side-ready')
  if (label) label.textContent = t('hud.side')
  if (sideTitle) sideTitle.textContent = q?.title || id
  if (ready) ready.hidden = !data.ready
}

export function refreshParty() {
  const dock = $('#party-dock')
  const s = game.state
  if (!dock || !s) return
  const team = game.getTeam()
  dock.innerHTML = team.map((c, index) => {
    const species = CREATURE_BY_ID[c.speciesId]
    const ratio = c.maxHp ? c.hp / c.maxHp : 0
    return `<button class="party-card ${index === 0 ? 'active' : ''} ${c.hp <= 0 ? 'fainted' : ''}" data-uid="${esc(c.uid)}" title="${esc(species?.name || '')}">
      <div class="party-portrait"><img src="${img(c.speciesId, 96)}" alt="${esc(species?.name || '')}"></div>
      <div class="party-name">${esc(c.nickname || species?.name || '—')}</div>
      <div class="party-lv"><span>Nv ${c.level}</span><span>${Math.max(0, c.hp)}/${c.maxHp}</span></div>
      <div class="party-hp"><i style="width:${ratio * 100}%;background:${hpColor(ratio)}"></i></div>
    </button>`
  }).join('') + (s.roster.length > team.length ? `<button class="party-more" data-party-more title="${esc(t('modal.ranch.roster'))}">+${s.roster.length - team.length}</button>` : '')
}

export function refreshAll() {
  refreshHUD()
}

export function worldActive() {
  const s = game.state
  if (!s?.started) return false
  const hud = $('#hud')
  const title = $('#title-screen')
  const starter = $('#starter-screen')
  return !!hud && !hud.hidden && !!title?.hidden && !!starter?.hidden && !s.battle && !s.dungeon && !isModalOpen()
}

/* ---------------- banners / prompt ---------------- */

let zoneTimer = 0
let eventTimer = 0

export function zoneBanner(zone) {
  const node = $('#zone-banner')
  if (!node || !zone) return
  node.querySelector('b').textContent = zone.name
  node.querySelector('span').textContent = zone.subtitle
  node.classList.add('show')
  clearTimeout(zoneTimer)
  zoneTimer = setTimeout(() => node.classList.remove('show'), 3400)
}

export function eventBanner(event) {
  const node = $('#event-banner')
  if (!node || !event) return
  node.innerHTML = `<span class="event-glyph">◈</span><div><b>${esc(event.name)}</b><span>${esc(event.desc)}</span></div>`
  node.hidden = false
  node.classList.add('show')
  clearTimeout(eventTimer)
  eventTimer = setTimeout(() => {
    node.classList.remove('show')
    node.hidden = true
  }, 6500)
}

export function setPrompt(target) {
  const node = $('#interaction-prompt')
  if (!node) return
  if (!target) {
    node.classList.remove('show')
    return
  }
  const label = target.type === 'npc' ? t('prompt.talk')
    : target.type === 'wild' ? t('prompt.wild')
      : target.type === 'loot' ? t('prompt.loot')
        : target.locked ? t('prompt.locked') : t('prompt.explore')
  const b = node.querySelector('b')
  const small = node.querySelector('small')
  if (b) b.textContent = label
  if (small) small.textContent = target.name || ''
  node.classList.add('show')
}

/* ---------------- screens ---------------- */

export function showGame() {
  const title = $('#title-screen')
  const starter = $('#starter-screen')
  const hud = $('#hud')
  if (title) title.hidden = true
  if (starter) starter.hidden = true
  if (hud) hud.hidden = false
  refreshAll()
}

export function showTitleScreen() {
  const title = $('#title-screen')
  const starter = $('#starter-screen')
  const hud = $('#hud')
  if (title) title.hidden = false
  if (starter) starter.hidden = true
  if (hud) hud.hidden = true
  refreshTitle()
}

export function showStarterScreen() {
  const title = $('#title-screen')
  const starter = $('#starter-screen')
  const hud = $('#hud')
  if (title) title.hidden = true
  if (starter) starter.hidden = false
  if (hud) hud.hidden = true
  renderStarterGrid()
}

export function refreshTitle() {
  const btn = $('#btn-continue')
  if (btn) btn.disabled = !game.hasSave()
  const lang = $('#title-lang-btn span')
  if (lang) lang.textContent = getLang() === 'es' ? 'Español' : 'English'
}

/* ---------------- starter ---------------- */

let selectedStarter = STARTER_IDS[0]

function renderStarterGrid() {
  const grid = $('#starter-grid')
  if (!grid) return
  grid.innerHTML = STARTER_IDS.map((id) => {
    const species = CREATURE_BY_ID[id]
    const stats = species.statsAt(5)
    return `<button class="starter-card ${selectedStarter === id ? 'selected' : ''}" data-starter="${id}">
      <img src="${img(id, 240)}" alt="${esc(species.name)}" style="width:100%;height:190px;object-fit:contain;position:relative;z-index:1">
      <h3>${esc(species.name)}</h3>
      <div class="lore">${esc(species.lore)}</div>
      <div class="starter-tags">${elementChip(species.element)}${rarityChip(species.rarity)}</div>
      <div class="starter-stats">
        <span>PS <b>${stats.hp}</b></span><span>ATQ <b>${stats.atk}</b></span>
        <span>DEF <b>${stats.def}</b></span><span>VEL <b>${stats.spd}</b></span>
      </div>
      <div style="position:relative;z-index:1;margin-top:10px" class="chip soft">${selectedStarter === id ? esc(t('starter.picked')) : esc(t('starter.pick'))}</div>
    </button>`
  }).join('')
  grid.querySelectorAll('[data-starter]').forEach((card) => {
    card.addEventListener('click', () => {
      selectedStarter = card.dataset.starter
      renderStarterGrid()
    })
  })
}

/* ---------------- language ---------------- */

export function applyLanguage() {
  document.documentElement.lang = getLang()
  const set = (id, value) => { const node = $(`#${id}`); if (node) node.textContent = value }
  set('title-eyebrow', tr('Un RPG de criaturas y vínculos', 'A creature RPG about bonds'))
  set('title-sub', t('app.subtitle'))
  set('title-desc', t('app.desc'))
  set('btn-new', t('app.new'))
  set('btn-continue', t('app.continue'))
  set('btn-help', t('modal.help.title'))
  set('title-footer', t('app.footer'))
  set('starter-title', t('starter.title'))
  set('starter-desc', t('starter.desc'))
  set('name-label', t('starter.name'))
  set('btn-start-game', t('starter.confirm'))
  set('starter-hint', t('starter.hint'))
  set('hud-coins-label', t('hud.coins'))
  set('hud-shards-label', t('hud.shards'))
  const actionLabels = {
    interact: t('action.interact'), team: t('action.team'), bag: t('action.bag'), camp: t('action.camp'),
  }
  for (const [key, label] of Object.entries(actionLabels)) {
    const btn = $(`#action-${key}`)
    const small = btn?.querySelector('small')
    if (small) small.textContent = label
    if (btn) btn.title = label
  }
  set('touch-run', t('action.run'))
  const battleLabels = {
    'battle-capture': 'battle.capture', 'battle-items': 'battle.items',
    'battle-switch': 'battle.switch', 'battle-flee': 'battle.flee',
  }
  for (const [id, key] of Object.entries(battleLabels)) {
    const span = $(`#${id} span`)
    if (span) span.textContent = t(key)
  }
  const menuLabels = {
    map: t('menu.map'), ranch: t('menu.ranch'), journal: t('menu.journal'),
    codex: t('menu.codex'), arena: t('menu.arena'), inventory: t('menu.inventory'), settings: t('menu.settings'),
  }
  for (const [key, label] of Object.entries(menuLabels)) {
    const btn = $(`#menu-${key}`)
    if (btn) {
      const small = btn.querySelector('small')
      if (small) small.textContent = label
      btn.title = label
    }
  }
  const features = $('#title-features')
  if (features) {
    features.innerHTML = tr(
      ['Captura con trampas', 'Evoluciones', 'Clima dinámico', 'PvP por invitación'],
      ['Trap capture', 'Evolutions', 'Dynamic weather', 'Invite PvP'],
    ).map((x) => `<span>${esc(x)}</span>`).join('')
  }
  const lang = $('#title-lang-btn span')
  if (lang) lang.textContent = getLang() === 'es' ? 'Español' : 'English'
  refreshHUD()
}

/* ---------------- help ---------------- */

export function openHelp() {
  openModal(() => ({
    narrow: true,
    kicker: tr('GUÍA DE CAMPO', 'FIELD GUIDE'),
    title: t('modal.help.title'),
    body: `<div class="stack" style="font-size:12px;line-height:1.65;color:var(--muted)">
      <div class="row"><span class="chip">WASD</span><span>${esc(t('modal.help.move'))}</span></div>
      <div class="row"><span class="chip">E</span><span>${esc(t('modal.help.interact'))}</span></div>
      <div class="row"><span class="chip">◈</span><span>${esc(t('modal.help.capture'))}</span></div>
      <div class="row"><span class="chip">☀</span><span>${esc(t('modal.help.weather'))}</span></div>
      <div class="row"><span class="chip">M</span><span>${esc(t('modal.help.menu'))}</span></div>
      <div class="row"><span class="chip">▣</span><span>${esc(t('modal.help.mobile'))}</span></div>
      <div class="lore-box">${esc(tr(
        'Las criaturas débiles se capturan con más facilidad. Las trampas de mayor rango son necesarias para rarezas altas. La evolución llega a los niveles 16 y 36.',
        'Weakened creatures are easier to capture. Higher-tier traps are needed for rare species. Evolution unlocks at levels 16 and 36.',
      ))}</div>
    </div>`,
    footer: `<button class="btn btn-primary" data-help-close>${esc(t('modal.close'))}</button>`,
    onMount: (root) => root.querySelector('[data-help-close]')?.addEventListener('click', () => closeModal()),
  }))
}

/* ---------------- core bindings ---------------- */

let coreReady = false

export function initCoreUI() {
  if (coreReady) return
  coreReady = true
  applyLanguage()
  refreshTitle()

  $('#btn-new')?.addEventListener('click', () => {
    if (game.hasSave()) {
      openConfirm({
        title: tr('Empezar una nueva partida', 'Start a new game'),
        body: tr('Se sobrescribirá la partida guardada actual. ¿Quieres continuar?', 'Your current save will be overwritten. Continue?'),
        confirmLabel: tr('Sobrescribir', 'Overwrite'),
        danger: true,
        onConfirm: () => showStarterScreen(),
      })
    } else {
      showStarterScreen()
    }
  })

  $('#btn-continue')?.addEventListener('click', () => {
    if (!game.hasSave()) {
      toast(t('app.nosave'), 'bad')
      return
    }
    const state = game.loadGame()
    if (!state) toast(tr('No se pudo cargar la partida.', 'The save could not be loaded.'), 'bad')
  })

  $('#btn-help')?.addEventListener('click', () => openHelp())
  $('#title-lang-btn')?.addEventListener('click', () => setLang(getLang() === 'es' ? 'en' : 'es'))

  $('#btn-start-game')?.addEventListener('click', () => {
    const input = $('#player-name')
    const name = (input?.value || '').trim().slice(0, 16) || 'Aria'
    game.newGame(name, selectedStarter)
  })

  $('#player-name')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      $('#btn-start-game')?.click()
    }
  })

  $('#party-dock')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-uid]')
    if (card) window.dispatchEvent(new CustomEvent('nexo:party', { detail: { uid: card.dataset.uid } }))
    else if (event.target.closest('[data-party-more]')) window.dispatchEvent(new CustomEvent('nexo:menu', { detail: { menu: 'ranch' } }))
  })

  $('#minimap-wrap')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('nexo:menu', { detail: { menu: 'map' } })))
  $('#zone-banner')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('nexo:menu', { detail: { menu: 'map' } })))
}
