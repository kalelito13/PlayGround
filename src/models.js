import * as THREE from '../vendor/three.module.js';
import { creatureTexture, personTexture } from './art2d.js';
import { paletteFor } from './appearance.js';

// ---------------------------------------------------------------------------
// Lumen Isles — 2D characters on a 3D stage
// ---------------------------------------------------------------------------
// Creatures and people are illustrated on canvas (see art2d.js) and mounted as
// camera-facing sprites. The island, trees, water and architecture stay fully
// 3D. This gives the cast a bold, readable, animated-illustration look while
// keeping free exploration in a real 3D world.
// ---------------------------------------------------------------------------

const materials = new Map();

export function material(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0,
      flatShading: true,
      ...options,
    }));
  }
  return materials.get(key);
}

const geo = {
  circle: new THREE.CircleGeometry(1, 24),
  octa: new THREE.OctahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.08, 6, 24),
};

function shadowBlob(size = 1) {
  const m = new THREE.Mesh(
    geo.circle,
    new THREE.MeshBasicMaterial({ color: '#22301f', transparent: true, opacity: 0.26, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.scale.setScalar(size);
  m.renderOrder = 2;
  return m;
}

// Proportions in world units. The illustrations are square; height drives the
// sprite plane and the width follows the same scale.
const CREATURE_SIZE = {
  spriglet: 1.75,
  emberpup: 1.85,
  dropplet: 1.8,
  mossling: 1.7,
  pebblit: 1.8,
  zapmouse: 1.8,
  fluffbat: 1.95,
  lunari: 2.0,
  solaris: 2.15,
  elderwood: 2.55,
  mosswarden: 2.0,
  voltrix: 1.95,
  cragwarden: 2.1,
  tidalyn: 2.0,
  sylvanox: 2.1,
  pyrohound: 2.15,
  nocturne: 2.1,
};

const FLYERS = new Set(['fluffbat', 'lunari', 'solaris', 'nocturne']);

function tinyStar(color, size = 0.05) {
  const m = new THREE.Mesh(
    geo.octa,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  m.scale.setScalar(size);
  m.castShadow = false;
  return m;
}

function addShinyAura(group, seed) {
  const p = paletteFor(seed);
  const aura = new THREE.Group();
  aura.name = 'shiny-aura';
  const orbs = [];
  for (let i = 0; i < p.orbiters; i++) {
    const orb = tinyStar(i % 2 ? p.accent : p.sparkleColor, 0.035 + (i % 3) * 0.012);
    orb.userData.orbit = {
      radius: 0.42 + (i / Math.max(1, p.orbiters)) * 0.42,
      speed: (0.65 + i * 0.13) * p.spin,
      phase: (i / p.orbiters) * Math.PI * 2,
      height: 0.55 + (i % 4) * 0.28,
    };
    aura.add(orb);
    orbs.push(orb);
  }
  group.add(aura);
  group.userData.shinySeed = seed;
  group.userData.shinyPalette = p;
  return { orbs, ring: null, color: p.accent, opacity: 0.8 };
}

export function buildCreature(speciesId, appearance = null) {
  if (speciesId && typeof speciesId === 'object') {
    appearance = speciesId.appearance || null;
    speciesId = speciesId.species;
  }
  const id = CREATURE_SIZE[speciesId] ? speciesId : 'spriglet';
  const group = new THREE.Group();
  const height = CREATURE_SIZE[id] || 1.8;
  const shiny = !!appearance?.shiny && !!appearance?.seed;

  const map = creatureTexture(id, shiny ? appearance : null);
  const mat = new THREE.SpriteMaterial({
    map,
    transparent: true,
    alphaTest: 0.02,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0.035);
  sprite.scale.set(height, height, 1);
  sprite.renderOrder = 3;
  group.add(sprite);

  // A soft contact shadow keeps the 2D character grounded in the 3D scene.
  const shadow = shadowBlob(height * 0.36);
  shadow.position.y = 0.015;
  shadow.material.opacity = 0.2;
  group.add(shadow);

  const anim = {
    kind: 'creature',
    speciesId: id,
    sprite,
    baseHeight: height,
    shadow,
    baseY: 0,
    phase: (id.charCodeAt(0) * 1.7 + id.length * 2.3) % 6.28,
    flyer: FLYERS.has(id),
    shiny,
  };
  if (shiny) anim.aura = addShinyAura(group, appearance.seed);

  group.userData.anim = anim;
  group.userData.speciesId = id;
  return group;
}

export function animateCreature(group, time, excitement = 0) {
  const a = group.userData.anim;
  if (!a || !a.sprite) return;
  const t = time + a.phase;
  const speed = 2.1 + excitement * 1.6;
  const breathe = Math.sin(t * speed) * 0.018;
  const sway = Math.sin(t * speed * 0.62) * 0.014;
  const hover = a.flyer ? 0.22 + Math.sin(t * 1.4) * 0.08 : 0;
  a.sprite.position.y = a.baseY + hover + breathe;
  a.sprite.position.x = sway;
  a.sprite.scale.y = a.baseHeight * (1 + breathe * 0.5);
  a.sprite.scale.x = a.baseHeight * (1 - breathe * 0.25);
  a.sprite.material.rotation = Math.sin(t * speed * 0.5) * 0.018;
  if (a.shadow) {
    a.shadow.position.x = sway * 0.5;
    a.shadow.material.opacity = a.flyer ? 0.14 : 0.22;
    a.shadow.scale.setScalar((a.baseHeight * 0.34) * (a.flyer ? 0.75 : 1) * (1 + breathe));
  }
  if (a.aura) {
    a.aura.orbs.forEach((orb, i) => {
      const o = orb.userData.orbit;
      orb.position.set(
        Math.cos(time * o.speed + o.phase) * o.radius,
        o.height + Math.sin(time * 1.7 + i) * 0.08 + hover,
        Math.sin(time * o.speed + o.phase) * o.radius,
      );
      orb.rotation.y = time * 2 + i;
      orb.material.opacity = 0.5 + Math.sin(time * 3 + i) * 0.35;
    });
  }
}

// ---------------------------------------------------------------------------
// Trainer and story characters
// ---------------------------------------------------------------------------

const PERSON_SIZE = 2.35;

export function buildPerson(profile = 'player', height = PERSON_SIZE) {
  const group = new THREE.Group();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: personTexture(profile),
    transparent: true,
    alphaTest: 0.02,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.center.set(0.5, 0.035);
  sprite.scale.set(height, height, 1);
  sprite.renderOrder = 4;
  group.add(sprite);

  const shadow = shadowBlob(height * 0.26);
  shadow.position.y = 0.015;
  shadow.material.opacity = 0.24;
  group.add(shadow);

  group.userData.anim = {
    kind: 'person',
    profile,
    sprite,
    shadow,
    baseHeight: height,
    baseY: 0,
    phase: profile.length * 1.3,
  };
  group.userData.profile = profile;
  return group;
}

export function buildTrainer() {
  return buildPerson('player', PERSON_SIZE);
}

export function animateTrainer(group, time, walkAmount = 0, jumping = false) {
  const a = group.userData.anim;
  if (!a || !a.sprite) return;
  const t = time * (6 + walkAmount * 7) + a.phase;
  const bob = Math.abs(Math.sin(t)) * walkAmount * 0.06;
  const sway = Math.sin(t * 0.5) * walkAmount * 0.02;
  a.sprite.position.y = a.baseY + bob + (jumping ? 0.08 : 0);
  a.sprite.position.x = sway;
  a.sprite.material.rotation = Math.sin(t * 0.5) * walkAmount * 0.018;
  a.sprite.scale.y = a.baseHeight * (1 - Math.abs(Math.sin(t)) * walkAmount * 0.012);
  a.sprite.scale.x = a.baseHeight * (1 + Math.abs(Math.sin(t)) * walkAmount * 0.008);
  if (a.shadow) {
    a.shadow.position.x = sway;
    a.shadow.scale.setScalar(a.baseHeight * 0.25 * (jumping ? 0.8 : 1));
    a.shadow.material.opacity = jumping ? 0.15 : 0.24;
  }
}

export { shadowBlob, geo as geometries };
