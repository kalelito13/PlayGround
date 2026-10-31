import * as THREE from '../vendor/three.module.js';
import {
  SPECIES, MOVES, TYPES, RARITIES, FLUTES, FLUTE_ORDER,
  displayName, typeMultiplier, stageMultiplier, xpGain, levelUp,
  XP_TO_NEXT, MAX_LEVEL, rarityOf, requiredFluteTier, requiredFlute, catchChance, shinyOdds,
} from './data.js';
import { buildCreature, animateCreature, material } from './models.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------------------------------------------------------------------------
// Cinematic spirit-glade arena
// ---------------------------------------------------------------------------

function buildArena() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#c8dfd1', 26, 72);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color('#589cc4') },
        uBottom: { value: new THREE.Color('#ffe1a6') },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uBottom; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y + 0.08, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, pow(h, 0.62));
          float glow = max(dot(normalize(vDir), normalize(vec3(-0.5,0.3,-0.7))), 0.0);
          col += vec3(1.0,0.8,0.55) * pow(glow, 12.0) * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  scene.add(sky);

  const hemi = new THREE.HemisphereLight('#dff4ff', '#4e6b46', 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0ce', 3.0);
  sun.position.set(8, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const rim = new THREE.PointLight('#ffbe72', 45, 34, 2);
  rim.position.set(-9, 7, -3);
  scene.add(rim);
  const coolRim = new THREE.PointLight('#6ad7ff', 32, 30, 2);
  coolRim.position.set(9, 5, 5);
  scene.add(coolRim);

  const arena = new THREE.Group();
  scene.add(arena);

  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 18.5, 1.2, 64),
    new THREE.MeshStandardMaterial({ color: '#3f7052', roughness: 1, flatShading: false }),
  );
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  arena.add(ground);

  const top = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshStandardMaterial({ color: '#58855b', roughness: 0.95 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.01;
  top.receiveShadow = true;
  arena.add(top);

  const ringMat = new THREE.MeshBasicMaterial({ color: '#c8f4b0', transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  for (const r of [10.5, 14.6]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.09, 72), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    arena.add(ring);
  }

  const platforms = [];
  for (const [x, z] of [[-3.1, -2.6], [3.1, 2.7]]) {
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3.25, 3.55, 0.55, 40),
      new THREE.MeshStandardMaterial({ color: '#b4ad8d', roughness: 0.9, flatShading: false }),
    );
    platform.position.set(x, 0.28, z);
    platform.castShadow = true;
    platform.receiveShadow = true;
    arena.add(platform);

    const moss = new THREE.Mesh(
      new THREE.CircleGeometry(3.18, 40),
      new THREE.MeshStandardMaterial({ color: '#7da45f', roughness: 1 }),
    );
    moss.rotation.x = -Math.PI / 2;
    moss.position.set(x, 0.56, z);
    moss.receiveShadow = true;
    arena.add(moss);

    const rune = new THREE.Mesh(
      new THREE.RingGeometry(2.25, 2.55, 40, 1, 0, Math.PI * 1.4),
      new THREE.MeshBasicMaterial({ color: '#ecffd0', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
    rune.rotation.x = -Math.PI / 2;
    rune.rotation.z = x < 0 ? 2 : -1;
    rune.position.set(x, 0.575, z);
    arena.add(rune);
    platforms.push(platform);
  }

  // Distant grove silhouettes
  const pineMat = new THREE.MeshStandardMaterial({ color: '#39634d', roughness: 1, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3c33', roughness: 1 });
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2 + Math.random() * 0.2;
    const radius = 19 + Math.random() * 8;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 3.6, 6), trunkMat);
    trunk.position.y = 1.8;
    tree.add(trunk);
    for (let j = 0; j < 3; j++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.0 - j * 0.5, 3.2 - j * 0.4, 7), pineMat);
      cone.position.y = 3.2 + j * 1.6;
      cone.castShadow = true;
      tree.add(cone);
    }
    tree.position.set(Math.cos(ang) * radius, -0.8 + Math.random() * 0.8, Math.sin(ang) * radius);
    tree.rotation.y = Math.random() * Math.PI;
    tree.scale.setScalar(0.8 + Math.random() * 0.8);
    arena.add(tree);
  }

  // Floating rocks
  const floaters = [];
  for (let i = 0; i < 16; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.4 + Math.random() * 1.3, 0),
      new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? '#6c8d68' : '#7b7d6e', roughness: 1, flatShading: true }),
    );
    rock.position.set((Math.random() - 0.5) * 44, 2 + Math.random() * 12, -10 - Math.random() * 26);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.userData.base = rock.position.clone();
    rock.userData.phase = Math.random() * 6;
    scene.add(rock);
    floaters.push(rock);
  }

  // God rays
  for (let i = 0; i < 4; i++) {
    const ray = new THREE.Mesh(
      new THREE.ConeGeometry(2.2 + i * 0.6, 24, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#fff2c4', transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ray.position.set(-10 + i * 7, 10, -12 - i * 2);
    ray.rotation.z = 0.16 + i * 0.05;
    scene.add(ray);
  }

  // Petals + fireflies
  const petalCount = 110;
  const petalGeo = new THREE.BufferGeometry();
  const petalPos = new Float32Array(petalCount * 3);
  for (let i = 0; i < petalCount; i++) {
    petalPos[i * 3] = (Math.random() - 0.5) * 30;
    petalPos[i * 3 + 1] = Math.random() * 14;
    petalPos[i * 3 + 2] = (Math.random() - 0.5) * 26;
  }
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
  const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({
    color: '#ffd7db', size: 0.16, transparent: true, opacity: 0.85, depthWrite: false,
  }));
  scene.add(petals);

  const flyCount = 70;
  const flyGeo = new THREE.BufferGeometry();
  const flyPos = new Float32Array(flyCount * 3);
  for (let i = 0; i < flyCount; i++) {
    flyPos[i * 3] = (Math.random() - 0.5) * 28;
    flyPos[i * 3 + 1] = 0.6 + Math.random() * 5;
    flyPos[i * 3 + 2] = (Math.random() - 0.5) * 22;
  }
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const fireflies = new THREE.Points(flyGeo, new THREE.PointsMaterial({
    color: '#ffe98a', size: 0.12, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  scene.add(fireflies);

  return { scene, petals, fireflies, floaters, platforms, topY: 0.58 };
}

// ---------------------------------------------------------------------------

export class Battle {
  constructor({ party, inventory, audio }) {
    this.party = party;
    this.inventory = inventory;
    this.audio = audio;
    this.arena = buildArena();
    this.scene = this.arena.scene;
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 260);
    this.camBase = new THREE.Vector3(0, 4.1, 11.2);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 1.7, 0);
    this.tweens = [];
    this.busy = true;
    this.session = 0;
    this.shake = 0;
    this.time = 0;
    this.enemyGroup = null;
    this.playerGroup = null;
    this.onEnd = null;
    this.activeIndex = 0;
    this.enemy = null;
    this.isBoss = false;
    this.cacheDom();
    this.bindUI();
  }

  cacheDom() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      section: $('battle'),
      kicker: $('battle-kicker'),
      enemyCard: $('enemy-card'),
      enemyName: $('enemy-name'),
      enemyLv: $('enemy-lv'),
      enemyHp: $('enemy-hp-fill'),
      enemyHpText: $('enemy-hp-text'),
      enemyTypes: $('enemy-types'),
      enemyStatus: $('enemy-status'),
      playerCard: $('player-card'),
      playerName: $('player-name'),
      playerLv: $('player-lv'),
      playerHp: $('player-hp-fill'),
      playerHpText: $('player-hp-text'),
      playerTypes: $('player-types'),
      playerStatus: $('player-status'),
      playerExp: $('player-exp-fill'),
      playerExpText: $('player-exp-text'),
      log: $('battle-log'),
      actions: $('battle-actions'),
      party: $('battle-party'),
      floats: $('battle-floats'),
      flash: $('battle-flash'),
    };
  }

  bindUI() {
    this.el.actions.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled || this.busy) return;
      this.audio.init();
      this.audio.sfx('select');
      const cmd = btn.dataset.cmd;
      if (cmd === 'fight') this.renderMoves();
      else if (cmd === 'bag') this.renderBag();
      else if (cmd === 'party') this.renderPartySwap(false);
      else if (cmd === 'run') this.attemptRun();
      else if (cmd === 'back') this.renderMain();
      else if (btn.dataset.move != null) this.usePlayerMove(Number(btn.dataset.move));
      else if (btn.dataset.item) this.useItem(btn.dataset.item);
      else if (btn.dataset.swap != null) this.switchTo(Number(btn.dataset.swap), btn.dataset.force === '1');
    });
  }

  // ---- lifecycle ---------------------------------------------------------

  async begin(enemy, isBoss, onEnd) {
    this.session++;
    this.enemy = enemy;
    this.isBoss = isBoss;
    this.onEnd = onEnd;
    this.activeIndex = this.party.findIndex((m) => m.hp > 0);
    this.busy = true;
    this.shake = 0;
    this.enemy.atkStage = 0;
    this.enemy.defStage = 0;

    for (const g of [this.enemyGroup, this.playerGroup]) {
      if (g) this.scene.remove(g);
    }
    this.enemyGroup = this.makeModel(enemy, -3.1, -2.6, isBoss ? 2.25 : 1.95, 0);
    this.playerGroup = this.makeModel(this.party[this.activeIndex], 3.1, 2.7, 2.05, Math.PI);
    this.scene.add(this.enemyGroup, this.playerGroup);

    this.el.section.classList.remove('hidden', 'leaving');
    this.el.kicker.textContent = isBoss ? 'GUARDIAN TRIAL · THE GROVE REMEMBERS' : 'WILD ENCOUNTER';
    this.el.kicker.classList.toggle('boss', isBoss);
    this.el.log.textContent = isBoss ? 'The ancient grove holds its breath…' : 'The grass rustles…';
    this.el.actions.innerHTML = '';
    this.renderHUD();
    this.renderPartyDots();
    this.spawnScale(this.enemyGroup, 1, 480);
    this.spawnScale(this.playerGroup, 1, 480);
    this.audio.sfx('encounter');
    await wait(500);
    if (!this.enemyGroup) return;
    this.el.log.textContent = isBoss
      ? 'The Verdant Guardian rises from the roots!'
      : `A wild ${displayName(enemy)} appeared!`;
    await wait(isBoss ? 1100 : 750);
    this.busy = false;
    this.renderMain();
  }

  makeModel(mon, x, z, scale, rotationY) {
    const g = buildCreature(mon);
    g.position.set(x, this.arena.topY, z);
    g.rotation.y = rotationY;
    g.userData.baseScale = scale;
    g.userData.spawn = 0.001;
    g.userData.squash = 1;
    g.userData.basePos = g.position.clone();
    g.scale.setScalar(0.001);
    return g;
  }

  spawnScale(group, target, ms) {
    const from = group.userData.spawn;
    return this.tween(ms, (p) => { group.userData.spawn = from + (target - from) * p; });
  }

  tween(ms, fn, ease = (t) => 1 - (1 - t) * (1 - t)) {
    return new Promise((resolve) => {
      this.tweens.push({ time: 0, duration: ms / 1000, fn, ease, resolve });
    });
  }

  update(dt, time) {
    this.time = time;
    // tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.time += dt;
      const p = Math.min(1, tw.time / tw.duration);
      tw.fn(tw.ease(p));
      if (p >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }
    for (const g of [this.enemyGroup, this.playerGroup]) {
      if (!g) continue;
      animateCreature(g, time, this.busy ? 1.4 : 0);
      const s = g.userData.baseScale * Math.max(0.001, g.userData.spawn) * (g.userData.squash || 1);
      g.scale.setScalar(s);
    }
    // swirling petals
    const pp = this.arena.petals.geometry.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      let y = pp.getY(i) - dt * (0.35 + (i % 5) * 0.08);
      if (y < -0.5) y = 15;
      pp.setY(i, y);
      pp.setX(i, pp.getX(i) + Math.sin(time * 0.7 + i) * dt * 0.25);
    }
    pp.needsUpdate = true;
    const fp = this.arena.fireflies.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      fp.setY(i, Math.max(0.4, fp.getY(i) + Math.sin(time * 1.4 + i * 1.7) * dt * 0.15));
    }
    fp.needsUpdate = true;
    this.arena.petals.material.opacity = 0.65 + Math.sin(time * 0.8) * 0.2;
    this.arena.fireflies.material.opacity = 0.6 + Math.sin(time * 1.6) * 0.3;
    this.arena.floaters.forEach((r) => {
      r.position.y = r.userData.base.y + Math.sin(time * 0.5 + r.userData.phase) * 0.7;
      r.rotation.y += dt * 0.1;
    });

    this.shake = Math.max(0, this.shake - dt * 2.6);
    const sh = this.shake;
    this.camera.position.set(
      this.camBase.x + Math.sin(time * 71) * sh * 0.55,
      this.camBase.y + Math.cos(time * 63) * sh * 0.35,
      this.camBase.z + Math.sin(time * 59) * sh * 0.2,
    );
    this.camera.lookAt(0, 1.7, 0);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  get active() {
    return this.party[this.activeIndex];
  }

  // ---- HUD ---------------------------------------------------------------

  renderHUD() {
    const enemy = this.enemy;
    const active = this.active;
    if (!enemy || !active) return;
    const eSpecies = SPECIES[enemy.species];
    const aSpecies = SPECIES[active.species];
    const eRarity = rarityOf(enemy.species);
    const aRarity = rarityOf(active.species);
    this.el.enemyName.innerHTML = `${displayName(enemy)}${enemy.shiny ? '<span class="shiny-star" title="Unique shiny">✦</span>' : ''}`;
    this.el.enemyLv.textContent = `Lv. ${enemy.level}`;
    this.el.enemyTypes.innerHTML = `<span class="type-chip t-${eSpecies.type}">${TYPES[eSpecies.type].name}</span><span class="rarity-chip r-${eSpecies.rarity}">${eRarity.name}</span>`;
    this.el.playerName.innerHTML = `${displayName(active)}${active.shiny ? '<span class="shiny-star" title="Unique shiny">✦</span>' : ''}`;
    this.el.playerLv.textContent = `Lv. ${active.level}`;
    this.el.playerTypes.innerHTML = `<span class="type-chip t-${aSpecies.type}">${TYPES[aSpecies.type].name}</span><span class="rarity-chip r-${aSpecies.rarity}">${aRarity.name}</span>`;
    this.el.playerStatus.textContent = active.hp <= 0 ? 'FAINTED' : '';
    this.el.enemyStatus.textContent = enemy.hp <= 0 ? 'FAINTED' : '';
    this.setHP('enemy', enemy);
    this.setHP('player', active);
    const pct = Math.min(100, (active.exp / XP_TO_NEXT(active.level)) * 100);
    this.el.playerExp.style.width = `${pct}%`;
    this.el.playerExpText.textContent = active.level >= MAX_LEVEL ? 'MAX' : `${active.exp}/${XP_TO_NEXT(active.level)}`;
    this.renderPartyDots();
  }

  setHP(side, mon) {
    const pct = clamp((mon.hp / mon.maxHp) * 100, 0, 100);
    const fill = side === 'enemy' ? this.el.enemyHp : this.el.playerHp;
    const text = side === 'enemy' ? this.el.enemyHpText : this.el.playerHpText;
    fill.style.width = `${pct}%`;
    fill.classList.toggle('low', pct <= 50 && pct > 22);
    fill.classList.toggle('critical', pct <= 22);
    text.textContent = `${Math.max(0, mon.hp)}/${mon.maxHp}`;
  }

  renderPartyDots() {
    this.el.party.innerHTML = this.party.map((m, i) => {
      const s = SPECIES[m.species];
      const pct = clamp((m.hp / m.maxHp) * 100, 0, 100);
      return `<div class="party-dot ${i === this.activeIndex ? 'active' : ''} ${m.hp <= 0 ? 'down' : ''}" title="${displayName(m)}">
        <span class="dot-name">${displayName(m)}</span>
        <span class="dot-hp"><i style="width:${pct}%;background:${TYPES[s.type].color}"></i></span>
      </div>`;
    }).join('');
  }

  log(text) {
    this.el.log.innerHTML = text;
  }

  float(text, side, cls = '') {
    const div = document.createElement('div');
    div.className = `battle-float ${side} ${cls}`;
    div.textContent = text;
    this.el.floats.appendChild(div);
    setTimeout(() => div.remove(), 1300);
  }

  flashScreen(color = '#fff7df') {
    this.el.flash.style.background = color;
    this.el.flash.classList.remove('go');
    void this.el.flash.offsetWidth;
    this.el.flash.classList.add('go');
  }

  // ---- command menus -----------------------------------------------------

  renderMain() {
    if (this.busy) return;
    this.el.actions.innerHTML = `
      <button class="battle-btn cmd-fight" data-cmd="fight"><b>FIGHT</b><span>Choose a move</span></button>
      <button class="battle-btn cmd-bag" data-cmd="bag"><b>FLUTES</b><span>${this.inventory.flutes?.length || 0} instruments · ${this.inventory.potions} tonics</span></button>
      <button class="battle-btn cmd-party" data-cmd="party"><b>SWAP</b><span>${this.party.filter((m) => m.hp > 0).length} ready</span></button>
      <button class="battle-btn cmd-run" data-cmd="run"><b>RUN</b><span>${this.isBoss ? 'No escape' : 'Try to flee'}</span></button>
    `;
  }

  renderMoves() {
    if (this.busy) return;
    const active = this.active;
    const buttons = active.moves.map((entry, i) => {
      const move = MOVES[entry.id];
      return `<button class="move-btn t-${move.type}" data-move="${i}" ${entry.pp <= 0 ? 'disabled' : ''}>
        <span class="move-name">${move.name}</span>
        <span class="move-type">${TYPES[move.type].name}</span>
        <span class="move-pp">${entry.pp}/${entry.maxPp} PP</span>
      </button>`;
    }).join('');
    this.el.actions.innerHTML = `<div class="move-grid">${buttons}</div>
      <button class="battle-btn small back-btn" data-cmd="back"><b>BACK</b></button>`;
  }

  renderBag() {
    if (this.busy) return;
    const need = requiredFluteTier(this.enemy.species, this.enemy.level);
    const requiredName = FLUTES[requiredFlute(this.enemy.species, this.enemy.level)].name;
    const owned = (this.inventory.flutes || []).slice().sort((a, b) => FLUTES[a].tier - FLUTES[b].tier);
    const rows = owned.map((id) => {
      const flute = FLUTES[id];
      const ok = flute.tier >= need;
      const chance = this.isBoss ? 0 : catchChance(this.enemy, id, this.inventory.resonance || 0);
      return `<button class="flute-row ${ok ? 'ok' : 'weak'} ${flute.tier === need ? 'match' : ''}" data-item="flute:${id}" ${this.isBoss ? 'disabled' : ''}>
        <span class="flute-glyph" style="--fc:${flute.color}">♪</span>
        <span class="flute-info">
          <b>${flute.name}</b>
          <small>Rank ${flute.tier} · ${ok ? 'the creature listens' : `needs ${requiredName}`}</small>
        </span>
        <span class="flute-chance ${ok ? '' : 'blocked'}">${ok ? `${Math.round(chance * 100)}%` : 'too simple'}</span>
      </button>`;
    }).join('');
    const hasMatch = owned.some((id) => FLUTES[id].tier >= need);
    const rarity = rarityOf(this.enemy.species);
    const hint = this.isBoss
      ? '<p class="bag-hint">Ancient roots seal the guardian against music. This battle must be won.</p>'
      : hasMatch
        ? `<p class="bag-hint">${displayName(this.enemy)} is <b>${rarity.name}</b> · Lv. ${this.enemy.level}. Shiny odds: 1 / ${shinyOdds(this.enemy.species)}. Softer melodies are easier to hear when HP is low.</p>`
        : `<p class="bag-hint">You need a <b>${requiredName}</b> for this ${rarity.name} creature. Win battles and befriend creatures to earn finer flutes.</p>`;
    this.el.actions.innerHTML = `
      <div class="flute-list">${rows || '<p class="bag-hint">You have no flutes yet.</p>'}</div>
      ${hint}
      <button class="battle-btn item-btn tonic-btn" data-item="potion" ${this.inventory.potions <= 0 ? 'disabled' : ''}>
        <b>Grove Tonic ×${this.inventory.potions}</b><span>Restore ${28 + this.active.level * 2} HP</span>
      </button>
      <button class="battle-btn small back-btn" data-cmd="back"><b>BACK</b></button>`;
  }

  renderPartySwap(force) {
    if (this.busy && !force) return;
    const rows = this.party.map((m, i) => {
      const s = SPECIES[m.species];
      const pct = clamp((m.hp / m.maxHp) * 100, 0, 100);
      const disabled = m.hp <= 0 || (i === this.activeIndex && !force);
      return `<button class="swap-row ${i === this.activeIndex ? 'current' : ''}" data-swap="${i}" data-force="${force ? 1 : 0}" ${disabled ? 'disabled' : ''}>
        <span class="swap-dot" style="background:${TYPES[s.type].color}"></span>
        <span class="swap-name">${displayName(m)}<small>Lv. ${m.level} · ${TYPES[s.type].name}</small></span>
        <span class="swap-hp"><i style="width:${pct}%"></i><em>${Math.max(0, m.hp)}/${m.maxHp}</em></span>
      </button>`;
    }).join('');
    this.el.actions.innerHTML = `<div class="swap-list">${rows}</div>
      ${force ? '' : '<button class="battle-btn small back-btn" data-cmd="back"><b>BACK</b></button>'}`;
  }

  // ---- actions -----------------------------------------------------------

  async usePlayerMove(index) {
    if (this.busy) return;
    const active = this.active;
    const entry = active.moves[index];
    if (!entry) return;
    this.busy = true;
    this.el.actions.innerHTML = '';
    if (entry.pp <= 0) {
      this.log(`${displayName(active)} has no power left for that move!`);
      this.busy = false;
      this.renderMain();
      return;
    }
    entry.pp--;
    const move = MOVES[entry.id];
    this.log(`${displayName(active)} used <b>${move.name}</b>!`);
    await this.performMove(active, this.enemy, move, true);
    if (!this.enemy) return;
    if (this.enemy.hp <= 0) {
      await this.enemyFainted();
      return;
    }
    await wait(250);
    await this.enemyTurn();
  }

  async performMove(attacker, defender, move, byPlayer) {
    const attackerGroup = byPlayer ? this.playerGroup : this.enemyGroup;
    const defenderGroup = byPlayer ? this.enemyGroup : this.playerGroup;
    if (!attackerGroup || !defenderGroup) return;
    await this.lunge(attackerGroup, defenderGroup, byPlayer);
    const hit = Math.random() <= move.accuracy;
    if (!hit) {
      this.log(`But ${displayName(defender)} dodged it!`);
      this.audio.sfx('miss');
      await wait(650);
      return;
    }
    if (move.power > 0) {
      const { dmg, eff, crit } = this.damage(attacker, defender, move);
      defender.hp = Math.max(0, defender.hp - dmg);
      this.audio.sfx('hit');
      this.shake = 0.5;
      defenderGroup.userData.squash = 0.82;
      setTimeout(() => { if (defenderGroup) defenderGroup.userData.squash = 1; }, 160);
      this.float(`-${dmg}`, byPlayer ? 'enemy' : 'player', crit ? 'crit' : '');
      this.setHP(byPlayer ? 'enemy' : 'player', defender);
      this.renderPartyDots();
      const fx = byPlayer ? this.el.enemyCard : this.el.playerCard;
      fx.classList.remove('shake');
      void fx.offsetWidth;
      fx.classList.add('shake');
      await wait(420);
      if (crit) this.log('A critical hit!');
      if (eff > 1) this.log("It's super effective!");
      else if (eff < 1) this.log("It's not very effective…");
      await wait(650);
    } else {
      await this.statusMove(attacker, defender, move, byPlayer);
    }
  }

  async statusMove(attacker, defender, move, byPlayer) {
    const defenderGroup = byPlayer ? this.enemyGroup : this.playerGroup;
    if (move.effect === 'atkDown') {
      defender.atkStage = Math.max(-3, defender.atkStage - 1);
      this.log(`${displayName(defender)}'s Attack fell!`);
    } else if (move.effect === 'defUp') {
      attacker.defStage = Math.min(3, attacker.defStage + 1);
      this.log(`${displayName(attacker)}'s Defense rose!`);
    } else if (move.effect === 'drain') {
      const heal = Math.round(attacker.maxHp * 0.22);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      this.audio.sfx('heal');
      this.log(`${displayName(attacker)} drained ${heal} vitality!`);
      this.float(`+${heal}`, byPlayer ? 'player' : 'enemy', 'heal');
      this.setHP(byPlayer ? 'player' : 'enemy', attacker);
    }
    if (defenderGroup) {
      defenderGroup.userData.squash = 0.92;
      setTimeout(() => { if (defenderGroup) defenderGroup.userData.squash = 1; }, 160);
    }
    this.renderHUD();
    await wait(850);
  }

  async lunge(attackerGroup, defenderGroup, byPlayer) {
    const base = attackerGroup.userData.basePos;
    const dir = byPlayer ? -1 : 1;
    const dx = byPlayer ? -0.55 : 0.55;
    const dz = byPlayer ? -0.4 : 0.4;
    await this.tween(180, (p) => {
      attackerGroup.position.x = base.x + dx * p;
      attackerGroup.position.z = base.z + dz * p;
      attackerGroup.rotation.z = dir * 0.06 * p;
    });
    await this.tween(180, (p) => {
      attackerGroup.position.x = base.x + dx * (1 - p);
      attackerGroup.position.z = base.z + dz * (1 - p);
      attackerGroup.rotation.z = dir * 0.06 * (1 - p);
    });
  }

  damage(attacker, defender, move) {
    const atk = attacker.atk * stageMultiplier(attacker.atkStage);
    const def = defender.def * stageMultiplier(defender.defStage);
    const eff = typeMultiplier(move.type, SPECIES[defender.species].type);
    const stab = move.type === SPECIES[attacker.species].type ? 1.2 : 1;
    const crit = Math.random() < 0.07;
    let dmg = ((2 * attacker.level / 5 + 2) * move.power * atk / def) / 50 + 2;
    dmg = dmg * eff * stab * (crit ? 1.5 : 1) * (0.86 + Math.random() * 0.28);
    return { dmg: Math.max(1, Math.round(dmg)), eff, crit };
  }

  chooseEnemyMove() {
    const enemy = this.enemy;
    const available = enemy.moves.filter((m) => m.pp > 0);
    if (!available.length) return MOVES.tackle;
    const scored = available.map((entry) => {
      const move = MOVES[entry.id];
      let score = move.power * typeMultiplier(move.type, SPECIES[this.active.species].type);
      if (move.effect) score = 30;
      return { move, entry, score: score * (0.75 + Math.random() * 0.5) };
    });
    scored.sort((a, b) => b.score - a.score);
    const pick = scored[Math.random() < 0.72 ? 0 : Math.floor(Math.random() * scored.length)];
    pick.entry.pp = Math.max(0, pick.entry.pp - 1);
    return pick.move;
  }

  async enemyTurn() {
    if (!this.enemy || this.enemy.hp <= 0 || !this.active || this.active.hp <= 0) {
      this.busy = false;
      this.renderMain();
      return;
    }
    const move = this.chooseEnemyMove();
    await wait(150);
    this.log(`Wild ${displayName(this.enemy)} used <b>${move.name}</b>!`);
    await this.performMove(this.enemy, this.active, move, false);
    if (!this.active) return;
    this.renderHUD();
    if (this.active.hp <= 0) {
      await this.playerFainted();
    } else {
      this.busy = false;
      this.renderMain();
    }
  }

  async enemyFainted() {
    this.busy = true;
    this.enemy.hp = 0;
    this.setHP('enemy', this.enemy);
    this.el.enemyStatus.textContent = 'FAINTED';
    this.log(`${displayName(this.enemy)} fainted!`);
    this.audio.sfx('fail');
    this.el.actions.innerHTML = '';
    await this.spawnScale(this.enemyGroup, 0, 380);
    await wait(450);
    const gained = xpGain(this.enemy, this.isBoss);
    await this.awardXp(gained);
    await wait(350);
    await this.finish(this.isBoss ? 'boss' : 'win');
  }

  async awardXp(amount) {
    const mon = this.active;
    if (!mon) return;
    mon.exp += amount;
    this.log(`${displayName(mon)} gained <b>${amount} XP</b>!`);
    this.audio.sfx('level');
    this.renderHUD();
    await wait(900);
    while (mon.exp >= XP_TO_NEXT(mon.level) && mon.level < MAX_LEVEL) {
      mon.exp -= XP_TO_NEXT(mon.level);
      const oldName = displayName(mon);
      const result = levelUp(mon);
      if (result?.evolvedTo) {
        this.log(`<b>${oldName} evolved into ${displayName(mon)}!</b>`);
        this.audio.sfx('level');
        this.flashScreen('#fff2b0');
        if (this.playerGroup && this.active === mon) {
          const old = this.playerGroup;
          const next = this.makeModel(mon, 3.1, 2.7, 2.05, Math.PI);
          next.userData.spawn = 1;
          next.scale.setScalar(2.05);
          this.scene.remove(old);
          this.scene.add(next);
          this.playerGroup = next;
        }
        await wait(1400);
      }
      this.log(`<b>${displayName(mon)}</b> is now Lv. ${mon.level}!`);
      this.audio.sfx('level');
      this.float(`LV. ${mon.level}`, 'player', 'level');
      this.renderHUD();
      await wait(950);
      if (result?.learned?.length) {
        const names = result.learned.map((id) => MOVES[id].name).join(', ');
        this.log(`${displayName(mon)} learned <b>${names}</b>!`);
        await wait(1100);
      }
    }
    this.renderHUD();
  }

  async playerFainted() {
    this.busy = true;
    this.log(`${displayName(this.active)} fainted!`);
    this.audio.sfx('fail');
    this.el.actions.innerHTML = '';
    await this.spawnScale(this.playerGroup, 0, 380);
    await wait(500);
    const next = this.party.findIndex((m) => m.hp > 0);
    if (next === -1) {
      this.log('All of your partners are exhausted…');
      await wait(1100);
      await this.finish('lost');
      return;
    }
    this.log('Choose your next partner.');
    this.busy = false;
    this.el.actions.innerHTML = '';
    this.renderPartySwap(true);
  }

  // ---- catching / items / switching / running ---------------------------

  async useItem(item) {
    if (this.busy) return;
    if (item.startsWith('flute:')) {
      await this.playFlute(item.slice(6));
      return;
    }
    if (item === 'potion') {
      if (this.inventory.potions <= 0) return;
      if (this.active.hp >= this.active.maxHp) {
        this.log(`${displayName(this.active)} is already full of beans.`);
        return;
      }
      this.busy = true;
      this.el.actions.innerHTML = '';
      this.inventory.potions--;
      const healed = Math.min(this.active.maxHp, this.active.hp + 28 + this.active.level * 2);
      const amount = healed - this.active.hp;
      this.active.hp = healed;
      this.audio.sfx('heal');
      this.log(`${displayName(this.active)} drank a Grove Tonic and recovered ${amount} HP!`);
      this.float(`+${amount}`, 'player', 'heal');
      this.renderHUD();
      await wait(800);
      await this.enemyTurn();
    }
  }

  // ---- flute capture -----------------------------------------------------

  async playFlute(fluteId) {
    if (this.busy || !this.enemy) return;
    const flute = FLUTES[fluteId];
    if (!flute) return;
    const need = requiredFluteTier(this.enemy.species, this.enemy.level);
    const requiredName = FLUTES[requiredFlute(this.enemy.species, this.enemy.level)].name;
    this.busy = true;
    this.el.actions.innerHTML = '';
    this.audio.init();
    this.audio.flute(flute.tier);
    this.log(`You raise the <b>${flute.name}</b> to your lips…`);
    await wait(420);

    if (this.isBoss) {
      this.log('Ancient roots seal the guardian against music. This trial must be won.');
      await wait(1000);
      this.busy = false;
      this.renderMain();
      return;
    }

    const melody = this.spawnMelody(flute);
    await melody;

    if (flute.tier < need) {
      this.audio.sfx('fail');
      this.log(`The melody is too simple. <b>${displayName(this.enemy)}</b> needs a <b>${requiredName}</b>.`);
      await wait(1300);
      await this.enemyTurn();
      return;
    }

    const chance = catchChance(this.enemy, fluteId, this.inventory.resonance || 0);
    const success = Math.random() < chance;
    if (success) {
      this.audio.sfx('catch');
      this.flashScreen('#fff4c8');
      this.log(`<b>${displayName(this.enemy)}</b> sways with the melody…`);
      this.float('♪', 'enemy', 'level');
      if (this.enemyGroup) {
        const spin = this.enemyGroup.rotation.y;
        this.tween(900, (p) => {
          if (!this.enemyGroup) return;
          this.enemyGroup.rotation.y = spin + p * Math.PI * 2.4;
        });
      }
      await wait(1100);
      this.log(`<b>Gotcha!</b> ${displayName(this.enemy)} joined your song!`);
      this.audio.sfx('catch');
      await this.spawnScale(this.enemyGroup, 0, 620);
      await wait(500);
      await this.finish('caught');
    } else {
      this.audio.sfx('fail');
      this.log(`${displayName(this.enemy)} shook off the melody!`);
      if (this.enemyGroup) this.enemyGroup.userData.squash = 0.9;
      setTimeout(() => { if (this.enemyGroup) this.enemyGroup.userData.squash = 1; }, 200);
      await this.spawnScale(this.enemyGroup, 1, 320);
      await wait(800);
      await this.enemyTurn();
    }
  }

  spawnMelody(flute) {
    const texture = getNoteTexture();
    const group = new THREE.Group();
    this.scene.add(group);
    const material = new THREE.SpriteMaterial({
      map: texture, color: flute.color, transparent: true, opacity: 0.95,
      depthWrite: false, depthTest: false,
    });
    const sprites = [];
    const start = this.playerGroup
      ? this.playerGroup.position.clone().add(new THREE.Vector3(0.2, 1.5, 0.3))
      : new THREE.Vector3(3.1, 2, 2.7);
    const end = this.enemyGroup
      ? this.enemyGroup.position.clone().add(new THREE.Vector3(0, 1.3, 0))
      : new THREE.Vector3(-3.1, 1.8, -2.6);
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 2.8, 0));
    for (let i = 0; i < 7; i++) {
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(start);
      sprite.scale.setScalar(0.34 + (i % 3) * 0.06);
      group.add(sprite);
      sprites.push(sprite);
    }
    // expanding resonance ring at the player's feet
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.0, 40),
      new THREE.MeshBasicMaterial({ color: flute.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(this.playerGroup ? this.playerGroup.position : new THREE.Vector3(3.1, 0.6, 2.7));
    ring.position.y += 0.12;
    this.scene.add(ring);
    const ringTween = this.tween(1200, (p) => {
      ring.scale.setScalar(0.4 + p * 3.2);
      ring.material.opacity = 0.6 * (1 - p);
    }, (t) => t);

    const noteTween = this.tween(1650, (p) => {
      sprites.forEach((sprite, i) => {
        const delay = i * 0.085;
        const u = Math.min(1, Math.max(0, (p - delay) / (1 - delay)));
        const a = (1 - u) * (1 - u);
        const b = 2 * (1 - u) * u;
        const c = u * u;
        sprite.position.set(
          start.x * a + mid.x * b + end.x * c,
          start.y * a + mid.y * b + end.y * c + Math.sin(u * Math.PI) * 0.4,
          start.z * a + mid.z * b + end.z * c,
        );
        sprite.position.x += Math.sin(u * Math.PI * 2 + i) * 0.35;
        sprite.material.opacity = 0.95 * (1 - Math.max(0, u - 0.75) * 3.2);
        sprite.scale.setScalar(0.26 + Math.sin(u * Math.PI) * 0.22);
      });
    }, (t) => t);

    return Promise.all([noteTween, ringTween]).then(() => {
      this.scene.remove(group);
      this.scene.remove(ring);
      material.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
    });
  }

  async switchTo(index, force) {
    if (index === this.activeIndex && !force) return;
    const next = this.party[index];
    if (!next || next.hp <= 0) return;
    this.busy = true;
    this.el.actions.innerHTML = '';
    if (this.playerGroup) {
      await this.spawnScale(this.playerGroup, 0, 260);
      this.scene.remove(this.playerGroup);
    }
    this.activeIndex = index;
    next.atkStage = 0;
    next.defStage = 0;
    this.playerGroup = this.makeModel(next, 3.1, 2.7, 2.05, Math.PI);
    this.scene.add(this.playerGroup);
    this.spawnScale(this.playerGroup, 1, 380);
    this.audio.sfx('confirm');
    this.log(`Go, <b>${displayName(next)}</b>!`);
    this.renderHUD();
    await wait(700);
    if (force) {
      this.busy = false;
      this.renderMain();
      return;
    }
    await this.enemyTurn();
  }

  async attemptRun() {
    if (this.busy) return;
    if (this.isBoss) {
      this.log('There is no running from the grove guardian!');
      return;
    }
    this.busy = true;
    this.el.actions.innerHTML = '';
    const chance = clamp(0.55 + (this.active.spd - this.enemy.spd) * 0.025, 0.25, 0.95);
    if (Math.random() < chance) {
      this.log('You slipped away through the tall grass.');
      await wait(800);
      await this.finish('run');
    } else {
      this.log("You couldn't get away!");
      await wait(700);
      await this.enemyTurn();
    }
  }

  async finish(result) {
    this.busy = true;
    this.session++;
    const callback = this.onEnd;
    const enemy = this.enemy;
    this.onEnd = null;
    this.el.actions.innerHTML = '';
    await wait(650);
    this.el.section.classList.add('leaving');
    await wait(420);
    this.el.section.classList.add('hidden');
    this.el.section.classList.remove('leaving');
    for (const g of [this.enemyGroup, this.playerGroup]) {
      if (g) this.scene.remove(g);
    }
    this.enemyGroup = null;
    this.playerGroup = null;
    this.enemy = null;
    this.busy = true;
    callback?.(result, enemy);
  }
}
