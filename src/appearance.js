import * as THREE from '../vendor/three.module.js';

// ---------------------------------------------------------------------------
// Unique shiny appearances
// Every shiny gets a deterministic-but-unique palette, aura, constellation
// pattern and sparkle rhythm derived from its own seed. No two are alike.
// ---------------------------------------------------------------------------

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();

export function paletteFor(seed) {
  if (cache.has(seed)) return cache.get(seed);
  const rand = mulberry32(seed >>> 0);
  const hue = rand() * 360;
  const hue2 = (hue + 90 + rand() * 180) % 360;
  const hue3 = (hue + 180 + rand() * 120) % 360;
  const palette = {
    seed,
    hue,
    rot: (rand() * 260 + 50) % 360,
    sat: 0.55 + rand() * 0.4,
    light: 0.06 + rand() * 0.16,
    accent: new THREE.Color().setHSL(hue2 / 360, 0.85, 0.68),
    aura: new THREE.Color().setHSL(hue3 / 360, 0.9, 0.64),
    sparkleColor: new THREE.Color().setHSL((hue + rand() * 360) / 360, 0.9, 0.78),
    orbiters: 2 + Math.floor(rand() * 4),
    freckles: 3 + Math.floor(rand() * 5),
    spin: (rand() > 0.5 ? 1 : -1) * (0.25 + rand() * 0.55),
    ring: rand() > 0.55,
  };
  cache.set(seed, palette);
  return palette;
}

function tinyStar(color, size = 0.045) {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(size, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  m.castShadow = false;
  return m;
}

export function applyShiny(group, seed) {
  const p = paletteFor(seed);
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const cloned = new Map();

  group.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    if (Array.isArray(o.material)) return;
    const hsl = {};
    o.material.color.getHSL(hsl);
    // Keep eyes, teeth and pure light materials readable.
    if (hsl.l < 0.075) return;
    if (hsl.l > 0.93 && hsl.s < 0.12) return;

    let material = cloned.get(o.material.uuid);
    if (!material) {
      material = o.material.clone();
      const color = o.material.color.clone();
      const h = (hsl.h * 360 + p.rot + (rand() - 0.5) * 44 + 360) % 360;
      const s = Math.min(1, Math.max(0.18, hsl.s * (0.75 + p.sat * 0.7)));
      const l = Math.min(0.92, Math.max(0.12, hsl.l + p.light - 0.06));
      color.setHSL(h / 360, s, l);
      material.color.copy(color);
      if (material.emissive) {
        material.emissive.copy(p.accent);
        material.emissiveIntensity = Math.max(material.emissiveIntensity || 0, 0.16);
      }
      cloned.set(o.material.uuid, material);
    }
    o.material = material;
  });

  // Floating constellation companions
  const aura = new THREE.Group();
  aura.name = 'shiny-aura';
  const orbs = [];
  for (let i = 0; i < p.orbiters; i++) {
    const orb = tinyStar(p.aura, 0.035 + rand() * 0.034);
    orb.userData.orbit = {
      radius: 0.45 + rand() * 0.45,
      speed: (0.6 + rand() * 0.9) * p.spin,
      phase: rand() * Math.PI * 2,
      height: 0.45 + rand() * 1.05,
      bob: rand() * 6,
    };
    aura.add(orb);
    orbs.push(orb);
  }

  // Unique star-freckle constellation on the body
  const freckles = [];
  for (let i = 0; i < p.freckles; i++) {
    const star = tinyStar(i % 3 === 0 ? p.sparkleColor : p.accent, 0.018 + rand() * 0.028);
    const ang = rand() * Math.PI * 2;
    star.position.set(
      Math.cos(ang) * (0.22 + rand() * 0.3),
      0.35 + rand() * 0.95,
      Math.sin(ang) * (0.2 + rand() * 0.3) + 0.12,
    );
    group.add(star);
    freckles.push(star);
  }

  let ring = null;
  if (p.ring) {
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.012, 4, 36),
      new THREE.MeshBasicMaterial({ color: p.accent, transparent: true, opacity: 0.46, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
  }

  group.add(aura);
  if (group.userData.anim) {
    group.userData.anim.aura = { orbs, ring, color: p.accent, opacity: 0.8 };
    group.userData.anim.freckles = freckles;
  }
  group.userData.shinySeed = seed;
  group.userData.shinyPalette = p;
}

export function animateShiny(anim, time) {
  if (!anim?.aura) return;
  const { orbs, ring } = anim.aura;
  orbs.forEach((orb, i) => {
    const o = orb.userData.orbit;
    orb.position.set(
      Math.cos(time * o.speed + o.phase) * o.radius,
      o.height + Math.sin(time * 1.7 + o.bob) * 0.08,
      Math.sin(time * o.speed + o.phase) * o.radius,
    );
    orb.rotation.y = time * 2 + i;
    orb.material.opacity = 0.55 + Math.sin(time * 3 + i) * 0.35;
  });
  if (ring) {
    ring.rotation.z = time * 0.5;
    ring.scale.setScalar(1 + Math.sin(time * 1.8) * 0.08);
  }
  if (anim.freckles) {
    anim.freckles.forEach((s, i) => {
      s.material.opacity = 0.5 + Math.sin(time * 2.4 + i * 1.7) * 0.4;
    });
  }
}

export function shinySignature(seed) {
  if (!seed) return '';
  const p = paletteFor(seed);
  const hue = Math.round(p.hue).toString(16).toUpperCase().padStart(2, '0');
  const acc = Math.round(p.hue * 1.7 % 360).toString(16).toUpperCase().padStart(2, '0');
  return `${hue}${acc}-${String(seed).slice(-4)}`;
}
