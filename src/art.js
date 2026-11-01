import {
  CREATURE_BY_ID, ELEMENTS, POIS, RARITIES, WORLD, ZONES, ZONE_BY_ID,
} from './data.js'
import { clamp, isNight, rand, shadeColor } from './core.js'

const TAU = Math.PI * 2

export function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
  if (fill !== undefined && fill !== null) ctx.fillStyle = fill
  ctx.fill()
}

function bodyGradient(ctx, x, y, rx, ry, palette) {
  const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.5, rx * 0.08, x, y, rx * 1.15)
  g.addColorStop(0, shadeColor(palette[0], 34))
  g.addColorStop(0.5, palette[0])
  g.addColorStop(1, palette[1])
  return g
}

function aura(ctx, x, y, r, species, time, intensity = 1) {
  const rarity = RARITIES[species.rarity]
  const pulse = 0.86 + Math.sin(time * 2.2 + x * 0.01) * 0.14
  const g = ctx.createRadialGradient(x, y - r * 0.15, r * 0.15, x, y - r * 0.1, r * 1.65)
  g.addColorStop(0, rarity.aura)
  g.addColorStop(0.55, rarity.aura.replace(/[\d.]+\)$/, `${0.12 * intensity})`))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = pulse
  ellipse(ctx, x, y - r * 0.1, r * 1.45, r * 1.1, g)
  ctx.restore()

  if (species.rarity === 'legendario' || species.rarity === 'mitico' || species.stage === 2) {
    ctx.save()
    ctx.translate(x, y - r * 0.2)
    ctx.rotate(time * 0.12)
    ctx.strokeStyle = rarity.color
    ctx.globalAlpha = 0.18 + Math.sin(time * 1.7) * 0.05
    ctx.lineWidth = Math.max(1, r * 0.018)
    ctx.setLineDash([r * 0.12, r * 0.12])
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 1.25, r * 0.48, 0, 0, TAU)
    ctx.stroke()
    ctx.rotate(-time * 0.25)
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 1.05, r * 0.38, 0.7, 0, TAU)
    ctx.stroke()
    ctx.restore()
  }
}

function eye(ctx, x, y, r, look = 0, glow = '#fff', iris = '#2dd4bf') {
  // socket shadow gives the eye depth instead of a flat sticker look
  ellipse(ctx, x, y + r * 0.07, r * 1.16, r * 1.24, 'rgba(2,6,12,.28)')
  // sclera
  ellipse(ctx, x, y, r, r * 1.12, '#f7fbff')
  // iris and inner shade
  ellipse(ctx, x + look * r * 0.18, y + r * 0.03, r * 0.68, r * 0.84, iris)
  ellipse(ctx, x + look * r * 0.22, y + r * 0.14, r * 0.5, r * 0.55, shadeColor(iris, -34))
  // slit pupil
  ellipse(ctx, x + look * r * 0.22, y + r * 0.02, r * 0.27, r * 0.64, '#091018')
  // highlights
  ellipse(ctx, x + look * r * 0.12 - r * 0.2, y - r * 0.34, r * 0.2, r * 0.2, '#ffffff')
  ellipse(ctx, x + look * r * 0.3 + r * 0.12, y + r * 0.24, r * 0.09, r * 0.09, glow)
  // upper eyelid / brow line
  ctx.strokeStyle = 'rgba(8,15,20,.62)'
  ctx.lineWidth = Math.max(1, r * 0.16)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(x, y, r * 1.02, Math.PI * 1.06, Math.PI * 1.94)
  ctx.stroke()
}

function drawFace(ctx, x, y, r, species, opts = {}) {
  const p = species.palette
  const shape = species.shape
  const eyeR = r * 0.115
  const look = opts.facing || 1
  const iris = p[2]
  const brow = shadeColor(p[1], -22)

  if (shape === 'golem') {
    // glowing carved eyes
    ctx.save()
    ctx.shadowColor = p[2]
    ctx.shadowBlur = r * 0.22
    ellipse(ctx, x - r * 0.17, y - r * 0.08, r * 0.075, r * 0.05, p[2])
    ellipse(ctx, x + r * 0.17, y - r * 0.08, r * 0.075, r * 0.05, p[2])
    ctx.restore()
    ctx.strokeStyle = p[1]
    ctx.lineWidth = Math.max(1, r * 0.03)
    ctx.beginPath()
    ctx.moveTo(x - r * 0.12, y + r * 0.14)
    ctx.lineTo(x, y + r * 0.19)
    ctx.lineTo(x + r * 0.12, y + r * 0.14)
    ctx.stroke()
    return
  }

  if (shape === 'slime') {
    eye(ctx, x - r * 0.19, y - r * 0.05, eyeR * 1.15, look, '#fff', iris)
    eye(ctx, x + r * 0.19, y - r * 0.05, eyeR * 1.15, look, '#fff', iris)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = Math.max(1, r * 0.03)
    ctx.beginPath()
    ctx.arc(x, y + r * 0.13, r * 0.13, 0.18, Math.PI - 0.18)
    ctx.stroke()
    // glossy cheek highlights
    ctx.globalAlpha = 0.5
    ellipse(ctx, x - r * 0.28, y + r * 0.06, r * 0.055, r * 0.035, '#ffffff')
    ellipse(ctx, x + r * 0.3, y + r * 0.02, r * 0.035, r * 0.025, '#ffffff')
    ctx.globalAlpha = 1
    return
  }

  const spacing = shape === 'insect' ? r * 0.22 : r * 0.165
  // brow ridge
  ctx.strokeStyle = brow
  ctx.lineWidth = Math.max(1, r * 0.045)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - spacing - r * 0.13, y - r * 0.2)
  ctx.lineTo(x - spacing + r * 0.08, y - r * 0.15)
  ctx.moveTo(x + spacing + r * 0.13, y - r * 0.2)
  ctx.lineTo(x + spacing - r * 0.08, y - r * 0.15)
  ctx.stroke()

  eye(ctx, x - spacing, y - r * 0.03, eyeR, look, '#fff', iris)
  eye(ctx, x + spacing, y - r * 0.03, eyeR, look, '#fff', iris)

  // muzzle / nostrils
  if (['beast', 'dragon', 'serpent', 'aquatic'].includes(shape)) {
    ctx.fillStyle = shadeColor(p[1], -30)
    ellipse(ctx, x - r * 0.045, y + r * 0.08, r * 0.028, r * 0.02, shadeColor(p[1], -30))
    ellipse(ctx, x + r * 0.045, y + r * 0.08, r * 0.028, r * 0.02, shadeColor(p[1], -30))
  }

  // mouth: predators get fangs, the rest a softer smile
  ctx.strokeStyle = '#1a1010'
  ctx.lineWidth = Math.max(1, r * 0.035)
  ctx.beginPath()
  if (['dragon', 'beast', 'serpent', 'insect', 'aquatic'].includes(shape)) {
    ctx.moveTo(x - r * 0.14, y + r * 0.15)
    ctx.quadraticCurveTo(x, y + r * 0.23, x + r * 0.14, y + r * 0.15)
    ctx.stroke()
    // fangs
    ctx.fillStyle = '#f8fafc'
    for (const d of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x + d * r * 0.11, y + r * 0.18)
      ctx.lineTo(x + d * r * 0.085, y + r * 0.28)
      ctx.lineTo(x + d * r * 0.055, y + r * 0.18)
      ctx.closePath()
      ctx.fill()
    }
    if (shape === 'serpent') {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = Math.max(1, r * 0.022)
      ctx.beginPath()
      ctx.moveTo(x, y + r * 0.22)
      ctx.lineTo(x - r * 0.03, y + r * 0.34)
      ctx.moveTo(x, y + r * 0.34)
      ctx.lineTo(x - r * 0.09, y + r * 0.39)
      ctx.moveTo(x, y + r * 0.34)
      ctx.lineTo(x + r * 0.09, y + r * 0.39)
      ctx.stroke()
    }
  } else {
    ctx.moveTo(x - r * 0.07, y + r * 0.16)
    ctx.quadraticCurveTo(x, y + r * 0.21, x + r * 0.07, y + r * 0.16)
    ctx.stroke()
  }

  if (species.rarity === 'legendario' || species.rarity === 'mitico') {
    ctx.strokeStyle = p[2]
    ctx.globalAlpha = 0.7
    ctx.lineWidth = Math.max(1, r * 0.022)
    ctx.beginPath()
    ctx.moveTo(x - r * 0.23, y - r * 0.12)
    ctx.lineTo(x - r * 0.08, y - r * 0.18)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + r * 0.23, y - r * 0.12)
    ctx.lineTo(x + r * 0.08, y - r * 0.18)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

function drawHorns(ctx, x, y, r, species, scale = 1) {
  const p = species.palette
  const horn = p[2]
  ctx.fillStyle = horn
  ctx.strokeStyle = p[1]
  ctx.lineWidth = Math.max(1, r * 0.018)
  const dirs = species.shape === 'beast' || species.shape === 'dragon' ? [-1, 1] : [1]
  for (const dir of dirs) {
    ctx.beginPath()
    ctx.moveTo(x + dir * r * 0.22 * scale, y - r * 0.3 * scale)
    ctx.quadraticCurveTo(x + dir * r * 0.43 * scale, y - r * 0.52 * scale, x + dir * r * 0.33 * scale, y - r * 0.7 * scale)
    ctx.quadraticCurveTo(x + dir * r * 0.27 * scale, y - r * 0.48 * scale, x + dir * r * 0.12 * scale, y - r * 0.35 * scale)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

function drawWings(ctx, x, y, r, species, time, side = 1) {
  const p = species.palette
  ctx.save()
  ctx.translate(x, y - r * 0.15)
  ctx.scale(side, 1)
  const flap = Math.sin(time * 2.6) * 0.1
  ctx.rotate(-0.18 + flap)
  const g = ctx.createLinearGradient(0, 0, r * 0.9, -r * 0.2)
  g.addColorStop(0, p[0])
  g.addColorStop(0.65, p[1])
  g.addColorStop(1, p[2])
  ctx.fillStyle = g
  ctx.globalAlpha = 0.92
  ctx.beginPath()
  ctx.moveTo(r * 0.08, 0)
  ctx.quadraticCurveTo(r * 0.5, -r * 0.72, r * 0.98, -r * 0.46)
  ctx.quadraticCurveTo(r * 0.68, -r * 0.2, r * 0.78, r * 0.02)
  ctx.quadraticCurveTo(r * 0.5, -r * 0.04, r * 0.52, r * 0.24)
  ctx.quadraticCurveTo(r * 0.28, r * 0.02, r * 0.08, r * 0.16)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 0.38
  ctx.strokeStyle = p[2]
  ctx.lineWidth = Math.max(1, r * 0.016)
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(r * 0.12, 0)
    ctx.lineTo(r * (0.5 + i * 0.12), -r * (0.44 - i * 0.1))
    ctx.stroke()
  }
  ctx.restore()
}

function drawTail(ctx, x, y, r, species, time, side = -1) {
  const p = species.palette
  ctx.save()
  ctx.translate(x + side * r * 0.35, y + r * 0.08)
  ctx.rotate(side * (0.3 + Math.sin(time * 1.5) * 0.1))
  ctx.strokeStyle = p[1]
  ctx.lineWidth = r * 0.12
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(side * r * 0.28, -r * 0.14, side * r * 0.52, -r * 0.28)
  ctx.stroke()
  if (species.shape === 'dragon' || species.rarity === 'legendario' || species.rarity === 'mitico') {
    ctx.fillStyle = p[2]
    ctx.beginPath()
    ctx.moveTo(side * r * 0.52, -r * 0.28)
    ctx.lineTo(side * r * 0.69, -r * 0.5)
    ctx.lineTo(side * r * 0.64, -r * 0.23)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawPattern(ctx, x, y, r, species, stage) {
  const p = species.palette
  const type = species.family.length % 4
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.fillStyle = p[2]
  if (type === 0) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath()
      ctx.ellipse(x + i * r * 0.19, y - r * 0.02, r * 0.035, r * 0.13, -0.3, 0, TAU)
      ctx.fill()
    }
  } else if (type === 1) {
    for (let i = 0; i < 4 + stage * 2; i++) {
      const a = i * 2.1
      ellipse(ctx, x + Math.cos(a) * r * (0.18 + (i % 3) * 0.06), y + Math.sin(a) * r * 0.14, r * 0.027, r * 0.027, p[2])
    }
  } else if (type === 2) {
    ctx.strokeStyle = p[2]
    ctx.lineWidth = Math.max(1, r * 0.022)
    ctx.beginPath()
    ctx.moveTo(x - r * 0.15, y - r * 0.18)
    ctx.lineTo(x - r * 0.04, y - r * 0.03)
    ctx.lineTo(x - r * 0.11, y + r * 0.08)
    ctx.moveTo(x + r * 0.12, y - r * 0.2)
    ctx.lineTo(x + r * 0.22, y - r * 0.02)
    ctx.stroke()
  } else {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(x, y - r * 0.02, r * (0.16 + i * 0.08), 0.2, 1.2)
      ctx.strokeStyle = p[2]
      ctx.lineWidth = Math.max(1, r * 0.014)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawTexture(ctx, x, y, r, species, stage, time) {
  const p = species.palette
  const shape = species.shape
  ctx.save()
  ctx.globalAlpha = 0.38
  if (shape === 'beast' || shape === 'bird' || shape === 'dragon') {
    // fur / feather strokes
    ctx.strokeStyle = shadeColor(p[0], 28)
    ctx.lineWidth = Math.max(1, r * 0.012)
    ctx.lineCap = 'round'
    const count = 8 + stage * 4
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const rr = r * (0.18 + (i % 4) * 0.055)
      const px = x + Math.cos(a) * rr
      const py = y + Math.sin(a) * rr * 0.72
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + Math.cos(a) * r * 0.045, py + Math.sin(a) * r * 0.045)
      ctx.stroke()
    }
    // belly plate
    ctx.globalAlpha = 0.24
    ctx.fillStyle = shadeColor(p[0], 40)
    ellipse(ctx, x, y + r * 0.17, r * 0.2, r * 0.12, shadeColor(p[0], 40))
  } else if (shape === 'golem') {
    ctx.strokeStyle = shadeColor(p[1], -34)
    ctx.lineWidth = Math.max(1, r * 0.018)
    const cracks = [[-0.28, -0.2, -0.16, -0.02], [0.12, -0.28, 0.22, -0.08], [-0.05, 0.06, 0.12, 0.22]]
    for (const [x1, y1, x2, y2] of cracks) {
      ctx.beginPath()
      ctx.moveTo(x + x1 * r, y + y1 * r)
      ctx.lineTo(x + x2 * r, y + y2 * r)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#5ee08a'
    for (let i = 0; i < 3; i++) {
      ellipse(ctx, x + (-0.3 + i * 0.3) * r, y + 0.25 * r, r * 0.055, r * 0.03, '#5ee08a')
    }
  } else if (shape === 'insect') {
    // segmented legs
    ctx.strokeStyle = shadeColor(p[1], -20)
    ctx.lineWidth = Math.max(1, r * 0.026)
    for (let i = 0; i < 3; i++) {
      const yy = y + r * (0.1 + i * 0.1)
      for (const d of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(x + d * r * 0.16, yy)
        ctx.lineTo(x + d * r * 0.38, yy + r * 0.12)
        ctx.lineTo(x + d * r * 0.46, yy + r * 0.28)
        ctx.stroke()
      }
    }
    // wing veins
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = shadeColor(p[2], 30)
    ctx.lineWidth = Math.max(1, r * 0.012)
    for (const d of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(x + d * r * 0.22, y - r * 0.24)
        ctx.lineTo(x + d * r * (0.42 + i * 0.05), y - r * (0.3 + i * 0.04))
        ctx.stroke()
      }
    }
  } else if (shape === 'aquatic') {
    // scales and gill lines
    ctx.strokeStyle = shadeColor(p[0], 36)
    ctx.lineWidth = Math.max(1, r * 0.014)
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(x - r * 0.16, y + r * 0.02, r * (0.1 + i * 0.07), -0.7, 0.7)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.45
    ctx.strokeStyle = shadeColor(p[1], -20)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(x + r * 0.1, y - r * 0.1 + i * r * 0.08)
      ctx.lineTo(x + r * 0.18, y - r * 0.02 + i * r * 0.08)
      ctx.stroke()
    }
  } else if (shape === 'plant') {
    // leaf veins and vine thorns
    ctx.strokeStyle = shadeColor(p[1], 42)
    ctx.lineWidth = Math.max(1, r * 0.016)
    for (const d of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x + d * r * 0.16, y + r * 0.26)
      ctx.quadraticCurveTo(x + d * r * 0.34, y + r * 0.34, x + d * r * 0.46, y + r * 0.22)
      ctx.stroke()
    }
    ctx.fillStyle = shadeColor(p[1], 20)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(x - r * 0.05, y + r * (0.34 + i * 0.06))
      ctx.lineTo(x - r * 0.12, y + r * (0.4 + i * 0.06))
      ctx.lineTo(x + r * 0.02, y + r * (0.4 + i * 0.06))
      ctx.closePath()
      ctx.fill()
    }
  } else if (shape === 'serpent') {
    // belly plates and scale rows
    ctx.fillStyle = shadeColor(p[0], 32)
    for (let i = 0; i < 5; i++) {
      const t = i / 5
      ellipse(ctx, x - r * 0.34 + t * r * 0.5, y + r * 0.32 - t * r * 0.18, r * 0.07, r * 0.035, shadeColor(p[0], 32))
    }
    ctx.strokeStyle = shadeColor(p[1], -16)
    ctx.lineWidth = Math.max(1, r * 0.014)
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(x - r * 0.18 + i * r * 0.12, y + r * 0.05 - i * r * 0.08, r * 0.055, 0.2, 2.6)
      ctx.stroke()
    }
  } else if (shape === 'spirit') {
    ctx.globalAlpha = 0.28
    ctx.strokeStyle = p[2]
    ctx.lineWidth = Math.max(1, r * 0.02)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(x + Math.sin(time + i) * r * 0.08, y + r * (0.2 + i * 0.1), r * (0.18 + i * 0.07), 0.2, 2.7)
      ctx.stroke()
    }
  } else if (shape === 'slime') {
    ctx.globalAlpha = 0.32
    ctx.fillStyle = shadeColor(p[0], 55)
    ellipse(ctx, x - r * 0.2, y - r * 0.24, r * 0.11, r * 0.065, shadeColor(p[0], 55))
    ellipse(ctx, x + r * 0.24, y + r * 0.04, r * 0.055, r * 0.035, shadeColor(p[0], 55))
    ctx.globalAlpha = 0.22
    ctx.fillStyle = p[2]
    ellipse(ctx, x + r * 0.02, y + r * 0.2, r * 0.1, r * 0.05, p[2])
  }
  ctx.restore()
}

function drawElementDetails(ctx, r, species, time) {
  const el = species.element
  const color = ELEMENTS[el]?.color || species.palette[2]
  const count = species.stage === 2 ? 9 : species.rarity === 'mitico' ? 12 : 6
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.shadowColor = color
  ctx.shadowBlur = r * 0.16
  for (let i = 0; i < count; i++) {
    const a = time * 0.55 + i * (TAU / count)
    const rr = r * (0.62 + (i % 3) * 0.13)
    const px = Math.cos(a) * rr
    const py = Math.sin(a * 1.3) * rr * 0.72 - r * 0.12
    const pulse = 0.35 + Math.sin(time * 2.2 + i) * 0.22
    ctx.globalAlpha = Math.max(0.12, pulse)
    ctx.fillStyle = color
    if (el === 'fuego') {
      ctx.beginPath()
      ctx.moveTo(px, py - r * 0.045)
      ctx.lineTo(px + r * 0.026, py + r * 0.02)
      ctx.lineTo(px - r * 0.026, py + r * 0.02)
      ctx.closePath()
      ctx.fill()
    } else if (el === 'rayo') {
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(1, r * 0.014)
      ctx.beginPath()
      ctx.moveTo(px - r * 0.03, py - r * 0.03)
      ctx.lineTo(px + r * 0.01, py)
      ctx.lineTo(px - r * 0.012, py + r * 0.03)
      ctx.stroke()
    } else if (el === 'planta') {
      ctx.beginPath()
      ctx.ellipse(px, py, r * 0.032, r * 0.016, a, 0, TAU)
      ctx.fill()
    } else if (el === 'hielo') {
      ctx.beginPath()
      ctx.moveTo(px, py - r * 0.04)
      ctx.lineTo(px + r * 0.026, py)
      ctx.lineTo(px, py + r * 0.04)
      ctx.lineTo(px - r * 0.026, py)
      ctx.closePath()
      ctx.fill()
    } else if (el === 'aire') {
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(1, r * 0.013)
      ctx.beginPath()
      ctx.arc(px, py, r * 0.035, 0.2, 2.8)
      ctx.stroke()
    } else {
      ellipse(ctx, px, py, r * 0.022, r * 0.022, color)
    }
  }
  ctx.restore()
}

function drawCreatureShape(ctx, species, r, time, opts) {
  const p = species.palette
  const stage = species.stage
  const bob = Math.sin(time * 1.8 + (opts.seed || 0)) * r * 0.014
  const shape = species.shape

  if (shape === 'beast') {
    ctx.fillStyle = p[1]
    for (const [lx, ly] of [[-0.32, 0.3], [-0.16, 0.34], [0.16, 0.34], [0.32, 0.3]]) {
      ctx.beginPath()
      ctx.roundRect(lx * r - r * 0.055, (ly + bob) * r, r * 0.12, r * 0.3, r * 0.05)
      ctx.fill()
    }
    ctx.fillStyle = bodyGradient(ctx, 0, 0, r * 0.46, r * 0.32, p)
    ellipse(ctx, 0, bob, r * 0.46, r * 0.31)
    ctx.fillStyle = bodyGradient(ctx, r * 0.34, -r * 0.26 + bob, r * 0.25, r * 0.24, p)
    ellipse(ctx, r * 0.34, -r * 0.27 + bob, r * 0.25, r * 0.23)
    ctx.fillStyle = p[1]
    for (const d of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(r * 0.34 + d * r * 0.13, -r * 0.43)
      ctx.lineTo(r * 0.34 + d * r * 0.24, -r * 0.61)
      ctx.lineTo(r * 0.34 + d * r * 0.28, -r * 0.38)
      ctx.closePath()
      ctx.fill()
    }
    drawFace(ctx, r * 0.4, -r * 0.25, r * 0.24, species, opts)
    drawTail(ctx, 0, bob, r, species, time, -1)
    drawHorns(ctx, r * 0.34, -r * 0.29, r, species, 0.9)
  } else if (shape === 'dragon') {
    drawWings(ctx, 0, 0, r, species, time, -1)
    drawWings(ctx, 0, 0, r, species, time, 1)
    ctx.fillStyle = bodyGradient(ctx, 0, 0, r * 0.4, r * 0.34, p)
    ellipse(ctx, 0, bob, r * 0.38, r * 0.32)
    ctx.strokeStyle = p[1]
    ctx.lineWidth = r * 0.15
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(r * 0.2, -r * 0.16 + bob)
    ctx.quadraticCurveTo(r * 0.34, -r * 0.42, r * 0.32, -r * 0.53 + bob)
    ctx.stroke()
    ctx.fillStyle = bodyGradient(ctx, r * 0.33, -r * 0.57, r * 0.24, r * 0.22, p)
    ellipse(ctx, r * 0.34, -r * 0.56 + bob, r * 0.24, r * 0.21)
    ctx.fillStyle = p[1]
    for (const d of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(r * 0.35 + d * r * 0.11, -r * 0.73)
      ctx.lineTo(r * 0.35 + d * r * 0.21, -r * 0.92)
      ctx.lineTo(r * 0.35 + d * r * 0.25, -r * 0.69)
      ctx.closePath()
      ctx.fill()
    }
    drawFace(ctx, r * 0.39, -r * 0.55, r * 0.23, species, opts)
    drawTail(ctx, 0, bob, r, species, time, -1)
    ctx.fillStyle = p[2]
    for (let i = 0; i < 3 + stage; i++) {
      ctx.beginPath()
      ctx.moveTo(-r * 0.2 + i * r * 0.12, -r * 0.26)
      ctx.lineTo(-r * 0.15 + i * r * 0.12, -r * 0.4 - i * r * 0.02)
      ctx.lineTo(-r * 0.1 + i * r * 0.12, -r * 0.26)
      ctx.closePath()
      ctx.fill()
    }
  } else if (shape === 'bird') {
    drawWings(ctx, 0, -r * 0.02, r * 1.05, species, time, -1)
    drawWings(ctx, 0, -r * 0.02, r * 1.05, species, time, 1)
    ctx.fillStyle = bodyGradient(ctx, 0, 0, r * 0.34, r * 0.4, p)
    ellipse(ctx, 0, bob, r * 0.34, r * 0.4)
    ctx.fillStyle = bodyGradient(ctx, 0, -r * 0.4 + bob, r * 0.22, r * 0.2, p)
    ellipse(ctx, 0, -r * 0.4 + bob, r * 0.22, r * 0.2)
    ctx.fillStyle = p[2]
    ctx.beginPath()
    ctx.moveTo(-r * 0.06, -r * 0.36)
    ctx.lineTo(r * 0.24, -r * 0.3)
    ctx.lineTo(-r * 0.05, -r * 0.24)
    ctx.closePath()
    ctx.fill()
    drawFace(ctx, 0, -r * 0.43, r * 0.21, species, opts)
    ctx.fillStyle = p[2]
    for (let i = -1; i <= 1; i++) {
      ctx.save()
      ctx.translate(i * r * 0.12, r * 0.34)
      ctx.rotate(i * 0.22)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(-r * 0.05, r * 0.28, r * 0.02, r * 0.4)
      ctx.quadraticCurveTo(r * 0.1, r * 0.2, 0, 0)
      ctx.fill()
      ctx.restore()
    }
    ctx.strokeStyle = p[2]
    ctx.lineWidth = r * 0.035
    for (const d of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(d * r * 0.09, r * 0.33)
      ctx.lineTo(d * r * 0.12, r * 0.52)
      ctx.stroke()
    }
  } else if (shape === 'slime') {
    const squish = Math.sin(time * 2.1) * 0.025
    ctx.fillStyle = bodyGradient(ctx, 0, 0, r * 0.54, r * 0.4, p)
    ctx.beginPath()
    ctx.moveTo(-r * 0.52, r * 0.28)
    ctx.bezierCurveTo(-r * 0.58, -r * 0.25, -r * 0.25, -r * 0.52, 0, -r * 0.48)
    ctx.bezierCurveTo(r * 0.28, -r * 0.52, r * 0.58, -r * 0.2, r * 0.52, r * 0.3)
    ctx.quadraticCurveTo(r * 0.32, r * 0.42 + squish * r, 0, r * 0.38)
    ctx.quadraticCurveTo(-r * 0.32, r * 0.44 - squish * r, -r * 0.52, r * 0.28)
    ctx.fill()
    ctx.globalAlpha = 0.45
    ctx.fillStyle = p[2]
    ellipse(ctx, -r * 0.18, -r * 0.2, r * 0.12, r * 0.08, p[2])
    ellipse(ctx, r * 0.2, r * 0.05, r * 0.06, r * 0.04, p[2])
    ctx.globalAlpha = 1
    drawFace(ctx, 0, -r * 0.04, r * 0.4, species, opts)
  } else if (shape === 'golem') {
    ctx.fillStyle = p[1]
    ctx.beginPath()
    ctx.roundRect(-r * 0.34, -r * 0.08, r * 0.22, r * 0.42, r * 0.06)
    ctx.roundRect(r * 0.12, -r * 0.08, r * 0.22, r * 0.42, r * 0.06)
    ctx.roundRect(-r * 0.42, r * 0.28, r * 0.25, r * 0.18, r * 0.06)
    ctx.roundRect(r * 0.17, r * 0.28, r * 0.25, r * 0.18, r * 0.06)
    ctx.fill()
    ctx.fillStyle = bodyGradient(ctx, 0, -r * 0.05, r * 0.45, r * 0.42, p)
    ctx.beginPath()
    ctx.roundRect(-r * 0.4, -r * 0.38, r * 0.8, r * 0.66, r * 0.13)
    ctx.fill()
    ctx.fillStyle = bodyGradient(ctx, 0, -r * 0.54, r * 0.25, r * 0.22, p)
    ctx.beginPath()
    ctx.roundRect(-r * 0.25, -r * 0.7, r * 0.5, r * 0.36, r * 0.1)
    ctx.fill()
    // crystal core
    ctx.fillStyle = p[2]
    ctx.shadowColor = p[2]
    ctx.shadowBlur = r * 0.25
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.25)
    ctx.lineTo(r * 0.13, -r * 0.08)
    ctx.lineTo(0, r * 0.12)
    ctx.lineTo(-r * 0.13, -r * 0.08)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    drawFace(ctx, 0, -r * 0.53, r * 0.22, species, opts)
    ctx.strokeStyle = p[2]
    ctx.globalAlpha = 0.4
    ctx.lineWidth = r * 0.02
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(-r * 0.3 + i * r * 0.25, -r * 0.33)
      ctx.lineTo(-r * 0.22 + i * r * 0.25, -r * 0.12)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  } else if (shape === 'spirit') {
    ctx.globalAlpha = 0.88
    ctx.fillStyle = bodyGradient(ctx, 0, -r * 0.08, r * 0.36, r * 0.44, p)
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.55)
    ctx.bezierCurveTo(r * 0.45, -r * 0.45, r * 0.42, r * 0.05, r * 0.18, r * 0.16)
    ctx.quadraticCurveTo(r * 0.08, r * 0.45, -r * 0.04, r * 0.28)
    ctx.quadraticCurveTo(-r * 0.2, r * 0.48, -r * 0.22, r * 0.15)
    ctx.bezierCurveTo(-r * 0.46, -r * 0.1, -r * 0.36, -r * 0.5, 0, -r * 0.55)
    ctx.fill()
    ctx.globalAlpha = 1
    // mask
    ctx.fillStyle = p[2]
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.22, r * 0.26, r * 0.18, 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
    drawFace(ctx, 0, -r * 0.24, r * 0.23, species, opts)
    for (let i = 0; i < 4 + stage * 2; i++) {
      const a = time * 0.7 + i * 1.7
      const px = Math.cos(a) * r * (0.45 + (i % 3) * 0.1)
      const py = Math.sin(a * 1.2) * r * 0.45 - r * 0.15
      ctx.globalAlpha = 0.4 + Math.sin(time * 2 + i) * 0.2
      ellipse(ctx, px, py, r * 0.025, r * 0.025, p[2])
    }
    ctx.globalAlpha = 1
  } else if (shape === 'insect') {
    ctx.fillStyle = p[1]
    for (let i = 0; i < 3; i++) {
      const y = r * (0.1 + i * 0.09)
      for (const d of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(d * r * 0.16, y)
        ctx.lineTo(d * r * 0.45, y + r * 0.2)
        ctx.lineTo(d * r * 0.18, y + r * 0.04)
        ctx.closePath()
        ctx.fill()
      }
    }
    // wings
    ctx.globalAlpha = 0.34
    ctx.fillStyle = p[2]
    for (const d of [-1, 1]) {
      ctx.save()
      ctx.scale(d, 1)
      ctx.rotate(-0.25 + Math.sin(time * 8) * 0.06)
      ctx.beginPath()
      ctx.ellipse(r * 0.34, -r * 0.24, r * 0.4, r * 0.2, -0.2, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = bodyGradient(ctx, 0, 0, r * 0.24, r * 0.36, p)
    ellipse(ctx, 0, r * 0.04, r * 0.24, r * 0.36)
    ellipse(ctx, 0, -r * 0.34, r * 0.2, r * 0.18, bodyGradient(ctx, 0, -r * 0.34, r * 0.2, r * 0.18, p))
    drawFace(ctx, 0, -r * 0.35, r * 0.19, species, opts)
    ctx.strokeStyle = p[2]
    ctx.lineWidth = r * 0.025
    for (const d of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(d * r * 0.08, -r * 0.48)
      ctx.quadraticCurveTo(d * r * 0.28, -r * 0.72, d * r * 0.36, -r * 0.55)
      ctx.stroke()
    }
    ctx.fillStyle = p[2]
    for (let i = 0; i < 3; i++) ellipse(ctx, 0, -r * 0.05 + i * r * 0.15, r * 0.06, r * 0.06, p[2])
  } else if (shape === 'aquatic') {
    drawTail(ctx, 0, r * 0.05, r * 1.15, species, time, -1)
    ctx.fillStyle = bodyGradient(ctx, 0, 0, r * 0.46, r * 0.32, p)
    ctx.beginPath()
    ctx.ellipse(0, bob, r * 0.48, r * 0.32, -0.06, 0, TAU)
    ctx.fill()
    ctx.fillStyle = p[2]
    ctx.beginPath()
    ctx.moveTo(-r * 0.1, -r * 0.2)
    ctx.lineTo(0, -r * 0.55)
    ctx.lineTo(r * 0.16, -r * 0.18)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = p[1]
    ctx.beginPath()
    ctx.moveTo(-r * 0.2, r * 0.2)
    ctx.lineTo(-r * 0.05, r * 0.45)
    ctx.lineTo(r * 0.12, r * 0.2)
    ctx.closePath()
    ctx.fill()
    drawFace(ctx, r * 0.27, -r * 0.02, r * 0.28, species, opts)
    ctx.strokeStyle = p[2]
    ctx.globalAlpha = 0.45
    ctx.lineWidth = r * 0.02
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(-r * 0.15, 0, r * (0.12 + i * 0.07), -0.6, 0.6)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  } else if (shape === 'plant') {
    // leaves / legs
    ctx.fillStyle = p[1]
    for (const d of [-1, 1]) {
      ctx.save()
      ctx.translate(d * r * 0.18, r * 0.24)
      ctx.rotate(d * 0.5)
      ctx.beginPath()
      ctx.ellipse(d * r * 0.16, 0, r * 0.26, r * 0.11, 0, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = bodyGradient(ctx, 0, 0, r * 0.38, r * 0.36, p)
    ellipse(ctx, 0, -r * 0.02, r * 0.38, r * 0.36)
    // petals
    const petals = 5 + stage * 2
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU + Math.sin(time * 0.6) * 0.04
      ctx.save()
      ctx.rotate(a)
      ctx.fillStyle = i % 2 ? p[0] : p[2]
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.ellipse(0, -r * 0.42, r * 0.14, r * 0.3, 0, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
    ctx.globalAlpha = 1
    drawFace(ctx, 0, -r * 0.02, r * 0.3, species, opts)
    ctx.strokeStyle = p[1]
    ctx.lineWidth = r * 0.06
    ctx.beginPath()
    ctx.moveTo(0, r * 0.3)
    ctx.quadraticCurveTo(r * 0.08, r * 0.5, r * 0.02, r * 0.6)
    ctx.stroke()
  } else if (shape === 'serpent') {
    ctx.strokeStyle = p[1]
    ctx.lineWidth = r * 0.22
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-r * 0.34, r * 0.34)
    ctx.bezierCurveTo(-r * 0.62, r * 0.02, r * 0.28, r * 0.18, r * 0.12, -r * 0.16)
    ctx.bezierCurveTo(-r * 0.02, -r * 0.46, r * 0.3, -r * 0.44, r * 0.34, -r * 0.52)
    ctx.stroke()
    ctx.strokeStyle = p[0]
    ctx.lineWidth = r * 0.16
    ctx.beginPath()
    ctx.moveTo(-r * 0.34, r * 0.34)
    ctx.bezierCurveTo(-r * 0.62, r * 0.02, r * 0.28, r * 0.18, r * 0.12, -r * 0.16)
    ctx.bezierCurveTo(-r * 0.02, -r * 0.46, r * 0.3, -r * 0.44, r * 0.34, -r * 0.52)
    ctx.stroke()
    ctx.fillStyle = bodyGradient(ctx, r * 0.36, -r * 0.56, r * 0.23, r * 0.2, p)
    ellipse(ctx, r * 0.36, -r * 0.56, r * 0.23, r * 0.2)
    drawFace(ctx, r * 0.4, -r * 0.56, r * 0.2, species, opts)
    drawHorns(ctx, r * 0.36, -r * 0.58, r, species, 0.75)
    ctx.fillStyle = p[2]
    for (let i = 0; i < 4; i++) {
      const t = i / 4
      const sx = -r * 0.1 + t * r * 0.28
      const sy = r * 0.06 - t * r * 0.18
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx + r * 0.06, sy - r * 0.1)
      ctx.lineTo(sx + r * 0.1, sy)
      ctx.closePath()
      ctx.fill()
    }
  }

  drawTexture(ctx, 0, 0, r, species, stage, time)
  drawPattern(ctx, 0, 0, r, species, stage)
  // shimmering top highlight
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.1 + Math.sin(time * 1.3) * 0.03
  ellipse(ctx, -r * 0.18, -r * 0.4, r * 0.18, r * 0.08, p[2])
  ctx.restore()
}

export function drawCreature(ctx, speciesId, x, y, scale = 1, opts = {}) {
  const species = CREATURE_BY_ID[speciesId]
  if (!species) return
  const time = opts.time ?? performance.now() / 1000
  const r = 52 * scale
  const flip = opts.flip ? -1 : 1
  const alpha = opts.alpha ?? 1
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(flip, 1)
  ctx.globalAlpha = alpha

  if (opts.shadow !== false) {
    ctx.save()
    ctx.globalAlpha = alpha * 0.28
    const g = ctx.createRadialGradient(0, r * 0.62, 0, 0, r * 0.62, r * 0.58)
    g.addColorStop(0, 'rgba(0,0,0,.7)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ellipse(ctx, 0, r * 0.62, r * 0.55, r * 0.14, g)
    ctx.restore()
  }

  if (opts.aura !== false) aura(ctx, 0, 0, r, species, time, opts.auraIntensity ?? 1)

  if (opts.silhouette) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.filter = 'brightness(0) saturate(0)'
    drawCreatureShape(ctx, species, r, time, { ...opts, facing: 1 })
    ctx.restore()
    ctx.restore()
    return
  }

  // Chunky dark contour, like a classic handheld monster sprite.
  const outline = opts.outline ?? (r > 40)
  if (outline) {
    ctx.save()
    ctx.filter = 'brightness(0) saturate(0)'
    ctx.globalAlpha = alpha * 0.92
    ctx.translate(0, r * 0.012)
    ctx.scale(1.055, 1.055)
    drawCreatureShape(ctx, species, r, time, { ...opts, facing: 1 })
    ctx.restore()
  }

  drawCreatureShape(ctx, species, r, time, { ...opts, facing: 1 })
  if (opts.elementFx !== false) drawElementDetails(ctx, r, species, time)

  if (opts.sparkles !== false) {
    const n = species.rarity === 'legendario' || species.rarity === 'mitico' ? 8 : species.stage === 2 ? 4 : 2
    for (let i = 0; i < n; i++) {
      const a = time * 0.8 + i * 2.4
      const px = Math.cos(a) * r * (0.6 + (i % 3) * 0.18)
      const py = Math.sin(a * 1.4) * r * 0.6 - r * 0.12
      ctx.globalAlpha = 0.35 + Math.sin(time * 2 + i * 2) * 0.25
      ellipse(ctx, px, py, r * 0.018, r * 0.018, species.palette[2])
    }
  }
  ctx.restore()
}

const thumbCache = new Map()
export function creatureDataURL(speciesId, size = 128) {
  const key = `${speciesId}_${size}`
  if (thumbCache.has(key)) return thumbCache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  drawCreature(ctx, speciesId, size / 2, size * 0.52, size / 130, { aura: false, shadow: false, sparkles: false, time: 1 })
  const url = canvas.toDataURL('image/png')
  thumbCache.set(key, url)
  return url
}

function drawPine(ctx, x, y, s, color, snow = false) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(0,0,0,.18)'
  ellipse(ctx, s * 0.12, s * 0.1, s * 0.52, s * 0.13, 'rgba(0,0,0,.2)')
  ctx.fillStyle = '#3b2a1c'
  ctx.fillRect(-s * 0.035, -s * 0.1, s * 0.07, s * 0.38)
  ctx.fillStyle = color
  for (let i = 0; i < 3; i++) {
    const yy = -s * (0.15 + i * 0.24)
    const ww = s * (0.45 - i * 0.1)
    ctx.beginPath()
    ctx.moveTo(0, yy - s * 0.36)
    ctx.lineTo(ww, yy + s * 0.08)
    ctx.lineTo(-ww, yy + s * 0.08)
    ctx.closePath()
    ctx.fill()
    if (snow) {
      ctx.fillStyle = 'rgba(235,248,255,.6)'
      ctx.beginPath()
      ctx.moveTo(0, yy - s * 0.36)
      ctx.lineTo(ww * 0.6, yy - s * 0.06)
      ctx.lineTo(-ww * 0.6, yy - s * 0.06)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = color
    }
  }
  ctx.restore()
}

function drawTree(ctx, x, y, s, colors) {
  ctx.save()
  ctx.translate(x, y)
  ellipse(ctx, s * 0.1, s * 0.14, s * 0.58, s * 0.16, 'rgba(0,0,0,.2)')
  ctx.strokeStyle = colors[1]
  ctx.lineWidth = s * 0.1
  ctx.beginPath()
  ctx.moveTo(0, s * 0.2)
  ctx.quadraticCurveTo(-s * 0.04, -s * 0.15, s * 0.06, -s * 0.45)
  ctx.stroke()
  const blobs = [[-0.24, -0.55, 0.3], [0.22, -0.52, 0.28], [0, -0.76, 0.3], [-0.1, -0.38, 0.25]]
  for (const [bx, by, br] of blobs) {
    ctx.fillStyle = colors[Math.abs(Math.floor((bx + by) * 10)) % 2 ? 2 : 3]
    ellipse(ctx, bx * s, by * s, br * s, br * s * 0.78)
  }
  ctx.restore()
}

function drawCrystal(ctx, x, y, s, color, alpha = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = alpha
  ctx.shadowColor = color
  ctx.shadowBlur = s * 0.5
  const g = ctx.createLinearGradient(0, -s, 0, s)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.25, color)
  g.addColorStop(1, shadeColor(color, -70))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(0, -s)
  ctx.lineTo(s * 0.35, -s * 0.1)
  ctx.lineTo(s * 0.18, s * 0.55)
  ctx.lineTo(-s * 0.18, s * 0.55)
  ctx.lineTo(-s * 0.35, -s * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.globalAlpha = alpha * 0.4
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.9)
  ctx.lineTo(s * 0.1, -s * 0.05)
  ctx.lineTo(-s * 0.06, s * 0.2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawBuilding(ctx, poi) {
  const { x, y } = poi
  ctx.save()
  ctx.translate(x, y)
  if (poi.type === 'ranch') {
    ellipse(ctx, 0, 42, 120, 25, 'rgba(0,0,0,.25)')
    // fence
    ctx.strokeStyle = '#9b6b3e'
    ctx.lineWidth = 7
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath()
      ctx.moveTo(i * 28, 22)
      ctx.lineTo(i * 28, 58)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(-125, 30); ctx.lineTo(125, 30)
    ctx.moveTo(-125, 48); ctx.lineTo(125, 48)
    ctx.stroke()
    // house
    ctx.fillStyle = '#c99558'
    ctx.fillRect(-66, -62, 132, 90)
    ctx.fillStyle = '#f2dfb6'
    ctx.fillRect(-54, -48, 108, 65)
    ctx.fillStyle = '#6b3f28'
    ctx.beginPath()
    ctx.moveTo(-82, -62)
    ctx.lineTo(0, -122)
    ctx.lineTo(82, -62)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ffd166'
    ctx.fillRect(-16, -18, 32, 44)
    ctx.fillStyle = '#3b2a1c'
    ctx.fillRect(-12, -14, 24, 40)
    ctx.fillStyle = '#7dd3fc'
    ctx.fillRect(-46, -36, 20, 20)
    ctx.fillRect(26, -36, 20, 20)
    // windmill
    ctx.translate(96, -32)
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(-3, -42, 6, 80)
    ctx.save()
    ctx.rotate(performance.now() / 5000)
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, -5, 46, 10)
      ctx.fillStyle = 'rgba(255,255,255,.3)'
      ctx.fillRect(6, -3, 36, 4)
    }
    ctx.restore()
  } else if (poi.type === 'arena') {
    ellipse(ctx, 0, 30, 150, 42, 'rgba(0,0,0,.28)')
    const g = ctx.createLinearGradient(0, -100, 0, 50)
    g.addColorStop(0, '#dff8ff')
    g.addColorStop(0.5, '#8bd8e8')
    g.addColorStop(1, '#2d6b7a')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(0, 0, 132, 76, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 9
    ctx.stroke()
    ctx.fillStyle = '#0e3a4a'
    ctx.beginPath()
    ctx.ellipse(0, 4, 92, 46, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#a5f3fc'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(0, 4, 76, 37, 0, 0, TAU)
    ctx.stroke()
    // pillars
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU
      ctx.fillStyle = '#e0f2fe'
      ctx.fillRect(Math.cos(a) * 118 - 4, Math.sin(a) * 64 - 22, 8, 36)
    }
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.moveTo(0, -96)
    ctx.lineTo(9, -80)
    ctx.lineTo(0, -70)
    ctx.lineTo(-9, -80)
    ctx.closePath()
    ctx.fill()
  } else if (poi.type === 'village') {
    ellipse(ctx, 0, 40, 130, 28, 'rgba(0,0,0,.24)')
    const tents = [[-64, -6, '#d97706'], [22, -18, '#7c3aed'], [76, 4, '#0e7490']]
    for (const [tx, ty, color] of tents) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(tx - 40, ty + 36)
      ctx.lineTo(tx, ty - 54)
      ctx.lineTo(tx + 40, ty + 36)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,.22)'
      ctx.beginPath()
      ctx.moveTo(tx, ty - 54)
      ctx.lineTo(tx + 14, ty + 36)
      ctx.lineTo(tx, ty + 36)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#3b2a1c'
      ctx.fillRect(tx - 9, ty + 12, 18, 24)
    }
    ctx.fillStyle = '#fbbf24'
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(-100 + i * 42, 28 + Math.sin(i) * 8, 3, 0, TAU)
      ctx.fill()
    }
  } else if (poi.type === 'dungeon') {
    ctx.save()
    const glow = 0.4 + Math.sin(performance.now() / 900 + x) * 0.12
    const g = ctx.createRadialGradient(0, -18, 4, 0, -18, 72)
    g.addColorStop(0, poi.color)
    g.addColorStop(0.45, `${poi.color}55`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = glow
    ellipse(ctx, 0, -20, 76, 82, g)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#1b2230'
    ctx.strokeStyle = '#48556b'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(-54, 38)
    ctx.lineTo(-54, -28)
    ctx.quadraticCurveTo(0, -108, 54, -28)
    ctx.lineTo(54, 38)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = poi.color
    ctx.globalAlpha = 0.72
    ctx.beginPath()
    ctx.ellipse(0, -4, 35, 50, 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = '#2b3445'
    ctx.fillRect(-66, 32, 22, 34)
    ctx.fillRect(44, 32, 22, 34)
    // runes
    ctx.strokeStyle = poi.color
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(0, -6, 12 + i * 7, 0.4 + i, 2.2 + i)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }
  ctx.restore()
}

let worldCanvas = null
let worldCanvasSeed = null
export function buildWorldCanvas(seed = 1) {
  if (worldCanvas && worldCanvasSeed === seed) return worldCanvas
  const canvas = document.createElement('canvas')
  canvas.width = WORLD.w
  canvas.height = WORLD.h
  const ctx = canvas.getContext('2d')
  const rng = seeded(seed)
  ctx.fillStyle = '#0c1820'
  ctx.fillRect(0, 0, WORLD.w, WORLD.h)

  // soft biome fields
  for (const zone of ZONES) {
    const g = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.r)
    g.addColorStop(0, zone.palette[2])
    g.addColorStop(0.55, zone.palette[1])
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 0.95
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(zone.x, zone.y, zone.r, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // terrain speckles
  for (let i = 0; i < 12000; i++) {
    const x = rng() * WORLD.w
    const y = rng() * WORLD.h
    let best = ZONES[0]
    let bd = Infinity
    for (const z of ZONES) {
      const d = Math.hypot(x - z.x, y - z.y) / z.r
      if (d < bd) { bd = d; best = z }
    }
    if (bd > 1.25) continue
    const alpha = 0.04 + rng() * 0.1
    ctx.fillStyle = best.palette[2]
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.ellipse(x, y, 2 + rng() * 18, 1 + rng() * 7, rng() * TAU, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // ---------- procedural terrain features ----------
  // Meandering streams: their course changes with the world seed.
  for (let r = 0; r < 2; r++) {
    const startX = r === 0 ? 120 + rng() * 620 : 2420 + rng() * 660
    const endX = startX + (rng() - 0.5) * 1100
    const midX = (startX + endX) / 2 + (rng() - 0.5) * 700
    const midY = 620 + rng() * 900
    ctx.save()
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = '#0b5b70'
    ctx.lineWidth = 20 + rng() * 16
    ctx.beginPath()
    ctx.moveTo(startX, -40)
    ctx.bezierCurveTo(startX + (rng() - 0.5) * 420, midY * 0.35, midX, midY * 0.7, midX, midY)
    ctx.bezierCurveTo(midX + (rng() - 0.5) * 420, midY + 320, endX, midY + 430, endX, WORLD.h + 40)
    ctx.stroke()
    ctx.globalAlpha = 0.22
    ctx.strokeStyle = '#8be9f7'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()
  }

  // Ponds and clearings, seeded away from settlements.
  for (let i = 0; i < 6; i++) {
    const zone = ZONES[Math.floor(rng() * ZONES.length)]
    const a = rng() * TAU
    const d = Math.sqrt(rng()) * zone.r * 0.72
    const x = zone.x + Math.cos(a) * d
    const y = zone.y + Math.sin(a) * d
    if (POIS.some(poi => Math.hypot(x - poi.x, y - poi.y) < 210)) continue
    const rx = 34 + rng() * 74
    const ry = rx * (0.42 + rng() * 0.24)
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.fillStyle = zone.id === 'desierto' ? '#6f5228' : '#124b58'
    ellipse(ctx, x, y, rx + 7, ry + 5, ctx.fillStyle)
    ctx.globalAlpha = 0.82
    ctx.fillStyle = zone.id === 'desierto' ? '#c49a52' : '#2b9fb0'
    ellipse(ctx, x, y, rx, ry, ctx.fillStyle)
    ctx.globalAlpha = 0.28
    ctx.strokeStyle = '#d9fbff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(x, y, rx * 0.62, ry * 0.58, 0, 0.2, 2.8)
    ctx.stroke()
    ctx.restore()
  }

  // Scattered standing stones / ruins make every seed feel different.
  for (let i = 0; i < 9; i++) {
    const zone = ZONES[Math.floor(rng() * ZONES.length)]
    const a = rng() * TAU
    const d = Math.sqrt(rng()) * zone.r * 0.78
    const cx = zone.x + Math.cos(a) * d
    const cy = zone.y + Math.sin(a) * d
    if (POIS.some(poi => Math.hypot(cx - poi.x, cy - poi.y) < 260)) continue
    const count = 3 + Math.floor(rng() * 4)
    const stoneColor = zone.id === 'desierto' ? '#d8b06a' : zone.id === 'cumbre' ? '#9fb6c9' : '#6f7f86'
    for (let k = 0; k < count; k++) {
      const ang = (k / count) * TAU + rng() * 0.4
      const sx = cx + Math.cos(ang) * (26 + rng() * 26)
      const sy = cy + Math.sin(ang) * (18 + rng() * 18)
      const h = 22 + rng() * 44
      ctx.save()
      ctx.globalAlpha = 0.55 + rng() * 0.25
      ctx.fillStyle = stoneColor
      ctx.beginPath()
      ctx.moveTo(sx - 7, sy)
      ctx.lineTo(sx - 4, sy - h)
      ctx.lineTo(sx + 4, sy - h)
      ctx.lineTo(sx + 8, sy)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#d9fbff'
      ctx.fillRect(sx - 2, sy - h * 0.7, 2, h * 0.4)
      ctx.restore()
    }
  }

  // river / coastline
  ctx.save()
  const water = ctx.createLinearGradient(0, 1500, 0, 2400)
  water.addColorStop(0, '#155e75')
  water.addColorStop(0.5, '#0e7490')
  water.addColorStop(1, '#083344')
  ctx.fillStyle = water
  ctx.beginPath()
  ctx.moveTo(0, 2070)
  ctx.bezierCurveTo(480, 1930, 900, 2110, 1320, 2010)
  ctx.bezierCurveTo(1750, 1900, 2180, 2080, 2600, 1980)
  ctx.bezierCurveTo(2900, 1920, 3100, 2040, 3200, 1990)
  ctx.lineTo(3200, 2400)
  ctx.lineTo(0, 2400)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 0.22
  ctx.strokeStyle = '#c7f5ff'
  ctx.lineWidth = 2
  for (let i = 0; i < 28; i++) {
    const y = 2040 + i * 12
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= 3200; x += 80) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 7)
    ctx.stroke()
  }
  ctx.restore()

  // paths between important places
  const pathPoints = [
    [1290, 1270], [1470, 1530], [1850, 1350], [1500, 1330], [690, 800], [2490, 1060], [1760, 1930], [650, 1690], [1720, 490], [520, 610], [2550, 870], [1870, 2090], [1710, 260], [560, 1850],
  ]
  ctx.save()
  ctx.strokeStyle = '#b08a5a'
  ctx.lineWidth = 24
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.34
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const [x1, y1] = pathPoints[i]
    const [x2, y2] = pathPoints[i + 1]
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.quadraticCurveTo((x1 + x2) / 2 + Math.sin(i) * 60, (y1 + y2) / 2 + Math.cos(i) * 60, x2, y2)
    ctx.stroke()
  }
  ctx.strokeStyle = '#d4b184'
  ctx.lineWidth = 8
  ctx.globalAlpha = 0.25
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const [x1, y1] = pathPoints[i]
    const [x2, y2] = pathPoints[i + 1]
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.quadraticCurveTo((x1 + x2) / 2 + Math.sin(i) * 60, (y1 + y2) / 2 + Math.cos(i) * 60, x2, y2)
    ctx.stroke()
  }
  ctx.restore()

  // biome decoration
  for (const zone of ZONES) {
    if (zone.id === 'bosque') {
      for (let i = 0; i < 260; i++) {
        const a = rng() * TAU
        const d = Math.sqrt(rng()) * zone.r * 0.92
        const x = zone.x + Math.cos(a) * d
        const y = zone.y + Math.sin(a) * d
        if (Math.hypot(x - 1290, y - 1270) < 120 || Math.hypot(x - 520, y - 610) < 140) continue
        const s = 34 + rng() * 44
        drawTree(ctx, x, y, s, ['#1f4a32', '#3b2a1c', '#24573a', '#2f6b43'])
      }
      for (let i = 0; i < 70; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * zone.r
        drawCrystal(ctx, zone.x + Math.cos(a) * d, zone.y + Math.sin(a) * d, 6 + rng() * 8, '#a78bfa', 0.32)
      }
    } else if (zone.id === 'pradera') {
      for (let i = 0; i < 350; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * zone.r * 0.95
        const x = zone.x + Math.cos(a) * d, y = zone.y + Math.sin(a) * d
        if (Math.hypot(x - 1290, y - 1270) < 130) continue
        ctx.strokeStyle = rng() > 0.5 ? '#7aa65a' : '#5f8a48'
        ctx.globalAlpha = 0.55
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.quadraticCurveTo(x + 3, y - 7, x + (rng() - 0.5) * 7, y - 13)
        ctx.stroke()
        if (rng() > 0.78) {
          ctx.fillStyle = ['#ffd166', '#fca5a5', '#c4b5fd', '#f8fafc'][Math.floor(rng() * 4)]
          ellipse(ctx, x + 3, y - 12, 2.2, 2.2, ctx.fillStyle)
        }
      }
      ctx.globalAlpha = 1
    } else if (zone.id === 'desierto') {
      for (let i = 0; i < 55; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * zone.r
        const x = zone.x + Math.cos(a) * d, y = zone.y + Math.sin(a) * d
        ctx.strokeStyle = '#e7bd77'
        ctx.globalAlpha = 0.16
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, 16 + rng() * 50, 0.1, 1.9)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      for (let i = 0; i < 25; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * zone.r
        drawCrystal(ctx, zone.x + Math.cos(a) * d, zone.y + Math.sin(a) * d, 8 + rng() * 10, '#fbbf24', 0.28)
      }
    } else if (zone.id === 'cumbre') {
      for (let i = 0; i < 120; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * zone.r * 0.95
        const x = zone.x + Math.cos(a) * d, y = zone.y + Math.sin(a) * d
        if (Math.hypot(x - 1710, y - 260) < 120) continue
        drawPine(ctx, x, y, 20 + rng() * 32, '#34536b', true)
      }
      for (let i = 0; i < 45; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * zone.r
        drawCrystal(ctx, zone.x + Math.cos(a) * d, zone.y + Math.sin(a) * d, 10 + rng() * 12, '#bae6fd', 0.4)
      }
    } else if (zone.id === 'caverna') {
      // rocky cave mouth / boulders
      for (let i = 0; i < 45; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * zone.r
        const x = zone.x + Math.cos(a) * d, y = zone.y + Math.sin(a) * d
        ctx.fillStyle = '#29264a'
        ctx.beginPath()
        ctx.ellipse(x, y, 18 + rng() * 30, 12 + rng() * 20, rng() * TAU, 0, TAU)
        ctx.fill()
      }
      for (let i = 0; i < 55; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * zone.r
        drawCrystal(ctx, zone.x + Math.cos(a) * d, zone.y + Math.sin(a) * d, 7 + rng() * 16, ['#c084fc', '#7dd3fc', '#fbbf24'][Math.floor(rng() * 3)], 0.55)
      }
    } else if (zone.id === 'costa') {
      for (let i = 0; i < 70; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * zone.r
        drawCrystal(ctx, zone.x + Math.cos(a) * d, zone.y + Math.sin(a) * d, 5 + rng() * 12, '#a5f3fc', 0.28)
      }
    }
  }

  // border cliffs
  ctx.strokeStyle = '#080f16'
  ctx.lineWidth = 110
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h)
  ctx.strokeStyle = '#1a2a33'
  ctx.lineWidth = 10
  ctx.strokeRect(58, 58, WORLD.w - 116, WORLD.h - 116)

  // buildings and dungeon gates
  for (const poi of POIS) drawBuilding(ctx, poi)

  worldCanvas = canvas
  worldCanvasSeed = seed
  return canvas
}

export function drawPlayer(ctx, x, y, time, dir = 'down', moving = false) {
  ctx.save()
  ctx.translate(x, y)
  const bob = moving ? Math.sin(time * 9) * 2.5 : Math.sin(time * 2) * 1.2
  const flip = dir === 'left' ? -1 : 1
  ctx.scale(flip, 1)
  ellipse(ctx, 0, 25, 19, 6, 'rgba(0,0,0,.32)')
  // cloak
  const g = ctx.createLinearGradient(0, -24, 0, 30)
  g.addColorStop(0, '#2dd4bf')
  g.addColorStop(0.55, '#0f766e')
  g.addColorStop(1, '#134e4a')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(-15, -14 + bob)
  ctx.quadraticCurveTo(-24, 14, -17, 26)
  ctx.quadraticCurveTo(0, 33, 17, 26)
  ctx.quadraticCurveTo(24, 14, 15, -14 + bob)
  ctx.closePath()
  ctx.fill()
  // scarf
  ctx.fillStyle = '#fbbf24'
  ctx.beginPath()
  ctx.moveTo(-11, -12 + bob)
  ctx.quadraticCurveTo(0, -8 + bob, 11, -12 + bob)
  ctx.lineTo(9, -5 + bob)
  ctx.quadraticCurveTo(0, -1 + bob, -9, -5 + bob)
  ctx.closePath()
  ctx.fill()
  // head
  ctx.fillStyle = '#e9b98e'
  ellipse(ctx, 0, -24 + bob, 11, 11.5, '#e9b98e')
  // hair
  ctx.fillStyle = '#3b2419'
  ctx.beginPath()
  ctx.arc(0, -26 + bob, 11.5, Math.PI, TAU)
  ctx.quadraticCurveTo(12, -22 + bob, 8, -18 + bob)
  ctx.quadraticCurveTo(3, -24 + bob, -2, -18 + bob)
  ctx.quadraticCurveTo(-8, -23 + bob, -11, -18 + bob)
  ctx.closePath()
  ctx.fill()
  // eyes
  ctx.fillStyle = '#111827'
  ellipse(ctx, -4, -23 + bob, 1.5, 1.8, '#111827')
  ellipse(ctx, 4, -23 + bob, 1.5, 1.8, '#111827')
  // lantern
  ctx.fillStyle = '#fbbf24'
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 12
  ellipse(ctx, 16, 3 + bob, 3.5, 4.5, '#fbbf24')
  ctx.shadowBlur = 0
  ctx.restore()
}

export function drawNPC(ctx, npc, time, near = false) {
  ctx.save()
  ctx.translate(npc.x, npc.y)
  const bob = Math.sin(time * 1.8 + npc.x) * 1.4
  ellipse(ctx, 0, 22, 17, 6, 'rgba(0,0,0,.3)')
  ctx.fillStyle = npc.color
  ctx.beginPath()
  ctx.moveTo(-13, -12 + bob)
  ctx.quadraticCurveTo(-18, 10, -14, 24)
  ctx.quadraticCurveTo(0, 28, 14, 24)
  ctx.quadraticCurveTo(18, 10, 13, -12 + bob)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#e9b98e'
  ellipse(ctx, 0, -21 + bob, 10, 10.5, '#e9b98e')
  ctx.fillStyle = '#2d1e17'
  ctx.beginPath()
  ctx.arc(0, -23 + bob, 10.5, Math.PI, TAU)
  ctx.fill()
  ctx.fillStyle = '#111827'
  ellipse(ctx, -3.5, -20 + bob, 1.3, 1.6, '#111827')
  ellipse(ctx, 3.5, -20 + bob, 1.3, 1.6, '#111827')
  // quest marker
  if (near) {
    ctx.fillStyle = '#ffd166'
    ctx.font = 'bold 18px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('!', 0, -44 + bob)
  }
  ctx.restore()
}

export function drawWorld(ctx, canvas, state, camera, time, playerMoving) {
  const w = canvas.clientWidth || canvas.width
  const h = canvas.clientHeight || canvas.height
  ctx.clearRect(0, 0, w, h)
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#081018')
  bg.addColorStop(1, '#0d1c20')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const world = buildWorldCanvas(state.world.seed || 1)
  ctx.save()
  ctx.translate(-camera.x, -camera.y)
  ctx.drawImage(world, 0, 0)

  // dynamic ground glow around player
  const p = state.player
  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 260)
  glow.addColorStop(0, 'rgba(255,209,102,.08)')
  glow.addColorStop(1, 'rgba(255,209,102,0)')
  ellipse(ctx, p.x, p.y, 260, 190, glow)

  // dynamic POI labels and pulses
  for (const poi of POIS) {
    if (poi.id === 'dungeon_nexo') continue
    const d = Math.hypot(p.x - poi.x, p.y - poi.y)
    if (d > 900) continue
    ctx.save()
    ctx.globalAlpha = clamp(1 - d / 900, 0.2, 1)
    ctx.fillStyle = poi.color
    ctx.font = '600 13px ui-sans-serif, system-ui'
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,.8)'
    ctx.shadowBlur = 6
    ctx.fillText(poi.name, poi.x, poi.y - 82)
    if (d < 200) {
      const pulse = 0.35 + Math.sin(time * 2.4) * 0.12
      ctx.globalAlpha = pulse
      ctx.strokeStyle = poi.color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(poi.x, poi.y + 18, 64, 22, 0, 0, TAU)
      ctx.stroke()
    }
    ctx.restore()
  }

  // NPCs
  for (const npc of state.npcs || []) {
    if (Math.hypot(p.x - npc.x, p.y - npc.y) > 1100) continue
    drawNPC(ctx, npc, time, Math.hypot(p.x - npc.x, p.y - npc.y) < 100)
  }

  // loot
  for (const loot of state.world.loot || []) {
    const bob = Math.sin(time * 2.5 + loot.x) * 4
    ctx.save()
    ctx.translate(loot.x, loot.y + bob)
    ctx.shadowColor = '#fbbf24'
    ctx.shadowBlur = 20
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.moveTo(0, -14)
    ctx.lineTo(13, -4)
    ctx.lineTo(8, 12)
    ctx.lineTo(-8, 12)
    ctx.lineTo(-13, -4)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#fff7d6'
    ctx.font = 'bold 11px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('?', 0, 3)
    ctx.restore()
  }

  // wild creatures
  for (const wild of state.world.spawns || []) {
    if (Math.hypot(p.x - wild.x, p.y - wild.y) > 1200) continue
    const species = CREATURE_BY_ID[wild.speciesId]
    if (!species) continue
    const d = Math.hypot(p.x - wild.x, p.y - wild.y)
    const scale = wild.rare ? 0.46 : 0.4
    drawCreature(ctx, wild.speciesId, wild.x, wild.y + Math.sin(time * 2 + wild.phase) * 2, scale, {
      time: time + wild.phase, flip: wild.vx < 0, shadow: true,
      auraIntensity: wild.rare ? 1.4 : 0.8,
    })
    if (d < 170 || wild.rare) {
      ctx.save()
      ctx.textAlign = 'center'
      ctx.font = '600 11px ui-sans-serif, system-ui'
      ctx.shadowColor = 'rgba(0,0,0,.9)'
      ctx.shadowBlur = 5
      ctx.fillStyle = wild.rare ? RARITIES[species.rarity].color : '#e2e8f0'
      ctx.fillText(`${species.name} · Nv ${wild.level}`, wild.x, wild.y - 34)
      ctx.restore()
    }
    if (d < 90) {
      ctx.save()
      ctx.strokeStyle = 'rgba(255,209,102,.7)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.ellipse(wild.x, wild.y + 15, 30, 12, 0, 0, TAU)
      ctx.stroke()
      ctx.restore()
    }
  }

  drawPlayer(ctx, p.x, p.y, time, p.dir, playerMoving)
  ctx.restore()

  // day/night overlay
  const night = isNight(state.world.time)
  const dusk = state.world.time > 17 && state.world.time < 20
  if (night || dusk) {
    const overlay = ctx.createLinearGradient(0, 0, 0, h)
    if (night) {
      overlay.addColorStop(0, 'rgba(5,10,30,.52)')
      overlay.addColorStop(1, 'rgba(10,15,45,.36)')
    } else {
      overlay.addColorStop(0, 'rgba(255,130,60,.13)')
      overlay.addColorStop(1, 'rgba(90,40,100,.18)')
    }
    ctx.fillStyle = overlay
    ctx.fillRect(0, 0, w, h)
  }

  // vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,.5)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)
}

export function drawWeather(ctx, w, h, weather, time, quality = 1) {
  ctx.clearRect(0, 0, w, h)
  if (!weather || weather === 'clear' || weather === 'none') {
    // drifting motes
    const n = Math.floor(28 * quality)
    for (let i = 0; i < n; i++) {
      const x = ((i * 197 + time * (8 + i % 4)) % (w + 100)) - 50
      const y = ((i * 131 + time * 5) % (h + 80)) - 40
      ctx.globalAlpha = 0.12 + Math.sin(time + i) * 0.05
      ellipse(ctx, x, y, 1.5, 1.5, '#ffd166')
    }
    ctx.globalAlpha = 1
    return
  }
  const count = weather === 'rain' ? 160 : weather === 'storm' ? 190 : weather === 'snow' ? 120 : weather === 'sand' ? 100 : 40
  const n = Math.floor(count * quality)
  if (weather === 'rain' || weather === 'storm') {
    ctx.strokeStyle = weather === 'storm' ? 'rgba(170,190,255,.38)' : 'rgba(160,215,255,.35)'
    ctx.lineWidth = 1.2
    for (let i = 0; i < n; i++) {
      const x = ((i * 173 + time * 900) % (w + 120)) - 60
      const y = ((i * 271 + time * 1200) % (h + 120)) - 60
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 6, y + 16)
      ctx.stroke()
    }
    if (weather === 'storm' && Math.sin(time * 3) > 0.985) {
      ctx.fillStyle = 'rgba(210,220,255,.35)'
      ctx.fillRect(0, 0, w, h)
    }
  } else if (weather === 'snow') {
    for (let i = 0; i < n; i++) {
      const x = ((i * 151 + time * (25 + i % 15)) % (w + 80)) - 40
      const y = ((i * 211 + time * (45 + i % 22)) % (h + 80)) - 40
      ctx.globalAlpha = 0.35 + Math.sin(time + i) * 0.18
      ellipse(ctx, x, y, 1.5 + (i % 3), 1.5 + (i % 3), '#f0f9ff')
    }
    ctx.globalAlpha = 1
  } else if (weather === 'sand') {
    for (let i = 0; i < n; i++) {
      const x = ((i * 191 + time * 250) % (w + 160)) - 80
      const y = ((i * 101 + Math.sin(time + i) * 40 + time * 60) % (h + 80)) - 40
      ctx.globalAlpha = 0.12 + (i % 5) * 0.03
      ellipse(ctx, x, y, 14 + (i % 9) * 4, 2.5, '#f5cf87')
    }
    ctx.globalAlpha = 1
  } else if (weather === 'fog') {
    for (let i = 0; i < 9; i++) {
      const x = ((i * 230 + time * 16) % (w + 500)) - 250
      const y = (i * 97 + Math.sin(time * 0.4 + i) * 60) % h
      const g = ctx.createRadialGradient(x, y, 0, x, y, 240)
      g.addColorStop(0, 'rgba(200,215,225,.075)')
      g.addColorStop(1, 'rgba(200,215,225,0)')
      ellipse(ctx, x, y, 260, 120, g)
    }
  } else if (weather === 'eclipse') {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.8)
    g.addColorStop(0, 'rgba(80,20,140,.04)')
    g.addColorStop(1, 'rgba(20,0,45,.34)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 55; i++) {
      const x = ((i * 137 + time * 20) % (w + 80)) - 40
      const y = ((i * 211 + time * 15) % (h + 80)) - 40
      ctx.globalAlpha = 0.2 + Math.sin(time * 2 + i) * 0.12
      ellipse(ctx, x, y, 1.8, 1.8, '#e9d5ff')
    }
    ctx.globalAlpha = 1
  }
}

export function drawBattleBackground(ctx, w, h, zoneId, weather, time) {
  const zone = ZONE_BY_ID[zoneId] || ZONES[0]
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  const isEclipse = weather === 'eclipse'
  if (isEclipse) {
    sky.addColorStop(0, '#12061f')
    sky.addColorStop(0.6, '#2c1147')
    sky.addColorStop(1, '#070b18')
  } else if (zoneId === 'desierto') {
    sky.addColorStop(0, '#3d1f14')
    sky.addColorStop(0.55, '#9a5a2b')
    sky.addColorStop(1, '#2a160e')
  } else if (zoneId === 'cumbre') {
    sky.addColorStop(0, '#0c1e35')
    sky.addColorStop(0.6, '#315b78')
    sky.addColorStop(1, '#101c2a')
  } else if (zoneId === 'caverna') {
    sky.addColorStop(0, '#0b0b18')
    sky.addColorStop(0.6, '#1e1838')
    sky.addColorStop(1, '#0a0914')
  } else if (zoneId === 'costa') {
    sky.addColorStop(0, '#082532')
    sky.addColorStop(0.55, '#126f85')
    sky.addColorStop(1, '#071820')
  } else {
    sky.addColorStop(0, '#0b1c2a')
    sky.addColorStop(0.55, '#1f4b4a')
    sky.addColorStop(1, '#0c1b18')
  }
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // distant mountains / structures
  ctx.save()
  ctx.globalAlpha = 0.55
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = ['#08131a', '#0b1d24', '#0e2a2d'][layer]
    ctx.beginPath()
    ctx.moveTo(0, h * 0.62)
    const seg = 7
    for (let i = 0; i <= seg; i++) {
      const x = (i / seg) * w
      const y = h * (0.38 + layer * 0.07) + Math.sin(i * 1.9 + layer) * 50 + (i % 2) * 25
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h * 0.7)
    ctx.lineTo(0, h * 0.7)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // arena floor
  const floor = ctx.createRadialGradient(w * 0.5, h * 0.82, 20, w * 0.5, h * 0.82, w * 0.62)
  floor.addColorStop(0, zone.palette[2])
  floor.addColorStop(0.5, zone.palette[1])
  floor.addColorStop(1, '#061014')
  ctx.fillStyle = floor
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.86, w * 0.62, h * 0.28, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = zone.accent
  ctx.globalAlpha = 0.25
  ctx.lineWidth = 2
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.ellipse(w * 0.5, h * 0.84, w * (0.12 + i * 0.1), h * (0.05 + i * 0.035), 0, 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // floating dust / weather
  for (let i = 0; i < 45; i++) {
    const x = ((i * 137 + time * (12 + i % 5)) % (w + 40)) - 20
    const y = ((i * 211 + Math.sin(time + i) * 20) % (h * 0.7))
    ctx.globalAlpha = 0.08 + (i % 5) * 0.02
    ellipse(ctx, x, y, 1.5 + (i % 3), 1.5 + (i % 3), zone.accent)
  }
  ctx.globalAlpha = 1

  // vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,.55)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)
}

export function drawMinimap(ctx, state, w, h) {
  ctx.clearRect(0, 0, w, h)
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, 'rgba(8,20,24,.92)')
  bg.addColorStop(1, 'rgba(12,30,38,.92)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  const sx = w / WORLD.w
  const sy = h / WORLD.h
  for (const zone of ZONES) {
    ctx.fillStyle = zone.palette[2]
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.ellipse(zone.x * sx, zone.y * sy, zone.r * sx, zone.r * sy, 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 0.8
    ctx.fillStyle = zone.accent
    ctx.font = '8px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(zone.short, zone.x * sx, zone.y * sy + 2)
  }
  ctx.globalAlpha = 1
  for (const poi of POIS) {
    if (poi.type === 'dungeon' && poi.id === 'dungeon_nexo') continue
    ctx.fillStyle = poi.color
    ctx.beginPath()
    ctx.arc(poi.x * sx, poi.y * sy, 2.5, 0, TAU)
    ctx.fill()
  }
  const px = state.player.x * sx
  const py = state.player.y * sy
  ctx.fillStyle = '#ffd166'
  ctx.shadowColor = '#ffd166'
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.arc(px, py, 3.5, 0, TAU)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,209,102,.45)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(px, py, 7 + Math.sin(performance.now() / 400) * 2, 0, TAU)
  ctx.stroke()
}

export function drawMap(ctx, state, w, h) {
  ctx.clearRect(0, 0, w, h)
  const bg = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7)
  bg.addColorStop(0, '#10242c')
  bg.addColorStop(1, '#060d14')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  const sx = w / WORLD.w
  const sy = h / WORLD.h
  for (const zone of ZONES) {
    const g = ctx.createRadialGradient(zone.x * sx, zone.y * sy, 0, zone.x * sx, zone.y * sy, zone.r * sx)
    g.addColorStop(0, zone.palette[2])
    g.addColorStop(0.6, zone.palette[1])
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.ellipse(zone.x * sx, zone.y * sy, zone.r * sx, zone.r * sy, 0, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.strokeStyle = 'rgba(255,255,255,.08)'
  ctx.lineWidth = 1
  for (let i = 1; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(i * w / 8, 0); ctx.lineTo(i * w / 8, h); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * h / 8); ctx.lineTo(w, i * h / 8); ctx.stroke()
  }
  for (const zone of ZONES) {
    ctx.fillStyle = '#f8fafc'
    ctx.globalAlpha = 0.72
    ctx.font = '600 13px ui-sans-serif, system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(zone.name, zone.x * sx, zone.y * sy - zone.r * sy * 0.62)
    ctx.globalAlpha = 0.3
    ctx.font = '10px ui-sans-serif'
    ctx.fillText(zone.subtitle, zone.x * sx, zone.y * sy - zone.r * sy * 0.62 + 16)
    ctx.globalAlpha = 1
  }
  for (const poi of POIS) {
    if (poi.type === 'dungeon' && poi.id === 'dungeon_nexo') continue
    const x = poi.x * sx, y = poi.y * sy
    ctx.fillStyle = 'rgba(5,12,18,.85)'
    ctx.strokeStyle = poi.color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, TAU)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = poi.color
    ctx.font = '10px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(poi.icon, x, y + 3.5)
    ctx.font = '9px ui-sans-serif'
    ctx.fillStyle = '#dbeafe'
    ctx.globalAlpha = 0.8
    ctx.fillText(poi.name, x, y + 21)
    ctx.globalAlpha = 1
  }
  const px = state.player.x * sx
  const py = state.player.y * sy
  ctx.fillStyle = '#ffd166'
  ctx.shadowColor = '#ffd166'
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.arc(px, py, 5, 0, TAU)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,209,102,.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(px, py, 11 + Math.sin(performance.now() / 350) * 3, 0, TAU)
  ctx.stroke()
}

export function drawRanchScene(ctx, w, h, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0d2330')
  sky.addColorStop(0.5, '#1c4a4c')
  sky.addColorStop(1, '#081418')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  // stars
  for (let i = 0; i < 50; i++) {
    const x = (i * 137) % w
    const y = (i * 71) % (h * 0.55)
    ctx.globalAlpha = 0.3 + Math.sin(time + i) * 0.15
    ellipse(ctx, x, y, 1.2, 1.2, '#f8fafc')
  }
  ctx.globalAlpha = 1
  // hills
  ctx.fillStyle = '#16352d'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.62)
  ctx.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.55, h * 0.63)
  ctx.quadraticCurveTo(w * 0.78, h * 0.72, w, h * 0.58)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()
  // house silhouette
  ctx.fillStyle = '#0b1b1d'
  ctx.fillRect(w * 0.68, h * 0.42, w * 0.2, h * 0.26)
  ctx.beginPath()
  ctx.moveTo(w * 0.65, h * 0.43)
  ctx.lineTo(w * 0.78, h * 0.3)
  ctx.lineTo(w * 0.91, h * 0.43)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffd166'
  ctx.globalAlpha = 0.7
  ctx.fillRect(w * 0.73, h * 0.49, w * 0.035, h * 0.06)
  ctx.globalAlpha = 1
  // fireflies
  for (let i = 0; i < 30; i++) {
    const x = (i * 173 + Math.sin(time * 0.5 + i) * 40) % w
    const y = h * 0.62 + Math.sin(time * 1.3 + i * 2) * h * 0.12
    ctx.globalAlpha = 0.3 + Math.sin(time * 2 + i) * 0.25
    ellipse(ctx, x, y, 1.6, 1.6, '#ffd166')
  }
  ctx.globalAlpha = 1
}

export function drawTitleGlow(ctx, w, h, time) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.52, 0, w * 0.5, h * 0.52, w * 0.5)
  g.addColorStop(0, 'rgba(45,212,191,.16)')
  g.addColorStop(0.5, 'rgba(45,212,191,.04)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 80; i++) {
    const x = (i * 173 + Math.sin(time * 0.3 + i) * 60) % w
    const y = (i * 97 + time * (4 + i % 7)) % h
    ctx.globalAlpha = 0.1 + Math.sin(time + i) * 0.08
    ellipse(ctx, x, y, 1.4, 1.4, i % 3 ? '#5eead4' : '#fbbf24')
  }
  ctx.globalAlpha = 1
}

export function elementColor(element) {
  return ELEMENTS[element]?.color || '#94a3b8'
}
