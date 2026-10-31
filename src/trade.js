import {
  SPECIES, MOVES, MAX_LEVEL, statsFor, makeShinySeed, displayName,
} from './data.js';

// ---------------------------------------------------------------------------
// Peer-to-peer creature trading
// ---------------------------------------------------------------------------
// Uses the public PeerJS cloud broker only to introduce the two browsers.
// The creatures themselves travel over an encrypted WebRTC data channel and
// never touch a game server (there isn't one). A short room code is enough.
// ---------------------------------------------------------------------------

const PEER_PREFIX = 'lumen-isles-';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function makeCode() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^LI/, '').slice(0, 6);
}

function peerIdFor(code) {
  return PEER_PREFIX + code.toLowerCase();
}

function previewOf(mon) {
  return {
    uid: mon.uid,
    species: mon.species,
    level: mon.level,
    shiny: !!mon.shiny,
    shinySeed: mon.shinySeed || null,
    nickname: mon.nickname || null,
  };
}

function sanitizeMon(raw, existingSeeds) {
  if (!raw || typeof raw !== 'object' || !SPECIES[raw.species]) return null;
  const level = clamp(Math.round(Number(raw.level) || 1), 1, MAX_LEVEL);
  const stats = statsFor(raw.species, level);
  let moves = Array.isArray(raw.moves)
    ? raw.moves.filter((m) => m && MOVES[m.id]).slice(-4).map((m) => ({
      id: m.id,
      pp: clamp(Math.round(Number(m.pp) || MOVES[m.id].pp), 0, MOVES[m.id].pp),
      maxPp: MOVES[m.id].pp,
    }))
    : [];
  if (moves.length < 2) {
    const base = SPECIES[raw.species].moves.filter(([lvl]) => lvl <= level).slice(-4);
    while (base.length < 2) base.push(SPECIES[raw.species].moves[base.length]);
    moves = base.map(([, id]) => ({ id, pp: MOVES[id].pp, maxPp: MOVES[id].pp }));
  }
  const shiny = !!raw.shiny;
  let shinySeed = null;
  if (shiny) {
    const n = Math.abs(Math.trunc(Number(raw.shinySeed) || 0));
    shinySeed = n >= 100000000 ? n : makeShinySeed();
    let guard = 0;
    while (existingSeeds.has(shinySeed) && guard++ < 30) shinySeed = makeShinySeed();
  }
  return {
    uid: `trade-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    species: raw.species,
    level,
    exp: 0,
    hp: clamp(Math.round(Number(raw.hp) || stats.maxHp), 1, stats.maxHp),
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    atkStage: 0,
    defStage: 0,
    moves,
    shiny,
    shinySeed,
    appearance: shiny ? { shiny: true, seed: shinySeed } : null,
    nickname: typeof raw.nickname === 'string' ? raw.nickname.slice(0, 18) : null,
    traded: true,
  };
}

export class TradeManager {
  constructor({ getParty, getRanch, onChanged, toast, save, audio, thumbFor }) {
    this.getParty = getParty;
    this.getRanch = getRanch;
    this.onChanged = onChanged;
    this.toast = toast;
    this.save = save;
    this.audio = audio;
    this.thumbFor = thumbFor;

    this.root = null;
    this.peer = null;
    this.conn = null;
    this.role = null;
    this.code = '';
    this.remotePreviews = [];
    this.localOffer = null;
    this.remoteOffer = null;
    this.localAccepted = false;
    this.remoteAccepted = false;
    this.swapping = false;
    this.logs = [];
    this.timeout = null;
  }

  // ---- UI ---------------------------------------------------------------

  mount(root) {
    this.root = root;
    root.innerHTML = `
      <div class="trade-panel">
        <div class="trade-statusbar">
          <span id="trade-dot" class="trade-dot"></span>
          <span id="trade-status">Not connected</span>
          <button class="ghost-btn trade-leave" data-trade="leave">Leave</button>
        </div>

        <div id="trade-lobby">
          <div class="trade-lobby-grid">
            <div class="trade-lobby-card">
              <b>Host a trade</b>
              <p>Create a room and share the six-letter code with a friend.</p>
              <button class="primary-btn" data-trade="host">Create room</button>
            </div>
            <div class="trade-lobby-card">
              <b>Join a trade</b>
              <p>Enter the code your friend sent you.</p>
              <div class="trade-join-row">
                <input id="trade-code-input" maxlength="10" autocapitalize="characters" autocomplete="off" placeholder="LI-ABC123" aria-label="Trade room code" />
                <button class="primary-btn" data-trade="join">Join</button>
              </div>
            </div>
          </div>
          <p class="trade-note">Trades are direct browser-to-browser. Keep the tab open. Never trade creatures you do not want to lose.</p>
        </div>

        <div id="trade-room" class="hidden">
          <div class="trade-room-head">
            <div class="trade-room-code">Room <b id="trade-room-code">—</b>
              <button class="ghost-btn trade-copy" data-trade="copy">Copy code</button>
            </div>
            <span id="trade-remote-name" class="trade-remote-name">Waiting for a friend…</span>
          </div>

          <div class="trade-columns">
            <section class="trade-column">
              <h4>Your offer</h4>
              <div id="trade-local-list" class="trade-mon-list"></div>
            </section>
            <section class="trade-column">
              <h4>Their offer</h4>
              <div id="trade-remote-offer" class="trade-offer-slot">Nothing offered yet</div>
            </section>
          </div>

          <div class="trade-actions">
            <button id="trade-accept" class="primary-btn" data-trade="accept" disabled>Lock in offer</button>
            <button class="ghost-btn" data-trade="reset">Reset offers</button>
          </div>
          <p id="trade-log" class="trade-log"></p>
        </div>
      </div>
    `;
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('keydown', (e) => {
      if (e.target.id === 'trade-code-input' && e.key === 'Enter') this.join();
    });
    this.renderAll();
  }

  onClick(e) {
    const btn = e.target.closest('[data-trade]');
    if (!btn) return;
    const action = btn.dataset.trade;
    if (action === 'host') this.host();
    else if (action === 'join') this.join();
    else if (action === 'copy') this.copyCode();
    else if (action === 'leave') this.leave();
    else if (action === 'accept') this.accept();
    else if (action === 'reset') this.resetOffers(true);
    else if (action === 'pick') this.pick(btn.dataset.uid);
  }

  setStatus(text, kind = '') {
    const status = this.root?.querySelector('#trade-status');
    const dot = this.root?.querySelector('#trade-dot');
    if (status) status.textContent = text;
    if (dot) dot.className = `trade-dot ${kind}`;
  }

  addLog(text) {
    this.logs.push(text);
    if (this.logs.length > 6) this.logs.shift();
    const el = this.root?.querySelector('#trade-log');
    if (el) el.innerHTML = this.logs.map((l) => `<span>${l}</span>`).join('');
  }

  showRoom(show) {
    this.root?.querySelector('#trade-lobby')?.classList.toggle('hidden', show);
    this.root?.querySelector('#trade-room')?.classList.toggle('hidden', !show);
    const code = this.root?.querySelector('#trade-room-code');
    if (code) code.textContent = this.code ? `LI-${this.code}` : '—';
  }

  renderAll() {
    if (!this.root) return;
    this.showRoom(!!this.conn || !!this.peer);
    this.renderLists();
    this.renderOffers();
    this.updateAccept();
  }

  monCard(mon, action) {
    const species = SPECIES[mon.species];
    const sign = mon.shiny ? '<span class="shiny-star" title="Unique shiny">✦</span>' : '';
    const thumb = this.thumbFor?.(mon) || '';
    const selected = this.localOffer && (this.localOffer.uid === mon.uid || this.localOffer.uid === mon.uid)
      ? ' selected' : '';
    return `<button class="trade-mon${selected}" data-trade="${action}" data-uid="${mon.uid}">
      <span class="trade-thumb">${thumb ? `<img src="${thumb}" alt="" />` : ''}</span>
      <span class="trade-mon-copy"><b>${displayName(mon)}${sign}</b><small>Lv. ${mon.level} · ${species.rarity}</small></span>
      ${mon.shiny ? '<span class="trade-shiny-tag">SHINY</span>' : ''}
    </button>`;
  }

  renderLists() {
    const list = this.root?.querySelector('#trade-local-list');
    if (!list) return;
    const party = this.getParty();
    const ranch = this.getRanch();
    const canOfferParty = party.length > 1;
    const partyRows = party.map((mon) => {
      const card = this.monCard(mon, 'pick');
      return canOfferParty ? card : card.replace('<button ', '<button disabled title="Keep at least one creature" ');
    }).join('');
    const ranchRows = ranch.length
      ? `<p class="trade-subhead">Isles Ranch</p>${ranch.map((m) => this.monCard(m, 'pick')).join('')}`
      : '';
    list.innerHTML = (partyRows || '<p class="trade-empty">No creatures.</p>') + ranchRows;
  }

  renderOffers() {
    const offer = this.root?.querySelector('#trade-remote-offer');
    if (offer) {
      if (!this.remoteOffer) {
        offer.innerHTML = '<p class="trade-empty">Nothing offered yet</p>';
      } else {
        const mon = this.remoteOffer;
        offer.innerHTML = `<div class="trade-offer-mon">
          <span class="trade-thumb">${this.thumbFor?.(mon) ? `<img src="${this.thumbFor(mon)}" alt="" />` : ''}</span>
          <div><b>${displayName(mon)} ${mon.shiny ? '<span class="shiny-star">✦</span>' : ''}</b>
          <small>Lv. ${mon.level} · ${SPECIES[mon.species].rarity}</small></div>
          ${this.remoteAccepted ? '<span class="trade-locked">LOCKED</span>' : ''}
        </div>`;
      }
    }
    const name = this.root?.querySelector('#trade-remote-name');
    if (name) {
      name.textContent = this.remotePreviews.length
        ? `Connected · ${this.remotePreviews.length} creature${this.remotePreviews.length === 1 ? '' : 's'} on their side`
        : 'Waiting for a friend…';
    }
  }

  updateAccept() {
    const btn = this.root?.querySelector('#trade-accept');
    if (!btn) return;
    btn.disabled = !this.conn?.open || !this.localOffer || this.localAccepted;
    btn.textContent = this.localAccepted
      ? (this.remoteAccepted ? 'Exchanging…' : 'Waiting for them…')
      : 'Lock in offer';
  }

  // ---- connection -------------------------------------------------------

  ensurePeerSupport() {
    if (window.Peer) return true;
    this.setStatus('Trade library missing', 'bad');
    this.addLog('PeerJS did not load. Check vendor/peerjs.min.js.');
    this.toast('Online trade library could not load.', 'warn');
    return false;
  }

  cleanupPeer() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    try { this.conn?.close(); } catch { /* already closed */ }
    try { this.peer?.destroy(); } catch { /* already destroyed */ }
    this.conn = null;
    this.peer = null;
  }

  leave() {
    this.cleanupPeer();
    this.role = null;
    this.code = '';
    this.remotePreviews = [];
    this.resetOffers(false);
    this.logs = [];
    this.setStatus('Not connected');
    this.renderAll();
    this.addLog('Left the trade room.');
  }

  host(attempt = 0) {
    if (!this.ensurePeerSupport()) return;
    this.cleanupPeer();
    this.role = 'host';
    this.code = makeCode();
    this.remotePreviews = [];
    this.remoteOffer = null;
    this.resetOffers(false);
    this.setStatus('Opening a room…', 'wait');
    this.renderAll();
    this.addLog('Creating a private room…');

    let peer;
    try {
      peer = new window.Peer(peerIdFor(this.code));
    } catch (err) {
      this.setStatus('Could not open a room', 'bad');
      this.addLog(String(err?.message || err));
      return;
    }
    this.peer = peer;
    this.timeout = setTimeout(() => {
      if (!this.conn) this.addLog('Still waiting for the broker. Check your connection and try again.');
    }, 20000);

    peer.on('open', () => {
      this.audio?.sfx('confirm');
      this.setStatus('Room open · waiting for a friend', 'ok');
      this.addLog(`Share code <b>LI-${this.code}</b>.`);
      this.renderAll();
    });
    peer.on('connection', (conn) => {
      if (this.conn?.open) {
        try { conn.close(); } catch { /* ignore */ }
        return;
      }
      this.attach(conn);
    });
    peer.on('error', (err) => {
      if (err?.type === 'unavailable-id' && attempt < 3) {
        this.addLog('Code collision — rolling a new room…');
        this.host(attempt + 1);
        return;
      }
      this.setStatus('Connection error', 'bad');
      this.addLog(this.describeError(err));
    });
  }

  join() {
    if (!this.ensurePeerSupport()) return;
    const input = this.root?.querySelector('#trade-code-input');
    const code = normalizeCode(input?.value);
    if (code.length !== 6) {
      this.toast('Enter the six-character room code.', 'warn');
      input?.focus();
      return;
    }
    this.cleanupPeer();
    this.role = 'guest';
    this.code = code;
    this.remotePreviews = [];
    this.remoteOffer = null;
    this.resetOffers(false);
    this.setStatus('Connecting…', 'wait');
    this.showRoom(true);
    this.addLog(`Knocking on room <b>LI-${code}</b>…`);

    let peer;
    try {
      peer = new window.Peer();
    } catch (err) {
      this.setStatus('Could not start the connection', 'bad');
      this.addLog(String(err?.message || err));
      return;
    }
    this.peer = peer;
    this.timeout = setTimeout(() => {
      if (!this.conn) this.addLog('No answer yet. Confirm the host is online and the code is correct.');
    }, 20000);

    peer.on('open', () => {
      const conn = peer.connect(peerIdFor(code), { reliable: true });
      this.attach(conn);
    });
    peer.on('error', (err) => {
      this.setStatus('Connection error', 'bad');
      this.addLog(this.describeError(err));
    });
  }

  attach(conn) {
    this.conn = conn;
    this.showRoom(true);
    this.renderAll();
    conn.on('open', () => {
      this.setStatus('Connected', 'ok');
      this.renderAll();
      this.addLog('Friend connected. Choose a creature to offer.');
      this.sendHello();
    });
    conn.on('data', (data) => this.onData(data));
    conn.on('close', () => {
      this.setStatus('Friend disconnected', 'bad');
      this.addLog('The other trainer left. Your creature stayed with you.');
      this.conn = null;
      this.remotePreviews = [];
      this.remoteOffer = null;
      this.localAccepted = false;
      this.remoteAccepted = false;
      this.swapping = false;
      this.renderAll();
    });
    conn.on('error', (err) => {
      this.setStatus('Channel error', 'bad');
      this.addLog(String(err?.message || err));
    });
  }

  sendHello() {
    const party = this.getParty();
    const ranch = this.getRanch();
    this.send({
      type: 'hello',
      party: [...party, ...ranch].map(previewOf),
    });
  }

  send(payload) {
    if (!this.conn?.open) return false;
    try {
      this.conn.send({ ...payload, _lumen: 1 });
      return true;
    } catch {
      return false;
    }
  }

  onData(raw) {
    let msg = raw;
    if (typeof raw === 'string') {
      try { msg = JSON.parse(raw); } catch { return; }
    }
    if (!msg || msg._lumen !== 1) return;
    if (msg.type === 'hello') {
      this.remotePreviews = Array.isArray(msg.party) ? msg.party.slice(0, 40) : [];
      this.addLog('Their field journal arrived.');
      this.renderOffers();
      if (this.role === 'host') this.sendHello();
    } else if (msg.type === 'offer') {
      const mon = sanitizeMon(msg.mon, this.usedSeeds());
      if (!mon) return;
      this.remoteOffer = mon;
      this.remoteAccepted = false;
      this.localAccepted = false;
      this.swapping = false;
      this.addLog(`They offered <b>${displayName(mon)}</b>.`);
      this.audio?.sfx('select');
      this.renderOffers();
      this.updateAccept();
    } else if (msg.type === 'withdraw') {
      this.remoteOffer = null;
      this.remoteAccepted = false;
      this.localAccepted = false;
      this.addLog('They withdrew their offer.');
      this.renderOffers();
      this.updateAccept();
    } else if (msg.type === 'accept') {
      this.remoteAccepted = true;
      this.addLog('They locked in their offer.');
      this.updateAccept();
      this.renderOffers();
      this.maybeSwap();
    } else if (msg.type === 'swap') {
      const incoming = sanitizeMon(msg.mon, this.usedSeeds());
      if (!incoming || !this.localOffer) {
        this.addLog('Trade failed: invalid creature data.');
        this.send({ type: 'failed' });
        return;
      }
      const outgoing = this.localOffer;
      if (!this.applyLocalTrade(incoming)) {
        this.addLog('Trade failed: your offer is no longer available.');
        this.send({ type: 'failed' });
        return;
      }
      this.send({ type: 'swap-ack', mon: outgoing });
      this.completeTrade(incoming, outgoing);
    } else if (msg.type === 'swap-ack') {
      const incoming = sanitizeMon(msg.mon, this.usedSeeds());
      if (!incoming || !this.localOffer) {
        this.addLog('Trade failed: invalid creature data.');
        return;
      }
      const outgoing = this.localOffer;
      if (!this.applyLocalTrade(incoming)) {
        this.addLog('Trade failed: your offer is no longer available.');
        return;
      }
      this.completeTrade(incoming, outgoing);
    } else if (msg.type === 'failed') {
      this.addLog('The other trainer reported a problem. Offers reset.');
      this.resetOffers(false);
    }
  }

  describeError(err) {
    const type = err?.type;
    if (type === 'peer-unavailable') return 'Room not found. Check the code and ask the host to stay in the trade screen.';
    if (type === 'network') return 'The trading broker is unreachable. Check your internet connection.';
    if (type === 'unavailable-id') return 'That room code is busy. Create a new room.';
    if (type === 'server-error') return 'The public broker refused the connection. Try again in a moment.';
    return err?.message ? String(err.message) : 'Unknown connection error.';
  }

  // ---- offers -----------------------------------------------------------

  pick(uid) {
    if (!this.conn?.open) return;
    const all = [...this.getParty(), ...this.getRanch()];
    const mon = all.find((m) => m.uid === uid);
    if (!mon) return;
    const inParty = this.getParty().some((m) => m.uid === uid);
    if (inParty && this.getParty().length <= 1) {
      this.toast('Keep at least one creature with you.', 'warn');
      return;
    }
    this.localOffer = mon;
    this.localAccepted = false;
    this.remoteAccepted = false;
    this.swapping = false;
    this.send({ type: 'offer', mon });
    this.addLog(`You offered <b>${displayName(mon)}</b>.`);
    this.audio?.sfx('select');
    this.renderLists();
    this.updateAccept();
    this.renderOffers();
  }

  accept() {
    if (!this.conn?.open || !this.localOffer || this.localAccepted) return;
    this.localAccepted = true;
    this.send({ type: 'accept' });
    this.addLog('You locked in your offer.');
    this.audio?.sfx('confirm');
    this.updateAccept();
    this.renderOffers();
    this.maybeSwap();
  }

  maybeSwap() {
    if (!this.localAccepted || !this.remoteAccepted || !this.localOffer || !this.remoteOffer) return;
    if (this.role !== 'host' || this.swapping) return;
    this.swapping = true;
    this.setStatus('Exchanging creatures…', 'wait');
    this.send({ type: 'swap', mon: this.localOffer });
    this.addLog('Sending your creature across the channel…');
  }

  resetOffers(notify) {
    this.localOffer = null;
    this.localAccepted = false;
    this.remoteAccepted = false;
    this.swapping = false;
    if (notify) {
      this.remoteOffer = null;
      this.send({ type: 'withdraw' });
      this.addLog('Offers reset.');
    }
    this.renderLists();
    this.renderOffers();
    this.updateAccept();
  }

  usedSeeds() {
    const seeds = new Set();
    for (const mon of [...this.getParty(), ...this.getRanch()]) {
      if (mon.shinySeed) seeds.add(mon.shinySeed);
    }
    return seeds;
  }

  applyLocalTrade(incoming) {
    const party = this.getParty();
    const ranch = this.getRanch();
    const uid = this.localOffer?.uid;
    let removed = false;
    const pi = party.findIndex((m) => m.uid === uid);
    if (pi >= 0) {
      if (party.length <= 1) return false;
      party.splice(pi, 1);
      removed = true;
    } else {
      const ri = ranch.findIndex((m) => m.uid === uid);
      if (ri >= 0) {
        ranch.splice(ri, 1);
        removed = true;
      }
    }
    if (!removed) return false;
    if (party.length < 6) party.push(incoming);
    else ranch.push(incoming);
    this.onChanged?.();
    return true;
  }

  completeTrade(incoming, outgoing) {
    this.setStatus('Trade complete', 'ok');
    this.addLog(`<b>${displayName(incoming)}</b> joined you. <b>${displayName(outgoing)}</b> found a new home.`);
    this.audio?.sfx('level');
    this.toast(`Trade complete: <b>${displayName(incoming)}</b> joined your team.`, 'success', 5200);
    this.localOffer = null;
    this.remoteOffer = null;
    this.localAccepted = false;
    this.remoteAccepted = false;
    this.swapping = false;
    this.save?.();
    this.onChanged?.();
    this.renderLists();
    this.renderOffers();
    this.updateAccept();
  }

  copyCode() {
    const text = `LI-${this.code}`;
    navigator.clipboard?.writeText(text).then(
      () => this.toast(`Room code ${text} copied.`, 'success', 2200),
      () => this.toast(`Room code: ${text}`, 'info', 4000),
    );
  }

  destroy() {
    this.cleanupPeer();
    this.root = null;
  }
}
