import { CREATURE_BY_ID, WORLD, ZONES } from './data.js'
import { clamp, zoneAt } from './core.js'
import {
  drawCreature, drawMinimap, drawRanchScene, drawTitleGlow, drawWeather, drawWorld,
} from './art.js'
import { game } from './engine.js'
import { initUI, worldActive, refreshAll, setPrompt, zoneBanner } from './ui.js'
import { initBattle, renderBattleFrame } from './battle.js'

const $id = (id) => document.getElementById(id)

const state = {
  keys: new Set(),
  joystick: { x: 0, y: 0, active: false, pointerId: null },
  sprint: false,
  moving: false,
  camera: { x: 0, y: 0 },
  lastFrame: 0,
  minimapTimer: 0,
  promptTimer: 0,
  lastPromptKey: '',
  lastZone: null,
  titleSpecies: 'brasal-1',
  titleRotate: 0,
  dpr: 1,
  width: 0,
  height: 0,
}

/* ---------------- canvas sizing ---------------- */

function resizeCanvas(canvas, ctx) {
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth || window.innerWidth
  const h = canvas.clientHeight || window.innerHeight
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { w, h, dpr }
}

function resizeAll() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2)
  state.width = window.innerWidth
  state.height = window.innerHeight
  const world = $id('world-canvas')
  const fx = $id('fx-canvas')
  if (world) {
    const ctx = world.getContext('2d')
    const size = resizeCanvas(world, ctx)
    if (size) { state.width = size.w; state.height = size.h }
  }
  if (fx) {
    const ctx = fx.getContext('2d')
    resizeCanvas(fx, ctx)
  }
  const title = $id('title-canvas')
  if (title) {
    const ctx = title.getContext('2d')
    resizeCanvas(title, ctx)
  }
}

/* ---------------- title animation ---------------- */

const TITLE_ROTATION = ['brasal-1', 'aquil-1', 'brot-1', 'myth_nexo', 'myth_solaris']

function renderTitle(now) {
  const title = $id('title-screen')
  if (!title || title.hidden) return
  const canvas = $id('title-canvas')
  const time = now / 1000
  if (canvas) {
    const ctx = canvas.getContext('2d')
    const w = canvas.clientWidth || state.width
    const h = canvas.clientHeight || state.height
    ctx.clearRect(0, 0, w, h)
    drawRanchScene(ctx, w, h, time)
    drawTitleGlow(ctx, w, h, time)
  }
  const monster = $id('title-monster')
  if (monster) {
    const ctx = monster.getContext('2d')
    const w = monster.clientWidth || 320
    const h = monster.clientHeight || 320
    const dpr = state.dpr
    if (monster.width !== Math.floor(w * dpr) || monster.height !== Math.floor(h * dpr)) {
      monster.width = Math.floor(w * dpr)
      monster.height = Math.floor(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const cycle = Math.floor(time / 4.2) % TITLE_ROTATION.length
    const speciesId = TITLE_ROTATION[cycle]
    const species = CREATURE_BY_ID[speciesId]
    if (!species) return
    const bob = Math.sin(time * 1.6) * 6
    const scale = clamp(Math.min(w, h) / 190, 0.9, 2.4)
    ctx.save()
    ctx.globalAlpha = 0.9
    drawCreature(ctx, speciesId, w / 2, h * 0.55 + bob, scale, {
      time, shadow: true, aura: true, auraIntensity: 1.25,
    })
    ctx.restore()
    const label = species.name
    ctx.save()
    ctx.textAlign = 'center'
    ctx.font = '600 11px ui-sans-serif, system-ui'
    ctx.fillStyle = 'rgba(232,244,244,.62)'
    ctx.fillText(label.toUpperCase(), w / 2, h - 16)
    ctx.restore()
  }
}

/* ---------------- input ---------------- */

const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
])

function axisInput() {
  const k = state.keys
  let x = 0
  let y = 0
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1
  if (k.has('KeyW') || k.has('ArrowUp')) y -= 1
  if (k.has('KeyS') || k.has('ArrowDown')) y += 1
  if (state.joystick.active) {
    x += state.joystick.x
    y += state.joystick.y
  }
  const len = Math.hypot(x, y)
  if (len > 1) { x /= len; y /= len }
  return { x, y }
}

function onKeyDown(event) {
  const target = event.target
  const typing = target instanceof HTMLElement
    && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

  if (typing) {
    if (event.code === 'Escape') target.blur()
    return
  }

  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    state.sprint = true
    return
  }

  if (MOVE_KEYS.has(event.code)) {
    state.keys.add(event.code)
    event.preventDefault()
    return
  }

  if (event.repeat) return

  const titleVisible = !$id('title-screen')?.hidden
  const starterVisible = !$id('starter-screen')?.hidden
  if (titleVisible || starterVisible) {
    if (event.code === 'Escape') return
    return
  }

  const modalOpen = !!document.querySelector('#modal-root.open')
  if (event.code === 'Escape') {
    if (modalOpen) {
      document.querySelector('#modal-root [data-modal-close]')?.click()
    } else {
      document.getElementById('menu-settings')?.click()
    }
    return
  }
  if (modalOpen) return

  const menuKeys = {
    KeyM: 'map', KeyR: 'ranch', KeyJ: 'journal', KeyC: 'codex',
    KeyP: 'arena', KeyB: 'inventory', KeyO: 'settings', KeyH: 'help',
  }
  if (menuKeys[event.code]) {
    event.preventDefault()
    window.dispatchEvent(new CustomEvent('nexo:menu', { detail: { menu: menuKeys[event.code] } }))
    return
  }

  if (event.code === 'KeyE' || event.code === 'Enter' || event.code === 'Space') {
    const s = game.state
    if (!s?.started || s.battle || s.dungeon) return
    event.preventDefault()
    document.getElementById('action-interact')?.click()
  }
}

function onKeyUp(event) {
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') state.sprint = false
  state.keys.delete(event.code)
}

function bindKeyboard() {
  window.addEventListener('keydown', onKeyDown, { passive: false })
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', () => {
    state.keys.clear()
    state.sprint = false
  })
}

/* ---------------- joystick ---------------- */

function bindJoystick() {
  const zone = $id('joystick')
  const stick = zone?.querySelector('.stick')
  if (!zone || !stick) return
  const radius = 42

  const update = (event) => {
    const rect = zone.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = event.clientX - cx
    let dy = event.clientY - cy
    const len = Math.hypot(dx, dy)
    if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius }
    stick.style.transform = `translate(${dx}px, ${dy}px)`
    const nx = dx / radius
    const ny = dy / radius
    const dead = 0.16
    state.joystick.x = Math.abs(nx) < dead ? 0 : nx
    state.joystick.y = Math.abs(ny) < dead ? 0 : ny
    state.joystick.active = Math.hypot(state.joystick.x, state.joystick.y) > 0
  }

  const release = (event) => {
    if (state.joystick.pointerId !== null && event?.pointerId !== state.joystick.pointerId) return
    state.joystick.pointerId = null
    state.joystick.active = false
    state.joystick.x = 0
    state.joystick.y = 0
    stick.style.transform = 'translate(0px, 0px)'
    zone.classList.remove('active')
  }

  zone.addEventListener('pointerdown', (event) => {
    state.joystick.pointerId = event.pointerId
    zone.setPointerCapture?.(event.pointerId)
    zone.classList.add('active')
    update(event)
    event.preventDefault()
  })
  zone.addEventListener('pointermove', (event) => {
    if (state.joystick.pointerId !== event.pointerId) return
    update(event)
    event.preventDefault()
  })
  zone.addEventListener('pointerup', release)
  zone.addEventListener('pointercancel', release)
  zone.addEventListener('lostpointercapture', release)

  const run = $id('touch-run')
  if (run) {
    run.addEventListener('click', () => {
      state.sprint = !state.sprint
      run.classList.toggle('active', state.sprint)
    })
  }
}

/* ---------------- interaction prompt ---------------- */

function updatePrompt(dt) {
  state.promptTimer -= dt
  if (state.promptTimer > 0) return
  state.promptTimer = 0.12
  const s = game.state
  if (!s || !worldActive()) {
    if (state.lastPromptKey !== '') {
      state.lastPromptKey = ''
      setPrompt(null)
    }
    return
  }
  const target = game.nearestInteractable()
  const key = target ? `${target.type}:${target.id}:${target.locked ? 'locked' : ''}` : ''
  if (key === state.lastPromptKey) return
  state.lastPromptKey = key
  setPrompt(target)
}

/* ---------------- minimap ---------------- */

function renderMinimap(now) {
  const canvas = $id('minimap')
  const s = game.state
  if (!canvas || !s) return
  const ctx = canvas.getContext('2d')
  const dpr = state.dpr
  const w = canvas.clientWidth || 138
  const h = canvas.clientHeight || 98
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawMinimap(ctx, s, w, h)
}

/* ---------------- world frame ---------------- */

function updateCamera(w, h) {
  const s = game.state
  if (!s) return
  const targetX = clamp(s.player.x - w / 2, 0, Math.max(0, WORLD.w - w))
  const targetY = clamp(s.player.y - h / 2, 0, Math.max(0, WORLD.h - h))
  const smooth = 0.16
  state.camera.x += (targetX - state.camera.x) * smooth
  state.camera.y += (targetY - state.camera.y) * smooth
  if (Math.abs(state.camera.x - targetX) < 0.4) state.camera.x = targetX
  if (Math.abs(state.camera.y - targetY) < 0.4) state.camera.y = targetY
}

function renderWorld(dt, now) {
  const s = game.state
  const canvas = $id('world-canvas')
  const fx = $id('fx-canvas')
  if (!s || !canvas) return
  const w = canvas.clientWidth || state.width
  const h = canvas.clientHeight || state.height

  const active = worldActive()
  if (active) {
    const { x, y } = axisInput()
    state.moving = Math.hypot(x, y) > 0.02
    if (state.moving) {
      const sprint = state.sprint || state.keys.has('ShiftLeft') || state.keys.has('ShiftRight')
      game.movePlayer(x, y, Math.min(dt, 0.05), sprint)
    }
    game.update(dt)
    updateCamera(w, h)

    const zone = zoneAt(s.player.x, s.player.y)
    if (state.lastZone && zone.id !== state.lastZone) zoneBanner(zone)
    state.lastZone = zone.id
  } else {
    state.moving = false
    updateCamera(w, h)
  }

  const ctx = canvas.getContext('2d')
  drawWorld(ctx, canvas, s, state.camera, now / 1000, state.moving)

  if (fx) {
    const fctx = fx.getContext('2d')
    const quality = s.settings?.particles === false ? 0 : (s.settings?.quality || 1)
    if (quality > 0) {
      drawWeather(fctx, w, h, s.world.weather, now / 1000, quality)
    } else {
      fctx.clearRect(0, 0, w, h)
    }
  }

  updatePrompt(dt)

  state.minimapTimer -= dt
  if (state.minimapTimer <= 0) {
    state.minimapTimer = 0.2
    renderMinimap(now)
  }
}

/* ---------------- main loop ---------------- */

function frame(now) {
  const dt = Math.min(0.05, (now - state.lastFrame) / 1000 || 0)
  state.lastFrame = now

  renderTitle(now)
  if (game.state?.battle) renderBattleFrame(now)
  else if (game.state?.started) renderWorld(dt, now)

  requestAnimationFrame(frame)
}

/* ---------------- boot ---------------- */

function boot() {
  resizeAll()
  bindKeyboard()
  bindJoystick()
  initUI()
  initBattle()

  // Debug handle used by the automated smoke tests and developer console.
  globalThis.__NEXO__ = { game, state }

  window.addEventListener('resize', resizeAll)
  window.addEventListener('orientationchange', () => setTimeout(resizeAll, 120))

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) state.lastFrame = performance.now()
    else state.keys.clear()
  })

  window.addEventListener('nexo:lang', () => {
    state.titleRotate = 0
    refreshAll()
  })

  const loading = $id('loading-screen')
  if (loading) {
    setTimeout(() => { loading.hidden = true }, 350)
  }

  if (!game.state) {
    const zone = ZONES[0]
    state.lastZone = zone?.id || null
  }

  requestAnimationFrame((now) => {
    state.lastFrame = now
    frame(now)
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
