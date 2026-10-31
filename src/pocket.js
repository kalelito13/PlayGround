// ---------------------------------------------------------------------------
// Lumen Isles — Pocket Device (dispositivo electrónico de bolsillo)
// ---------------------------------------------------------------------------
// Interfaz visual de los datos del jugador: guarda, carga, journal, equipo,
// flautas, medallas y resumen de la aventura. Todo se almacena en localStorage
// pero se presenta como un dispositivo portátil que el jugador lleva consigo.
// ---------------------------------------------------------------------------

import { t } from './i18n.js';
import { txt, ZONES, LANDMARKS } from './story.js';
import { displayName, rarityOf, formatLumen } from './data.js';
import { creatureDataURL } from './art2d.js';
import { badgeName, GYMS } from './gyms.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let pocketOpen = false;
let pocketRoot = null;
let onClose = null;

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function $p(id) {
  return pocketRoot.querySelector(`#p-${id}`);
}

function formatNumber(n) {
  return String(n).padStart(2, '0');
}

function creatureRow(mon) {
  const s = rarityOf(mon.species);
  const shiny = mon.shiny ? '<span class="p-shiny">✦</span>' : '';
  const thumb = creatureDataURL(mon.species, mon.shiny ? { shiny: true, seed: mon.shinySeed } : null);
  return `
    <div class="p-entry p-mon">
      <img src="${thumb}" class="p-thumb" alt="${displayName(mon)}" />
      <div class="p-info">
        <div class="p-name">${displayName(mon)}${shiny}</div>
        <div class="p-sub">
          <span class="p-chip t-${s ? s.name.toLowerCase() : 'normal'}">${txt({es: s.name, en: s.name}) || s.name}</span>
          <span>Lv. ${mon.level}</span>
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function renderSaveScreen() {
  const save = JSON.parse(localStorage.getItem('lumen-isles-save-v1') || 'null');
  const hasSave = !!save && Array.isArray(save.party) && save.party.length;
  const lang = localStorage.getItem('lumen-lang') || 'es';

  $p('p-screen').innerHTML = `
    <div class="p-header">
      <div class="p-title">${t('pocket.title')}</div>
      <div class="p-subtitle">${t('pocket.subtitle')}</div>
    </div>

    <div class="p-section">
      <h3>${t('pocket.save')}</h3>
      <div class="p-save-status">
        ${hasSave
          ? `<div class="p-ok">✓ ${t('pocket.saveFound')}</div>
             <div class="p-detail">
               <span>${t('pocket.party')}: ${save.party.length}</span>
               <span>${t('pocket.caught')}: ${save.caught?.length || 0}</span>
               <span>${t('pocket.day')}: ${save.gameDay || 1}</span>
               <span>${t('pocket.lang')}: ${lang.toUpperCase()}</span>
             </div>`
          : `<div class="p-empty">— ${t('pocket.noSave')}</div>`
        }
      </div>
      <div class="p-actions">
        <button class="p-btn p-btn-primary" id="p-btn-save">${t('pocket.saveNow')}</button>
        <button class="p-btn p-btn-ghost" id="p-btn-load">${hasSave ? t('pocket.load') : t('pocket.newJourney')}</button>
        ${hasSave ? `<button class="p-btn p-btn-danger" id="p-btn-reset">${t('pocket.reset')}</button>` : ''}
      </div>
    </div>

    <div class="p-section">
      <h3>${t('pocket.device')}</h3>
      <div class="p-device-info">
        <div><span class="p-label">${t('pocket.storage')}</span><span class="p-value">localStorage</span></div>
        <div><span class="p-label">${t('pocket.key')}</span><span class="p-value">lumen-isles-save-v1</span></div>
        <div><span class="p-label">${t('pocket.language')}</span><span class="p-value">${lang.toUpperCase()}</span></div>
      </div>
    </div>
  `;

  $p('p-btn-save')?.addEventListener('click', () => {
    if (onClose) onClose('save');
  });
  $p('p-btn-load')?.addEventListener('click', () => {
    if (onClose) onClose(hasSave ? 'load' : 'new');
  });
  $p('p-btn-reset')?.addEventListener('click', () => {
    if (confirm(t('pocket.resetConfirm'))) {
      localStorage.removeItem('lumen-isles-save-v1');
      renderSaveScreen();
    }
  });
}

function renderJournalScreen(state) {
  const party = state.party || [];
  const ranch = state.ranchMons || [];
  const minutes = Math.max(1, Math.round((Date.now() - (state.startedAt || Date.now())) / 60000));

  $p('p-screen').innerHTML = `
    <div class="p-header">
      <div class="p-title">${t('pocket.journal')}</div>
      <div class="p-subtitle">${t('pocket.fieldNotes')}</div>
    </div>

    <div class="p-section">
      <h3>${t('pocket.team')}</h3>
      <div class="p-grid">${party.map(creatureRow).join('') || `<p class="p-empty">${t('pocket.noTeam')}</p>`}</div>
    </div>

    <div class="p-section">
      <h3>${t('pocket.ranch')}</h3>
      <div class="p-grid">${ranch.map(creatureRow).join('') || `<p class="p-empty">${t('pocket.noRanch')}</p>`}</div>
    </div>

    <div class="p-section">
      <h3>${t('pocket.stats')}</h3>
      <div class="p-stats">
        <div><span class="p-big">${party.length}</span><span>${t('pocket.partyLabel')}</span></div>
        <div><span class="p-big">${state.caught?.length || 0}</span><span>${t('pocket.speciesLabel')}</span></div>
        <div><span class="p-big">${state.catchCount || 0}</span><span>${t('pocket.caughtLabel')}</span></div>
        <div><span class="p-big">${state.shinyFound || 0}</span><span>${t('pocket.shinyLabel')}</span></div>
        <div><span class="p-big">${state.battlesWon || 0}</span><span>${t('pocket.winsLabel')}</span></div>
        <div><span class="p-big">${minutes}m</span><span>${t('pocket.timeLabel')}</span></div>
      </div>
    </div>
  `;
}

function renderDevicesScreen(state) {
  const inv = state.inventory || {};
  const flutes = inv.flutes || ['willow'];
  const badges = inv.badges || [];

  $p('p-screen').innerHTML = `
    <div class="p-header">
      <div class="p-title">${t('pocket.device')}</div>
      <div class="p-subtitle">${t('pocket.instruments')}</div>
    </div>

    <div class="p-section">
      <h3>${t('pocket.flutes')}</h3>
      <div class="p-grid">${flutes.map((id) => {
        const f = window.FLUTES || {};
        const flute = f[id] || { name: id, short: id, tier: 1, color: '#999' };
        const active = id === inv.selectedFlute ? ' p-active' : '';
        return `
          <div class="p-entry p-flute${active}">
            <span class="p-flute-icon">♪</span>
            <div class="p-info">
              <div class="p-name">${flute.name}</div>
              <div class="p-sub">Rank ${flute.tier} · ${active ? t('pocket.active') : ''}</div>
            </div>
          </div>
        `;
      }).join('')}</div>
    </div>

    <div class="p-section">
      <h3>${t('pocket.badges')}</h3>
      <div class="p-grid">${badges.map((bid) => {
        const def = window.BADGE_BY_ID ? window.BADGE_BY_ID[bid] : null;
        const name = def ? badgeName(def) : bid;
        return `
          <div class="p-entry p-badge">
            <span class="p-badge-glyph">${def ? def.glyph : '✦'}</span>
            <div class="p-info">
              <div class="p-name">${name}</div>
              <div class="p-sub">${t('pocket.gymBadge')}</div>
            </div>
          </div>
        `;
      }).join('') || `<p class="p-empty">${t('pocket.noBadges')}</p>`}</div>
    </div>

    <div class="p-section">
      <h3>${t('pocket.satchel')}</h3>
      <div class="p-stats">
        <div><span class="p-big">${inv.lumen != null ? inv.lumen : 0}</span><span>Lumen</span></div>
        <div><span class="p-big">${inv.potions || 0}</span><span>${t('pocket.tonics')}</span></div>
        <div><span class="p-big">${Math.round((inv.resonance || 0) * 100)}%</span><span>${t('pocket.resonance')}</span></div>
        <div><span class="p-big">${flutes.length}</span><span>${t('pocket.fluteLabel')}</span></div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Map screen
// ---------------------------------------------------------------------------

function renderMapScreen(state) {
  const px = state.player?.pos?.x ?? 0;
  const pz = state.player?.pos?.z ?? 0;
  const zonesReached = state.zones || [];
  const landmarksReached = state.landmarks || [];

  // Build per-zone info
  const zoneRows = ZONES.map((zone) => {
    const d = Math.hypot(px - zone.center.x, pz - zone.center.z);
    const reached = zonesReached.includes(zone.id);
    const here = d <= zone.radius + 4;
    const lms = LANDMARKS.filter((l) => l.zone === zone.id);
    const lmHtml = lms.map((lm) => {
      const done = landmarksReached.includes(lm.id);
      return `<span class="p-lm ${done ? 'p-lm-done' : ''}" title="${txt(lm.name)}">${done ? '✓' : '○'}</span>`;
    }).join('');
    return `
      <div class="p-zone-row${reached ? ' p-reached' : ''}${here ? ' p-here' : ''}">
        <div class="p-zone-name">${txt(zone.name)}</div>
        <div class="p-zone-dist">${Math.round(d)} m${reached ? ' · ' + t('pocket.visited') : ''}</div>
        <div class="p-zone-landmarks">${lmHtml}</div>
      </div>
    `;
  }).join('');

  $p('p-screen').innerHTML = `
    <div class="p-header">
      <div class="p-title">${t('pocket.map')}</div>
      <div class="p-subtitle">${t('pocket.mapSub')}</div>
    </div>

    <div class="p-section p-map-section">
      <div class="p-map-compass">
        <span class="p-compass-n">N</span>
        <span class="p-you">${t('pocket.you')} <span class="p-you-dot">●</span></span>
      </div>
      <div class="p-zone-list">${zoneRows}</div>
    </div>

    <div class="p-section">
      <h3>${t('pocket.gyms')}</h3>
      <div class="p-grid">${GYMS.map((g) => {
        const d = Math.hypot(px - g.x, pz - g.z);
        const hasBadge = badgesOwned(state).includes(g.badge.id);
        return `
          <div class="p-entry p-gym${hasBadge ? ' p-done' : ''}">
            <span class="p-gym-badge">${g.badge.glyph}</span>
            <div class="p-info">
              <div class="p-name">${txt(g.name)}</div>
              <div class="p-sub">${txt(g.leader)} · ${Math.round(d)} m${hasBadge ? ' · ' + t('pocket.badgeOwned') : ''}</div>
            </div>
          </div>
        `;
      }).join('')}</div>
    </div>
  `;
}

function badgesOwned(state) {
  return (state.inventory?.badges || []);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function openPocket(state, onAction) {
  onClose = onAction;
  pocketOpen = true;
  pocketRoot = document.getElementById('pocket-device');
  if (!pocketRoot) {
    const el = document.createElement('div');
    el.id = 'pocket-device';
    el.className = 'pocket-device hidden';
    document.body.appendChild(el);
    pocketRoot = el;
  }

  pocketRoot.innerHTML = `
    <div class="pocket-shell">
      <div class="pocket-screen-border">
        <div class="pocket-speaker">● ● ●</div>
        <div class="pocket-cam">●</div>
        <div id="p-screen" class="p-screen"></div>
        <div class="pocket-home-bar">
          <button class="pocket-home-btn" id="p-home-save">${t('pocket.navSave')}</button>
          <button class="pocket-home-btn" id="p-home-journal">${t('pocket.navJournal')}</button>
          <button class="pocket-home-btn" id="p-home-map">${t('pocket.navMap')}</button>
          <button class="pocket-home-btn" id="p-home-device">${t('pocket.navDevice')}</button>
        </div>
        <button class="pocket-power" id="p-btn-power">${t('pocket.power')}</button>
      </div>
    </div>
  `;

  const nav = {
    'p-home-save': () => renderSaveScreen(),
    'p-home-journal': () => renderJournalScreen(state),
    'p-home-map': () => renderMapScreen(state),
    'p-home-device': () => renderDevicesScreen(state),
  };

  Object.entries(nav).forEach(([id, fn]) => {
    $p(id.replace('p-home-', ''))?.addEventListener('click', fn);
    pocketRoot.querySelector(`#${id}`)?.addEventListener('click', fn);
  });

  $p('p-btn-power')?.addEventListener('click', closePocket);

  renderSaveScreen();
  pocketRoot.classList.remove('hidden');
  document.body.classList.add('pocket-open');
}

export function closePocket() {
  if (!pocketOpen || !pocketRoot) return;
  pocketRoot.classList.add('hidden');
  document.body.classList.remove('pocket-open');
  pocketOpen = false;
  onClose = null;
}

export function togglePocket(state, onAction) {
  if (pocketOpen) closePocket();
  else openPocket(state, onAction);
}

export function isPocketOpen() {
  return pocketOpen;
}
