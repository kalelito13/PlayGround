import {
  CHAPTERS, CREATURE_BY_ID, CREATURES, DUNGEONS, ELEMENTS, ITEMS, NPCS, POIS,
  RELIC_BY_ID, RELICS, SIDEQUEST_BY_ID, SIDEQUESTS, TECHNIQUES, TRAPS, TRAINERS, ZONES,
} from './data.js'
import {
  clamp, displayName, hpColor, movePowerForDisplay, pct, statsForCreature, xpNeed,
} from './core.js'
import { drawMap } from './art.js'
import { game, SHOP_STOCK } from './engine.js'
import {
  elementName, getLang, localizedChapter, localizedSideQuest, localizedSideQuestById,
  rarityName, setLang, t, weatherDesc, weatherName,
} from './i18n.js'
import {
  $, esc, tr, img, fmt, elementChip, rarityChip, hpBar, rewardLine, openModal,
  closeModal, refreshModal, toast, refreshHUD, applyLanguage, refreshTitle,
} from './ui-core.js'

const speciesOf = (creature) => CREATURE_BY_ID[creature?.speciesId]
const relicPrice = (relic) => ({ raro: 700, epico: 1400, legendario: 3000 }[relic.rarity] || 1000)

function creatureCard(c, { active = false, team = false } = {}) {
  const species = speciesOf(c)
  const ratio = c.maxHp ? c.hp / c.maxHp : 0
  return `<button class="creature-card ${active ? 'active' : ''}" data-ranch-uid="${esc(c.uid)}" style="text-align:left">
    <div class="thumb"><img src="${img(c.speciesId, 128)}" alt="${esc(species?.name || '')}"></div>
    ${team ? '<span class="corner-badge" style="color:var(--gold)">EQUIPO</span>' : ''}
    <div class="c-name"><span>${esc(c.nickname || species?.name || '—')}</span><span class="faint">Nv ${c.level}</span></div>
    <div class="c-meta"><span>${esc(species?.name || '')}</span><span>${elementName(species?.element)}</span></div>
    <div class="c-hp"><i style="width:${ratio * 100}%;background:${hpColor(ratio)}"></i></div>
  </button>`
}

function statBox(label, value) {
  return `<div class="stat-box"><span>${esc(label)}</span><b>${fmt(value)}</b></div>`
}

function moveRow(id, equipped = true) {
  const move = TECHNIQUES[id]
  if (!move) return ''
  return `<div class="move-row ${equipped ? 'equipped' : ''}">
    <div class="move-icon" style="color:${ELEMENTS[move.element]?.color || 'var(--muted)'}">${move.icon || '◇'}</div>
    <div class="move-name">${esc(move.name)}<div class="move-el">${esc(elementName(move.element))} · ${esc(move.desc || '')}</div></div>
    <div class="move-power">${move.kind === 'attack' || move.kind === 'drain' ? movePowerForDisplay(id, 50) : '—'}</div>
  </div>`
}

/* ---------------- story ---------------- */

export function openStory(chapter, mode = 'intro', next = null) {
  if (!chapter) return
  openModal(() => {
    const loc = localizedChapter(chapter)
    const isOutro = mode === 'outro'
    const paras = (isOutro ? chapter.outro : chapter.intro) || []
    const kicker = isOutro ? tr('CAPÍTULO COMPLETADO', 'CHAPTER COMPLETE') : t('modal.story.chapter')
    const nextLoc = next ? localizedChapter(next) : null
    return {
      className: 'story-modal',
      kicker: `${kicker} ${String(chapter.id + 1).padStart(2, '0')}`,
      title: esc(loc?.title || chapter.title),
      sub: esc(loc?.subtitle || chapter.subtitle),
      body: `<div class="story-hero" style="border:1px solid var(--line);border-radius:13px;padding:18px 20px;margin-bottom:16px">
          <div class="story-next">${esc(loc?.objective || chapter.objective)}</div>
          <p style="margin:8px 0 0;color:var(--muted);font-size:10px;letter-spacing:.14em;text-transform:uppercase">${esc(isOutro ? tr('Consecuencias', 'Aftermath') : tr('Prólogo', 'Prologue'))}</p>
        </div>
        <div class="story-body" style="padding:0">
          ${paras.map((p, i) => `<p class="${i === paras.length - 1 && isOutro ? 'quote' : ''}">${esc(p)}</p>`).join('')}
          ${isOutro ? `<div class="story-divider"></div>${rewardLine(chapter.reward)}` : ''}
          ${nextLoc ? `<div class="story-divider"></div><div class="story-next">${esc(t('modal.story.next'))}<b>${esc(nextLoc.title)}</b></div>` : ''}
          ${isOutro && !next ? `<div class="story-divider"></div><div class="story-next">${esc(t('modal.story.final'))}<b>${esc(tr('El Nexo respira.', 'The Nexus breathes.'))}</b></div>` : ''}
        </div>`,
      footer: `<button class="btn btn-primary" data-story-continue>${esc(t('modal.story.continue'))}</button>`,
      onMount: (root) => root.querySelector('[data-story-continue]')?.addEventListener('click', () => closeModal()),
    }
  })
}

/* ---------------- ranch ---------------- */

let ranchSelected = null

export function openRanch(uid = null) {
  const s = game.state
  if (!s) return
  if (uid && s.roster.some((c) => c.uid === uid)) ranchSelected = uid
  if (!ranchSelected || !s.roster.some((c) => c.uid === ranchSelected)) {
    ranchSelected = game.getActive()?.uid || s.roster[0]?.uid
  }
  openModal(() => {
    const c = game.getCreature(ranchSelected) || s.roster[0]
    const species = speciesOf(c)
    const stats = statsForCreature(c)
    const team = s.team.includes(c.uid)
    const ready = game.evolutionReady(c)
    const nextSpecies = species?.next ? CREATURE_BY_ID[species.next] : null
    const atRanch = Math.hypot(s.player.x - 1290, s.player.y - 1270) < 270
    const cost = 40 + c.level * 14
    const ownedRelics = [...new Set(s.relics)]
    const knownExtra = c.known.filter((id) => !c.moveset.includes(id))
    const hpRatio = c.maxHp ? c.hp / c.maxHp : 0
    return {
      wide: true,
      kicker: tr('TU HOGAR', 'YOUR HOME'),
      title: t('modal.ranch.title'),
      sub: `${t('modal.ranch.sub')} · ${t('modal.ranch.party')} ${s.team.length}/6`,
      body: `<div class="ranch-layout">
        <aside class="ranch-side">
          <div class="ranch-hero">
            <div class="art"><img src="${img(c.speciesId, 260)}" alt="${esc(species?.name || '')}"></div>
            <h3>${esc(c.nickname || species?.name || '—')}</h3>
            <div class="row" style="justify-content:center;flex-wrap:wrap">${elementChip(species?.element)}${rarityChip(species?.rarity)}</div>
            <div class="faint" style="font-size:9px;margin-top:4px">${esc(species?.name || '')} · ${t('modal.level')} ${c.level}${c.shiny ? ' · ✦' : ''}</div>
          </div>
          <div class="spread" style="font-size:9px;color:var(--muted)"><span>${t('modal.hp')}</span><span>${c.hp} / ${c.maxHp}</span></div>
          ${hpBar(c.hp, c.maxHp)}
          <div class="spread" style="font-size:9px;color:var(--muted);margin-top:8px"><span>XP</span><span>${c.xp} / ${xpNeed(c.level)}</span></div>
          ${hpBar(c.xp, xpNeed(c.level))}
          <div class="stat-grid">
            ${statBox(t('modal.atk'), stats.atk)}
            ${statBox(t('modal.def'), stats.def)}
            ${statBox(t('modal.spd'), stats.spd)}
            ${statBox(t('modal.bond'), c.bond)}
          </div>
          <div class="section-title">${esc(t('modal.moves'))}</div>
          <div class="move-list">${c.moveset.map((id) => moveRow(id, true)).join('') || `<div class="empty-state">${esc(t('battle.nomoves'))}</div>`}</div>
          ${knownExtra.length ? `<div class="section-title">${esc(t('modal.known'))}</div>
            <div class="row" style="flex-wrap:wrap;gap:5px">${knownExtra.map((id) => {
              const move = TECHNIQUES[id]
              return `<button class="chip soft" data-learn-move="${esc(id)}" title="${esc(move?.desc || '')}">+ ${esc(move?.name || id)}</button>`
            }).join('')}</div>` : ''}
          <div class="section-title">${esc(t('modal.relic'))}</div>
          <div class="faint" style="font-size:9px;margin-bottom:6px">${c.relic ? esc(RELIC_BY_ID[c.relic]?.name || c.relic) : esc(t('modal.norelic'))}</div>
          ${ownedRelics.length ? `<div class="row">
            <select id="ranch-relic" style="flex:1;padding:7px;border-radius:7px;background:rgba(2,10,13,.7);color:var(--ink);border:1px solid var(--line);font-size:10px">
              <option value="">${esc(t('modal.norelic'))}</option>
              ${ownedRelics.map((id) => `<option value="${esc(id)}" ${c.relic === id ? 'selected' : ''}>${esc(RELIC_BY_ID[id]?.name || id)}</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-teal" data-relic-apply>${esc(t('modal.equip'))}</button>
          </div>` : `<div class="faint" style="font-size:9px">${esc(tr('Encuentra reliquias explorando mazmorras.', 'Find relics by exploring dungeons.'))}</div>`}
          ${c.relic ? `<button class="btn btn-ghost btn-sm" data-relic-remove style="margin-top:6px">${esc(t('modal.unequip'))}</button>` : ''}
        </aside>
        <section class="stack">
          <div class="spread" style="flex-wrap:wrap">
            <div class="row">
              <button class="btn btn-primary btn-sm" data-ranch-rest ${atRanch ? '' : 'disabled'}>⌂ ${esc(t('modal.ranch.rest'))}</button>
              <button class="btn btn-teal btn-sm" data-ranch-train>▲ ${esc(t('modal.ranch.train'))} · ◉ ${fmt(cost)}</button>
              <button class="btn btn-sm" data-ranch-feed>🍯 ${esc(t('modal.feed'))}</button>
            </div>
            <button class="btn ${team ? 'btn-ghost' : 'btn-teal'} btn-sm" data-ranch-team>${team ? esc(tr('Quitar del equipo', 'Remove from team')) : esc(tr('Añadir al equipo', 'Add to team'))}</button>
          </div>
          <div class="lore-box" style="margin:0">${esc(t('modal.ranch.info'))}</div>
          ${!atRanch ? `<div class="faint" style="font-size:9px">${esc(t('toast.ranchnot'))}</div>` : ''}
          ${ready && nextSpecies ? `<div class="chapter-card current" style="padding:12px">
            <div class="chapter-num">${esc(t('modal.evolutionready'))}</div>
            <div class="spread" style="margin-top:6px">
              <div><h3 style="margin:0">${esc(species.name)} → ${esc(nextSpecies.name)}</h3><p style="margin:3px 0 0">${esc(nextSpecies.lore)}</p></div>
              <button class="btn btn-primary btn-sm" data-ranch-evolve>✧ ${esc(t('modal.evolve'))}</button>
            </div>
          </div>` : nextSpecies ? `<div class="faint" style="font-size:9px">${esc(t('modal.evolutionlater'))} · ${t('modal.noevolve')} (Nv ${species.evoLevel})</div>` : ''}
          <div class="section-title">${esc(t('modal.ranch.roster'))} · ${s.roster.length}</div>
          <div class="grid grid-auto">${s.roster.map((entry) => creatureCard(entry, {
            active: entry.uid === c.uid, team: s.team.includes(entry.uid),
          })).join('')}</div>
          <div class="faint" style="font-size:9px">${esc(tr('Haz clic en una criatura para ver su ficha completa.', 'Click a creature to open its full record.'))}</div>
        </section>
      </div>`,
      footer: `<button class="btn btn-ghost" data-ranch-close>${esc(t('modal.close'))}</button>`,
      onMount: (root) => {
        root.querySelector('[data-ranch-close]')?.addEventListener('click', () => closeModal())
        root.querySelectorAll('[data-ranch-uid]').forEach((card) => {
          card.addEventListener('click', () => {
            ranchSelected = card.dataset.ranchUid
            refreshModal()
          })
        })
        root.querySelector('[data-ranch-rest]')?.addEventListener('click', () => {
          if (Math.hypot(game.state.player.x - 1290, game.state.player.y - 1270) >= 270) {
            toast(t('toast.ranchnot'), 'bad')
            return
          }
          game.healTeam(true)
          refreshModal()
        })
        root.querySelector('[data-ranch-train]')?.addEventListener('click', () => {
          const result = game.trainCreature(c.uid)
          if (result) toast(tr(`${displayName(c)} gana experiencia.`, `${displayName(c)} gains experience.`), 'good')
          refreshModal()
        })
        root.querySelector('[data-ranch-feed]')?.addEventListener('click', () => {
          game.feedCreature(c.uid)
          refreshModal()
        })
        root.querySelector('[data-ranch-evolve]')?.addEventListener('click', () => {
          const result = game.evolveCreature(c.uid)
          if (result) refreshModal()
        })
        root.querySelector('[data-ranch-team]')?.addEventListener('click', () => {
          if (!game.toggleTeam(c.uid)) toast(tr('No se puede cambiar el equipo ahora.', 'The team cannot be changed right now.'), 'bad')
          refreshModal()
        })
        root.querySelector('[data-relic-apply]')?.addEventListener('click', () => {
          const value = root.querySelector('#ranch-relic')?.value
          if (!value) {
            game.unequipRelic(c.uid)
          } else if (!game.equipRelic(c.uid, value)) {
            toast(tr('Esa reliquia no está disponible.', 'That relic is not available.'), 'bad')
          }
          refreshModal()
        })
        root.querySelector('[data-relic-remove]')?.addEventListener('click', () => {
          game.unequipRelic(c.uid)
          refreshModal()
        })
        root.querySelectorAll('[data-learn-move]').forEach((button) => {
          button.addEventListener('click', () => {
            const id = button.dataset.learnMove
            if (!TECHNIQUES[id] || c.moveset.includes(id)) return
            if (c.moveset.length < 4) c.moveset.push(id)
            else {
              let weakest = 0
              for (let i = 1; i < c.moveset.length; i++) {
                if (movePowerForDisplay(c.moveset[i], c.level) < movePowerForDisplay(c.moveset[weakest], c.level)) weakest = i
              }
              c.moveset[weakest] = id
            }
            game.save()
            toast(tr('Técnica equipada.', 'Technique equipped.'), 'good')
            refreshModal()
          })
        })
      },
    }
  })
}

/* ---------------- codex ---------------- */

let codexSelected = null
let codexQuery = ''
let codexElement = 'all'

export function openCodex(selected = null) {
  if (selected) codexSelected = selected
  const s = game.state
  if (!s) return
  if (codexSelected) {
    const species = CREATURE_BY_ID[codexSelected]
    const entry = s.codex[codexSelected]
    const discovered = !!(entry?.seen || entry?.caught)
    if (!species) { codexSelected = null; return openCodex() }
    openModal(() => {
      const forms = CREATURES.filter((c) => c.family === species.family).sort((a, b) => a.stage - b.stage)
      const stats = species.statsAt(50)
      return {
        wide: true,
        kicker: t('modal.codex.title'),
        title: discovered ? esc(species.name) : esc(t('modal.codex.unknown')),
        sub: discovered ? `${esc(species.lore)}` : t('modal.codex.lore'),
        body: `<div class="codex-detail">
          <div>
            <div class="codex-art"><img src="${img(species.id, 320)}" alt="${esc(species.name)}" ${discovered ? '' : 'style="filter:brightness(0) opacity(.35)"'}></div>
            <div class="codex-evo">${forms.map((form) => {
              const seen = !!s.codex[form.id]?.seen || !!s.codex[form.id]?.caught
              return `<div class="evo-node ${form.id === species.id ? 'current' : ''}">
                <img src="${img(form.id, 96)}" alt="" ${seen ? '' : 'style="filter:brightness(0) opacity(.25)"'}>
                <div>${seen ? esc(form.name) : '???'}</div><div>Nv ${form.evoLevel || '—'}</div>
              </div>`
            }).join('<span class="faint">→</span>')}</div>
          </div>
          <div>
            <div class="row" style="flex-wrap:wrap">${elementChip(species.element)}${rarityChip(species.rarity)}<span class="chip soft">${esc(tr('Etapa', 'Stage'))} ${species.stage + 1}</span>${species.mythic ? '<span class="chip" style="color:var(--danger)">MITO</span>' : ''}</div>
            ${discovered ? `<div class="lore-box">${esc(species.lore)}</div>` : `<div class="lore-box">${esc(t('modal.codex.unknown'))}</div>`}
            <div class="section-title">${esc(t('common.stats'))} · Nv 50</div>
            <div class="stat-grid">
              ${statBox(t('modal.hp'), stats.hp)}${statBox(t('modal.atk'), stats.atk)}
              ${statBox(t('modal.def'), stats.def)}${statBox(t('modal.spd'), stats.spd)}
            </div>
            <div class="section-title">${esc(t('modal.moves'))}</div>
            <div class="move-list">${species.learnset.map((entryMove) => {
              const move = TECHNIQUES[entryMove.id]
              if (!move) return ''
              return `<div class="move-row"><div class="move-icon" style="color:${ELEMENTS[move.element]?.color || 'var(--muted)'}">${move.icon || '◇'}</div>
                <div class="move-name">${esc(move.name)}<div class="move-el">${esc(elementName(move.element))} · ${esc(move.desc || '')}</div></div>
                <div class="move-power">Nv ${entryMove.level}</div></div>`
            }).join('')}</div>
            <div class="section-title">${esc(t('modal.codex.forms'))}</div>
            <div class="faint" style="font-size:10px;line-height:1.6">${forms.map((f) => `${f.name}${f.evoLevel ? ` (Nv ${f.evoLevel})` : ''}`).join(' → ')}</div>
          </div>
        </div>`,
        footer: `<button class="btn btn-ghost" data-codex-back>← ${esc(t('modal.back'))}</button>`,
        onMount: (root) => root.querySelector('[data-codex-back]')?.addEventListener('click', () => {
          codexSelected = null
          refreshModal()
        }),
      }
    })
    return
  }

  openModal(() => {
    const caught = game.codexCount(true)
    const seen = game.codexCount(false)
    return {
      wide: true,
      kicker: t('modal.codex.title'),
      title: t('modal.codex.title'),
      sub: t('modal.codex.sub'),
      body: `<div class="codex-tools">
        <input id="codex-search" placeholder="${esc(t('modal.codex.search'))}" value="${esc(codexQuery)}" autocomplete="off">
        <select id="codex-element" style="padding:9px;border-radius:8px;background:rgba(2,10,13,.7);color:var(--ink);border:1px solid var(--line);font-size:11px">
          <option value="all">${esc(t('modal.codex.all'))}</option>
          ${Object.keys(ELEMENTS).map((el) => `<option value="${el}" ${codexElement === el ? 'selected' : ''}>${esc(elementName(el))}</option>`).join('')}
        </select>
        <span class="codex-count">${esc(t('modal.codex.found'))}: <b>${caught}</b> · ${esc(t('modal.codex.total'))}: <b>${CREATURES.length}</b> · ${esc(tr('Vistas', 'Seen'))}: <b>${seen}</b></span>
      </div>
      <div class="grid grid-auto" id="codex-grid">
        ${CREATURES.map((species) => {
          const entry = s.codex[species.id]
          const discovered = !!(entry?.seen || entry?.caught)
          const name = discovered ? species.name : '???'
          return `<button class="creature-card ${discovered ? '' : 'locked'}" data-codex-id="${species.id}" data-name="${esc(species.name.toLowerCase())}" data-element="${species.element}">
            <div class="thumb"><img src="${img(species.id, 128)}" alt="${esc(name)}" ${discovered ? '' : 'style="filter:brightness(0) opacity(.32)"'}></div>
            <div class="c-name"><span>${esc(name)}</span><span class="faint">${discovered ? `#${String(species.stage + 1).padStart(2, '0')}` : '???'}</span></div>
            <div class="c-meta"><span>${discovered ? esc(elementName(species.element)) : esc(t('common.unknown'))}</span><span style="color:${discovered ? (species.palette?.[2] || 'var(--muted)') : 'var(--faint)'}">${discovered ? esc(rarityName(species.rarity)) : '—'}</span></div>
            <div class="c-hp"><i style="width:${discovered ? 100 : 0}%;background:${species.palette?.[2] || 'var(--teal)'}"></i></div>
          </button>`
        }).join('')}
      </div>`,
      footer: `<button class="btn btn-ghost" data-codex-close>${esc(t('modal.close'))}</button>`,
      onMount: (root) => {
        const input = root.querySelector('#codex-search')
        const select = root.querySelector('#codex-element')
        const filter = () => {
          const q = (input?.value || '').toLowerCase().trim()
          codexQuery = input?.value || ''
          codexElement = select?.value || 'all'
          root.querySelectorAll('[data-codex-id]').forEach((card) => {
            const matchText = !q || card.dataset.name.includes(q) || card.dataset.codexId.includes(q)
            const matchElement = codexElement === 'all' || card.dataset.element === codexElement
            card.style.display = matchText && matchElement ? '' : 'none'
          })
        }
        input?.addEventListener('input', filter)
        select?.addEventListener('change', filter)
        filter()
        root.querySelectorAll('[data-codex-id]').forEach((card) => {
          card.addEventListener('click', () => {
            const id = card.dataset.codexId
            const entry = s.codex[id]
            if (!entry?.seen && !entry?.caught) {
              toast(tr('Aún no has visto esta especie.', 'You have not seen this species yet.'), 'info')
              return
            }
            codexSelected = id
            refreshModal()
          })
        })
        root.querySelector('[data-codex-close]')?.addEventListener('click', () => closeModal())
      },
    }
  })
}

/* ---------------- journal ---------------- */

export function openJournal() {
  const s = game.state
  if (!s) return
  openModal(() => {
    const chapter = CHAPTERS[s.quests.main]
    const current = localizedChapter(chapter)
    const progress = game.mainProgress()
    const completedMain = (s.quests.completed || []).filter((id) => typeof id === 'number')
    const activeSides = Object.entries(s.quests.side || {}).filter(([, data]) => data.status === 'active')
    const doneSides = (s.quests.completed || []).filter((id) => typeof id === 'string')
    const availableSides = SIDEQUESTS.filter((q) => !s.quests.side[q.id] && !doneSides.includes(q.id))
    return {
      wide: true,
      kicker: t('modal.journal.title'),
      title: t('modal.journal.title'),
      sub: t('modal.journal.sub'),
      body: `<div class="section-title">${esc(t('modal.journal.main'))}</div>
        ${current ? `<div class="chapter-card current">
          <div class="chapter-num">${esc(t('modal.journal.chapter'))} ${String(chapter.id + 1).padStart(2, '0')} · ${esc(t('common.progress'))} ${progress.current}/${progress.target}</div>
          <h3>${esc(current.title)}</h3>
          <p>${esc(current.subtitle)}</p>
          <div class="lore-box" style="margin:8px 0">${esc(current.objective)}</div>
          ${hpBar(progress.current, progress.target)}
          ${rewardLine(chapter.reward)}
        </div>` : `<div class="empty-state">${esc(t('modal.journal.final'))}</div>`}
        ${completedMain.length ? `<div class="section-title">${esc(t('modal.journal.completed'))}</div>
          <div class="stack">${completedMain.map((id) => {
            const loc = localizedChapter(CHAPTERS[id])
            return `<div class="quest-item done"><div class="q-icon">✓</div><div><h4>${esc(loc?.title || id)}</h4><p>${esc(loc?.objective || '')}</p></div></div>`
          }).join('')}</div>` : ''}

        <div class="section-title">${esc(t('modal.journal.side'))} · ${esc(t('modal.journal.active'))}</div>
        <div class="stack">
          ${activeSides.length ? activeSides.map(([id, data]) => {
            const q = localizedSideQuestById(id)
            const p = game.sideProgress(id)
            return `<div class="quest-item ${data.ready ? 'ready' : ''}">
              <div class="q-icon">${data.ready ? '!' : '◇'}</div>
              <div style="flex:1"><h4>${esc(q?.title || id)}</h4><p>${esc(q?.desc || '')}</p>
                ${hpBar(p.current, p.target)}
                <div class="q-foot"><span>${p.current} / ${p.target}</span>${data.ready ? `<span class="gold">${esc(t('hud.ready'))}</span>` : ''}</div>
                ${rewardLine(q?.reward)}
              </div>
            </div>`
          }).join('') : `<div class="empty-state">${esc(t('hud.none'))}</div>`}
        </div>

        ${availableSides.length ? `<div class="section-title">${esc(t('modal.journal.available'))}</div>
          <div class="stack">${availableSides.map((q) => {
            const loc = localizedSideQuest(q)
            const npc = NPCS.find((n) => n.id === q.npc)
            return `<div class="quest-item">
              <div class="q-icon">＋</div>
              <div><h4>${esc(loc?.title || q.title)}</h4><p>${esc(loc?.desc || q.desc)}</p>
              <div class="q-foot"><span>${esc(t('modal.journal.talk'))}: ${esc(npc?.name || q.npc)}</span></div>${rewardLine(q.reward)}</div>
            </div>`
          }).join('')}</div>` : ''}

        ${doneSides.length ? `<div class="section-title">${esc(t('modal.journal.completed'))}</div>
          <div class="stack">${doneSides.map((id) => {
            const q = localizedSideQuestById(id)
            return `<div class="quest-item done"><div class="q-icon">✓</div><div><h4>${esc(q?.title || id)}</h4><p>${esc(q?.desc || '')}</p></div></div>`
          }).join('')}</div>` : ''}`,
      footer: `<button class="btn btn-ghost" data-journal-close>${esc(t('modal.close'))}</button>`,
      onMount: (root) => root.querySelector('[data-journal-close]')?.addEventListener('click', () => closeModal()),
    }
  })
}

/* ---------------- map ---------------- */

function fitCanvas(canvas, width, height) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.max(1, Math.floor(width * dpr))
  canvas.height = Math.max(1, Math.floor(height * dpr))
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

export function openMap() {
  const s = game.state
  if (!s) return
  openModal(() => {
    const currentZone = ZONES.find((z) => Math.hypot(s.player.x - z.x, s.player.y - z.y) < z.r) || ZONES[0]
    return {
      wide: true,
      kicker: t('modal.map.title'),
      title: t('modal.map.title'),
      sub: `${t('modal.map.sub')} · ${weatherName(s.world.weather)}`,
      body: `<div class="map-shell">
        <div class="map-canvas-wrap"><canvas id="map-canvas"></canvas>
          <div class="map-legend"><span>◈ ${esc(tr('Mazmorra', 'Dungeon'))}</span><span>⌂ ${esc(tr('Rancho', 'Ranch'))}</span><span>⚔ ${esc(tr('Coliseo', 'Arena'))}</span><span>⛺ ${esc(tr('Aldea', 'Village'))}</span></div>
        </div>
        <div class="map-side">
          <div class="lore-box" style="margin:0">${esc(currentZone.name)} · ${esc(currentZone.subtitle)}<br><span class="faint">${esc(weatherName(s.world.weather))}: ${esc(weatherDesc(s.world.weather))}</span></div>
          ${POIS.map((poi) => {
            const locked = !!poi.hidden && s.quests.main < 9
            const here = Math.hypot(s.player.x - poi.x, s.player.y - poi.y) < 80
            const dungeon = poi.type === 'dungeon'
            return `<div class="map-place" data-poi-row="${poi.id}">
              <div class="icon" style="color:${poi.color}">${poi.icon}</div>
              <div style="flex:1"><b>${esc(poi.name)}</b><small>${locked ? esc(t('modal.map.locked')) : esc(poi.desc)}</small></div>
              ${here ? `<span class="chip soft">${esc(t('modal.map.current'))}</span>` : `<button class="btn btn-sm ${dungeon ? 'btn-teal' : 'btn-ghost'}" data-map-poi="${poi.id}" ${locked ? 'disabled' : ''}>${locked ? esc(t('modal.map.locked')) : dungeon ? esc(tr('Entrar', 'Enter')) : esc(t('modal.map.travel'))}</button>`}
            </div>`
          }).join('')}
        </div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-map-close>${esc(t('modal.close'))}</button>`,
      onMount: (root) => {
        const canvas = root.querySelector('#map-canvas')
        if (canvas) {
          const wrap = canvas.parentElement
          const w = wrap.clientWidth || 700
          const h = wrap.clientHeight || 430
          const ctx = fitCanvas(canvas, w, h)
          drawMap(ctx, game.state, w, h)
        }
        root.querySelector('[data-map-close]')?.addEventListener('click', () => closeModal())
        root.querySelectorAll('[data-map-poi]').forEach((button) => {
          button.addEventListener('click', () => {
            const poi = POIS.find((p) => p.id === button.dataset.mapPoi)
            if (!poi) return
            if (poi.type === 'dungeon') {
              closeModal()
              game.enterDungeon(poi.dungeon)
            } else {
              closeModal()
              if (game.teleport(poi.id)) {
                refreshHUD()
                const destZone = ZONES.find((z) => Math.hypot(game.state.player.x - z.x, game.state.player.y - z.y) < z.r) || currentZone
                window.dispatchEvent(new CustomEvent('nexo:zone', { detail: { zone: destZone } }))
              }
            }
          })
        })
      },
    }
  })
}

/* ---------------- inventory ---------------- */

let invTab = 'traps'

export function openInventory(tab = null) {
  if (tab) invTab = tab
  const s = game.state
  if (!s) return
  openModal(() => {
    const tabs = [
      ['traps', t('modal.inv.traps')], ['items', t('modal.inv.items')], ['relics', t('modal.inv.relics')],
    ]
    let content = ''
    if (invTab === 'traps') {
      content = `<div class="grid grid-2">${TRAPS.map((trap) => {
        const count = s.inventory.traps[trap.id] || 0
        return `<div class="item-card"><div class="item-icon" style="color:${trap.color}">${trap.icon}</div>
          <div style="flex:1"><h4>${esc(trap.name)} <span class="chip soft">×${count}</span></h4><p>${esc(trap.desc)}</p>
          <div class="item-foot"><span class="price">${esc(tr('Rango', 'Tier'))} ${trap.tier} · +${Math.round(trap.bonus * 100)}%</span></div></div>
        </div>`
      }).join('')}</div>`
    } else if (invTab === 'items') {
      content = `<div class="grid grid-2">${Object.values(ITEMS).map((item) => {
        const count = s.inventory.items[item.id] || 0
        return `<div class="item-card"><div class="item-icon" style="color:${item.color}">${item.icon}</div>
          <div style="flex:1"><h4>${esc(item.name)} <span class="chip soft">×${count}</span></h4><p>${esc(item.desc)}</p>
          <div class="item-foot"><span class="price">◉ ${item.price}</span>${count ? `<button class="btn btn-sm btn-teal" data-item-use="${item.id}">${esc(t('modal.use'))}</button>` : ''}</div></div>
        </div>`
      }).join('')}</div>`
    } else {
      const owned = [...new Set(s.relics)]
      content = owned.length ? `<div class="grid grid-2">${owned.map((id) => {
        const relic = RELIC_BY_ID[id]
        const count = s.relics.filter((x) => x === id).length
        return `<div class="item-card"><div class="item-icon">${relic.icon}</div>
          <div style="flex:1"><h4>${esc(relic.name)} <span class="chip soft">×${count}</span></h4><p>${esc(relic.desc)}</p>
          <div class="item-foot"><span class="price" style="color:${ELEMENTS[relic.element]?.color || 'var(--violet)'}">${esc(rarityName(relic.rarity))}</span>
          <button class="btn btn-sm btn-teal" data-relic-equip="${id}">${esc(t('modal.equip'))}</button></div></div>
        </div>`
      }).join('')}</div>` : `<div class="empty-state">${esc(t('modal.inv.empty'))}</div>`
    }
    return {
      wide: true,
      kicker: t('modal.inv.title'),
      title: t('modal.inv.title'),
      sub: `${t('hud.coins')}: ◉ ${fmt(s.player.coins)} · ${t('hud.shards')}: ✧ ${fmt(s.player.shards)}`,
      body: `<div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${invTab === id ? 'active' : ''}" data-inv-tab="${id}">${esc(label)}</button>`).join('')}</div>${content}`,
      footer: `<button class="btn btn-ghost" data-inv-close>${esc(t('modal.close'))}</button>`,
      onMount: (root) => {
        root.querySelector('[data-inv-close]')?.addEventListener('click', () => closeModal())
        root.querySelectorAll('[data-inv-tab]').forEach((button) => button.addEventListener('click', () => {
          invTab = button.dataset.invTab
          refreshModal()
        }))
        root.querySelectorAll('[data-item-use]').forEach((button) => button.addEventListener('click', () => openItemTarget(button.dataset.itemUse)))
        root.querySelectorAll('[data-relic-equip]').forEach((button) => button.addEventListener('click', () => openRelicTarget(button.dataset.relicEquip)))
      },
    }
  })
}

function openItemTarget(itemId) {
  const s = game.state
  const item = ITEMS[itemId]
  if (!s || !item) return
  const valid = s.roster.filter((c) => item.revive ? c.hp <= 0 : c.hp > 0)
  if (!valid.length) {
    toast(item.revive ? tr('No hay criaturas debilitadas.', 'No fainted creatures.') : tr('No hay criaturas que puedan usarlo.', 'No creature can use it.'), 'bad')
    return
  }
  openModal(() => ({
    narrow: true,
    kicker: t('modal.inv.items'),
    title: esc(item.name),
    sub: esc(item.desc),
    body: `<div class="grid grid-2">${valid.map((c) => creatureCard(c, { team: s.team.includes(c.uid) })).join('')}</div>`,
    footer: `<button class="btn btn-ghost" data-target-back>← ${esc(t('modal.back'))}</button>`,
    onMount: (root) => {
      root.querySelectorAll('[data-ranch-uid]').forEach((card) => card.addEventListener('click', () => {
        const result = game.useItemOutside(itemId, card.dataset.ranchUid)
        if (result) {
          invTab = 'items'
          openInventory('items')
        } else {
          toast(tr('No se pudo usar el objeto.', 'The item could not be used.'), 'bad')
        }
      }))
      root.querySelector('[data-target-back]')?.addEventListener('click', () => openInventory('items'))
    },
  }))
}

function openRelicTarget(relicId) {
  const s = game.state
  const relic = RELIC_BY_ID[relicId]
  if (!s || !relic) return
  openModal(() => ({
    narrow: true,
    kicker: t('modal.relic'),
    title: esc(relic.name),
    sub: esc(relic.desc),
    body: `<div class="grid grid-2">${s.roster.map((c) => creatureCard(c, { team: s.team.includes(c.uid) })).join('')}</div>`,
    footer: `<button class="btn btn-ghost" data-target-back>← ${esc(t('modal.back'))}</button>`,
    onMount: (root) => {
      root.querySelectorAll('[data-ranch-uid]').forEach((card) => card.addEventListener('click', () => {
        if (game.equipRelic(card.dataset.ranchUid, relicId)) openInventory('relics')
        else toast(tr('No se pudo equipar la reliquia.', 'The relic could not be equipped.'), 'bad')
      }))
      root.querySelector('[data-target-back]')?.addEventListener('click', () => openInventory('relics'))
    },
  }))
}

/* ---------------- shop ---------------- */

let shopTab = 'traps'

export function openShop(tab = null) {
  if (tab) shopTab = tab
  const s = game.state
  if (!s) return
  openModal(() => {
    let content = ''
    if (shopTab === 'traps') {
      content = `<div class="grid grid-2">${TRAPS.map((trap) => {
        const owned = s.inventory.traps[trap.id] || 0
        return `<div class="item-card"><div class="item-icon" style="color:${trap.color}">${trap.icon}</div>
          <div style="flex:1"><h4>${esc(trap.name)}</h4><p>${esc(trap.desc)}</p>
          <div class="item-foot"><span class="price">◉ ${trap.cost} · ${esc(t('modal.shop.owned'))} ${owned}</span>
          <button class="btn btn-sm ${s.player.coins >= trap.cost ? 'btn-teal' : 'btn-ghost'}" data-buy-kind="trap" data-buy-id="${trap.id}" ${s.player.coins >= trap.cost ? '' : 'disabled'}>${esc(t('modal.buy'))}</button></div></div>
        </div>`
      }).join('')}</div>`
    } else if (shopTab === 'items') {
      content = `<div class="grid grid-2">${SHOP_STOCK.items.map((id) => {
        const item = ITEMS[id]
        const owned = s.inventory.items[id] || 0
        return `<div class="item-card"><div class="item-icon" style="color:${item.color}">${item.icon}</div>
          <div style="flex:1"><h4>${esc(item.name)}</h4><p>${esc(item.desc)}</p>
          <div class="item-foot"><span class="price">◉ ${item.price} · ${esc(t('modal.shop.owned'))} ${owned}</span>
          <button class="btn btn-sm ${s.player.coins >= item.price ? 'btn-teal' : 'btn-ghost'}" data-buy-kind="item" data-buy-id="${id}" ${s.player.coins >= item.price ? '' : 'disabled'}>${esc(t('modal.buy'))}</button></div></div>
        </div>`
      }).join('')}</div>`
    } else {
      content = `<div class="grid grid-2">${SHOP_STOCK.relics.map((id) => {
        const relic = RELIC_BY_ID[id]
        const price = relicPrice(relic)
        const owned = s.relics.filter((x) => x === id).length
        return `<div class="item-card"><div class="item-icon">${relic.icon}</div>
          <div style="flex:1"><h4>${esc(relic.name)}</h4><p>${esc(relic.desc)}</p>
          <div class="item-foot"><span class="price">◉ ${fmt(price)} · ${esc(t('modal.shop.owned'))} ${owned}</span>
          <button class="btn btn-sm ${s.player.coins >= price ? 'btn-teal' : 'btn-ghost'}" data-buy-kind="relic" data-buy-id="${id}" ${s.player.coins >= price ? '' : 'disabled'}>${esc(t('modal.buy'))}</button></div></div>
        </div>`
      }).join('')}</div>`
    }
    const tabs = [['traps', t('modal.shop.traps')], ['items', t('modal.shop.items')], ['relics', t('modal.shop.relics')]]
    return {
      wide: true,
      kicker: t('modal.shop.title'),
      title: t('modal.shop.title'),
      sub: `${t('modal.shop.sub')} · ◉ ${fmt(s.player.coins)}`,
      body: `<div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${shopTab === id ? 'active' : ''}" data-shop-tab="${id}">${esc(label)}</button>`).join('')}</div>${content}`,
      footer: `<button class="btn btn-ghost" data-shop-close>${esc(t('modal.close'))}</button>`,
      onMount: (root) => {
        root.querySelector('[data-shop-close]')?.addEventListener('click', () => closeModal())
        root.querySelectorAll('[data-shop-tab]').forEach((button) => button.addEventListener('click', () => {
          shopTab = button.dataset.shopTab
          refreshModal()
        }))
        root.querySelectorAll('[data-buy-kind]').forEach((button) => button.addEventListener('click', () => {
          if (game.buy(button.dataset.buyKind, button.dataset.buyId, 1)) {
            toast(t('modal.shop.bought'), 'good')
            refreshModal()
          }
        }))
      },
    }
  })
}

/* ---------------- npc / discovery ---------------- */

export function openNpcDialog(name, lines = [], quest = null) {
  openModal(() => ({
    narrow: true,
    kicker: tr('ENCUENTRO', 'ENCOUNTER'),
    title: esc(name),
    sub: quest ? esc(localizedSideQuest(quest)?.title || quest.title) : esc(tr('Habitante de Vértice', 'A resident of Vértice')),
    body: `<div class="story-body" style="padding:0">${lines.map((line) => `<p>${esc(line)}</p>`).join('')}</div>
      ${quest ? `<div class="lore-box">${esc(localizedSideQuest(quest)?.desc || quest.desc)}</div>${rewardLine(quest.reward)}` : ''}`,
    footer: `<button class="btn btn-primary" data-npc-close>${esc(t('modal.continue'))}</button>`,
    onMount: (root) => root.querySelector('[data-npc-close]')?.addEventListener('click', () => closeModal()),
  }))
}

export function openDiscovery(result) {
  if (!result) return
  openModal(() => {
    const relic = result.relic || (result.type === 'relic' ? result.relic : null)
    return {
      narrow: true,
      kicker: tr('HALLAZGO', 'DISCOVERY'),
      title: relic ? esc(relic.name) : result.type === 'shards' ? `✧ ${result.amount || ''}` : esc(result.trap?.name || tr('Hallazgo', 'Discovery')),
      sub: esc(result.text || ''),
      body: relic ? `<div class="lore-box">${esc(relic.desc)}</div><div class="row" style="justify-content:center"><img src="${img('myth_nexo', 160)}" alt="" style="height:130px;object-fit:contain"></div>` : `<div class="empty-state">${esc(result.text || '')}</div>`,
      footer: `<button class="btn btn-primary" data-discovery-close>${esc(t('modal.continue'))}</button>`,
      onMount: (root) => root.querySelector('[data-discovery-close]')?.addEventListener('click', () => closeModal()),
    }
  })
}

/* ---------------- rewards ---------------- */

export function openBattleRewards(detail, extra = {}) {
  const result = detail?.result || 'win'
  const rewards = detail?.rewards || {}
  const titles = {
    win: [tr('VICTORIA', 'VICTORY'), tr('El vínculo se fortalece.', 'The bond grows stronger.')],
    captured: [tr('CAPTURA EXITOSA', 'CAPTURE COMPLETE'), tr('Una nueva puerta se abre.', 'A new door opens.')],
    loss: [tr('DERROTA', 'DEFEAT'), tr('Vértice te espera para intentarlo de nuevo.', 'Vértice waits for another attempt.')],
    fled: [tr('HUIDA', 'ESCAPED'), tr('A veces retroceder también es una decisión.', 'Sometimes retreat is also a decision.')],
  }
  const [title, sub] = titles[result] || titles.win
  const levels = rewards.levels || []
  const evolutions = rewards.evolutions || []
  const items = rewards.items || []
  openModal(() => ({
    narrow: true,
    kicker: t('battle.rewards'),
    title,
    sub,
    body: `<div class="stack">
      <div class="row" style="flex-wrap:wrap">
        <span class="chip" style="color:var(--gold)">◉ ${fmt(rewards.coins || 0)}</span>
        <span class="chip" style="color:var(--teal-soft)">✧ ${fmt(rewards.shards || 0)}</span>
        <span class="chip">XP ${fmt(rewards.xp || 0)}</span>
        ${rewards.rank ? `<span class="chip" style="color:${rewards.rank > 0 ? 'var(--green)' : 'var(--danger)'}">${rewards.rank > 0 ? '+' : ''}${rewards.rank} ${tr('rango', 'rank')}</span>` : ''}
      </div>
      ${items.length ? `<div class="section-title">${esc(tr('Objetos', 'Items'))}</div><div class="stack">${items.map((entry) => `<div class="item-card"><div class="item-icon">${entry.item?.icon || '◈'}</div><div><h4>${esc(entry.item?.name || '')}</h4><p>${esc(tr('Objeto encontrado', 'Item found'))}</p></div></div>`).join('')}</div>` : ''}
      ${levels.length ? `<div class="section-title">${esc(t('modal.reward.levelup'))}</div><div class="stack">${levels.map((entry) => `<div class="quest-item"><div class="q-icon">▲</div><div><h4>${esc(displayName(entry.creature))} → Nv ${entry.levels.join(', ')}</h4><p>${esc(entry.learned?.map((m) => m.name).join(' · ') || '')}</p></div></div>`).join('')}</div>` : ''}
      ${evolutions.length ? `<div class="section-title">${esc(t('modal.reward.evolve'))}</div><div class="stack">${evolutions.map((c) => `<div class="quest-item ready"><div class="q-icon">✧</div><div><h4>${esc(displayName(c))}</h4><p>${esc(t('modal.reward.evolvehint'))}</p></div></div>`).join('')}</div>` : ''}
      ${extra.dungeonClear ? `<div class="section-title">${esc(t('modal.dungeon.clear'))}</div><div class="chapter-card current"><h3>${esc(extra.dungeonClear.dungeon?.name || '')}</h3><div class="row" style="flex-wrap:wrap"><span class="chip gold">◉ ${fmt(extra.dungeonClear.coins || 0)}</span><span class="chip">✧ ${fmt(extra.dungeonClear.shards || 0)}</span>${extra.dungeonClear.trap ? `<span class="chip">${extra.dungeonClear.trap.icon} ${esc(extra.dungeonClear.trap.name)}</span>` : ''}${extra.dungeonClear.relic ? `<span class="chip" style="color:var(--violet)">${extra.dungeonClear.relic.icon} ${esc(extra.dungeonClear.relic.name)}</span>` : ''}</div></div>` : ''}
      ${extra.dungeonFailed ? `<div class="chapter-card"><h3>${esc(extra.dungeonFailed.dungeon?.name || '')}</h3><p>${esc(tr(`Has perdido ${extra.dungeonFailed.lost} monedas, pero tu equipo se ha recuperado.`, `You lost ${extra.dungeonFailed.lost} coins, but your team recovered.`))}</p></div>` : ''}
      ${game.state?.dungeon && !extra.dungeonClear ? `<div class="faint" style="font-size:10px">${esc(tr('Puedes continuar explorando la mazmorra.', 'You can continue exploring the dungeon.'))}</div>` : ''}
    </div>`,
    footer: `<button class="btn btn-primary" data-reward-close>${esc(t('battle.continue'))}</button>`,
    onMount: (root) => root.querySelector('[data-reward-close]')?.addEventListener('click', () => closeModal()),
  }))
}

/* ---------------- dungeon ---------------- */

const NODE_META = {
  start: { icon: '⌂', es: 'Entrada', en: 'Entrance' },
  battle: { icon: '⚔', es: 'Combate', en: 'Battle' },
  elite: { icon: '✦', es: 'Élite', en: 'Elite' },
  boss: { icon: '☠', es: 'Guardián', en: 'Guardian' },
  chest: { icon: '▣', es: 'Cofre', en: 'Chest' },
  shrine: { icon: '✚', es: 'Santuario', en: 'Shrine' },
  trap: { icon: '⚠', es: 'Trampa', en: 'Trap' },
  lore: { icon: '◇', es: 'Eco', en: 'Echo' },
}

/* ---------------- settings ---------------- */

let confirmReset = false

export function openSettings() {
  const s = game.state
  if (!s) return
  confirmReset = false
  openModal(() => {
    const settings = s.settings
    return {
      narrow: true,
      kicker: tr('SISTEMA', 'SYSTEM'),
      title: t('modal.settings.title'),
      sub: `${tr('Partida guardada', 'Save')}: ${s.lastSave ? new Date(s.lastSave).toLocaleString() : tr('Aún no', 'Not yet')} · v1.0`,
      body: `<div class="stack">
        <div class="spread"><span>${esc(t('modal.settings.sound'))}</span><button class="btn btn-sm ${settings.sound ? 'btn-teal' : 'btn-ghost'}" data-setting="sound">${settings.sound ? 'ON' : 'OFF'}</button></div>
        <div class="spread"><span>${esc(t('modal.settings.particles'))}</span><button class="btn btn-sm ${settings.particles ? 'btn-teal' : 'btn-ghost'}" data-setting="particles">${settings.particles ? 'ON' : 'OFF'}</button></div>
        <div class="spread"><span>${esc(t('modal.settings.encounters'))}</span><button class="btn btn-sm ${settings.encounters !== false ? 'btn-teal' : 'btn-ghost'}" data-setting="encounters">${settings.encounters !== false ? 'ON' : 'OFF'}</button></div>
        <div class="spread"><span>${esc(t('modal.settings.quality'))}</span>
          <div class="row">${[0.5, 1, 1.5].map((q) => `<button class="btn btn-sm ${settings.quality === q ? 'btn-teal' : 'btn-ghost'}" data-quality="${q}">${q === 1 ? 'Normal' : q < 1 ? esc(tr('Baja', 'Low')) : esc(tr('Alta', 'High'))}</button>`).join('')}</div>
        </div>
        <div class="spread"><span>${esc(t('modal.settings.language'))}</span>
          <div class="row"><button class="btn btn-sm ${getLang() === 'es' ? 'btn-teal' : 'btn-ghost'}" data-lang="es">Español</button><button class="btn btn-sm ${getLang() === 'en' ? 'btn-teal' : 'btn-ghost'}" data-lang="en">English</button></div>
        </div>
        <div class="lore-box" style="margin:6px 0 0">${esc(t('modal.lang.desc'))}</div>
        ${confirmReset ? `<div class="chapter-card" style="border-color:rgba(251,113,133,.4)">
          <p style="margin:0 0 8px;color:var(--danger)">${esc(t('modal.settings.resetconfirm'))}</p>
          <div class="row"><button class="btn btn-danger btn-sm" data-reset-confirm>${esc(t('common.confirm'))}</button><button class="btn btn-ghost btn-sm" data-reset-cancel>${esc(t('common.cancel'))}</button></div>
        </div>` : ''}
      </div>`,
      footer: `<button class="btn btn-ghost" data-settings-close>${esc(t('modal.close'))}</button>
        <button class="btn btn-teal" data-settings-save>${esc(t('modal.settings.save'))}</button>
        <button class="btn btn-danger" data-settings-reset>${esc(t('modal.settings.reset'))}</button>`,
      onMount: (root) => {
        root.querySelector('[data-settings-close]')?.addEventListener('click', () => closeModal())
        root.querySelectorAll('[data-setting]').forEach((button) => button.addEventListener('click', () => {
          const key = button.dataset.setting
          s.settings[key] = !s.settings[key]
          game.save()
          refreshModal()
        }))
        root.querySelectorAll('[data-quality]').forEach((button) => button.addEventListener('click', () => {
          s.settings.quality = Number(button.dataset.quality)
          game.save()
          refreshModal()
        }))
        root.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => {
          setLang(button.dataset.lang)
          applyLanguage()
          refreshTitle()
        }))
        root.querySelector('[data-settings-save]')?.addEventListener('click', () => {
          game.save()
          toast(t('toast.saved'), 'good')
          refreshModal()
        })
        root.querySelector('[data-settings-reset]')?.addEventListener('click', () => {
          confirmReset = true
          refreshModal()
        })
        root.querySelector('[data-reset-cancel]')?.addEventListener('click', () => {
          confirmReset = false
          refreshModal()
        })
        root.querySelector('[data-reset-confirm]')?.addEventListener('click', () => {
          game.resetSave()
          toast(t('toast.reset'), 'info')
          setTimeout(() => location.reload(), 200)
        })
      },
    }
  })
}

/* ---------------- dungeon ---------------- */

export function openDungeon() {
  const s = game.state
  const d = s?.dungeon
  if (!d) return
  const meta = DUNGEONS[d.id]
  openModal(() => {
    const nodes = d.nodes
    const available = (x, y) => Math.abs(d.pos.x - x) + Math.abs(d.pos.y - y) === 1
    return {
      wide: true,
      kicker: t('modal.dungeon.title'),
      title: esc(meta.name),
      sub: `${t('modal.dungeon.sub')} · ${t('modal.dungeon.floor')} ${d.floor} / ${d.floors}`,
      body: `<div class="dungeon-head">
          <div class="dungeon-floor">${String(d.floor).padStart(2, '0')}</div>
          <div style="flex:1"><div class="spread"><b>${esc(tr('Equipo', 'Team'))}</b><span class="faint" style="font-size:9px">${game.getTeam().filter((c) => c.hp > 0).length}/${game.getTeam().length} ${esc(tr('en pie', 'standing'))}</span></div>
          ${hpBar(game.getTeam().reduce((sum, c) => sum + c.hp, 0), Math.max(1, game.getTeam().reduce((sum, c) => sum + c.maxHp, 0)))}
          <div class="faint" style="font-size:9px;margin-top:5px">${esc(tr('Elige un nodo adyacente. Los nodos ocultos se revelan al acercarte.', 'Choose an adjacent node. Hidden nodes reveal as you approach.'))}</div></div>
        </div>
        <div class="dungeon-map">${nodes.map((row) => row.map((node) => {
          const info = NODE_META[node.type] || NODE_META.battle
          const isCurrent = d.pos.x === node.x && d.pos.y === node.y
          const isAvailable = available(node.x, node.y)
          const revealed = node.revealed || node.visited
          const cls = ['dungeon-node', revealed ? 'revealed' : '', node.visited ? 'visited' : '', isCurrent ? 'current' : '', isAvailable ? 'available' : ''].filter(Boolean).join(' ')
          const label = revealed ? (getLang() === 'en' ? info.en : info.es) : '???'
          return `<button class="${cls}" ${isAvailable ? `data-dungeon-x="${node.x}" data-dungeon-y="${node.y}"` : 'disabled'}>
            <span class="node-icon">${revealed ? info.icon : '·'}</span><span class="node-label">${esc(label)}</span>
          </button>`
        }).join('')).join('')}</div>
        <div class="dungeon-legend">${Object.entries(NODE_META).map(([, info]) => `<span>${info.icon} ${esc(getLang() === 'en' ? info.en : info.es)}</span>`).join('')}</div>
        <div class="section-title">${esc(tr('Registro de expedición', 'Expedition log'))}</div>
        <div class="lore-box" style="max-height:120px;overflow:auto">${d.log.slice(-6).map((line) => `<div>${esc(line)}</div>`).join('') || `<span class="faint">${esc(tr('La mazmorra guarda silencio.', 'The dungeon is silent.'))}</span>`}</div>`,
      footer: `<button class="btn btn-ghost" data-dungeon-leave>${esc(t('modal.dungeon.leave'))}</button>
        <button class="btn btn-primary" data-dungeon-close>${esc(t('modal.continue'))}</button>`,
      onMount: (root) => {
        root.querySelector('[data-dungeon-leave]')?.addEventListener('click', () => {
          game.exitDungeon()
          closeModal()
        })
        root.querySelector('[data-dungeon-close]')?.addEventListener('click', () => closeModal())
        root.querySelectorAll('[data-dungeon-x]').forEach((button) => button.addEventListener('click', () => {
          const x = Number(button.dataset.dungeonX)
          const y = Number(button.dataset.dungeonY)
          closeModal()
          const result = game.moveDungeon(x, y)
          if (result.type === 'resolved' || result.type === 'visited') openDungeon()
          else if (result.type === 'invalid') toast(tr('Ese nodo no está disponible.', 'That node is not available.'), 'bad')
        }))
      },
    }
  })
}
