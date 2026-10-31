import * as THREE from '../vendor/three.module.js';
import { material } from './models.js';

// ---------------------------------------------------------------------------
// Procedural island: terrain, water, forest, meadows, camp and shrine
// ---------------------------------------------------------------------------

const ISLAND_RADIUS = 92;
const POND = { x: 34, z: 30, r: 13 };
const CAMP = { x: 7, z: 7 };
const HUT = { x: -13, z: 12 };
const SHRINE = { x: 0, z: -64 };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash2(x, y, seed) {
  const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}

function noise2(x, y, seed = 1) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function fbm(x, y, seed = 3) {
  return noise2(x, y, seed) * 0.6 + noise2(x * 2.1, y * 2.1, seed + 4) * 0.28 + noise2(x * 4.3, y * 4.3, seed + 9) * 0.12;
}

export function createWorld() {
  const group = new THREE.Group();
  const colliders = [];
  const animated = [];
  const rand = mulberry32(20261031);

  const heightAt = (x, z) => {
    const d = Math.hypot(x, z);
    let h = 1.55 + fbm(x * 0.018, z * 0.018, 3) * 4.2 + fbm(x * 0.06, z * 0.06, 17) * 0.7;
    // flatten the starting meadow
    const meadow = 1 - smoothstep(6, 26, Math.hypot(x, z));
    h = h * (1 - meadow * 0.75) + 1.85 * meadow * 0.75;
    // pond basin
    const pd = Math.hypot(x - POND.x, z - POND.z);
    h -= (1 - smoothstep(POND.r * 0.45, POND.r * 1.25, pd)) * 3.1;
    // shrine plateau
    h += (1 - smoothstep(0, 20, Math.hypot(x - SHRINE.x, z - SHRINE.z))) * 1.15;
    // coast
    h -= smoothstep(ISLAND_RADIUS - 24, ISLAND_RADIUS + 18, d) * 14;
    return h;
  };

  // ---- terrain ------------------------------------------------------------
  const segs = 150;
  const terrainGeo = new THREE.PlaneGeometry(300, 300, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass1 = new THREE.Color('#79b356');
  const cGrass2 = new THREE.Color('#5d9b49');
  const cGrass3 = new THREE.Color('#8ec466');
  const cSand = new THREE.Color('#dcc792');
  const cWet = new THREE.Color('#b7a878');
  const cRock = new THREE.Color('#7f8a5c');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const n = fbm(x * 0.12, z * 0.12, 31);
    const pd = Math.hypot(x - POND.x, z - POND.z);
    if (h < -0.25) tmp.copy(cWet);
    else if (h < 0.55) tmp.copy(cSand);
    else if (h > 4.7) tmp.copy(cRock).lerp(cGrass2, 0.4);
    else tmp.copy(cGrass1).lerp(n > 0.52 ? cGrass3 : cGrass2, Math.abs(n - 0.5) * 1.1);
    // sandy pond shore
    if (pd < POND.r + 2.4 && pd > POND.r - 2.2) tmp.lerp(cSand, 0.55);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: false });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // ---- ocean --------------------------------------------------------------
  const ocean = new THREE.Mesh(
    new THREE.CircleGeometry(420, 64),
    new THREE.MeshStandardMaterial({ color: '#43aec4', roughness: 0.28, metalness: 0.12, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -1.35;
  group.add(ocean);

  const oceanShine = new THREE.Mesh(
    new THREE.CircleGeometry(419, 64),
    new THREE.MeshBasicMaterial({ color: '#9fe4e4', transparent: true, opacity: 0.1, depthWrite: false }),
  );
  oceanShine.rotation.x = -Math.PI / 2;
  oceanShine.position.y = -1.2;
  group.add(oceanShine);

  // ---- pond water ---------------------------------------------------------
  const waterUniforms = { uTime: { value: 0 }, uNight: { value: 0 } };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vW;
      varying vec3 vN;
      void main() {
        vec3 p = position;
        float wave = sin(p.x * 0.75 + uTime * 1.1) * 0.055 + cos(p.y * 0.9 + uTime * 0.8) * 0.045;
        p.z += wave;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * vec3(-0.04 * cos(p.x * 0.75 + uTime * 1.1), 1.0, 0.04 * sin(p.y * 0.9 + uTime * 0.8)));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uNight;
      varying vec3 vW;
      varying vec3 vN;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(viewDir, normalize(vN)), 0.0), 2.0);
        vec3 deep = vec3(0.075, 0.37, 0.46);
        vec3 shallow = vec3(0.22, 0.78, 0.78);
        float sparkle = pow(max(0.0, sin(vW.x * 3.0 + uTime * 2.0) * sin(vW.z * 2.4 - uTime * 1.4)), 12.0);
        vec3 col = mix(deep, shallow, 0.35 + 0.35 * sin(vW.x * 0.2 + vW.z * 0.3)) + sparkle * 0.55 + fres * vec3(0.5, 0.85, 0.9);
        col = mix(col, vec3(0.035, 0.1, 0.17) + sparkle * vec3(0.35, 0.42, 0.5), uNight * 0.82);
        gl_FragColor = vec4(col, 0.82);
      }
    `,
  });
  const pondWater = new THREE.Mesh(new THREE.PlaneGeometry(POND.r * 2.35, POND.r * 2.35, 42, 42), waterMat);
  pondWater.rotation.x = -Math.PI / 2;
  pondWater.position.set(POND.x, 0.32, POND.z);
  pondWater.renderOrder = 1;
  group.add(pondWater);
  animated.push((dt, t) => { waterUniforms.uTime.value = t; oceanShine.position.y = -1.2 + Math.sin(t * 0.5) * 0.05; });

  // pond ripples + lily pads
  const rippleMat = new THREE.MeshBasicMaterial({ color: '#c8f6ef', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 32), rippleMat.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(POND.x + Math.sin(i * 2.4) * 4, 0.38, POND.z + Math.cos(i * 2.4) * 4);
    group.add(ring);
    const phase = i * 1.4;
    animated.push((dt, t) => {
      const k = ((t + phase) % 4) / 4;
      ring.scale.setScalar(0.6 + k * 2.2);
      ring.material.opacity = 0.32 * (1 - k);
    });
  }
  for (let i = 0; i < 12; i++) {
    const lotus = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rand() * 0.5, 10), material('#5fa85c', { side: THREE.DoubleSide }));
    pad.rotation.x = -Math.PI / 2;
    lotus.add(pad);
    if (rand() > 0.45) {
      const flower = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.25, 6), material('#f7c9d8'));
      flower.position.y = 0.16;
      lotus.add(flower);
    }
    const ang = rand() * Math.PI * 2, r = 3 + rand() * 8;
    lotus.position.set(POND.x + Math.cos(ang) * r, 0.36, POND.z + Math.sin(ang) * r);
    lotus.rotation.y = rand() * Math.PI;
    group.add(lotus);
  }

  // ---- tall grass ---------------------------------------------------------
  const grassPatchCenters = [
    [-15, -7], [16, 6], [-28, 30], [10, 46], [-44, -16],
    [46, -16], [2, -34], [-6, 28], [36, 10], [-30, -34], [26, 48],
  ];
  const bladeGeo = new THREE.ConeGeometry(0.075, 0.72, 3, 1, true);
  bladeGeo.translate(0, 0.36, 0);
  const grassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float sway = sin(uTime * 1.5 + iPos.x * 0.4 + iPos.z * 0.31);
        transformed.x += sway * 0.075 * max(transformed.y, 0.0);
        transformed.z += cos(uTime * 1.2 + iPos.z * 0.37) * 0.055 * max(transformed.y, 0.0);
      #endif
    `);
    grassMat.userData.shader = shader;
  };
  const bladesPerPatch = 310;
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, grassPatchCenters.length * bladesPerPatch);
  grass.castShadow = false;
  grass.receiveShadow = true;
  grass.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const grassColors = ['#4f9448', '#63a94f', '#78b95c', '#559c4a', '#86c163'];
  let gi = 0;
  for (const [cx, cz] of grassPatchCenters) {
    for (let i = 0; i < bladesPerPatch; i++) {
      const ang = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 5.4;
      const x = cx + Math.cos(ang) * r;
      const z = cz + Math.sin(ang) * r;
      const s = 0.65 + rand() * 0.95;
      dummy.position.set(x, heightAt(x, z) - 0.03, z);
      dummy.scale.set(0.7 + rand() * 0.8, s, 0.7 + rand() * 0.8);
      dummy.rotation.y = rand() * Math.PI;
      dummy.updateMatrix();
      grass.setMatrixAt(gi, dummy.matrix);
      grass.setColorAt(gi, new THREE.Color(grassColors[Math.floor(rand() * grassColors.length)]));
      gi++;
    }
  }
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  group.add(grass);
  animated.push((dt, t) => {
    if (grassMat.userData.shader) grassMat.userData.shader.uniforms.uTime.value = t;
  });

  // ---- trees --------------------------------------------------------------
  const treePositions = [];
  const nearWater = (x, z) => Math.hypot(x - POND.x, z - POND.z) < POND.r + 4;
  for (let attempts = 0; attempts < 900 && treePositions.length < 115; attempts++) {
    const ang = rand() * Math.PI * 2;
    const r = 13 + Math.sqrt(rand()) * 76;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const h = heightAt(x, z);
    if (h < 0.7 || h > 5.5) continue;
    if (nearWater(x, z)) continue;
    if (Math.hypot(x, z) < 16) continue;
    if (Math.hypot(x - HUT.x, z - HUT.z) < 9) continue;
    if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < 15) continue;
    if (treePositions.some((p) => Math.hypot(p[0] - x, p[1] - z) < 3.1)) continue;
    if (Math.hypot(x - 35, z + 10) < 8) continue; // clearing for views
    treePositions.push([x, z, h]);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.2, 6);
  trunkGeo.translate(0, 1.1, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, material('#7b5a3d'), treePositions.length);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  const canopyGeo = new THREE.IcosahedronGeometry(1.5, 0);
  const canopyA = new THREE.InstancedMesh(canopyGeo, material('#4f8c46'), treePositions.length);
  const canopyB = new THREE.InstancedMesh(canopyGeo, material('#65a851'), treePositions.length);
  canopyA.castShadow = true; canopyB.castShadow = true;
  canopyA.receiveShadow = true; canopyB.receiveShadow = true;
  const greens = ['#4b8742', '#5c9a4b', '#6cab55', '#477f3f', '#78b45e'];
  treePositions.forEach(([x, z, h], i) => {
    const s = 0.8 + rand() * 0.85;
    dummy.position.set(x, h, z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x + (rand() - 0.5) * 0.4, h + 2.05 * s + 0.7, z + (rand() - 0.5) * 0.4);
    dummy.scale.set(s * (0.9 + rand() * 0.35), s * (0.8 + rand() * 0.3), s * (0.9 + rand() * 0.35));
    dummy.rotation.set(rand(), rand() * Math.PI, rand());
    dummy.updateMatrix();
    canopyA.setMatrixAt(i, dummy.matrix);
    canopyA.setColorAt(i, new THREE.Color(greens[Math.floor(rand() * greens.length)]));

    dummy.position.set(x + (rand() - 0.5) * 1.1, h + 3.1 * s, z + (rand() - 0.5) * 1.1);
    dummy.scale.setScalar(s * (0.55 + rand() * 0.35));
    dummy.rotation.set(rand(), rand() * Math.PI, rand());
    dummy.updateMatrix();
    canopyB.setMatrixAt(i, dummy.matrix);
    canopyB.setColorAt(i, new THREE.Color(greens[Math.floor(rand() * greens.length)]));

    if (s > 0.95) colliders.push({ x, z, r: 0.55 * s });
  });
  trunkMesh.instanceMatrix.needsUpdate = true;
  canopyA.instanceMatrix.needsUpdate = true;
  canopyB.instanceMatrix.needsUpdate = true;
  if (canopyA.instanceColor) canopyA.instanceColor.needsUpdate = true;
  if (canopyB.instanceColor) canopyB.instanceColor.needsUpdate = true;
  group.add(trunkMesh, canopyA, canopyB);

  // hero tree near spawn
  function heroTree(x, z, scale = 1) {
    const g = new THREE.Group();
    const h = heightAt(x, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4.4, 7), material('#7d5c3e'));
    trunk.position.y = 2.2;
    trunk.castShadow = true; trunk.receiveShadow = true;
    g.add(trunk);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9 - i * 0.2, 0), material(greens[i % greens.length]));
      c.position.set(Math.sin(i * 2.2) * 1.0, 4.2 + i * 0.85, Math.cos(i * 2.2) * 1.0);
      c.rotation.set(rand() * 2, rand() * 2, rand() * 2);
      c.castShadow = true; c.receiveShadow = true;
      g.add(c);
    }
    g.position.set(x, h, z);
    g.scale.setScalar(scale);
    group.add(g);
    colliders.push({ x, z, r: 0.8 * scale });
  }
  heroTree(12, 18, 1.05);
  heroTree(-24, -4, 0.9);
  heroTree(24, -16, 0.8);

  // ---- rocks --------------------------------------------------------------
  const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, material('#9c9b8d'), 66);
  rocks.castShadow = true; rocks.receiveShadow = true;
  const rockColors = ['#9c9b8d', '#8c8b7f', '#a8a598', '#848b7c'];
  let ri = 0;
  for (let attempts = 0; attempts < 500 && ri < 66; attempts++) {
    const ang = rand() * Math.PI * 2;
    const r = 18 + Math.sqrt(rand()) * 70;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    const h = heightAt(x, z);
    if (h < 0.9 || h > 5.8) continue;
    if (nearWater(x, z)) continue;
    if (Math.hypot(x - HUT.x, z - HUT.z) < 7 || Math.hypot(x - SHRINE.x, z - SHRINE.z) < 12) continue;
    if (Math.hypot(x, z) < 12) continue;
    const s = 0.4 + rand() * 1.3;
    dummy.position.set(x, h + s * 0.28, z);
    dummy.rotation.set(rand() * 2, rand() * Math.PI, rand() * 2);
    dummy.scale.set(s, s * (0.65 + rand() * 0.5), s);
    dummy.updateMatrix();
    rocks.setMatrixAt(ri, dummy.matrix);
    rocks.setColorAt(ri, new THREE.Color(rockColors[Math.floor(rand() * rockColors.length)]));
    if (s > 0.9) colliders.push({ x, z, r: s * 0.75 });
    ri++;
  }
  rocks.count = ri;
  group.add(rocks);

  // ---- flowers ------------------------------------------------------------
  const flowerGeo = new THREE.SphereGeometry(0.09, 5, 4);
  const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), 420);
  const flowerColors = ['#ffd9e2', '#fff4c7', '#ffb7c9', '#e6d8ff', '#ffd9a0', '#fbfbf2'];
  let fi = 0;
  for (let i = 0; i < 900 && fi < 420; i++) {
    const ang = rand() * Math.PI * 2;
    const r = 6 + Math.sqrt(rand()) * 78;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    const h = heightAt(x, z);
    if (h < 0.75 || h > 4.8 || nearWater(x, z)) continue;
    dummy.position.set(x, h + 0.12, z);
    dummy.scale.set(0.8 + rand() * 0.9, 0.8 + rand() * 0.7, 0.8 + rand() * 0.9);
    dummy.rotation.set(rand() * 2, rand() * 2, rand() * 2);
    dummy.updateMatrix();
    flowers.setMatrixAt(fi, dummy.matrix);
    flowers.setColorAt(fi, new THREE.Color(flowerColors[Math.floor(rand() * flowerColors.length)]));
    fi++;
  }
  flowers.count = fi;
  flowers.castShadow = false;
  group.add(flowers);

  // ---- reeds around the pond ---------------------------------------------
  const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 1.4, 3), material('#6f9f4d', { side: THREE.DoubleSide }), 120);
  for (let i = 0; i < 120; i++) {
    const ang = rand() * Math.PI * 2;
    const rr = POND.r + 1.4 + rand() * 2.5;
    const x = POND.x + Math.cos(ang) * rr;
    const z = POND.z + Math.sin(ang) * rr;
    dummy.position.set(x, Math.max(heightAt(x, z), 0.2) + 0.65, z);
    dummy.scale.set(1, 0.7 + rand() * 0.9, 1);
    dummy.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3);
    dummy.updateMatrix();
    reeds.setMatrixAt(i, dummy.matrix);
  }
  group.add(reeds);

  // ---- camp ---------------------------------------------------------------
  const camp = new THREE.Group();
  camp.position.set(CAMP.x, heightAt(CAMP.x, CAMP.z), CAMP.z);
  const fireRing = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.65, 24), material('#8f8577', { side: THREE.DoubleSide }));
  fireRing.rotation.x = -Math.PI / 2;
  fireRing.position.y = 0.03;
  camp.add(fireRing);
  for (let i = 0; i < 9; i++) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), material('#8e887b'));
    const a = (i / 9) * Math.PI * 2;
    stone.position.set(Math.cos(a) * 1.42, 0.16, Math.sin(a) * 1.42);
    stone.scale.set(1, 0.75, 1);
    stone.castShadow = true;
    camp.add(stone);
  }
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.5, 6), material('#6e4d33'));
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.18;
    log.castShadow = true;
    camp.add(log);
  }
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.32 - i * 0.07, 1.05 - i * 0.18, 6),
      new THREE.MeshStandardMaterial({ color: ['#ffb03a', '#ff7a2d', '#ffe38a'][i], emissive: ['#ff7a1f', '#ff4d10', '#ffcf55'][i], emissiveIntensity: 2.2, roughness: 0.6, flatShading: true, transparent: true, opacity: 0.94 }),
    );
    flame.position.set((rand() - 0.5) * 0.16, 0.62 + i * 0.06, (rand() - 0.5) * 0.16);
    camp.add(flame);
    flames.push(flame);
  }
  const fireLight = new THREE.PointLight('#ffab4a', 6, 14, 2);
  fireLight.position.y = 1.1;
  camp.add(fireLight);
  // bench
  const bench = new THREE.Group();
  bench.position.set(2.6, 0, 1.2);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.6), material('#8c6440'));
  seat.position.y = 0.55; seat.castShadow = true; bench.add(seat);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.5), material('#705033'));
    leg.position.set(s * 0.85, 0.28, 0); leg.castShadow = true; bench.add(leg);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.12), material('#8c6440'));
  back.position.set(0, 0.86, -0.28); back.castShadow = true; bench.add(back);
  campsiteAdd(camp, bench);
  group.add(camp);
  colliders.push({ x: CAMP.x, z: CAMP.z, r: 1.55 });
  animated.push((dt, t) => {
    flames.forEach((f, i) => {
      f.scale.set(1 + Math.sin(t * 7 + i * 2) * 0.09, 0.9 + Math.sin(t * 9 + i) * 0.15, 1 + Math.cos(t * 6 + i) * 0.09);
      f.rotation.y = t * (1.2 + i * 0.4);
    });
    fireLight.intensity = 5.2 + Math.sin(t * 8.3) * 1.1 + Math.sin(t * 13.7) * 0.5;
  });

  function campsiteAdd(parent, child) {
    parent.add(child);
  }

  // ---- hut ----------------------------------------------------------------
  const hut = new THREE.Group();
  hut.position.set(HUT.x, heightAt(HUT.x, HUT.z), HUT.z);
  hut.rotation.y = 0.7;
  const wallMat = material('#d9b98a');
  const walls = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.9, 3.8), wallMat);
  walls.position.y = 1.45; walls.castShadow = true; walls.receiveShadow = true;
  hut.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9, 2.2, 4), material('#b15f49'));
  roof.position.y = 4.0; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  hut.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.12), material('#7a4f31'));
  door.position.set(0, 0.95, 1.93); door.castShadow = true;
  hut.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), material('#e6c05a', { metalness: 0.4, roughness: 0.4 }));
  knob.position.set(0.35, 1.0, 2.02);
  hut.add(knob);
  const windowMats = [];
  for (const x of [-1.35, 1.35]) {
    const winMat = new THREE.MeshStandardMaterial({ color: '#ffe9a3', emissive: '#ffca5c', emissiveIntensity: 0.35, roughness: 0.5 });
    windowMats.push(winMat);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.1), winMat);
    win.position.set(x, 1.8, 1.94);
    hut.add(win);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.08), material('#7a4f31'));
    frame.position.set(x, 1.8, 1.88);
    hut.add(frame);
  }
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.4, 0.55), material('#8e7561'));
  chimney.position.set(1.2, 4.3, -0.6); chimney.castShadow = true;
  hut.add(chimney);
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#ffdca0', emissive: '#ffb347', emissiveIntensity: 1.4, roughness: 0.4 });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), lanternMat);
  lantern.position.set(0.9, 2.5, 2.02);
  hut.add(lantern);
  const lanternLight = new THREE.PointLight('#ffc27a', 0, 11, 2);
  lanternLight.position.set(1.5, 2.5, 3.0);
  hut.add(lanternLight);
  group.add(hut);
  colliders.push({ x: HUT.x, z: HUT.z, r: 3.0 });

  // smoking chimney puffs
  const smokeMat = new THREE.MeshBasicMaterial({ color: '#f4f0e8', transparent: true, opacity: 0.25, depthWrite: false });
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.3 + rand() * 0.3, 7, 6), smokeMat.clone());
    puff.userData.phase = i / 7;
    puff.userData.offset = new THREE.Vector3(1.2, 4.9, -0.6);
    hut.add(puff);
    puffs.push(puff);
  }
  animated.push((dt, t) => {
    puffs.forEach((p) => {
      const k = ((t * 0.14 + p.userData.phase) % 1);
      p.position.set(p.userData.offset.x + Math.sin(k * 6 + p.userData.phase * 9) * 0.5, p.userData.offset.y + k * 3.2, p.userData.offset.z + Math.cos(k * 5) * 0.4);
      p.scale.setScalar(0.6 + k * 1.6);
      p.material.opacity = 0.22 * (1 - k);
    });
  });

  // fence + sign
  for (let i = 0; i < 7; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 5), material('#8b6744'));
    post.position.set(-8.2 + i * 1.2, 0.55, 16.4);
    post.castShadow = true;
    const hh = heightAt(-8.2 + i * 1.2, 16.4);
    post.position.y = hh + 0.55;
    group.add(post);
    if (i < 6) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.12, 0.08), material('#a07b52'));
      rail.position.set(-7.6 + i * 1.2, heightAt(-7.6 + i * 1.2, 16.4) + 0.8, 16.4);
      rail.castShadow = true;
      group.add(rail);
    }
  }
  const sign = new THREE.Group();
  const sx = 5.6, sz = 3.0;
  sign.position.set(sx, heightAt(sx, sz), sz);
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.7, 6), material('#815c3c'));
  signPost.position.y = 0.85; signPost.castShadow = true;
  sign.add(signPost);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.1), material('#c99b5f'));
  board.position.set(0, 1.5, 0.05); board.rotation.x = -0.12; board.castShadow = true;
  sign.add(board);
  for (let i = 0; i < 3; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.85 - i * 0.12, 0.055, 0.02), material('#6b4a2e'));
    line.position.set(-0.12 + i * 0.06, 1.62 - i * 0.16, 0.12);
    line.rotation.x = -0.12;
    sign.add(line);
  }
  group.add(sign);
  colliders.push({ x: sx, z: sz, r: 0.4 });

  // ---- shrine -------------------------------------------------------------
  const shrine = new THREE.Group();
  shrine.position.set(SHRINE.x, heightAt(SHRINE.x, SHRINE.z), SHRINE.z);
  const circle = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 4.5, 48),
    new THREE.MeshBasicMaterial({ color: '#9de6a0', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.05;
  shrine.add(circle);
  const runeMat = new THREE.MeshBasicMaterial({ color: '#b7ffa0', transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const rune = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 4), runeMat);
    rune.rotation.x = -Math.PI / 2;
    rune.rotation.z = (i / 6) * Math.PI * 2;
    rune.position.set(Math.cos((i / 6) * Math.PI * 2) * 3.8, 0.07, Math.sin((i / 6) * Math.PI * 2) * 3.8);
    shrine.add(rune);
  }
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 5.2, 6), material('#8e9a83'));
    pillar.position.set(side * 2.4, 2.6, -1.1);
    pillar.rotation.z = side * 0.05;
    pillar.castShadow = true; pillar.receiveShadow = true;
    shrine.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 1.5), material('#a3ad96'));
    cap.position.set(side * 2.4, 5.2, -1.1);
    cap.castShadow = true;
    shrine.add(cap);
    for (let i = 0; i < 3; i++) {
      const vine = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 5), material('#6f9e56'));
      vine.position.set(side * 2.4 + (rand() - 0.5) * 0.5, 1 + i * 1.1, -1.1 + (rand() - 0.5) * 0.5);
      vine.scale.set(0.6, 1.2, 0.5);
      shrine.add(vine);
    }
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.6, 1.3), material('#98a28c'));
  lintel.position.set(0, 5.55, -1.1);
  lintel.rotation.z = 0.015;
  lintel.castShadow = true;
  shrine.add(lintel);
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#c7ffc0', emissive: '#6dff8a', emissiveIntensity: 1.8, roughness: 0.25, flatShading: true });
  const crystals = [];
  for (let i = 0; i < 5; i++) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 + rand() * 0.2, 0), crystalMat);
    crystal.position.set((rand() - 0.5) * 5, 5.9 + rand() * 0.8, -1.1 + (rand() - 0.5) * 0.5);
    crystal.rotation.set(rand(), rand(), rand());
    shrine.add(crystal);
    crystals.push(crystal);
  }
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 3.2, 26, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: '#9dffb0', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.position.y = 13;
  shrine.add(beam);
  group.add(shrine);
  colliders.push({ x: SHRINE.x - 2.4, z: SHRINE.z - 1.1, r: 0.85 }, { x: SHRINE.x + 2.4, z: SHRINE.z - 1.1, r: 0.85 });

  let bossGlow = 0;
  const setGuardianBeam = (on) => { bossGlow = on ? 1 : 0; };
  animated.push((dt, t) => {
    crystals.forEach((c, i) => {
      c.rotation.y += dt * 0.5;
      c.position.y += Math.sin(t * 1.3 + i) * 0.0015;
    });
    circle.rotation.z += dt * 0.12;
    runeMat.opacity = 0.45 + Math.sin(t * 2) * 0.18 + bossGlow * 0.3;
    const targetOpacity = bossGlow ? 0.15 + Math.sin(t * 1.6) * 0.05 : 0;
    beam.material.opacity += (targetOpacity - beam.material.opacity) * 0.04;
    beam.rotation.y += dt * 0.3;
  });

  // ---- clouds -------------------------------------------------------------
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#fff7e8', roughness: 1, transparent: true, opacity: 0.9, flatShading: true, fog: false });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const parts = 4 + Math.floor(rand() * 4);
    for (let j = 0; j < parts; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2 + rand() * 2.4, 7, 5), cloudMat);
      puff.position.set((j - parts / 2) * 2.6 + (rand() - 0.5) * 2, (rand() - 0.5) * 1.2, (rand() - 0.5) * 2.4);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set((rand() - 0.5) * 310, 30 + rand() * 22, (rand() - 0.5) * 310);
    cloud.scale.setScalar(0.8 + rand() * 1.1);
    group.add(cloud);
    clouds.push(cloud);
  }
  animated.push((dt) => {
    clouds.forEach((c) => {
      c.position.x += dt * 0.55;
      if (c.position.x > 165) c.position.x = -165;
    });
  });

  // ---- pollen / fireflies ------------------------------------------------
  const pollenCount = 220;
  const pollenGeo = new THREE.BufferGeometry();
  const pollenPos = new Float32Array(pollenCount * 3);
  const pollenSeeds = [];
  for (let i = 0; i < pollenCount; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 85;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    pollenPos[i * 3] = x;
    pollenPos[i * 3 + 1] = heightAt(x, z) + 0.5 + rand() * 5;
    pollenPos[i * 3 + 2] = z;
    pollenSeeds.push({ phase: rand() * Math.PI * 2, speed: 0.3 + rand() * 0.6, radius: 1 + rand() * 2 });
  }
  pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));
  const pollen = new THREE.Points(pollenGeo, new THREE.PointsMaterial({ color: '#ffefb8', size: 0.14, transparent: true, opacity: 0.72, depthWrite: false, sizeAttenuation: true }));
  group.add(pollen);
  animated.push((dt, t) => {
    const p = pollenGeo.attributes.position;
    for (let i = 0; i < pollenCount; i++) {
      const s = pollenSeeds[i];
      const baseX = pollenPos[i * 3], baseZ = pollenPos[i * 3 + 2];
      p.setX(i, baseX + Math.sin(t * s.speed + s.phase) * s.radius);
      p.setY(i, pollenPos[i * 3 + 1] + Math.sin(t * s.speed * 0.7 + s.phase) * 0.8);
      p.setZ(i, baseZ + Math.cos(t * s.speed * 0.8 + s.phase) * s.radius);
    }
    p.needsUpdate = true;
    pollen.material.opacity = 0.5 + Math.sin(t * 0.5) * 0.2;
  });

  // ---- butterflies -------------------------------------------------------
  const butterflies = [];
  const bColors = ['#ffd05c', '#ff9cc0', '#9cd8ff', '#f6f1d8'];
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Group();
    const wingMat = new THREE.MeshBasicMaterial({ color: bColors[i % bColors.length], side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.CircleGeometry(0.16, 6), wingMat);
      wing.position.x = side * 0.14;
      wing.scale.set(1, 0.65, 1);
      b.add(wing);
      wing.userData.side = side;
    }
    const [cx, cz] = grassPatchCenters[i % grassPatchCenters.length];
    b.userData.home = new THREE.Vector3(cx + (rand() - 0.5) * 4, heightAt(cx, cz) + 1 + rand() * 1.4, cz + (rand() - 0.5) * 4);
    b.position.copy(b.userData.home);
    b.userData.phase = rand() * Math.PI * 2;
    group.add(b);
    butterflies.push(b);
  }
  animated.push((dt, t) => {
    butterflies.forEach((b) => {
      const h = b.userData.home;
      b.position.set(
        h.x + Math.sin(t * 0.6 + b.userData.phase) * 2.4,
        heightAt(h.x, h.z) + 1.1 + Math.sin(t * 1.7 + b.userData.phase) * 0.5,
        h.z + Math.cos(t * 0.45 + b.userData.phase) * 2.4,
      );
      b.rotation.y = t * 0.6 + b.userData.phase;
      const flap = Math.sin(t * 14 + b.userData.phase) * 0.9;
      b.children.forEach((w) => { w.rotation.y = w.userData.side * (0.3 + flap); });
    });
  });

  // ---- sparkle pickups ----------------------------------------------------
  const pickups = [];
  const pickupSpots = [
    [5, -18], [-20, 6], [26, -6], [-9, 40], [44, 22], [-46, 8],
    [16, -42], [-24, -24], [52, -4], [-36, 44], [4, 56], [-54, -18],
  ];
  for (let i = 0; i < pickupSpots.length; i++) {
    const [x, z] = pickupSpots[i];
    const g = new THREE.Group();
    const y = heightAt(x, z);
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3, 0),
      new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? '#ffd86a' : '#a6f4ff', emissive: i % 3 === 0 ? '#ffb62e' : '#4fd8ff', emissiveIntensity: 1.6, roughness: 0.2, flatShading: true }),
    );
    shard.castShadow = true;
    g.add(shard);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.54, 20), new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.05;
    g.add(ring);
    g.position.set(x, y + 1.0, z);
    g.userData = { kind: i % 4 === 0 ? 'potion' : 'orb', phase: rand() * Math.PI * 2, baseY: y + 1.0, taken: false };
    group.add(g);
    pickups.push(g);
    animated.push((dt, t) => {
      g.rotation.y += dt * 1.5;
      shard.position.y = Math.sin(t * 2 + g.userData.phase) * 0.16;
      ring.rotation.z += dt * 0.7;
      g.visible = !g.userData.taken;
    });
  }

  // ---- sky dome -----------------------------------------------------------
  const skyUni = {
    uTop: { value: new THREE.Color('#4fb5d9') },
    uBottom: { value: new THREE.Color('#ffe6b3') },
    uSun: { value: new THREE.Vector3(-0.55, 0.45, -0.5).normalize() },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(480, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: skyUni,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uSun;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 1.15 + 0.06, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, pow(h, 0.68));
          float sun = max(dot(normalize(vDir), normalize(uSun)), 0.0);
          col += vec3(1.0, 0.82, 0.55) * pow(sun, 22.0) * 0.66;
          col += vec3(1.0, 0.9, 0.7) * pow(sun, 4.0) * 0.09;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  group.add(sky);

  // ---- stars & moon -------------------------------------------------------
  const starCount = 700;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 1.1 - 0.05, Math.random() * 2 - 1).normalize();
    v.multiplyScalar(450);
    starPos[i * 3] = v.x;
    starPos[i * 3 + 1] = Math.abs(v.y);
    starPos[i * 3 + 2] = v.z;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: '#fff6d8', size: 1.8, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(stars);

  const moon = new THREE.Group();
  const moonBall = new THREE.Mesh(new THREE.SphereGeometry(8, 20, 14), new THREE.MeshBasicMaterial({ color: '#f7f3d9', fog: false }));
  moon.add(moonBall);
  const moonHalo = new THREE.Mesh(new THREE.SphereGeometry(13, 16, 12), new THREE.MeshBasicMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.18, depthWrite: false, fog: false }));
  moon.add(moonHalo);
  moon.renderOrder = -8;
  group.add(moon);

  // ---- time of day -------------------------------------------------------
  const skyStops = [
    { t: 0.0, top: '#081127', bottom: '#1b2a4d', fog: '#22304a', sun: '#9cb5ff', cloud: '#6b7797' },
    { t: 0.21, top: '#081127', bottom: '#1b2a4d', fog: '#22304a', sun: '#9cb5ff', cloud: '#6b7797' },
    { t: 0.29, top: '#5d6ead', bottom: '#ffae80', fog: '#c9b3ab', sun: '#ffb07a', cloud: '#ffd1b4' },
    { t: 0.37, top: '#4fb5d9', bottom: '#ffe6b3', fog: '#cfe3d6', sun: '#fff1cf', cloud: '#fff7e8' },
    { t: 0.62, top: '#4fb5d9', bottom: '#ffe6b3', fog: '#cfe3d6', sun: '#fff1cf', cloud: '#fff7e8' },
    { t: 0.71, top: '#5a529e', bottom: '#ff9568', fog: '#d8b1a2', sun: '#ffb07a', cloud: '#ffbe9e' },
    { t: 0.8, top: '#1a2342', bottom: '#3c3f66', fog: '#3b4055', sun: '#b3c3ff', cloud: '#596587' },
    { t: 1.0, top: '#081127', bottom: '#1b2a4d', fog: '#22304a', sun: '#9cb5ff', cloud: '#6b7797' },
  ].map((s) => ({
    t: s.t,
    top: new THREE.Color(s.top),
    bottom: new THREE.Color(s.bottom),
    fog: new THREE.Color(s.fog),
    sun: new THREE.Color(s.sun),
    cloud: new THREE.Color(s.cloud),
  }));
  const tmpTop = new THREE.Color();
  const tmpBottom = new THREE.Color();
  const tmpFog = new THREE.Color();
  const tmpSunColor = new THREE.Color();
  const tmpCloud = new THREE.Color();
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  let nightLevel = 0;
  let dayLevel = 1;
  let starTwinkle = 0;

  function setTimeOfDay(fraction) {
    const t = ((fraction % 1) + 1) % 1;
    const angle = (t - 0.25) * Math.PI * 2;
    const elevation = Math.sin(angle);
    const day = clamp01(elevation / 0.28);
    const night = clamp01((0.06 - elevation) / 0.24);
    const twilight = clamp01(1 - Math.abs(elevation) / 0.32);
    nightLevel = night;
    dayLevel = day;
    sunDir.set(Math.cos(angle) * 0.92, elevation, 0.32).normalize();
    moonDir.set(-Math.cos(angle) * 0.92, -elevation, -0.32).normalize();

    let i = 0;
    while (i < skyStops.length - 2 && t > skyStops[i + 1].t) i++;
    const a = skyStops[i], b = skyStops[i + 1];
    const k = clamp01((t - a.t) / Math.max(0.0001, b.t - a.t));
    tmpTop.copy(a.top).lerp(b.top, k);
    tmpBottom.copy(a.bottom).lerp(b.bottom, k);
    tmpFog.copy(a.fog).lerp(b.fog, k);
    tmpSunColor.copy(a.sun).lerp(b.sun, k);
    tmpCloud.copy(a.cloud).lerp(b.cloud, k);

    skyUni.uTop.value.copy(tmpTop);
    skyUni.uBottom.value.copy(tmpBottom);
    skyUni.uSun.value.copy(sunDir);
    waterUniforms.uNight.value = night;
    starMat.opacity = Math.max(0, night * 0.95);
    stars.rotation.y = t * Math.PI * 0.5;
    moon.position.copy(moonDir).multiplyScalar(370);
    moon.rotation.y += 0.001;
    moon.visible = moonDir.y > -0.02;
    cloudMat.color.copy(tmpCloud);
    windowMats.forEach((m) => { m.emissiveIntensity = 0.2 + night * 2.5; });
    lanternLight.intensity = night * 7.5;
    lanternMat.emissiveIntensity = 0.6 + night * 1.8;
    pollen.material.color.set(night > 0.4 ? '#e8ff9a' : '#ffefb8');
    pollen.material.size = 0.14 + night * 0.09;
    butterflies.forEach((b) => { b.visible = day > 0.12; });
    return { t, elevation, day, night, twilight, fog: tmpFog, sunColor: tmpSunColor, sunDir, moonDir };
  }

  function clamp01(v) { return Math.min(1, Math.max(0, v)); }

  return {
    group,
    heightAt,
    colliders,
    pondWater,
    pickups,
    campPos: new THREE.Vector3(CAMP.x, heightAt(CAMP.x, CAMP.z), CAMP.z),
    hutPos: new THREE.Vector3(HUT.x, heightAt(HUT.x, HUT.z), HUT.z),
    shrinePos: new THREE.Vector3(SHRINE.x, heightAt(SHRINE.x, SHRINE.z), SHRINE.z),
    setGuardianBeam,
    wildSpawns: [
      { species: 'mossling', x: -15, z: -4, level: 4 },
      { species: 'zapmouse', x: 17, z: 8, level: 5 },
      { species: 'pebblit', x: 27, z: 20, level: 5 },
      { species: 'dropplet', x: 43, z: 31, level: 6 },
      { species: 'fluffbat', x: -31, z: -15, level: 5 },
      { species: 'emberpup', x: -7, z: -31, level: 6 },
      { species: 'spriglet', x: 47, z: 7, level: 6 },
      { species: 'mossling', x: 7, z: 36, level: 4 },
      { species: 'zapmouse', x: -38, z: 26, level: 7 },
      { species: 'pebblit', x: -22, z: -39, level: 6 },
      { species: 'fluffbat', x: 31, z: -35, level: 7 },
      { species: 'dropplet', x: 26, z: 47, level: 7 },
    ],
    update(dt, t) {
      for (const fn of animated) fn(dt, t);
      // keep pond water level low enough to see shore
      pondWater.position.y = 0.32 + Math.sin(t * 0.8) * 0.015;
    },
    collectPickup(p) {
      if (p.userData.taken) return null;
      p.userData.taken = true;
      return p.userData.kind;
    },
  };
}
