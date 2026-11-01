import { CHAPTERS, CREATURE_BY_ID } from './data.js'
import { displayName } from './core.js'
import { game, on } from './engine.js'
import { t } from './i18n.js'
import {
  initCoreUI, showGame, showTitleScreen, refreshAll, refreshHUD, refreshQuest, refreshParty,
  toast, isModalOpen, setModalCloseHook, closeModal, openModal, applyLanguage, refreshTitle,
  refreshModal, zoneBanner, eventBanner, setPrompt, worldActive, tr, openHelp,
} from './ui-core.js'
import {
  openStory, openRanch, openCodex, openJournal, openMap, openInventory, openShop,
  openNpcDialog, openDiscovery, openBattleRewards, openDungeon, openSettings,
} from './ui-panels.js'
import { openArena } from './ui-arena.js'

let pendingStory = null
let pendingDungeon = false
let lastDungeonClear = null
let lastDungeonFailed = null
let saveDotTimer = 0

function presentStory(chapter, mode = 'intro', next = null) {
  if (!chapter) return
  if (isModalOpen()) {
    pendingStory = { chapter, mode, next }
    return
  }
  openStory(chapter, mode, next)
}

function handleModalClosed() {
  if (pendingStory) {
    const queued = pendingStory
    pendingStory = null
    openStory(queued.chapter, queued.mode, queued.next)
    return
  }
  if (pendingDungeon && game.state?.dungeon) {
    pendingDungeon = false
    openDungeon()
  }
}

export function openMenu(menu) {
  const s = game.state
  if (!s?.started) return
  if (s.battle) return
  switch (menu) {
    case 'map': openMap(); break
    case 'ranch': openRanch(); break
    case 'journal': openJournal(); break
    case 'codex': openCodex(); break
    case 'arena': openArena(); break
    case 'inventory': openInventory(); break
    case 'settings': openSettings(); break
    case 'help': openHelp(); break
    default: break
  }
}

export function interact() {
  const s = game.state
  if (!s?.started || s.battle || s.dungeon || isModalOpen()) return
  const target = game.nearestInteractable()
  if (!target) {
    toast(t('toast.nointeract'), 'info')
    return
  }
  const result = game.interactNearest()
  switch (result.type) {
    case 'npc': {
      const lines = result.result?.lines || []
      if (!isModalOpen()) openNpcDialog(target.name, lines, result.result?.quest || null)
      break
    }
    case 'loot':
      if (result.result) openDiscovery(result.result)
      break
    case 'ranch':
      openRanch()
      break
    case 'arena':
      openArena()
      break
    case 'shop':
      openShop()
      break
    case 'wild':
    case 'dungeon':
    case 'locked':
    case 'none':
    default:
      break
  }
  refreshAll()
}

export function camp() {
  const s = game.state
  if (!s?.started || s.battle || s.dungeon || isModalOpen()) return
  game.healTeam(false, 0.35)
  s.world.time = (s.world.time + 1.3) % 24
  game.save()
  toast(tr('Acampas un rato. Tu equipo recupera energía.', 'You make camp. Your team recovers energy.'), 'good')
  refreshAll()
}

export function closeTopModal() {
  if (isModalOpen()) closeModal()
}

function bindActions() {
  document.querySelectorAll('[data-menu]').forEach((button) => {
    button.addEventListener('click', () => openMenu(button.dataset.menu))
  })
  document.getElementById('action-interact')?.addEventListener('click', interact)
  document.getElementById('action-team')?.addEventListener('click', () => openRanch())
  document.getElementById('action-bag')?.addEventListener('click', () => openInventory())
  document.getElementById('action-camp')?.addEventListener('click', camp)
}

function bindWindowEvents() {
  window.addEventListener('nexo:menu', (event) => openMenu(event.detail?.menu))
  window.addEventListener('nexo:party', (event) => openRanch(event.detail?.uid))
  window.addEventListener('nexo:zone', (event) => {
    if (event.detail?.zone) zoneBanner(event.detail.zone)
    refreshHUD()
  })
  window.addEventListener('nexo:lang', () => {
    applyLanguage()
    refreshTitle()
    refreshAll()
    if (isModalOpen()) refreshModal()
  })
}

function bindGameEvents() {
  on('game:start', () => {
    pendingStory = null
    pendingDungeon = false
    showGame()
    const loading = document.getElementById('loading-screen')
    if (loading) loading.hidden = true
    presentStory(CHAPTERS[0], 'intro')
  })

  on('game:loaded', (event) => {
    pendingStory = null
    pendingDungeon = false
    showGame()
    const loading = document.getElementById('loading-screen')
    if (loading) loading.hidden = true
    const s = event.detail?.state
    toast(tr(`Bienvenido de nuevo, ${s?.player?.name || 'guardián'}.`, `Welcome back, ${s?.player?.name || 'guardian'}.`), 'good')
    if (s?.dungeon) setTimeout(() => openDungeon(), 250)
    else if (location.hash.startsWith('#invite=')) setTimeout(() => openArena(), 450)
  })

  on('toast', (event) => toast(event.detail?.text, event.detail?.kind || 'info'))

  on('save:ok', () => {
    const dot = document.getElementById('save-dot')
    if (!dot) return
    dot.classList.add('show')
    clearTimeout(saveDotTimer)
    saveDotTimer = setTimeout(() => dot.classList.remove('show'), 1200)
  })

  on('weather:change', () => refreshHUD())
  on('zone:change', (event) => {
    refreshHUD()
    if (event.detail?.zone) zoneBanner(event.detail.zone)
  })
  on('world:event', (event) => {
    eventBanner(event.detail)
    refreshHUD()
  })

  on('story:chapter', (event) => {
    presentStory(event.detail?.chapter, 'outro', event.detail?.next)
    refreshAll()
  })

  on('level:up', (event) => {
    const creature = event.detail?.creature
    const levels = event.detail?.levels || []
    if (!creature) return
    const learned = (event.detail?.learned || []).map((move) => move.name).join(' · ')
    toast(tr(
      `¡${displayName(creature)} sube a Nv ${levels[levels.length - 1]}!${learned ? ` Aprende ${learned}.` : ''}`,
      `${displayName(creature)} reached Lv ${levels[levels.length - 1]}!${learned ? ` Learned ${learned}.` : ''}`,
    ), 'good')
  })

  on('creature:evolved', (event) => {
    const next = event.detail?.newSpecies
    if (next) toast(tr(`¡Evolución! ${next.name} ha despertado.`, `Evolution! ${next.name} has awakened.`), 'evolve')
    refreshAll()
  })

  on('capture:success', (event) => {
    const species = event.detail?.species
    if (species) toast(tr(`${species.name} se ha unido a tu equipo.`, `${species.name} joined your team.`), 'good')
    refreshAll()
  })

  on('battle:finished', (event) => {
    const extra = {}
    if (lastDungeonClear) {
      extra.dungeonClear = lastDungeonClear
      lastDungeonClear = null
    }
    if (lastDungeonFailed) {
      extra.dungeonFailed = lastDungeonFailed
      lastDungeonFailed = null
    }
    pendingDungeon = !!game.state?.dungeon
    openBattleRewards(event.detail, extra)
    refreshAll()
  })

  on('dungeon:enter', () => {
    pendingDungeon = false
    openDungeon()
  })
  on('dungeon:floor', () => {
    pendingDungeon = true
    refreshAll()
  })
  on('dungeon:cleared', (event) => {
    lastDungeonClear = event.detail
    pendingDungeon = false
    refreshAll()
  })
  on('dungeon:failed', (event) => {
    lastDungeonFailed = event.detail
    pendingDungeon = false
    refreshAll()
  })
  on('dungeon:node', () => {
    if (isModalOpen() && game.state?.dungeon) refreshModal()
  })
}

export function initUI() {
  initCoreUI()
  setModalCloseHook(handleModalClosed)
  bindActions()
  bindWindowEvents()
  bindGameEvents()
  refreshTitle()
  if (!game.state) showTitleScreen()
}

export {
  isModalOpen, worldActive, refreshAll, refreshHUD, refreshQuest, refreshParty,
  toast, setPrompt, zoneBanner, eventBanner, openStory, openRanch, openCodex,
  openJournal, openMap, openInventory, openShop, openArena, openSettings,
}
