// Keyboard, pointer and touch input
export class Input {
  constructor({ canvas, joystick, knob }) {
    this.canvas = canvas;
    this.joystick = joystick;
    this.knob = knob;
    this.keys = new Set();
    this.pressed = new Set();
    this.orbit = { dx: 0, dy: 0, zoom: 0 };
    this.move = { x: 0, y: 0 };
    this.touchMove = { x: 0, y: 0 };
    this.dragging = false;
    this.lastPointer = { x: 0, y: 0 };
    this.stickPointer = null;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.pressed.delete('Space');
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touchMove.x = 0;
      this.touchMove.y = 0;
      this.resetStick();
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target !== canvas) return;
      this.dragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
      canvas.classList.add('grabbing');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.orbit.dx += (e.clientX - this.lastPointer.x) * 0.005;
      this.orbit.dy += (e.clientY - this.lastPointer.y) * 0.004;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });
    const endDrag = () => {
      this.dragging = false;
      canvas.classList.remove('grabbing');
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.orbit.zoom += Math.sign(e.deltaY) * 0.08;
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.bindJoystick();
  }

  bindJoystick() {
    if (!this.joystick) return;
    const update = (e) => {
      if (e.pointerId !== this.stickPointer) return;
      const rect = this.joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const max = rect.width * 0.34;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touchMove.x = dx / max;
      this.touchMove.y = -dy / max;
      this.joystick.classList.add('active');
    };
    this.joystick.addEventListener('pointerdown', (e) => {
      this.stickPointer = e.pointerId;
      this.joystick.setPointerCapture?.(e.pointerId);
      this.joystick.classList.add('active');
      update(e);
    });
    this.joystick.addEventListener('pointermove', update);
    const end = (e) => {
      if (e.pointerId !== this.stickPointer) return;
      this.resetStick();
    };
    this.joystick.addEventListener('pointerup', end);
    this.joystick.addEventListener('pointercancel', end);
    this.joystick.addEventListener('lostpointercapture', end);
  }

  resetStick() {
    this.stickPointer = null;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    if (this.knob) this.knob.style.transform = 'translate(0,0)';
    this.joystick?.classList.remove('active');
  }

  get vector() {
    let x = 0, y = 0;
    if (this.enabled) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.stickPointer !== null) {
        x += this.touchMove.x;
        y += this.touchMove.y;
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  get running() {
    return this.enabled && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
  }

  wasPressed(code) {
    if (!this.enabled) return false;
    return this.pressed.has(code);
  }

  trigger(code) {
    this.pressed.add(code);
  }

  takeOrbit() {
    const o = { ...this.orbit };
    this.orbit.dx = 0;
    this.orbit.dy = 0;
    this.orbit.zoom = 0;
    return o;
  }

  endFrame() {
    this.pressed.clear();
  }
}
