import { TRAINERS } from './data.js'
import { game } from './engine.js'
import { t } from './i18n.js'
import {
  esc, fmt, tr, openModal, closeModal, refreshModal, toast, isModalOpen,
} from './ui-core.js'

let inviteCode = ''
let inviteInput = ''
let queueing = false

export function openArena(prefill = null) {
  const s = game.state
  if (!s) return
  if (prefill) inviteInput = prefill
  else if (!inviteInput && location.hash.startsWith('#invite=')) inviteInput = decodeURIComponent(location.hash.slice(8))

  openModal(() => {
    const healthy = game.getTeam().filter((c) => c.hp > 0).length
    const leaderboard = [
      { name: s.player.name, score: s.player.rank, you: true },
      ...TRAINERS.map((trainer, index) => ({ name: trainer.name, score: 1680 - index * 47, you: false })),
    ].sort((a, b) => b.score - a.score).slice(0, 9)
    const link = inviteCode ? `${location.href.split('#')[0]}#invite=${inviteCode}` : ''
    return {
      wide: true,
      kicker: t('modal.arena.title'),
      title: t('modal.arena.title'),
      sub: `${t('modal.arena.sub')} · ${t('modal.arena.rules')}`,
      body: `<div class="arena-hero">
        <div class="arena-rank">
          <div class="rank-value">${fmt(s.player.rank)}</div>
          <div class="rank-name">${esc(game.rankTitle(s.player.rank))}</div>
          <div class="arena-stats">
            <div><b>${fmt(s.player.wins)}</b><span>${esc(t('modal.arena.wins'))}</span></div>
            <div><b>${fmt(s.player.losses)}</b><span>${esc(t('modal.arena.losses'))}</span></div>
            <div><b>${healthy}</b><span>${esc(tr('En pie', 'Standing'))}</span></div>
          </div>
          <div class="online-pill" style="margin-top:10px">${esc(t('modal.arena.online'))} · 12</div>
        </div>
        <div class="invite-box">
          <div class="spread"><b style="font-size:12px">${esc(t('modal.arena.invite'))}</b><span class="chip soft">${esc(t('modal.arena.async'))}</span></div>
          <p class="faint" style="font-size:10px;line-height:1.5;margin:8px 0">${esc(tr('Comparte un enlace con otro guardián. Su equipo se convierte en el rival de un duelo asíncrono.', 'Share a link with another guardian. Their team becomes the rival in an asynchronous duel.'))}</p>
          <div class="row" style="flex-wrap:wrap;margin-bottom:8px">
            <button class="btn btn-teal btn-sm" data-arena-create>◈ ${esc(t('modal.arena.create'))}</button>
            ${inviteCode ? `<button class="btn btn-sm" data-arena-copy>⧉ ${esc(t('modal.arena.copy'))}</button>` : ''}
          </div>
          ${inviteCode ? `<textarea readonly id="arena-code">${esc(link)}</textarea>` : ''}
          <div class="section-title" style="margin-top:12px">${esc(t('modal.arena.accept'))}</div>
          <textarea id="arena-input" placeholder="${esc(t('modal.arena.code'))}">${esc(inviteInput)}</textarea>
          <button class="btn btn-primary btn-sm" data-arena-accept style="margin-top:8px">⚔ ${esc(t('modal.arena.start'))}</button>
        </div>
      </div>
      <div class="arena-hero" style="margin-top:16px">
        <div>
          <div class="section-title">${esc(t('modal.arena.leaderboard'))}</div>
          <div>${leaderboard.map((row, index) => `<div class="leader-row ${row.you ? 'gold' : ''}">
            <span class="pos">${index + 1}</span><span class="name">${esc(row.name)}${row.you ? ` · ${esc(tr('Tú', 'You'))}` : ''}</span><span class="pts">${fmt(row.score)}</span>
          </div>`).join('')}</div>
        </div>
        <div>
          <div class="section-title">${esc(tr('Duelo aleatorio', 'Random duel'))}</div>
          <div class="chapter-card current">
            <div class="chapter-num">NEXOLINK</div>
            <h3>${esc(tr('Coliseo de Cristal', 'Crystal Arena'))}</h3>
            <p>${esc(tr('La red busca un rival de nivel similar. El combate es 3v3, sin captura y sin huida.', 'The network finds a rival of similar level. The battle is 3v3, no capture, no fleeing.'))}</p>
            <div class="row" style="margin-top:10px">
              <button class="btn btn-primary" data-arena-match ${queueing ? 'disabled' : ''}>${queueing ? esc(t('modal.arena.queue')) : `⚔ ${esc(t('modal.arena.match'))}`}</button>
            </div>
          </div>
          <div class="faint" style="font-size:9px;margin-top:8px">${esc(tr('Las victorias aumentan tu rango y desbloquean títulos de guardián.', 'Victories raise your rank and unlock guardian titles.'))}</div>
        </div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-arena-close>${esc(t('modal.close'))}</button>`,
      onMount: (root) => {
        root.querySelector('[data-arena-close]')?.addEventListener('click', () => closeModal())
        const input = root.querySelector('#arena-input')
        input?.addEventListener('input', () => { inviteInput = input.value })
        root.querySelector('[data-arena-create]')?.addEventListener('click', () => {
          inviteCode = game.createInvite()
          refreshModal()
          toast(t('modal.arena.copied'), 'good')
        })
        root.querySelector('[data-arena-copy]')?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(link)
            toast(t('toast.copied'), 'good')
          } catch {
            const code = root.querySelector('#arena-code')
            code?.select()
            toast(tr('Selecciona y copia el enlace manualmente.', 'Select and copy the link manually.'), 'info')
          }
        })
        root.querySelector('[data-arena-accept]')?.addEventListener('click', () => {
          const value = (root.querySelector('#arena-input')?.value || inviteInput || '').trim()
          if (!value) {
            toast(t('modal.arena.invalid'), 'bad')
            return
          }
          inviteInput = value
          closeModal()
          const battle = game.acceptInvite(value)
          if (!battle) setTimeout(() => { if (!isModalOpen()) openArena(value) }, 120)
        })
        root.querySelector('[data-arena-match]')?.addEventListener('click', () => {
          if (!game.getTeam().some((c) => c.hp > 0)) {
            toast(t('modal.arena.needteam'), 'bad')
            return
          }
          queueing = true
          refreshModal()
          setTimeout(() => {
            const stillOpen = !!document.querySelector('[data-arena-match]')
            if (!stillOpen) { queueing = false; return }
            queueing = false
            closeModal()
            game.startArenaBattle(Math.floor(Math.random() * TRAINERS.length))
          }, 1100)
        })
      },
    }
  })
}
