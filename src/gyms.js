import * as THREE from '../vendor/three.module.js';
import { material, buildPerson } from './models.js';
import { createCreature } from './data.js';
import { txt } from './story.js';

// ---------------------------------------------------------------------------
// Gyms, badges and the Colosseum
// ---------------------------------------------------------------------------

export const GYMS = [
  {
    id: 'verdant', profile: 'mara', type: 'leaf', color: '#65c45a',
    name: { es: 'Salón Verdante', en: 'Verdant Hall' },
    leader: { es: 'Mara', en: 'Mara' },
    title: { es: 'Líder de la Hoja', en: 'Leaf Leader' },
    x: 14, z: 54,
    intro: {
      es: 'El jardín reconoce tus pasos. Demuéstrame que sabes escucharlo.',
      en: 'The garden knows your footsteps. Show me you know how to listen.',
    },
    badge: {
      id: 'gym:verdant', glyph: '❧',
      name: { es: 'Medalla Hoja', en: 'Leaf Badge' },
      color: '#65c45a',
    },
    team: [['mossling', 11], ['mosswarden', 14]],
    reward: { lumen: 240, potions: 2 },
  },
  {
    id: 'tide', profile: 'sable', type: 'aqua', color: '#4cbcd8',
    name: { es: 'Gruta de Vidrio', en: 'Glass Grotto' },
    leader: { es: 'Sable', en: 'Sable' },
    title: { es: 'Líder de la Marea', en: 'Tide Leader' },
    x: 53, z: 27,
    intro: {
      es: 'El agua no se vence. Se aprende a nadar con ella. ¿Sabrás hacerlo?',
      en: 'Water is not defeated. You learn to swim with it. Can you?',
    },
    badge: {
      id: 'gym:tide', glyph: '≈',
      name: { es: 'Medalla Marea', en: 'Tide Badge' },
      color: '#4cbcd8',
    },
    team: [['dropplet', 14], ['tidalyn', 17]],
    reward: { lumen: 300, potions: 3 },
  },
  {
    id: 'cinder', profile: 'kael', type: 'ember', color: '#ef7f43',
    name: { es: 'Forja de Brasas', en: 'Cinder Forge' },
    leader: { es: 'Kael', en: 'Kael' },
    title: { es: 'Líder de la Fragua', en: 'Forge Leader' },
    x: -22, z: -44,
    intro: {
      es: 'Cada flauta nace en un fuego que no se apaga. Enciende el tuyo.',
      en: 'Every flute is born in a fire that never dies. Light yours.',
    },
    badge: {
      id: 'gym:cinder', glyph: '✹',
      name: { es: 'Medalla Brasa', en: 'Ember Badge' },
      color: '#ef7f43',
    },
    team: [['emberpup', 16], ['pyrohound', 19]],
    reward: { lumen: 380, potions: 3 },
  },
  {
    id: 'storm', profile: 'brann', type: 'stone', color: '#a99a7a',
    name: { es: 'Trono de Tormenta', en: 'Stormseat' },
    leader: { es: 'Brann', en: 'Brann' },
    title: { es: 'Líder del Alud', en: 'Avalanche Leader' },
    x: -47, z: -18,
    intro: {
      es: 'La montaña no se mueve por gritos. Se mueve por paciencia. Veamos la tuya.',
      en: 'The mountain does not move for shouts. It moves for patience. Let us see yours.',
    },
    badge: {
      id: 'gym:storm', glyph: '◆',
      name: { es: 'Medalla Cumbre', en: 'Summit Badge' },
      color: '#b9a77d',
    },
    team: [['pebblit', 17], ['voltrix', 19], ['cragwarden', 21]],
    reward: { lumen: 500, potions: 4 },
  },
];

export const BADGE_BY_ID = Object.fromEntries(GYMS.map((g) => [g.badge.id, { ...g.badge, gymId: g.id }]));

export function gymById(id) {
  return GYMS.find((g) => g.id === id) || null;
}

export function gymTeam(gym) {
  return gym.team.map(([species, level]) => createCreature(species, level, { shiny: false }));
}

// ---------------------------------------------------------------------------
// World architecture
// ---------------------------------------------------------------------------

function bannerTexture(color, glyph) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, color);
  g.addColorStop(1, '#14332c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(20, 12);
  ctx.lineTo(236, 12);
  ctx.lineTo(226, 210);
  ctx.lineTo(128, 246);
  ctx.lineTo(30, 210);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f4e7b0';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = '#fff7d8';
  ctx.font = 'bold 110px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 128, 118);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeBanner(color, glyph) {
  const texture = bannerTexture(color, glyph);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.7, 1.7, 1);
  sprite.center.set(0.5, 0.1);
  return sprite;
}

function torch(scene, x, y, z, color) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.1, 6), material('#4a3a2a'));
  pole.position.y = 1.05;
  pole.castShadow = true;
  group.add(pole);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.14, 0.28, 8), material('#6b5235'));
  bowl.position.y = 2.1;
  group.add(bowl);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.48, 7),
    new THREE.MeshBasicMaterial({ color }),
  );
  flame.position.y = 2.45;
  group.add(flame);
  const light = new THREE.PointLight(color, 6, 8, 2);
  light.position.y = 2.5;
  group.add(light);
  group.userData.flame = flame;
  group.userData.light = light;
  scene.add(group);
  return group;
}

function buildGym(scene, gym, index) {
  const root = new THREE.Group();
  const height = 0;
  root.position.set(gym.x, height, gym.z);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.8, 0.55, 20),
    material('#7b7a64'),
  );
  platform.position.y = 0.27;
  platform.receiveShadow = true;
  platform.castShadow = true;
  root.add(platform);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.9, 5.9, 40),
    new THREE.MeshBasicMaterial({ color: gym.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.57;
  root.add(ring);

  // Four pillars with coloured banners
  const banners = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const px = Math.cos(a) * 5.6;
    const pz = Math.sin(a) * 5.6;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 4.4, 7), material('#8d8a76'));
    pillar.position.set(px, 2.2, pz);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    root.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), material('#b3ad92'));
    cap.position.set(px, 4.4, pz);
    cap.castShadow = true;
    root.add(cap);
    const banner = makeBanner(gym.color, gym.badge.glyph);
    banner.position.set(px * 0.97, 1.6, pz * 0.97);
    banner.lookAt(new THREE.Vector3(0, 2.4, 0));
    root.add(banner);
    banners.push(banner);
  }

  const leader = buildPerson(gym.profile, 2.5);
  leader.position.set(0, 0.55, -2.4);
  root.add(leader);

  const torches = [
    torch(scene, gym.x - 6.6, 0, gym.z + 2.4, gym.color),
    torch(scene, gym.x + 6.6, 0, gym.z + 2.4, gym.color),
  ];

  const crest = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: gym.color, emissive: gym.color, emissiveIntensity: 1.4, roughness: 0.3 }),
  );
  crest.position.set(0, 6.1, 0);
  root.add(crest);

  scene.add(root);
  return {
    ...gym, root, leader, ring, crest, banners, torches,
    pos: new THREE.Vector3(gym.x, height, gym.z),
    radius: 7.4,
    animate(t, dt) {
      ring.rotation.z += dt * 0.18;
      crest.rotation.y += dt * 0.8;
      crest.position.y = 6.1 + Math.sin(t * 1.4 + index) * 0.18;
      banners.forEach((b, i) => { b.position.y = 1.6 + Math.sin(t * 1.8 + i) * 0.05; });
      torches.forEach((torchGroup) => {
        torchGroup.userData.flame.scale.y = 0.85 + Math.sin(t * 9 + index) * 0.18;
        torchGroup.userData.light.intensity = 4.2 + Math.sin(t * 11 + index) * 1.4;
      });
    },
  };
}

function buildColosseum(scene) {
  const x = 0, z = 32;
  const root = new THREE.Group();
  root.position.set(x, 0, z);

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11.8, 0.6, 36),
    material('#b3a37e'),
  );
  floor.position.y = 0.3;
  floor.receiveShadow = true;
  root.add(floor);

  const arena = new THREE.Mesh(
    new THREE.CircleGeometry(8.6, 40),
    new THREE.MeshStandardMaterial({ color: '#cbb98d', roughness: 0.9 }),
  );
  arena.rotation.x = -Math.PI / 2;
  arena.position.y = 0.62;
  arena.receiveShadow = true;
  root.add(arena);

  const seal = new THREE.Mesh(
    new THREE.RingGeometry(4.6, 7.6, 48),
    new THREE.MeshBasicMaterial({ color: '#f0d67c', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  seal.rotation.x = -Math.PI / 2;
  seal.position.y = 0.64;
  root.add(seal);

  const columns = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.abs(((a - Math.PI / 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.25) continue;
    const px = Math.cos(a) * 11.2;
    const pz = Math.sin(a) * 11.2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 5.2, 8), material('#a9a087'));
    col.position.set(px, 2.6, pz);
    col.castShadow = true;
    col.receiveShadow = true;
    root.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.36, 1.25), material('#c2b696'));
    cap.position.set(px, 5.2, pz);
    cap.castShadow = true;
    root.add(cap);
    columns.push(col);
  }

  // Grand banner over the entrance
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 512;
  bannerCanvas.height = 256;
  const ctx = bannerCanvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, '#4a3a70');
  bg.addColorStop(1, '#1a1830');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#f0d67c';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 492, 236);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 58px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('COLISEO', 256, 112);
  ctx.font = 'bold 36px Georgia, serif';
  ctx.fillText('DEL ALBA', 256, 166);
  const texture = new THREE.CanvasTexture(bannerCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, toneMapped: false }));
  banner.scale.set(7.2, 3.6, 1);
  banner.position.set(0, 7.4, 10.8);
  root.add(banner);

  const keeper = buildPerson('keeper', 2.45);
  keeper.position.set(0, 0.62, 8.4);
  root.add(keeper);

  const torches = [
    torch(scene, x - 9.5, 0, z + 8.5, '#ffd77a'),
    torch(scene, x + 9.5, 0, z + 8.5, '#ffd77a'),
  ];

  scene.add(root);
  return {
    root, keeper, torches, seal, columns,
    pos: new THREE.Vector3(x, 0, z),
    x, z, radius: 12.5,
    animate(t, dt) {
      seal.rotation.z += dt * 0.12;
      seal.material.opacity = 0.28 + Math.sin(t * 1.5) * 0.08;
      torches.forEach((torchGroup, i) => {
        torchGroup.userData.flame.scale.y = 0.85 + Math.sin(t * 8 + i) * 0.2;
        torchGroup.userData.light.intensity = 4 + Math.sin(t * 10 + i) * 1.5;
      });
    },
  };
}

export function createGymWorld(scene) {
  const gyms = GYMS.map((gym, i) => buildGym(scene, gym, i));
  const colosseum = buildColosseum(scene);
  return {
    gyms,
    colosseum,
    animate(t, dt) {
      gyms.forEach((g) => g.animate(t, dt));
      colosseum.animate(t, dt);
    },
    gymNear(x, z) {
      for (const gym of gyms) {
        if (Math.hypot(x - gym.x, z - gym.z) < gym.radius + 1.6) return gym;
      }
      return null;
    },
    atColosseum(x, z) {
      return Math.hypot(x - colosseum.x, z - colosseum.z) < colosseum.radius + 1.2;
    },
  };
}

export function gymName(gym) {
  return txt(gym.name);
}

export function leaderName(gym) {
  return txt(gym.leader);
}

export function badgeName(badge) {
  return txt(badge.name);
}
