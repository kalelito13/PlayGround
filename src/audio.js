// Tiny procedural sound system — no audio assets required.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = true;
    this.stepIndex = 0;
    this.timer = null;
    this.chords = [
      [261.63, 329.63, 392.0],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
    ];
    this.melody = [0, 2, 4, 2, 1, 3, 2, 0, 2, 4, 5, 4, 3, 1, 2, 0];
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.12;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.34;
    this.sfxGain.connect(this.master);
    this.startMusic();
  }

  startMusic() {
    if (!this.ctx || this.timer) return;
    this.timer = setInterval(() => this.musicStep(), 420);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  musicStep() {
    if (!this.ctx || !this.musicOn || this.ctx.state !== 'running') return;
    const bar = Math.floor(this.stepIndex / 8) % this.chords.length;
    const chord = this.chords[bar];
    const idx = this.stepIndex % 16;
    const note = chord[[0, 1, 2, 1][idx % 4]] * (idx >= 8 ? 2 : 1);
    const t = this.ctx.currentTime;
    this.tone(note * 2, 1.6, 'sine', 0.045, t, this.musicGain, 0.004);
    if (this.stepIndex % 4 === 0) {
      this.tone(chord[0] / 2, 2.6, 'triangle', 0.045, t, this.musicGain, 0.4);
      this.tone(chord[2] / 2, 2.6, 'sine', 0.03, t + 0.02, this.musicGain, 0.5);
    }
    if (this.stepIndex % 8 === 3) {
      this.tone(this.melody[idx] ? chord[this.melody[idx] % 3] * 2 : note * 2, 0.8, 'triangle', 0.035, t, this.musicGain, 0.01);
    }
    this.stepIndex++;
  }

  tone(freq, duration, type, gain, when, destination, attack = 0.01) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(g);
    g.connect(destination || this.sfxGain);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  sweep(f0, f1, duration, type = 'sine', gain = 0.12) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + duration + 0.05);
  }

  sfx(name) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'select':
        this.tone(520, 0.08, 'triangle', 0.12, t, this.sfxGain);
        this.tone(780, 0.1, 'triangle', 0.08, t + 0.05, this.sfxGain);
        break;
      case 'confirm':
        this.tone(523, 0.1, 'triangle', 0.12, t, this.sfxGain);
        this.tone(659, 0.1, 'triangle', 0.12, t + 0.08, this.sfxGain, 0.005);
        this.tone(784, 0.2, 'triangle', 0.12, t + 0.16, this.sfxGain, 0.005);
        break;
      case 'hit':
        this.sweep(180, 60, 0.18, 'sawtooth', 0.16);
        this.tone(90, 0.12, 'square', 0.1, t, this.sfxGain);
        break;
      case 'hurt':
        this.sweep(320, 110, 0.3, 'sawtooth', 0.12);
        break;
      case 'miss':
        this.sweep(500, 240, 0.2, 'sine', 0.08);
        break;
      case 'orb':
        this.sweep(400, 900, 0.35, 'sine', 0.1);
        break;
      case 'catch':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.1, t + i * 0.12, this.sfxGain));
        break;
      case 'fail':
        this.sweep(300, 120, 0.5, 'triangle', 0.1);
        break;
      case 'level':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.45, 'sine', 0.09, t + i * 0.1, this.sfxGain));
        break;
      case 'heal':
        [440, 554, 659].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.08, t + i * 0.08, this.sfxGain));
        break;
      case 'pickup':
        this.tone(880, 0.15, 'triangle', 0.09, t, this.sfxGain);
        this.tone(1174, 0.25, 'triangle', 0.07, t + 0.08, this.sfxGain);
        break;
      case 'encounter':
        this.sweep(200, 800, 0.45, 'triangle', 0.12);
        this.tone(220, 0.3, 'sawtooth', 0.06, t + 0.2, this.sfxGain);
        break;
      case 'step':
        this.tone(150 + Math.random() * 40, 0.04, 'triangle', 0.03, t, this.sfxGain);
        break;
    }
  }

  // A little wooden-flute melody. Each instrument rank has its own scale.
  flute(tier = 1) {
    if (!this.ctx || !this.enabled) return;
    const scales = {
      1: [392, 440, 523, 587],
      2: [494, 587, 659, 784],
      3: [523, 659, 784, 988],
      4: [440, 554, 659, 880],
      5: [659, 784, 988, 1319],
      6: [523, 784, 1047, 1568],
    };
    const notes = scales[Math.min(6, Math.max(1, tier))];
    const t = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      this.tone(freq, 0.55, 'sine', 0.11, t + i * 0.16, this.sfxGain, 0.03);
      this.tone(freq * 2, 0.35, 'triangle', 0.035, t + i * 0.16, this.sfxGain, 0.05);
    });
    this.tone(notes[0] / 2, 1.1, 'sine', 0.05, t, this.sfxGain, 0.08);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.5 : 0;
    return this.enabled;
  }
}
