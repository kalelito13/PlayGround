import {
  CREATURE_BY_ID, ELEMENTS, ITEMS, RARITIES, TECHNIQUES, TRAPS, WEATHERS,
} from './data.js'
import { displayName, hpColor, movePowerForDisplay, pct } from './core.js'
import { drawBattleBackground, drawCreature } from './art.js'
import { game, on } from './engine.js'
import { elementName, rarityName, t, weatherName } from './i18n.js'
import { esc, tr, toast, img } from './ui-core.js'

let battle = null
let busy = false
let subpanel = null
let started = false
let resultBannerShown = false

const $id = (id) => document.getElementById(id)

function rootEl() { return $id('battle-root') }

function active(side) {
  if (!battle) return null
  return side === 'player'
    ? battle.playerTeam[battle.playerIndex]
    : battle.enemyTeam[battle.enemyIndex]
}

function statusLabel(side) {
  const status = battle?.status?.[side]
  if (!status) return ''
  const names = {
    quemado: tr('Quemado', 'Burned'), envenenado: tr('Envenenado', 'Poisoned'),
    ralentizado: tr('Ralentizado', 'Slowed'), aturdido: tr('Aturdido', 'Stunned'),
  }
  return names[status.type] || status.type
}

function subChips(creature) {
  if (!creature) return ''
  const species = CREATURE_BY_ID[creature.speciesId]
  const chips = [
    `<span class="chip" style="color:${ELEMENTS[species?.element]?.color || '#94a3b8'}">${ELEMENTS[species?.element]?.icon || '◇'} ${esc(elementName(species?.element))}</span>`,
    `<span class="chip" style="color:${RARITIES[species?.rarity]?.color || '#94a3b8'}">${esc(rarityName(species?.rarity))}</span>`,
  ]
  const status = statusLabel(creature === active('player') ? 'player' : 'enemy')
  if (status) chips.push(`<span class="chip" style="color:var(--orange)">${esc(status)}</span>`)
  if (creature.relic) chips.push(`<span class="chip soft">◈ ${esc(creature.relic)}</span>`)
  return chips.join('')
}

function renderLog() {
  const log = $id('battle-log')
  if (!log || !battle) return
  log.innerHTML = battle.log.slice(-4).map((entry) => `<div>${esc(entry.text)}</div>`).join('')
}

function renderPanels() {
  const p = active('player')
  const e = active('enemy')
  if (!p || !e) return
  const pRatio = p.maxHp ? Math.max(0, p.hp / p.maxHp) : 0
  const eRatio = e.maxHp ? Math.max(0, e.hp / e.maxHp) : 0
  $id('enemy-name').textContent = displayName(e)
  $id('enemy-level').textContent = `Nv ${e.level}`
  $id('enemy-hp-bar').style.width = `${eRatio * 100}%`
  $id('enemy-hp-bar').style.background = hpColor(eRatio)
  $id('enemy-hp-text').textContent = `${Math.max(0, e.hp)} / ${e.maxHp}`
  $id('enemy-sub').innerHTML = subChips(e)
  $id('battle-player-name').textContent = displayName(p)
  $id('battle-player-level').textContent = `Nv ${p.level}`
  $id('battle-player-hp-bar').style.width = `${pRatio * 100}%`
  $id('battle-player-hp-bar').style.background = hpColor(pRatio)
  $id('battle-player-hp-text').textContent = `${Math.max(0, p.hp)} / ${p.maxHp}`
  $id('battle-player-sub').innerHTML = subChips(p)
  const weather = WEATHERS[battle.weather] || WEATHERS.clear
  $id('battle-weather').innerHTML = `<span>${weather.icon}</span><span>${esc(weatherName(battle.weather))}</span><span>· ${esc(t('battle.turn'))} ${battle.turn}</span>`
}

function moveButton(id) {
  const move = TECHNIQUES[id]
  if (!move) return ''
  const power = move.kind === 'attack' || move.kind === 'drain' ? movePowerForDisplay(id, active('player')?.level || 1) : '—'
  return `<button class="move-btn" data-action="move" data-move="${esc(id)}" ${busy || battle?.over ? 'disabled' : ''}>
    <span class="m-icon" style="color:${ELEMENTS[move.element]?.color || 'var(--muted)'}">${move.icon || '◇'}</span>
    <span class="m-info"><span class="m-name">${esc(move.name)}</span><span class="m-meta"><span>${esc(elementName(move.element))}</span><span>·</span><span>${esc(move.kind === 'attack' ? tr('Ataque', 'Attack') : move.kind === 'heal' ? tr('Curación', 'Heal') : tr('Apoyo', 'Support'))}</span></span></span>
    <span class="m-power">${power}</span>
  </button>`
}

function renderMoves() {
  const grid = $id('move-grid')
  const p = active('player')
  if (!grid || !p) return
  if (battle?.over) {
    grid.innerHTML = `<button class="btn btn-primary" data-action="continue" style="grid-column:1/-1;min-height:58px;justify-content:center">${esc(t('battle.continue'))} →</button>`
    return
  }
  const moves = p.moveset.filter((id) => TECHNIQUES[id])
  grid.innerHTML = moves.length ? moves.map(moveButton).join('') : `<div class="empty-state" style="grid-column:1/-1">${esc(t('battle.nomoves'))}</div>`
}

function renderSideButtons() {
  const capture = $id('battle-capture')
  const items = $id('battle-items')
  const swap = $id('battle-switch')
  const flee = $id('battle-flee')
  if (capture) capture.disabled = busy || battle?.over || !battle?.canCapture
  if (items) items.disabled = busy || battle?.over
  if (swap) swap.disabled = busy || battle?.over
  if (flee) flee.disabled = busy || battle?.over
}

function renderSubpanel() {
  const node = $id('battle-subpanel')
  if (!node) return
  if (!subpanel || !battle || battle.over) {
    node.hidden = true
    node.innerHTML = ''
    return
  }
  node.hidden = false
  if (subpanel === 'capture') {
    const p = active('player')
    const e = active('enemy')
    const available = TRAPS.filter((trap) => (game.state.inventory.traps[trap.id] || 0) > 0)
    const chances = available.map((trap) => game.captureChance(trap.id).chance)
    const best = chances.length ? Math.max(...chances) : 0
    node.innerHTML = `<div class="spread" style="margin-bottom:8px"><div><b style="font-size:12px">${esc(t('battle.traps'))}</b><div class="faint" style="font-size:9px">${esc(t('battle.weaken'))} · ${esc(displayName(e))} Nv ${e?.level}</div></div><button class="btn btn-sm btn-ghost" data-action="close-sub">← ${esc(t('battle.back'))}</button></div>
      <div class="trap-grid">${TRAPS.map((trap) => {
        const count = game.state.inventory.traps[trap.id] || 0
        const chance = game.captureChance(trap.id).chance
        const recommended = count > 0 && Math.abs(chance - best) < 0.0001 && best > 0
        return `<button class="trap-card ${count ? '' : 'disabled'}" data-action="trap" data-trap="${trap.id}" ${count ? '' : 'disabled'}>
          <div class="t-head"><span>${trap.icon} ${esc(trap.name)}</span><span>×${count}</span></div>
          <div class="t-chance">${pct(chance)}</div>
          ${recommended ? `<div class="chip" style="color:var(--gold);margin-top:3px">${esc(t('battle.recommended'))}</div>` : ''}
          <div class="t-desc">${esc(trap.desc)}</div>
        </button>`
      }).join('')}</div>`
  } else if (subpanel === 'items') {
    const p = active('player')
    const fainted = battle.playerTeam.find((c) => c.hp <= 0)
    node.innerHTML = `<div class="spread" style="margin-bottom:8px"><b style="font-size:12px">${esc(t('battle.chooseitem'))}</b><button class="btn btn-sm btn-ghost" data-action="close-sub">← ${esc(t('battle.back'))}</button></div>
      <div class="grid grid-2">${Object.values(ITEMS).filter((item) => !item.rare).map((item) => {
        const count = game.state.inventory.items[item.id] || 0
        const target = item.revive ? fainted : p
        return `<div class="item-card"><div class="item-icon" style="color:${item.color}">${item.icon}</div>
          <div style="flex:1"><h4>${esc(item.name)} <span class="chip soft">×${count}</span></h4><p>${esc(item.desc)}</p>
          <div class="item-foot"><span class="faint" style="font-size:8px">${target ? `${esc(tr('Objetivo', 'Target'))}: ${esc(displayName(target))}` : esc(tr('Sin objetivo', 'No target'))}</span>
          <button class="btn btn-sm btn-teal" data-action="item" data-item="${item.id}" ${count && target ? '' : 'disabled'}>${esc(t('modal.use'))}</button></div></div></div>`
      }).join('')}</div>`
  } else if (subpanel === 'switch') {
    node.innerHTML = `<div class="spread" style="margin-bottom:8px"><b style="font-size:12px">${esc(t('battle.switchto'))}</b><button class="btn btn-sm btn-ghost" data-action="close-sub">← ${esc(t('battle.back'))}</button></div>
      <div class="grid grid-3">${battle.playerTeam.map((c, index) => {
        const species = CREATURE_BY_ID[c.speciesId]
        const ratio = c.maxHp ? c.hp / c.maxHp : 0
        const disabled = c.hp <= 0 || index === battle.playerIndex
        return `<button class="creature-card ${disabled ? 'locked' : ''}" data-action="switch-mon" data-uid="${esc(c.uid)}" ${disabled ? 'disabled' : ''}>
          <div class="thumb"><img src="${img(c.speciesId, 128)}" alt="${esc(species?.name || '')}"></div>
          <div class="c-name"><span>${esc(displayName(c))}</span><span class="faint">Nv ${c.level}</span></div>
          <div class="c-meta"><span>${esc(species?.name || '')}</span><span>${Math.max(0, c.hp)}/${c.maxHp}</span></div>
          <div class="c-hp"><i style="width:${ratio * 100}%;background:${hpColor(ratio)}"></i></div>
        </button>`
      }).join('')}</div>`
  }
}

function syncUI() {
  if (!battle) return
  renderPanels()
  renderLog()
  renderMoves()
  renderSideButtons()
  renderSubpanel()
}

/* ---------------- animation ---------------- */

function animateSide(side, kind) {
  const host = $id(side === 'player' ? 'battle-mon-player' : 'battle-mon-enemy')
  const canvas = host?.querySelector('canvas')
  if (!canvas) return
  const cls = kind === 'lunge'
    ? (side === 'player' ? 'lunge-player' : 'lunge-enemy')
    : 'shake'
  canvas.classList.remove('lunge-player', 'lunge-enemy', 'shake')
  void canvas.offsetWidth
  canvas.classList.add(cls)
  setTimeout(() => canvas.classList.remove(cls), 420)
}

function floatText(side, text, cls = '') {
  const host = $id(side === 'player' ? 'battle-mon-player' : 'battle-mon-enemy')
  if (!host) return
  const node = document.createElement('div')
  node.className = `damage-float ${cls}`
  node.textContent = text
  host.appendChild(node)
  setTimeout(() => node.remove(), 1050)
}

function banner(title, sub = '', ms = 900) {
  const node = $id('battle-banner')
  if (!node) return Promise.resolve()
  const b = node.querySelector('b')
  const span = node.querySelector('span')
  if (b) b.textContent = title
  if (span) span.textContent = sub
  node.classList.add('show')
  return new Promise((resolve) => {
    setTimeout(() => {
      node.classList.remove('show')
      resolve()
    }, ms)
  })
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function playEvents(events) {
  for (const event of events) {
    if (!battle) break
    switch (event.type) {
      case 'log':
        renderLog()
        await sleep(180)
        break
      case 'attack': {
        animateSide(event.side, 'lunge')
        await sleep(120)
        animateSide(event.targetSide, 'hit')
        floatText(event.targetSide, `-${event.damage}`, event.effectiveness === 'super' ? 'super' : event.effectiveness === 'weak' ? 'weak' : '')
        renderPanels()
        await sleep(520)
        break
      }
      case 'heal':
        floatText(event.side, `+${event.amount}`)
        renderPanels()
        await sleep(430)
        break
      case 'statusDamage':
        floatText(event.side, `-${event.amount}`)
        renderPanels()
        await sleep(420)
        break
      case 'miss':
        floatText(event.side, tr('Falla', 'Miss'), 'weak')
        await sleep(320)
        break
      case 'buff':
      case 'debuff':
        renderPanels()
        await sleep(260)
        break
      case 'faint':
        await banner(event.name || '', tr('DEBILITADA', 'FAINTED'), 720)
        renderPanels()
        break
      case 'switch':
        renderPanels()
        await sleep(380)
        break
      case 'captureThrow':
        await banner(tr('TRAMPA', 'TRAP'), event.trap?.name || '', 620)
        break
      case 'captureSuccess':
        await banner(tr('CAPTURADA', 'CAPTURED'), event.species?.name || '', 1050)
        renderPanels()
        break
      case 'captureFail':
        await banner(tr('SE ROMPIÓ', 'IT BROKE'), event.trap?.name || '', 650)
        break
      case 'item':
        floatText('player', `+${Math.max(0, (event.hpAfter || 0) - (event.hpBefore || 0))}`)
        renderPanels()
        await sleep(430)
        break
      case 'flee':
        if (event.success) await banner(tr('HUIDA', 'ESCAPED'), '', 750)
        await sleep(300)
        break
      case 'end':
        renderPanels()
        await sleep(400)
        break
      case 'turn':
        renderPanels()
        await sleep(100)
        break
      default:
        await sleep(120)
    }
  }
}

function showResultBanner() {
  if (!battle || resultBannerShown) return
  resultBannerShown = true
  const result = battle.result
  if (result === 'win') banner(tr('VICTORIA', 'VICTORY'), tr('El vínculo se fortalece', 'The bond grows stronger'), 1200)
  else if (result === 'captured') banner(tr('CAPTURADA', 'CAPTURED'), displayName(active('enemy')), 1200)
  else if (result === 'loss') banner(tr('DERROTA', 'DEFEAT'), tr('Vértice te espera', 'Vértice awaits'), 1200)
  else if (result === 'fled') banner(tr('HUIDA', 'ESCAPED'), '', 1000)
}

async function act(action) {
  if (busy || !battle || battle.over) return
  busy = true
  subpanel = null
  syncUI()
  let events = []
  try {
    events = action() || []
  } catch (error) {
    console.error('Battle action failed', error)
    toast(tr('El combate ha encontrado un error. Inténtalo de nuevo.', 'The battle hit an error. Try again.'), 'bad')
  }
  await playEvents(events)
  busy = false
  if (battle?.over) showResultBanner()
  syncUI()
}

function continueBattle() {
  if (!battle?.over) return
  const root = rootEl()
  if (root) root.hidden = true
  const finished = battle
  battle = null
  busy = false
  subpanel = null
  resultBannerShown = false
  $id('battle-subpanel').hidden = true
  $id('battle-banner')?.classList.remove('show')
  game.finishBattle()
  return finished
}

function handleClick(event) {
  const button = event.target.closest('[data-action]')
  if (!button || !battle) return
  const action = button.dataset.action
  if (action === 'close-sub') {
    subpanel = null
    syncUI()
    return
  }
  if (action === 'continue') {
    continueBattle()
    return
  }
  if (busy) return
  if (action === 'move') act(() => game.playerMove(button.dataset.move))
  else if (action === 'capture') { subpanel = 'capture'; syncUI() }
  else if (action === 'items') { subpanel = 'items'; syncUI() }
  else if (action === 'switch') { subpanel = 'switch'; syncUI() }
  else if (action === 'flee') act(() => game.playerFlee())
  else if (action === 'trap') act(() => game.playerCapture(button.dataset.trap))
  else if (action === 'item') act(() => {
    const item = ITEMS[button.dataset.item]
    const target = item?.revive ? battle.playerTeam.find((c) => c.hp <= 0) : active('player')
    return game.playerItem(button.dataset.item, target?.uid)
  })
  else if (action === 'switch-mon') act(() => game.playerSwitch(button.dataset.uid))
}

function drawMonster(canvas, creature, time, enemy = false) {
  if (!canvas || !creature) return
  const dpr = 1
  const size = 190
  if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
    canvas.width = size * dpr
    canvas.height = size * dpr
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)
  const bob = Math.sin(time * 1.7 + (enemy ? 1.4 : 0)) * 4
  drawCreature(ctx, creature.speciesId, size / 2, size * 0.53 + bob, 1.42, {
    time, flip: false, shadow: true, aura: true, auraIntensity: enemy ? 1.05 : 1,
    alpha: creature.hp <= 0 ? 0.35 : 1,
  })
}

export function renderBattleFrame(now) {
  if (!battle) return
  const root = rootEl()
  if (!root || root.hidden) return
  const canvas = $id('battle-canvas')
  if (!canvas) return
  const w = canvas.clientWidth || window.innerWidth
  const h = canvas.clientHeight || window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawBattleBackground(ctx, w, h, battle.zone, battle.weather, now / 1000)
  drawMonster($id('battle-enemy-canvas'), active('enemy'), now / 1000, true)
  drawMonster($id('battle-player-canvas'), active('player'), now / 1000, false)
}

function startBattle(nextBattle) {
  battle = nextBattle
  busy = false
  subpanel = null
  resultBannerShown = false
  const root = rootEl()
  if (!root) return
  const flash = $id('transition-flash')
  if (flash) {
    flash.classList.remove('go')
    void flash.offsetWidth
    flash.classList.add('go')
    setTimeout(() => flash.classList.remove('go'), 560)
  }
  root.hidden = false
  $id('battle-subpanel').hidden = true
  $id('battle-subpanel').innerHTML = ''
  $id('battle-banner')?.classList.remove('show')
  syncUI()
  renderBattleFrame(performance.now())
}

export function initBattle() {
  if (started) return
  started = true
  const root = rootEl()
  if (!root) return
  root.addEventListener('click', handleClick)
  on('battle:start', (event) => startBattle(event.detail?.battle))
}
