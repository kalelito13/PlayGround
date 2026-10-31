import * as THREE from '../vendor/three.module.js';
import { createWorld } from './world.js';
import { buildCreature, buildTrainer, animateCreature, animateTrainer, shadowBlob } from './models.js';
import {
  SPECIES, TYPES, MOVES, RARITIES, FLUTES, FLUTE_ORDER, createCreature, displayName, healCreature,
  starterOptions, XP_TO_NEXT, MAX_LEVEL, shinyOdds, rarityOf, requiredFluteTier, requiredFlute, makeShinySeed,
} from './data.js';
import { shinySignature } from './appearance.js';
import {
  SHOP_ITEMS, SUPPORTER_PACKS, PAYMENT, REDEEM_CODES, defaultInventory, purchase, redeem,
  ownsItem, ownedEntry, hasSkin, formatLumen, paymentLinkFor,
} from './shop.js';
import { TradeManager } from './trade.js';
import { Battle } from './battle.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#cfe3d6', 0.0052);
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 14, 28);

const world = createWorld();
scene.add(world.group);

const hemi = new THREE.HemisphereLight('#dff4ff', '#6b8251', 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1cf', 2.7);
sun.position.set(46, 74, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.bias = -0.0007;
sun.shadow.normalBias = 0.025;
scene.add(sun);
const fill = new THREE.DirectionalLight('#b7d8ff', 0.5);
fill.position.set(-40, 25, -35);
scene.add(fill);

const trainer = buildTrainer();
trainer.position.set(0, world.heightAt(0, 0), 0);
scene.add(trainer);

const campGlow = new THREE.PointLight('#ffbe6b', 10, 16, 2);
const campPos = world.campPos;
campGlow.position.set(campPos.x, campPos.y + 1.2, campPos.z);
scene.add(campGlow);

// Unique cosmetics bought in the Grove Market are attached to the trainer.
let trainerFx = null;
function refreshTrainerCosmetics() {
  if (trainerFx) {
    trainer.remove(trainerFx);
    trainerFx.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    trainerFx = null;
  }
  const fx = new THREE.Group();
  fx.name = 'trainer-cosmetics';
  if (hasSkin(state.inventory, 'moonweave-mantle') || hasSkin(state.inventory, 'patron-ring') || hasSkin(state.inventory, 'astral-flute')) {
    const color = hasSkin(state.inventory, 'patron-ring') ? '#e8c86a' : '#9fc8ff';
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.035, 5, 32),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5, roughness: 0.35 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    fx.add(ring);
    for (let i = 0; i < 3; i++) {
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color }));
      const a = (i / 3) * Math.PI * 2;
      spark.position.set(Math.cos(a) * 0.62, 1.1 + i * 0.2, Math.sin(a) * 0.62);
      fx.add(spark);
    }
  }
  if (hasSkin(state.inventory, 'starcrown') || hasSkin(state.inventory, 'founder-crown')) {
    const gold = hasSkin(state.inventory, 'founder-crown') ? '#ffe07a' : '#d9f4ff';
    const crown = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color: gold, emissive: gold, emissiveIntensity: 1.6, roughness: 0.25 }),
    );
    crown.scale.set(1.4, 0.8, 1.4);
    crown.position.y = 2.62;
    fx.add(crown);
  }
  if (hasSkin(state.inventory, 'starlight-aura')) {
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.02, 32),
      new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.05;
    fx.add(aura);
  }
  if (fx.children.length) {
    trainer.add(fx);
    trainerFx = fx;
  }
}

const audio = new AudioSys();
const input = new Input({
  canvas,
  joystick: document.getElementById('joystick'),
  knob: document.getElementById('stick-knob'),
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const SAVE_KEY = 'lumen-isles-save-v1';
const DAY_SECONDS = 720; // one full day/night cycle every 12 real minutes
const state = {
  mode: 'loading',
  party: [],
  inventory: defaultInventory(),
  ranchMons: [],
  caught: [],
  seen: [],
  catchCount: 0,
  battlesWon: 0,
  bossDefeated: false,
  boss: null,
  wilds: [],
  cooldown: 0,
  near: null,
  activeWild: null,
  startedAt: Date.now(),
  ranch: 0,
  modalOpen: false,
  zone: '',
  gameTime: 0.34,
  gameDay: 1,
  selectedFlute: 'willow',
  shinyFound: 0,
  specialStamp: 0,
  lunariSpawned: false,
  solarisSpawned: false,
};

const battle = new Battle({ party: state.party, inventory: state.inventory, audio });
battle.resize(window.innerWidth / window.innerHeight);

const trade = new TradeManager({
  getParty: () => state.party,
  getRanch: () => state.ranchMons,
  onChanged: () => {
    renderPartyHUD();
    updateQuest();
    refreshTrainerCosmetics();
  },
  toast,
  save: () => saveGame(),
  audio,
  thumbFor,
});

const player = {
  pos: new THREE.Vector3(0, 0, 0),
  vel: new THREE.Vector3(),
  facing: Math.PI,
  jump: 0,
  jumpVel: 0,
  grounded: true,
  walk: 0,
  stepTimer: 0,
};

let cameraYaw = 0;
let cameraPitch = 0.3;
let cameraDist = 11.5;
const cameraLook = new THREE.Vector3(0, 1.4, 0);

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const ui = {
  title: $('title'),
  titleContinue: $('btn-continue'),
  titleContinueMeta: $('continue-meta'),
  starter: $('starter'),
  starterGrid: $('starter-grid'),
  hud: $('hud'),
  questTitle: $('quest-title'),
  questDesc: $('quest-desc'),
  questCount: $('quest-count'),
  questCard: $('quest-card'),
  party: $('party-list'),
  flute: $('flute-chip'),
  fluteName: $('flute-name'),
  lumen: $('lumen-count'),
  potions: $('potion-count'),
  prompt: $('prompt'),
  promptText: $('prompt-text'),
  promptKey: $('prompt-key'),
  toasts: $('toasts'),
  modal: $('modal'),
  modalBody: $('modal-body'),
  ending: $('ending'),
  endingStats: $('ending-stats'),
  loading: $('loading'),
  zone: $('zone-label'),
  action: $('btn-action'),
  jump: $('btn-jump'),
  flash: $('screen-flash'),
  battle: $('battle'),
  timeChip: $('time-chip'),
  timeText: $('time-text'),
  timeIcon: $('time-icon'),
  dayText: $('day-text'),
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angleLerp = (a, b, t) => {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
};

function toast(html, kind = 'info', ms = 3600) {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = html;
  ui.toasts.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 500);
  }, ms);
}

function flashScreen(color = '#fff8e6') {
  ui.flash.style.background = color;
  ui.flash.classList.remove('go');
  void ui.flash.offsetWidth;
  ui.flash.classList.add('go');
}

function setPrompt(text, key = 'E') {
  ui.promptText.textContent = text;
  ui.promptKey.textContent = key;
  ui.prompt.classList.add('show');
  ui.action.classList.add('ready');
}

function hidePrompt() {
  ui.prompt.classList.remove('show');
  ui.action.classList.remove('ready');
}

// ---------------------------------------------------------------------------
// Thumbnails for cards / party menu
// ---------------------------------------------------------------------------

const thumbs = {};
let thumbRig = null;
const shinyThumbKeys = [];

function makeThumbnails() {
  const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  tr.setPixelRatio(1);
  tr.setSize(300, 300, false);
  tr.toneMapping = THREE.ACESFilmicToneMapping;
  tr.toneMappingExposure = 1.15;
  tr.outputColorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight('#ffffff', '#8aa27c', 2.0));
  const d = new THREE.DirectionalLight('#fff3d8', 3.2);
  d.position.set(2, 5, 4);
  s.add(d);
  const rim = new THREE.DirectionalLight('#9fd9ff', 1.6);
  rim.position.set(-4, 2, -3);
  s.add(rim);
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  cam.position.set(1.7, 1.6, 4.6);
  cam.lookAt(0, 0.9, 0);

  for (const id of Object.keys(SPECIES)) {
    const g = buildCreature(id);
    g.rotation.y = 0.22;
    if (id === 'elderwood') g.scale.setScalar(0.95);
    s.add(g);
    tr.render(s, cam);
    thumbs[id] = tr.domElement.toDataURL('image/png');
    s.remove(g);
  }
  thumbRig = { renderer: tr, scene: s, camera: cam };
}

// Shinies get their own portrait so two shinies never share a picture.
function thumbFor(mon) {
  if (!mon) return '';
  const base = thumbs[mon.species] || '';
  if (!mon.shiny || !mon.shinySeed) return base;
  const key = `${mon.species}:${mon.shinySeed}`;
  if (thumbs[key]) return thumbs[key];
  if (!thumbRig) return base;
  try {
    const { renderer, scene: s, camera: cam } = thumbRig;
    const g = buildCreature(mon);
    g.rotation.y = 0.22;
    s.add(g);
    renderer.render(s, cam);
    const url = renderer.domElement.toDataURL('image/png');
    s.remove(g);
    thumbs[key] = url;
    shinyThumbKeys.push(key);
    if (shinyThumbKeys.length > 60) {
      const old = shinyThumbKeys.shift();
      delete thumbs[old];
    }
    return url;
  } catch {
    return base;
  }
}

// ---------------------------------------------------------------------------
// Wild creatures
// ---------------------------------------------------------------------------

function spawnWild(spawn, isTitle = false) {
  const lure = state.inventory.lureUntil > Date.now() ? 2 : 1;
  const shiny = Math.random() < lure / shinyOdds(spawn.species);
  const mon = createCreature(spawn.species, spawn.level, { shiny });
  const root = new THREE.Group();
  const model = buildCreature(mon);
  const baseScale = spawn.species === 'elderwood' ? 1.5 : mon.shiny ? 1.0 : 0.9;
  model.scale.setScalar(baseScale);
  root.add(model);
  const shadow = shadowBlob(spawn.species === 'elderwood' ? 1.8 : 1.1);
  root.add(shadow);
  const typeColor = mon.shiny ? '#ffe27a' : TYPES[SPECIES[spawn.species].type].color;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 0.95, 28),
    new THREE.MeshBasicMaterial({ color: typeColor, transparent: true, opacity: mon.shiny ? 0.65 : 0.4, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  root.add(ring);
  const x = spawn.x, z = spawn.z;
  root.position.set(x, world.heightAt(x, z) + 0.01, z);
  scene.add(root);

  const wild = {
    mon,
    spawn,
    root,
    model,
    shadow,
    ring,
    home: new THREE.Vector2(x, z),
    target: new THREE.Vector2(x, z),
    timer: 2 + Math.random() * 5,
    phase: Math.random() * 8,
    scaleBase: baseScale,
    isTitle,
    shiny,
    special: spawn.special || null,
    active: true,
  };
  if (isTitle) {
    model.scale.setScalar(wild.scaleBase * 0.001);
    wild.spawnScale = 0;
  }
  if (!isTitle) state.wilds.push(wild);
  return wild;
}

function pickWanderTarget(wild) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 6;
    const x = wild.home.x + Math.cos(a) * r;
    const z = wild.home.y + Math.sin(a) * r;
    if (world.heightAt(x, z) > 0.5) {
      wild.target.set(x, z);
      return;
    }
  }
  wild.target.copy(wild.home);
}

function despawnWild(wild, respawnMs) {
  wild.active = false;
  scene.remove(wild.root);
  state.wilds = state.wilds.filter((w) => w !== wild);
  if (state.near === wild) state.near = null;
  if (respawnMs && !wild.special) {
    setTimeout(() => {
      if (state.bossDefeated && state.caught.length >= 3) return;
      const level = Math.min(12, wild.spawn.level + Math.floor(Math.random() * 2));
      const w = spawnWild({ ...wild.spawn, level });
      w.spawnScale = 0;
      w.model.scale.setScalar(0.001);
    }, respawnMs);
  }
}

function normalizeCaught(mon) {
  const joined = { ...mon };
  joined.hp = Math.max(1, joined.hp);
  joined.exp = joined.exp || 0;
  if (joined.shiny && !joined.shinySeed) joined.shinySeed = makeShinySeed();
  joined.appearance = joined.shiny && joined.shinySeed ? { shiny: true, seed: joined.shinySeed } : null;
  return joined;
}

// Mythical and divine visitors appear only when the isles are ready for them.
function ensureSpecialSpawns(force = false) {
  const now = performance.now();
  if (!force && now - state.specialStamp < 1400) return;
  state.specialStamp = now;
  const night = isNightTime();

  for (const wild of [...state.wilds]) {
    if (!wild.special) continue;
    if (wild.special === 'lunari' && !night) despawnWild(wild);
    if (wild.special === 'solaris' && (night || !state.bossDefeated)) despawnWild(wild);
  }

  if (night && state.caught.length >= 3 && !state.caught.includes('lunari') && !state.wilds.some((w) => w.special === 'lunari')) {
    const x = world.shrinePos.x - 10;
    const z = world.shrinePos.z - 3;
    const wild = spawnWild({ species: 'lunari', x, z, level: 14, special: 'lunari' });
    wild.spawnScale = 0;
    wild.model.scale.setScalar(0.001);
    audio.sfx('level');
    toast('<b>Lunari</b> steps out of the moonlight. It will only answer an <b>Aurora Flute</b>.', 'warn', 6500);
  }

  if (!night && state.bossDefeated && !state.caught.includes('solaris') && !state.wilds.some((w) => w.special === 'solaris')) {
    const x = world.shrinePos.x + 9;
    const z = world.shrinePos.z + 2;
    const wild = spawnWild({ species: 'solaris', x, z, level: 17, special: 'solaris' });
    wild.spawnScale = 0;
    wild.model.scale.setScalar(0.001);
    audio.sfx('level');
    toast('<b>Solaris</b> descends on the restored grove. Only a <b>Celestial Flute</b> can calm it.', 'warn', 7000);
  }
}

// ---------------------------------------------------------------------------
// Boss
// ---------------------------------------------------------------------------

function ensureBoss() {
  if (state.bossDefeated || state.caught.length < 3) return;
  world.setGuardianBeam(true);
  if (state.boss) return;
  const x = world.shrinePos.x;
  const z = world.shrinePos.z + 3.4;
  const y = world.heightAt(x, z);
  const root = new THREE.Group();
  root.position.set(x, y, z);
  const mon = createCreature('elderwood', 19);
  const model = buildCreature(mon);
  model.scale.setScalar(2.4);
  root.add(model);
  const shadow = shadowBlob(2.6);
  root.add(shadow);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.0, 2.35, 40),
    new THREE.MeshBasicMaterial({ color: '#b8ff9c', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  root.add(ring);
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 2.75, 48),
    new THREE.MeshBasicMaterial({ color: '#e2ffc6', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.02;
  root.add(halo);
  scene.add(root);
  state.boss = { mon, root, model, ring, halo, x, z, phase: 2 };
  battle.resize(window.innerWidth / window.innerHeight);
}

function removeBoss() {
  if (!state.boss) return;
  scene.remove(state.boss.root);
  state.boss = null;
  world.setGuardianBeam(false);
}

// ---------------------------------------------------------------------------
// Quest & HUD
// ---------------------------------------------------------------------------

function questPhase() {
  if (state.bossDefeated) return 3;
  if (state.caught.length >= 3) return 2;
  return 1;
}

function updateQuest() {
  const phase = questPhase();
  if (phase === 1) {
    ui.questTitle.textContent = 'A New Naturalist';
    ui.questDesc.textContent = 'Befriend 3 different creatures wandering Sunmeadow.';
    ui.questCount.textContent = `${Math.min(3, state.caught.length)} / 3`;
  } else if (phase === 2) {
    ui.questTitle.textContent = 'The Grove Guardian';
    ui.questDesc.textContent = 'The northern shrine is glowing. Something ancient has awoken.';
    ui.questCount.textContent = '!';
    ensureBoss();
  } else {
    ui.questTitle.textContent = 'Isles Restored';
    ui.questDesc.textContent = 'The grove is at peace. Explore, collect and befriend.';
    ui.questCount.textContent = '★';
  }
  ui.questCard.classList.toggle('urgent', phase === 2);
}

function syncFluteUnlocks(announce = true) {
  const unlocks = [
    ['silver', state.caught.length >= 2],
    ['amber', state.caught.length >= 3],
    ['moonstone', state.caught.length >= 5],
    ['aurora', state.caught.length >= 6],
    ['celestial', state.bossDefeated],
  ];
  for (const [id, earned] of unlocks) {
    if (!earned || state.inventory.flutes.includes(id)) continue;
    state.inventory.flutes.push(id);
    if (announce) {
      toast(`New instrument: <b>${FLUTES[id].name}</b> · rank ${FLUTES[id].tier}`, 'success', 5000);
      audio.sfx('level');
    }
  }
  if (!FLUTES[state.selectedFlute] || !state.inventory.flutes.includes(state.selectedFlute)) {
    state.selectedFlute = state.inventory.flutes[state.inventory.flutes.length - 1] || 'willow';
  }
}

function cycleFlute() {
  const owned = FLUTE_ORDER.filter((id) => state.inventory.flutes.includes(id));
  if (!owned.length) return;
  const i = owned.indexOf(state.selectedFlute);
  state.selectedFlute = owned[(i + 1) % owned.length];
  const flute = FLUTES[state.selectedFlute];
  audio.init();
  audio.flute(flute.tier);
  toast(`<b>${flute.name}</b> · rank ${flute.tier}<br><small>${flute.desc}</small>`, 'info', 3600);
  renderPartyHUD();
}

function renderPartyHUD() {
  ui.party.innerHTML = state.party.map((m) => {
    const s = SPECIES[m.species];
    const pct = clamp((m.hp / m.maxHp) * 100, 0, 100);
    return `<div class="party-chip ${m.hp <= 0 ? 'down' : ''}" title="${displayName(m)} · Lv. ${m.level}">
      <span class="chip-dot" style="background:${TYPES[s.type].color}"></span>
      <span class="chip-body"><b>${displayName(m)}${m.shiny ? ' <span class="shiny-star">✦</span>' : ''}</b><small>Lv.${m.level}</small>
        <span class="chip-bar"><i style="width:${pct}%"></i></span>
      </span>
    </div>`;
  }).join('');
  const flute = FLUTES[state.selectedFlute] || FLUTES.willow;
  if (ui.fluteName) ui.fluteName.textContent = flute.short;
  if (ui.flute) {
    ui.flute.title = `${flute.name} · rank ${flute.tier}. Tap to switch instruments.`;
    ui.flute.style.setProperty('--fc', flute.color);
    ui.flute.classList.toggle('gilded', hasSkin(state.inventory, 'gilded-willow') || hasSkin(state.inventory, 'astral-flute'));
  }
  if (ui.lumen) ui.lumen.textContent = formatLumen(state.inventory.lumen);
  ui.potions.textContent = state.inventory.potions;
}

function updateZone() {
  const { x, z } = player.pos;
  let zone = 'Sunmeadow';
  if (Math.hypot(x - 34, z - 30) < 22) zone = 'Whispering Pond';
  else if (z < -45) zone = 'Ancient Grove';
  else if (x < -30) zone = 'West Thicket';
  else if (z > 34) zone = 'Bloomfield';
  if (zone !== state.zone) {
    state.zone = zone;
    ui.zone.textContent = zone;
    ui.zone.classList.remove('pop');
    void ui.zone.offsetWidth;
    ui.zone.classList.add('pop');
  }
}

// ---------------------------------------------------------------------------
// Day / night cycle
// ---------------------------------------------------------------------------

let sky = null;

function isNightTime() {
  const t = state.gameTime;
  return t < 0.25 || t >= 0.75;
}

function isTwilight() {
  const t = state.gameTime;
  return (t >= 0.25 && t < 0.31) || (t >= 0.69 && t < 0.75);
}

function applySky() {
  sky = world.setTimeOfDay(state.gameTime);
  sun.color.copy(sky.sunColor);
  sun.intensity = 0.12 + sky.day * 2.8;
  sun.position.copy(sky.sunDir).multiplyScalar(78);
  fill.color.set(sky.night > 0.4 ? '#9fb8ff' : '#b7d8ff');
  fill.intensity = 0.16 + sky.day * 0.42 + sky.night * 0.28;
  hemi.intensity = 0.3 + sky.day * 1.25;
  hemi.color.set(sky.day > 0.2 ? '#dff4ff' : '#93a8e8');
  hemi.groundColor.set(sky.day > 0.2 ? '#6b8251' : '#2c3546');
  scene.fog.color.copy(sky.fog);
  renderer.toneMappingExposure = 0.72 + sky.day * 0.36;
  campGlow.intensity = 1.5 + sky.night * 13;
  updateTimeChip();
}

function updateTimeChip() {
  if (!ui.timeChip) return;
  const totalMinutes = Math.round(state.gameTime * 1440) % 1440;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  ui.timeText.textContent = `${hh}:${mm}`;
  ui.dayText.textContent = `Day ${state.gameDay}`;
  const night = isNightTime();
  ui.timeIcon.textContent = night ? '☾' : isTwilight() ? '☼' : '☀';
  ui.timeChip.classList.toggle('night', night);
}

function updateTime(dt) {
  state.gameTime += dt / DAY_SECONDS;
  while (state.gameTime >= 1) {
    state.gameTime -= 1;
    state.gameDay++;
    toast(`<b>Day ${state.gameDay}</b> dawns over Lumen Isles.`, 'info', 3800);
  }
  applySky();
}

function advanceTime(amount = 0.035) {
  if (state.mode !== 'world') return;
  audio.init();
  audio.sfx('select');
  state.gameTime += amount;
  while (state.gameTime >= 1) {
    state.gameTime -= 1;
    state.gameDay++;
  }
  applySky();
  saveGame();
  const label = isNightTime() ? 'The stars wheel overhead.' : 'The sun climbs a little higher.';
  toast(label, 'info', 2400);
  ensureSpecialSpawns(true);
}

// ---------------------------------------------------------------------------
// Save / load
// ---------------------------------------------------------------------------

function saveGame() {
  if (!state.party.length) return;
  const data = {
    party: state.party,
    inventory: state.inventory,
    ranchMons: state.ranchMons,
    caught: state.caught,
    seen: state.seen,
    catchCount: state.catchCount,
    battlesWon: state.battlesWon,
    bossDefeated: state.bossDefeated,
    startedAt: state.startedAt,
    ranch: state.ranch,
    gameTime: state.gameTime,
    gameDay: state.gameDay,
    selectedFlute: state.selectedFlute,
    shinyFound: state.shinyFound,
    pos: { x: player.pos.x, z: player.pos.z },
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage may be unavailable */ }
}

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.party) || !data.party.length) return null;
    if (!data.party.every((m) => SPECIES[m.species])) return null;
    return data;
  } catch {
    return null;
  }
}

function normalizeMon(mon) {
  if (!mon || !SPECIES[mon.species]) return null;
  mon.level = clamp(Math.round(Number(mon.level) || 1), 1, MAX_LEVEL);
  if (mon.shiny === undefined) mon.shiny = !!mon.appearance?.shiny;
  if (mon.shiny && !mon.shinySeed) mon.shinySeed = makeShinySeed();
  if (!mon.shiny) mon.shinySeed = null;
  mon.appearance = mon.shiny && mon.shinySeed ? { shiny: true, seed: mon.shinySeed } : null;
  if (!Number.isFinite(mon.hp)) mon.hp = mon.maxHp;
  mon.hp = clamp(mon.hp, 0, mon.maxHp);
  return mon;
}

function applySave(data) {
  state.party = (data.party || []).map(normalizeMon).filter(Boolean);
  battle.party = state.party;
  const inv = defaultInventory();
  Object.assign(inv, data.inventory || {});
  if (!Array.isArray(inv.flutes) || !inv.flutes.length) inv.flutes = ['willow'];
  inv.flutes = FLUTE_ORDER.filter((id) => inv.flutes.includes(id));
  if (!inv.flutes.length) inv.flutes = ['willow'];
  inv.owned = Array.isArray(inv.owned) ? inv.owned : [];
  inv.skins = Array.isArray(inv.skins) ? inv.skins : [];
  inv.badges = Array.isArray(inv.badges) ? inv.badges : [];
  inv.potions = Math.max(0, Number(inv.potions) || 0);
  inv.resonance = clamp(Number(inv.resonance) || 0, 0, 0.3);
  inv.lumen = Math.max(0, Number(inv.lumen) || 0);
  // Old saves used Star Orbs; convert their value into the new currency.
  if (data.inventory?.orbs) inv.lumen += data.inventory.orbs * 20;
  if (data.inventory?.orbs && !data.inventory?.flutes) inv.flutes = ['willow', 'silver', 'amber'];
  state.inventory = inv;
  battle.inventory = state.inventory;
  state.ranchMons = (data.ranchMons || []).map(normalizeMon).filter(Boolean);
  state.caught = data.caught || [];
  state.seen = data.seen || [];
  state.catchCount = data.catchCount || 0;
  state.battlesWon = data.battlesWon || 0;
  state.bossDefeated = !!data.bossDefeated;
  state.startedAt = data.startedAt || Date.now();
  state.ranch = data.ranch || state.ranchMons.length;
  state.gameTime = Number.isFinite(data.gameTime) ? data.gameTime : 0.34;
  state.gameDay = Math.max(1, Number(data.gameDay) || 1);
  state.selectedFlute = data.selectedFlute || 'willow';
  state.shinyFound = data.shinyFound || 0;
  player.pos.set(data.pos?.x || 0, 0, data.pos?.z || 0);
  player.pos.y = world.heightAt(player.pos.x, player.pos.z);
  trainer.position.copy(player.pos);
  cameraLook.set(player.pos.x, player.pos.y + 1.4, player.pos.z);
  cameraYaw = 0;
  cameraPitch = 0.3;
  cameraDist = 11.5;
  syncFluteUnlocks(false);
  applySky();
  refreshTrainerCosmetics();
}

function refreshContinue() {
  const save = readSave();
  if (save) {
    ui.titleContinue.disabled = false;
    const lead = save.party[0];
    ui.titleContinueMeta.textContent = `${displayName(lead)} · Lv.${lead.level} · ${save.caught?.length || 0} caught`;
  } else {
    ui.titleContinue.disabled = true;
    ui.titleContinueMeta.textContent = 'No journey yet';
  }
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

function renderPartyModal() {
  const cards = state.party.map((m) => {
    const s = SPECIES[m.species];
    const rarity = rarityOf(m.species);
    const pct = clamp((m.hp / m.maxHp) * 100, 0, 100);
    const exp = m.level >= MAX_LEVEL ? 100 : (m.exp / XP_TO_NEXT(m.level)) * 100;
    const sig = m.shiny ? shinySignature(m.shinySeed) : '';
    return `<div class="detail-card ${m.shiny ? 'is-shiny' : ''}">
      <div class="detail-art">${m.shiny ? '<span class="shiny-halo">✦</span>' : ''}<img src="${thumbFor(m)}" alt="${displayName(m)}" /></div>
      <div class="detail-main">
        <div class="detail-head">
          <h4>${displayName(m)}${m.shiny ? ' <span class="shiny" title="Unique shiny">✦</span>' : ''}</h4>
          <span class="type-chip t-${s.type}">${TYPES[s.type].name}</span>
          <span class="rarity-chip r-${s.rarity}">${rarity.name}</span>
          <span class="detail-lv">Lv. ${m.level}</span>
        </div>
        ${m.shiny ? `<p class="shiny-sig">ONE OF ONE · ${sig}</p>` : ''}
        <div class="detail-hp"><span>HP</span><div class="bar"><i style="width:${pct}%"></i></div><em>${m.hp}/${m.maxHp}</em></div>
        <div class="detail-stats">
          <span>ATK <b>${m.atk}</b></span><span>DEF <b>${m.def}</b></span><span>SPD <b>${m.spd}</b></span>
        </div>
        <div class="move-chips">${m.moves.map((mv) => `<span class="move-chip t-${MOVES[mv.id].type}">${MOVES[mv.id].name}</span>`).join('')}</div>
        <p class="detail-lore">${s.lore}</p>
        <div class="detail-exp"><span>XP</span><div class="bar exp"><i style="width:${exp}%"></i></div><em>${m.level >= MAX_LEVEL ? 'MAX' : `${m.exp}/${XP_TO_NEXT(m.level)}`}</em></div>
      </div>
    </div>`;
  }).join('');

  const minutes = Math.max(1, Math.round((Date.now() - state.startedAt) / 60000));
  const flutePills = FLUTE_ORDER.filter((id) => state.inventory.flutes.includes(id)).map((id) => {
    const f = FLUTES[id];
    return `<span class="flute-pill ${id === state.selectedFlute ? 'active' : ''}" style="--fc:${f.color}" title="${f.desc}">♪ ${f.short} <b>${f.tier}</b></span>`;
  }).join('');
  const uniques = (state.inventory.owned || []).map((o) => {
    const entry = typeof o === 'string' ? { id: o } : o;
    const def = [...SHOP_ITEMS, ...SUPPORTER_PACKS].find((i) => i.id === entry.id);
    return `<div class="owned-curio">
      <span class="curio-glyph">${def?.glyph || '✦'}</span>
      <div><b>${def?.name || entry.id}</b><small>${entry.supporter ? 'Supporter edition' : 'One of one'}${entry.serial ? ` · ${entry.serial}` : ''}</small></div>
    </div>`;
  }).join('');
  const ranchCards = state.ranchMons.length
    ? `<div class="ranch-grid">${state.ranchMons.map((m) => `<div class="ranch-mon" title="${displayName(m)} · Lv. ${m.level}">
        <img src="${thumbFor(m)}" alt="" />
        <span><b>${displayName(m)}${m.shiny ? ' ✦' : ''}</b><small>Lv. ${m.level} · ${rarityOf(m.species).name}</small></span>
      </div>`).join('')}</div>`
    : '<p class="ranch-note">No creatures are resting at the ranch yet.</p>';
  const lureLeft = Math.max(0, (state.inventory.lureUntil || 0) - Date.now());
  const lureText = lureLeft > 0 ? `${Math.ceil(lureLeft / 60000)} min of doubled shiny odds` : 'No lure active';

  ui.modalBody.innerHTML = `
    <div class="modal-tabs">
      <h3>Field Journal</h3>
      <div class="modal-mini-stats">
        <span><b>${state.caught.length}</b> species</span>
        <span><b>${state.catchCount}</b> caught</span>
        <span><b>${state.shinyFound}</b> shinies</span>
        <span><b>${state.battlesWon}</b> wins</span>
        <span><b>${formatLumen(state.inventory.lumen)}</b> lumen</span>
        <span><b>${minutes}m</b> afield</span>
      </div>
    </div>
    <div class="journal-nav">
      <button class="primary-btn" id="modal-shop">Grove Market</button>
      <button class="ghost-btn" id="modal-trade">Online Trade</button>
      <span class="journal-clock">Day ${state.gameDay} · ${ui.timeText.textContent}</span>
    </div>
    <div class="detail-list">${cards || '<p>Your team is empty.</p>'}</div>
    ${state.ranch ? `<p class="ranch-note">${state.ranch} friend${state.ranch > 1 ? 's are' : ' is'} relaxing at the Isles Ranch.</p>` : ''}
    <div class="modal-section">
      <h4>Isles Ranch</h4>
      ${ranchCards}
    </div>
    <div class="modal-section">
      <h4>Instruments</h4>
      <div class="flute-row">${flutePills}</div>
      <p class="modal-tip">Tap the flute chip in the HUD to switch. A creature needs a flute whose rank matches its rarity — and level 10+ creatures ask for one rank higher.</p>
    </div>
    <div class="modal-section">
      <h4>Satchel</h4>
      <div class="satchel">
        <div><span class="big-num">${formatLumen(state.inventory.lumen)}</span><span>Lumen</span></div>
        <div><span class="big-num">${state.inventory.potions}</span><span>Grove Tonics</span></div>
        <div><span class="big-num">${Math.round((state.inventory.resonance || 0) * 100)}%</span><span>Resonance</span></div>
        <div><span class="big-num">${state.inventory.flutes.length}</span><span>Flutes</span></div>
      </div>
      <p class="modal-tip">Shiny lure: ${lureText}.</p>
    </div>
    ${uniques ? `<div class="modal-section"><h4>One-of-one Curios</h4><div class="owned-list">${uniques}</div></div>` : ''}
    <div class="modal-section">
      <h4>Controls</h4>
      <div class="controls-grid">
        <div><kbd>W A S D</kbd><span>Move</span></div>
        <div><kbd>Shift</kbd><span>Run</span></div>
        <div><kbd>Space</kbd><span>Jump</span></div>
        <div><kbd>E</kbd><span>Interact / Battle</span></div>
        <div><kbd>Drag</kbd><span>Orbit camera</span></div>
        <div><kbd>M</kbd><span>Journal</span></div>
      </div>
      <p class="modal-tip">On touch screens use the joystick, the A button and drag the world to look around. Tap the clock to wait and change the light.</p>
    </div>
    <div class="modal-actions">
      <button class="primary-btn" id="modal-save">Save Journey</button>
      <button class="ghost-btn" id="modal-help">How to Play</button>
      <button class="danger-btn" id="modal-reset">Reset</button>
    </div>
  `;

  $('modal-shop')?.addEventListener('click', openShop);
  $('modal-trade')?.addEventListener('click', openTrade);
  $('modal-save')?.addEventListener('click', () => { saveGame(); toast('Journey saved to this device.', 'success', 2200); });
  $('modal-help')?.addEventListener('click', () => showHelp());
  $('modal-reset')?.addEventListener('click', () => {
    if (confirm('Reset your journey? This clears your team and progress on this device.')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  });
}

function showHelp() {
  ui.modalBody.innerHTML = `
    <div class="modal-tabs"><h3>How to Play</h3></div>
    <div class="help-grid">
      <div class="help-item"><b>1 · Explore</b><p>Wander the island. Wild creatures graze in the tall grass and along the shore. Walk close, then press <kbd>E</kbd> (or the <b>A</b> button) to battle.</p></div>
      <div class="help-item"><b>2 · Battle</b><p>Pick moves that match your creature's type. Leaf beats Aqua, Aqua beats Ember, Ember beats Leaf. Stone and Spark have their own rivalries.</p></div>
      <div class="help-item"><b>3 · Play a flute</b><p>Weaken a wild creature, then open <b>Flutes</b> in battle. The instrument must match the creature's rarity: Willow for common, Silver for rare, Amber for epic, Moonstone for legendary, Aurora for mythical, Celestial for divine. Level 10+ creatures ask for one rank higher.</p></div>
      <div class="help-item"><b>4 · Shiny one-of-ones</b><p>Shinies are extremely rare and every single one gets its own palette, aura, orbiters and star freckles. Odds improve for common creatures and worsen for divine ones, so a shiny Solaris is a true legend.</p></div>
      <div class="help-item"><b>5 · Day &amp; night</b><p>The sun moves in real time. Tap the clock to wait. <b>Lunari</b> only appears at night; <b>Solaris</b> visits the restored grove by day. Lanterns and fireflies wake after dusk.</p></div>
      <div class="help-item"><b>6 · Market &amp; trade</b><p>Spend Lumen at the <b>Grove Market</b> on tonics, lures and one-of-one curios. Trade creatures with a friend anywhere using a six-letter room code — no account needed.</p></div>
    </div>
    <div class="modal-actions"><button class="primary-btn" id="modal-back">Back to Journal</button></div>
  `;
  $('modal-back')?.addEventListener('click', renderPartyModal);
}

function openModal() {
  if (state.mode !== 'world') return;
  state.mode = 'menu';
  state.modalOpen = true;
  input.enabled = false;
  hidePrompt();
  renderPartyModal();
  ui.modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal() {
  if (!state.modalOpen) return;
  trade.leave();
  trade.destroy();
  state.modalOpen = false;
  ui.modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  if (state.mode === 'menu') state.mode = 'world';
  input.enabled = true;
}

// ---------------------------------------------------------------------------
// Grove Market
// ---------------------------------------------------------------------------

function openShop() {
  state.mode = 'menu';
  state.modalOpen = true;
  input.enabled = false;
  hidePrompt();
  ui.modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  renderShop();
}

function shopItemCard(item) {
  const owned = item.unique ? ownsItem(state.inventory, item.id) : false;
  const entry = item.unique ? ownedEntry(state.inventory, item.id) : null;
  const afford = state.inventory.lumen >= item.price;
  const disabled = owned || !afford;
  return `<article class="shop-card ${item.unique ? 'unique' : ''} ${owned ? 'owned' : ''}">
    <div class="shop-glyph" aria-hidden="true">${item.glyph}</div>
    <div class="shop-copy">
      <div class="shop-name-line"><h4>${item.name}</h4>${item.unique ? '<span class="oneofone">1 OF 1</span>' : ''}</div>
      <p>${item.blurb}</p>
      ${entry?.serial ? `<p class="shop-serial">Serial ${entry.serial}</p>` : ''}
      <div class="shop-buy-row">
        <span class="shop-price"><i>✦</i> ${formatLumen(item.price)}</span>
        <button class="primary-btn shop-buy" data-buy="${item.id}" ${disabled ? 'disabled' : ''}>
          ${owned ? 'In your journal' : afford ? 'Buy' : 'Need Lumen'}
        </button>
      </div>
    </div>
  </article>`;
}

function renderShop() {
  const supplies = SHOP_ITEMS.filter((i) => i.section === 'supplies').map(shopItemCard).join('');
  const curios = SHOP_ITEMS.filter((i) => i.section === 'curios').map(shopItemCard).join('');
  const packs = SUPPORTER_PACKS.map((pack) => {
    const owned = ownsItem(state.inventory, pack.id);
    const entry = owned ? ownedEntry(state.inventory, pack.id) : null;
    const link = paymentLinkFor(pack);
    return `<article class="shop-card supporter-card ${owned ? 'owned' : ''}">
      <div class="shop-glyph" aria-hidden="true">${pack.glyph}</div>
      <div class="shop-copy">
        <div class="shop-name-line"><h4>${pack.name}</h4><span class="pack-price">$${pack.priceUSD.toFixed(2)} USD</span></div>
        <p>${pack.blurb}</p>
        <ul class="pack-perks">${pack.perks.map((perk) => `<li>${perk}</li>`).join('')}</ul>
        ${entry?.serial ? `<p class="shop-serial">Linked · ${entry.serial}</p>` : ''}
        <div class="shop-buy-row">
          <span class="shop-price real">${owned ? 'Supporter' : link ? 'Secure checkout' : 'Checkout link needed'}</span>
          <button class="primary-btn shop-buy" data-pay="${pack.id}" ${owned ? 'disabled' : ''}>
            ${owned ? 'Thank you ♥' : link ? 'Pay & get code' : 'Set up payment'}
          </button>
        </div>
      </div>
    </article>`;
  }).join('');
  const linkReady = !!PAYMENT.link;
  const uniques = (state.inventory.owned || []).map((o) => {
    const entry = typeof o === 'string' ? { id: o } : o;
    const def = [...SHOP_ITEMS, ...SUPPORTER_PACKS].find((i) => i.id === entry.id);
    return `<div class="owned-curio"><span class="curio-glyph">${def?.glyph || '✦'}</span><div><b>${def?.name || entry.id}</b><small>${entry.serial || 'Journal entry'}</small></div></div>`;
  }).join('');

  ui.modalBody.innerHTML = `
    <div class="modal-tabs">
      <h3>Grove Market</h3>
      <div class="shop-wallet"><span>✦</span><b>${formatLumen(state.inventory.lumen)}</b><small>Lumen</small></div>
    </div>
    <div class="journal-nav">
      <button class="ghost-btn" id="modal-journal">← Field Journal</button>
      <button class="ghost-btn" id="modal-trade">Online Trade ⇄</button>
      <span class="journal-clock">Day ${state.gameDay} · ${ui.timeText.textContent}</span>
    </div>

    <section class="shop-section">
      <div class="shop-section-head"><h4>Supplies</h4><p>Earned Lumen only. Catch, battle and explore to fill your purse.</p></div>
      <div class="shop-grid">${supplies}</div>
    </section>

    <section class="shop-section">
      <div class="shop-section-head"><h4>One-of-one Curios</h4><p>Each curiosity can be bought once per journal and carries its own serial.</p></div>
      <div class="shop-grid">${curios}</div>
    </section>

    <section class="shop-section">
      <div class="shop-section-head"><h4>Supporter Packs</h4><p>Real money, paid directly to the creator’s account. Packs unlock with the redeem code sent after payment.</p></div>
      <div class="shop-grid">${packs}</div>
      <div class="payment-note ${linkReady ? '' : 'warn'}">
        <b>${linkReady ? `Checkout by ${PAYMENT.provider}` : 'Checkout link not configured yet'}</b>
        <p>${linkReady
          ? PAYMENT.note
          : 'Paste your Stripe / PayPal / Mercado Pago link into <code>src/shop.js</code> → <code>PAYMENT.link</code>. Until then, supporter packs can only be unlocked with a redeem code.'}</p>
      </div>
    </section>

    <section class="shop-section">
      <div class="shop-section-head"><h4>Redeem a code</h4><p>After a payment, the creator sends a code like <code>LUMEN-STAR-2026</code>.</p></div>
      <div class="redeem-row">
        <input id="redeem-input" placeholder="LUMEN-XXXX-XXXX" autocomplete="off" autocapitalize="characters" />
        <button class="primary-btn" id="redeem-btn" data-redeem="1">Redeem</button>
      </div>
    </section>

    ${uniques ? `<section class="shop-section"><div class="shop-section-head"><h4>Your one-of-ones</h4></div><div class="owned-list">${uniques}</div></section>` : ''}

    <div class="modal-actions">
      <button class="primary-btn" id="shop-back">Back to Journal</button>
    </div>
  `;
  $('modal-journal')?.addEventListener('click', renderPartyModal);
  $('shop-back')?.addEventListener('click', renderPartyModal);
  $('modal-trade')?.addEventListener('click', openTrade);
  $('redeem-btn')?.addEventListener('click', doRedeem);
  $('redeem-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRedeem(); });
  ui.modalBody.querySelectorAll('[data-buy]').forEach((btn) => btn.addEventListener('click', () => buyShopItem(btn.dataset.buy)));
  ui.modalBody.querySelectorAll('[data-pay]').forEach((btn) => btn.addEventListener('click', () => payForPack(btn.dataset.pay)));
}

function buyShopItem(id) {
  const result = purchase(id, state);
  if (!result.ok) {
    toast(result.message, 'warn', 3000);
    return;
  }
  audio.init();
  audio.sfx(result.item.unique ? 'level' : 'confirm');
  const serial = result.serial ? ` Serial <b>${result.serial}</b>.` : '';
  toast(`<b>${result.item.name}</b> added.${serial}`, 'success', 4800);
  refreshTrainerCosmetics();
  renderPartyHUD();
  saveGame();
  renderShop();
}

function payForPack(id) {
  const pack = SUPPORTER_PACKS.find((p) => p.id === id);
  if (!pack) return;
  const link = paymentLinkFor(pack);
  if (!link) {
    toast('No checkout link yet. Add yours in <b>src/shop.js → PAYMENT.link</b>.', 'warn', 6500);
    ui.modalBody.querySelector('.payment-note')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  audio.init();
  audio.sfx('confirm');
  window.open(link, '_blank', 'noopener,noreferrer');
  toast('Complete the payment, then redeem the code you receive.', 'info', 5000);
}

function doRedeem() {
  const input = $('redeem-input');
  const result = redeem(input?.value, state);
  if (!result.ok) {
    toast(result.message, 'warn', 3600);
    audio.sfx('fail');
    return;
  }
  audio.sfx('level');
  toast(`<b>${result.pack.name}</b> unlocked. Thank you for supporting the isles!`, 'success', 5600);
  refreshTrainerCosmetics();
  renderPartyHUD();
  saveGame();
  renderShop();
}

// ---------------------------------------------------------------------------
// Online trade screen
// ---------------------------------------------------------------------------

function openTrade() {
  state.mode = 'menu';
  state.modalOpen = true;
  input.enabled = false;
  hidePrompt();
  ui.modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  ui.modalBody.innerHTML = `
    <div class="modal-tabs">
      <h3>Online Trade</h3>
      <div class="modal-mini-stats"><span><b>${state.party.length}</b> party</span><span><b>${state.ranchMons.length}</b> ranch</span></div>
    </div>
    <div class="journal-nav">
      <button class="ghost-btn" id="trade-journal">← Field Journal</button>
      <button class="ghost-btn" id="trade-shop">Grove Market</button>
      <span class="journal-clock">Direct browser-to-browser</span>
    </div>
    <div id="trade-root"></div>
    <div class="modal-actions"><button class="primary-btn" id="trade-back">Back to Journal</button></div>
  `;
  const root = $('trade-root');
  trade.mount(root);
  $('trade-journal')?.addEventListener('click', () => { trade.leave(); trade.destroy(); renderPartyModal(); });
  $('trade-shop')?.addEventListener('click', () => { trade.leave(); trade.destroy(); openShop(); });
  $('trade-back')?.addEventListener('click', () => { trade.leave(); trade.destroy(); renderPartyModal(); });
}

// ---------------------------------------------------------------------------
// Battle integration
// ---------------------------------------------------------------------------

function battlePromptText() {
  return 'Battle';
}

function startBattle(wild, isBoss = false) {
  if (state.mode !== 'world' || state.cooldown > 0) return;
  if (state.party.every((m) => m.hp <= 0)) {
    toast('Your team needs to rest at the campfire first.', 'warn');
    return;
  }
  state.mode = 'battle';
  state.activeWild = wild;
  input.enabled = false;
  hidePrompt();
  closeModal();
  document.body.classList.add('in-battle');
  flashScreen('#fff6d9');
  audio.sfx('encounter');
  const mon = wild.mon;
  if (!state.seen.includes(mon.species)) state.seen.push(mon.species);
  if (mon.shiny) {
    state.shinyFound = Math.max(state.shinyFound, 0);
    toast(`<b>✦ A unique shiny ${displayName(mon)}!</b> Every shiny is one of one.`, 'success', 6000);
    setTimeout(() => audio.sfx('level'), 500);
  }

  battle.begin(mon, isBoss, (result) => endBattle(result, wild, isBoss));
}

function endBattle(result, wild, isBoss) {
  state.mode = 'world';
  state.cooldown = 1.6;
  input.enabled = true;
  document.body.classList.remove('in-battle');
  flashScreen('#ffeec2');

  const enemy = wild?.mon;
  if (result === 'caught' && enemy) {
    state.catchCount++;
    state.battlesWon++;
    const rarity = rarityOf(enemy.species);
    const reward = 22 + rarity.tier * 9 + (enemy.shiny ? 120 : 0);
    state.inventory.lumen += reward;
    if (enemy.shiny) state.shinyFound++;
    const isNew = !state.caught.includes(enemy.species);
    if (isNew) {
      state.caught.push(enemy.species);
      audio.sfx('catch');
      toast(`New field note: <b>${SPECIES[enemy.species].name}</b>!`, 'success', 4200);
    }
    const joined = normalizeCaught(enemy);
    if (state.party.length < 6) {
      state.party.push(joined);
      toast(`${displayName(joined)} joined your team.`, 'success', 3000);
    } else {
      state.ranchMons.push(joined);
      state.ranch = state.ranchMons.length;
      toast(`${displayName(joined)} is resting at the Isles Ranch.`, 'info', 3200);
    }
    syncFluteUnlocks();
    if (enemy.shiny) {
      toast(`Shiny <b>${displayName(joined)}</b> logged with signature ${shinySignature(enemy.shinySeed)}.`, 'success', 6500);
      flashScreen('#fff0b8');
    }
    toast(`+${reward} Lumen`, 'info', 2400);
    if (wild) despawnWild(wild, 65000);
    renderPartyHUD();
    updateQuest();
    if (questPhase() === 2 && state.caught.length === 3) {
      setTimeout(() => toast('A green light rises from the <b>northern shrine</b>…', 'warn', 5200), 900);
    }
  } else if (result === 'win' && enemy) {
    state.battlesWon++;
    const reward = 7 + enemy.level * 2;
    state.inventory.lumen += reward;
    if (wild) despawnWild(wild, 32000);
    toast(`${SPECIES[enemy.species].name} was defeated. +${reward} Lumen.`, 'info', 2400);
  } else if (result === 'boss') {
    state.battlesWon++;
    state.bossDefeated = true;
    state.inventory.lumen += 250;
    state.inventory.potions += 3;
    removeBoss();
    syncFluteUnlocks();
    updateQuest();
    saveGame();
    showEnding();
  } else if (result === 'lost') {
    for (const m of state.party) healCreature(m);
    player.pos.set(world.campPos.x, 0, world.campPos.z - 2);
    player.pos.y = world.heightAt(player.pos.x, player.pos.z);
    trainer.position.copy(player.pos);
    cameraLook.set(player.pos.x, player.pos.y + 1.3, player.pos.z);
    state.cooldown = 1.5;
    audio.sfx('heal');
    toast('You wake up by the campfire. Your team is fully rested.', 'info', 4200);
  } else if (result === 'run' && wild) {
    const away = new THREE.Vector2(wild.root.position.x - player.pos.x, wild.root.position.z - player.pos.z).normalize();
    if (away.lengthSq() === 0) away.set(1, 0);
    wild.home.set(wild.root.position.x + away.x * 6, wild.root.position.z + away.y * 6);
    wild.target.copy(wild.home);
    state.cooldown = 2.6;
  }

  if (result !== 'lost') {
    const lead = state.party[0];
    if (lead) {
      // Bank EXP overflow safely and keep HUD fresh
      if (lead.exp >= XP_TO_NEXT(lead.level)) lead.exp = Math.min(lead.exp, XP_TO_NEXT(lead.level) - 1);
    }
  }
  renderPartyHUD();
  updateQuest();
  saveGame();
}

// ---------------------------------------------------------------------------
// Ending
// ---------------------------------------------------------------------------

function showEnding() {
  const minutes = Math.max(1, Math.round((Date.now() - state.startedAt) / 60000));
  const bestLevel = Math.max(...state.party.map((m) => m.level));
  ui.endingStats.innerHTML = `
    <div><b>${state.caught.length}</b><span>species befriended</span></div>
    <div><b>${state.catchCount}</b><span>creatures caught</span></div>
    <div><b>${bestLevel}</b><span>highest level</span></div>
    <div><b>${minutes}m</b><span>in the isles</span></div>
  `;
  ui.ending.classList.remove('hidden');
  flashScreen('#fff2b0');
  audio.sfx('level');
  document.body.classList.add('modal-open');
  state.mode = 'ending';
  input.enabled = false;
}

$('btn-ending-continue')?.addEventListener('click', () => {
  ui.ending.classList.add('hidden');
  document.body.classList.remove('modal-open');
  state.mode = 'world';
  input.enabled = true;
  state.cooldown = 1.2;
  toast('The isles are yours to roam. New friends are still out there.', 'success', 4200);
  saveGame();
});

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

function nearestWild() {
  let best = null;
  let bestD = 4;
  for (const w of state.wilds) {
    if (!w.active) continue;
    const d = Math.hypot(w.root.position.x - player.pos.x, w.root.position.z - player.pos.z);
    if (d < bestD) { bestD = d; best = w; }
  }
  return { wild: best, dist: bestD };
}

function nearBoss() {
  if (!state.boss) return false;
  return Math.hypot(state.boss.x - player.pos.x, state.boss.z - player.pos.z) < 7;
}

function interact() {
  if (state.mode !== 'world' || state.cooldown > 0) return;
  if (nearBoss()) {
    audio.sfx('confirm');
    startBattle({ mon: state.boss.mon, root: state.boss.root }, true);
    return;
  }
  const { wild } = nearestWild();
  if (wild) {
    audio.sfx('confirm');
    startBattle(wild, false);
    return;
  }
  if (player.pos.distanceTo(world.campPos) < 4.2) {
    for (const m of state.party) healCreature(m);
    audio.sfx('heal');
    renderPartyHUD();
    saveGame();
    toast('The fire is warm. Your team is fully healed.', 'success', 3000);
    return;
  }
  if (Math.hypot(player.pos.x - world.hutPos.x, player.pos.z - world.hutPos.z) < 6) {
    openModal();
    return;
  }
}

// ---------------------------------------------------------------------------
// Player update
// ---------------------------------------------------------------------------

function canWalk(x, z) {
  if (Math.hypot(x, z) > 88) return false;
  for (let i = 0; i < world.colliders.length; i++) {
    const c = world.colliders[i];
    const rr = c.r + 0.42;
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz < rr * rr) return false;
  }
  return true;
}

function updatePlayer(dt) {
  const v = input.vector;
  const moving = Math.hypot(v.x, v.y) > 0.05;
  const speed = input.running ? 8.4 : 5.0;
  const f = { x: -Math.sin(cameraYaw), z: -Math.cos(cameraYaw) };
  const r = { x: Math.cos(cameraYaw), z: -Math.sin(cameraYaw) };
  const tx = (f.x * v.y + r.x * v.x) * speed;
  const tz = (f.z * v.y + r.z * v.x) * speed;
  player.vel.x = damp(player.vel.x, tx, 12, dt);
  player.vel.z = damp(player.vel.z, tz, 12, dt);

  if (Math.hypot(player.vel.x, player.vel.z) > 0.12) {
    const nx = player.pos.x + player.vel.x * dt;
    const nz = player.pos.z + player.vel.z * dt;
    if (canWalk(nx, player.pos.z)) player.pos.x = nx;
    else player.vel.x *= 0.2;
    if (canWalk(player.pos.x, nz)) player.pos.z = nz;
    else player.vel.z *= 0.2;
  }

  // jump
  if (input.wasPressed('Space') && player.grounded && state.mode === 'world') {
    player.jumpVel = 6.4;
    player.grounded = false;
  }
  if (!player.grounded) {
    player.jumpVel -= 19 * dt;
    player.jump += player.jumpVel * dt;
    if (player.jump <= 0) {
      player.jump = 0;
      player.jumpVel = 0;
      player.grounded = true;
    }
  }

  player.pos.y = world.heightAt(player.pos.x, player.pos.z) + player.jump;
  trainer.position.copy(player.pos);
  const sp = Math.hypot(player.vel.x, player.vel.z);
  if (sp > 0.25) {
    const targetFacing = Math.atan2(player.vel.x, player.vel.z);
    player.facing = angleLerp(player.facing, targetFacing, 1 - Math.exp(-14 * dt));
  }
  trainer.rotation.y = player.facing;
  player.walk = damp(player.walk, Math.min(1, sp / 5), 10, dt);
  animateTrainer(trainer, performance.now() / 1000, player.walk, !player.grounded);

  // footsteps
  player.stepTimer -= dt;
  if (sp > 2 && player.grounded && player.stepTimer <= 0) {
    player.stepTimer = input.running ? 0.26 : 0.4;
    audio.sfx('step');
  }
}

// ---------------------------------------------------------------------------
// World update
// ---------------------------------------------------------------------------

function updateWilds(dt, time) {
  let nearest = null;
  let nearestDist = 4.1;
  for (const w of state.wilds) {
    if (!w.active) continue;
    animateCreature(w.model, time + w.phase, 0);
    const p = w.root.position;
    w.timer -= dt;
    if (w.timer <= 0) {
      pickWanderTarget(w);
      w.timer = 2.5 + Math.random() * 6;
    }
    const dx = w.target.x - p.x;
    const dz = w.target.y - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.2) {
      const speed = 0.8;
      const nx = p.x + (dx / dist) * speed * dt;
      const nz = p.z + (dz / dist) * speed * dt;
      if (world.heightAt(nx, nz) > 0.35) {
        p.x = nx;
        p.z = nz;
        p.y = world.heightAt(nx, nz) + 0.01;
        w.model.rotation.y = angleLerp(w.model.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-5 * dt));
      } else {
        w.timer = 0;
      }
    }
    // avoid standing inside the player
    const pd = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    if (pd < 1.2) {
      const a = Math.atan2(p.x - player.pos.x, p.z - player.pos.z);
      p.x += Math.sin(a) * dt * 1.4;
      p.z += Math.cos(a) * dt * 1.4;
    }
    if (state.mode === 'world' || state.mode === 'title') {
      w.ring.material.opacity = 0.28 + Math.sin(time * 2 + w.phase) * 0.08;
    }
    if (state.mode === 'world') {
      if (pd < nearestDist) { nearestDist = pd; nearest = w; }
      if (w.spawnScale !== undefined && w.spawnScale < 1) {
        w.spawnScale = Math.min(1, w.spawnScale + dt * 2.4);
        w.model.scale.setScalar(w.scaleBase * w.spawnScale);
      }
    }
  }
  if (state.mode === 'world' && state.cooldown <= 0) {
    if (nearest) {
      if (state.near !== nearest) {
        state.near = nearest;
        setPrompt(`Battle ${displayName(nearest.mon)} · Lv. ${nearest.mon.level}`);
      }
      nearest.ring.material.opacity = 0.55 + Math.sin(time * 4) * 0.2;
      nearest.ring.scale.setScalar(1.1 + Math.sin(time * 4) * 0.06);
    } else {
      state.near = null;
      if (!nearBoss() && player.pos.distanceTo(world.campPos) >= 4.2 && Math.hypot(player.pos.x - world.hutPos.x, player.pos.z - world.hutPos.z) >= 6) {
        hidePrompt();
      }
    }
  }

  if (state.boss) {
    animateCreature(state.boss.model, time * 0.8, 2);
    state.boss.ring.rotation.z = time * 0.35;
    state.boss.halo.rotation.z = -time * 0.22;
    state.boss.halo.scale.setScalar(1 + Math.sin(time * 1.6) * 0.04);
    state.boss.ring.material.opacity = 0.4 + Math.sin(time * 2.2) * 0.16;
  }
}

function updateProximityPrompt() {
  if (state.mode !== 'world' || state.cooldown > 0) return;
  if (nearBoss()) {
    setPrompt('Challenge the Verdant Guardian');
    return;
  }
  const { wild } = nearestWild();
  if (wild) {
    setPrompt(`Battle ${displayName(wild.mon)} · Lv. ${wild.mon.level}`);
    return;
  }
  if (player.pos.distanceTo(world.campPos) < 4.2) {
    setPrompt('Rest by the campfire');
    return;
  }
  if (Math.hypot(player.pos.x - world.hutPos.x, player.pos.z - world.hutPos.z) < 6) {
    setPrompt('Open your field journal');
    return;
  }
  hidePrompt();
}

function checkPickups() {
  for (const p of world.pickups) {
    if (p.userData.taken) continue;
    if (Math.hypot(p.position.x - player.pos.x, p.position.z - player.pos.z) < 1.8) {
      const kind = world.collectPickup(p);
      if (kind === 'orb') {
        state.inventory.lumen += 22;
        toast('Found a <b>Lumen shard</b> in the grass! +22', 'success', 2400);
      } else {
        state.inventory.potions++;
        toast('Found a <b>Grove Tonic</b>!', 'success', 2400);
      }
      audio.sfx('pickup');
      renderPartyHUD();
      saveGame();
    }
  }
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

function updateWorldCamera(dt, time) {
  const orbit = input.takeOrbit();
  if (orbit.dx) cameraYaw -= orbit.dx;
  if (orbit.dy) cameraPitch = clamp(cameraPitch + orbit.dy, 0.08, 1.12);
  if (orbit.zoom) cameraDist = clamp(cameraDist + orbit.zoom * 10, 6.5, 18);

  const px = player.pos.x;
  const pz = player.pos.z;
  const py = player.pos.y;
  const cp = Math.cos(cameraPitch);
  let desired = new THREE.Vector3(
    px + Math.sin(cameraYaw) * cameraDist * cp,
    py + 2.2 + Math.sin(cameraPitch) * cameraDist,
    pz + Math.cos(cameraYaw) * cameraDist * cp,
  );
  const ground = world.heightAt(desired.x, desired.z) + 1.7;
  if (desired.y < ground) desired.y = ground;
  camera.position.lerp(desired, 1 - Math.exp(-7 * dt));
  const lookTarget = new THREE.Vector3(px, py + 1.35, pz);
  cameraLook.lerp(lookTarget, 1 - Math.exp(-10 * dt));
  camera.lookAt(cameraLook);
}

function updateTitleCamera(dt, time) {
  const a = time * 0.055 + 0.7;
  camera.position.set(Math.cos(a) * 31, 12.5 + Math.sin(time * 0.08) * 1.4, Math.sin(a) * 31 + 4);
  camera.lookAt(0, 2.4, 0);
}

function updateBattleCamera() {
  camera.aspect = window.innerWidth / window.innerHeight;
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function buildStarterCards() {
  const info = {
    spriglet: 'A leaf-fox with a spring in its step. Balanced and quick.',
    emberpup: 'A warm-hearted pup. Hits hard and never backs down.',
    dropplet: 'A calm river otter. Sturdy, kind, and fond of pebbles.',
  };
  ui.starterGrid.innerHTML = starterOptions().map((id) => {
    const s = SPECIES[id];
    const t = TYPES[s.type];
    return `<button class="starter-card t-${s.type}" data-starter="${id}">
      <span class="starter-orb" style="--c:${t.color}"></span>
      <span class="starter-art"><img src="${thumbs[id]}" alt="${s.name}" /></span>
      <span class="starter-type" style="background:${t.color}">${t.name}</span>
      <h3>${s.name}</h3>
      <p>${info[id]}</p>
      <span class="starter-pick">Choose ${s.name} →</span>
    </button>`;
  }).join('');
  ui.starterGrid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-starter]');
    if (!card) return;
    chooseStarter(card.dataset.starter);
  });
}

function chooseStarter(id) {
  audio.init();
  audio.sfx('confirm');
  state.party.length = 0;
  const mon = createCreature(id, 5);
  state.party.push(mon);
  state.inventory = defaultInventory();
  battle.party = state.party;
  battle.inventory = state.inventory;
  state.mode = 'world';
  state.startedAt = Date.now();
  state.caught = [];
  state.seen = [id];
  state.catchCount = 0;
  state.battlesWon = 0;
  state.bossDefeated = false;
  state.ranch = 0;
  state.ranchMons = [];
  state.gameTime = 0.34;
  state.gameDay = 1;
  state.selectedFlute = 'willow';
  state.shinyFound = 0;
  state.lunariSpawned = false;
  state.solarisSpawned = false;
  syncFluteUnlocks(false);
  applySky();
  refreshTrainerCosmetics();
  player.pos.set(0, world.heightAt(0, 0), 0);
  player.facing = Math.PI;
  trainer.position.copy(player.pos);
  cameraYaw = 0;
  cameraPitch = 0.3;
  cameraDist = 11.5;
  cameraLook.set(0, player.pos.y + 1.4, 0);
  ui.starter.classList.add('hidden');
  ui.title.classList.add('hidden');
  document.body.classList.add('playing');
  input.enabled = true;
  renderPartyHUD();
  updateQuest();
  saveGame();
  updateZone();
  setTimeout(() => toast(`<b>${SPECIES[id].name}</b> is your partner. Press <kbd>E</kbd> near a wild creature to battle!`, 'info', 5200), 700);
  setTimeout(() => toast('Catch <b>3 different creatures</b> to uncover the grove guardian.', 'warn', 5000), 3400);
}

function beginNewJourney() {
  audio.init();
  audio.sfx('confirm');
  ui.title.classList.add('hidden');
  ui.starter.classList.remove('hidden');
  state.mode = 'starter';
  buildStarterCards();
  refreshContinue();
}

function continueJourney() {
  const save = readSave();
  if (!save) return;
  audio.init();
  audio.sfx('confirm');
  applySave(save);
  ui.title.classList.add('hidden');
  ui.starter.classList.add('hidden');
  document.body.classList.add('playing');
  state.mode = 'world';
  input.enabled = true;
  renderPartyHUD();
  updateQuest();
  updateZone();
  if (state.caught.length >= 3 && !state.bossDefeated) {
    toast('The northern shrine is glowing. The guardian is waiting.', 'warn', 4800);
  } else {
    toast('Welcome back to the isles.', 'info', 2400);
  }
}

// ---------------------------------------------------------------------------
// Buttons / events
// ---------------------------------------------------------------------------

$('btn-new').addEventListener('click', beginNewJourney);
$('btn-continue').addEventListener('click', continueJourney);
$('btn-title-help').addEventListener('click', () => {
  audio.init();
  audio.sfx('select');
  ui.modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  state.modalOpen = true;
  showHelp();
});
$('modal-close').addEventListener('click', closeModal);
ui.modal.addEventListener('click', (e) => {
  if (e.target === ui.modal) closeModal();
});
$('btn-menu').addEventListener('click', () => { audio.sfx('select'); openModal(); });
$('btn-shop').addEventListener('click', () => { audio.init(); audio.sfx('select'); openShop(); });
$('btn-trade').addEventListener('click', () => { audio.init(); audio.sfx('select'); openTrade(); });
$('flute-chip')?.addEventListener('click', () => { if (state.mode === 'world') cycleFlute(); });
$('time-chip')?.addEventListener('click', () => advanceTime());
$('btn-fullscreen')?.addEventListener('click', () => {
  const root = document.documentElement;
  if (!document.fullscreenElement) {
    root.requestFullscreen?.().catch(() => toast('Fullscreen is not available in this browser.', 'warn', 2600));
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
});
$('btn-sound').addEventListener('click', (e) => {
  audio.init();
  const on = audio.toggle();
  e.currentTarget.classList.toggle('off', !on);
  e.currentTarget.innerHTML = on ? '♪' : '✕';
});
$('btn-action').addEventListener('click', () => { audio.init(); input.trigger('KeyE'); });
if (ui.jump) ui.jump.addEventListener('click', () => { input.trigger('Space'); });

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && state.mode === 'world') interact();
  if (e.code === 'KeyM' && !state.modalOpen && state.mode === 'world') openModal();
  if (e.code === 'Escape' && state.modalOpen) closeModal();
  if (e.code === 'KeyH' && !state.modalOpen && state.mode === 'world') {
    ui.modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    state.modalOpen = true;
    state.mode = 'menu';
    input.enabled = false;
    showHelp();
  }
});
window.addEventListener('pointerdown', () => audio.init(), { once: true });
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  battle.resize(window.innerWidth / window.innerHeight);
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  const time = elapsed;

  world.update(dt, time);
  updateTime(dt);
  ensureSpecialSpawns();
  if (trainerFx) {
    trainerFx.rotation.y = time * 0.45;
    trainerFx.children.forEach((child, i) => {
      if (i > 0) child.rotation.y = time * 1.4 + i;
    });
  }
  updateWilds(dt, time);
  if (state.boss) {
    const bd = Math.hypot(state.boss.x - player.pos.x, state.boss.z - player.pos.z);
    if (state.mode === 'world' && bd < 9) setPrompt('Challenge the Verdant Guardian');
  }

  if (state.mode === 'world' || state.mode === 'menu') {
    if (state.mode === 'world' && !state.modalOpen) updatePlayer(dt);
    else animateTrainer(trainer, time, 0, false);
    updateWorldCamera(dt, time);
    checkPickups();
    updateProximityPrompt();
    updateZone();
    if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);
  } else if (state.mode === 'title' || state.mode === 'starter') {
    animateTrainer(trainer, time, 0, false);
    updateTitleCamera(dt, time);
    updateProximityPrompt();
  }

  if (state.mode === 'battle' || document.body.classList.contains('in-battle')) {
    battle.update(dt, time);
    updateBattleCamera();
    renderer.render(battle.scene, battle.camera);
  } else {
    renderer.render(scene, camera);
  }

  input.endFrame();
}

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

async function init() {
  try {
    makeThumbnails();
  } catch (err) {
    console.warn('Thumbnail generation skipped', err);
  }
  buildStarterCards();
  spawnWild({ species: 'mossling', x: -15, z: -4, level: 4 }, true);
  spawnWild({ species: 'dropplet', x: 12, z: 18, level: 6 }, true);
  spawnWild({ species: 'fluffbat', x: -10, z: 22, level: 5 }, true);
  wildsInit();
  applySky();
  syncFluteUnlocks(false);
  refreshTrainerCosmetics();
  ensureSpecialSpawns(true);
  refreshContinue();
  renderPartyHUD();
  updateQuest();
  ui.loading.classList.add('hidden');
  ui.title.classList.remove('hidden');
  state.mode = 'title';
  document.body.classList.remove('loading');
  tick();
}

function wildsInit() {
  for (const spawn of world.wildSpawns) spawnWild(spawn);
}

// Kick things off after the first frame so fonts/layout settle.
requestAnimationFrame(() => {
  init().catch((err) => {
    console.error(err);
    ui.loading.innerHTML = `<p>Could not start the adventure.</p><pre>${err.message}</pre>`;
  });
});

// Installable Android PWA / offline shell.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker skipped', err));
  });
}
