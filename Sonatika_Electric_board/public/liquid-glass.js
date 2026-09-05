(() => {
  'use strict';

  const groups = '.nav,.role-tabs,.period-tabs,.payment-methods';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const states = new Map();
  const filters = new Map();
  const observed = new WeakSet();
  const NS = 'http://www.w3.org/2000/svg';
  let frame = 0;
  let lastTime = 0;
  let hovered = null;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('liquid-filter-defs');
  const defs = document.createElementNS(NS, 'defs');
  svg.append(defs);
  document.body.append(svg);

  // Encode surface normals near a rounded lens edge into a displacement map.
  // Neutral pixels leave the center clear; edge pixels bend the actual backdrop.
  function refraction(width, height) {
    const w = Math.max(16, Math.round(width / 8) * 8);
    const h = Math.max(16, Math.round(height / 8) * 8);
    const key = `${w}:${h}`;
    if (filters.has(key)) return filters.get(key);
    if (filters.size >= 96) return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(w, 640);
    canvas.height = Math.min(h, 240);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    const radius = Math.min(w, h) / 2;
    const rim = Math.min(13, radius * .6);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const px = (x + .5) * w / canvas.width - w / 2;
        const py = (y + .5) * h / canvas.height - h / 2;
        const qx = Math.max(Math.abs(px) - (w / 2 - radius), 0);
        const qy = Math.max(Math.abs(py) - (h / 2 - radius), 0);
        const length = Math.hypot(qx, qy);
        const depth = radius - length;
        const bend = depth > 0 && depth < rim ? Math.sin(Math.PI * depth / rim) : 0;
        const nx = length ? Math.sign(px) * qx / length : 0;
        const ny = length ? Math.sign(py) * qy / length : 0;
        const offset = (y * canvas.width + x) * 4;
        pixels.data[offset] = 128 + nx * bend * 110;
        pixels.data[offset + 1] = 128 + ny * bend * 110;
        pixels.data[offset + 2] = 128;
        pixels.data[offset + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const id = `liquid-refraction-${filters.size}`;
    const filter = document.createElementNS(NS, 'filter');
    filter.id = id;
    filter.setAttribute('x', '0%');
    filter.setAttribute('y', '0%');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const map = document.createElementNS(NS, 'feImage');
    map.setAttribute('href', canvas.toDataURL());
    map.setAttribute('width', '100%');
    map.setAttribute('height', '100%');
    map.setAttribute('preserveAspectRatio', 'none');
    map.setAttribute('result', 'normal-map');
    const displacement = document.createElementNS(NS, 'feDisplacementMap');
    displacement.setAttribute('in', 'SourceGraphic');
    displacement.setAttribute('in2', 'normal-map');
    displacement.setAttribute('scale', '16');
    displacement.setAttribute('xChannelSelector', 'R');
    displacement.setAttribute('yChannelSelector', 'G');
    filter.append(map, displacement);
    defs.append(filter);
    const value = `url("#${id}") blur(.35px) saturate(1.3)`;
    filters.set(key, value);
    return value;
  }

  function setOptics(element, width, height) {
    const value = refraction(width, height);
    if (value) element.style.setProperty('--liquid-refraction', value);
  }

  function box(button) {
    return { x: button.offsetLeft, y: button.offsetTop, w: button.offsetWidth, h: button.offsetHeight };
  }

  function paint(state) {
    const { lens, position: p, target, velocity: v, group } = state;
    if (!lens?.isConnected) return;
    // Velocity stretches the droplet along its travel axis. A second spring
    // lets its shape recover continuously even when the destination changes.
    const dx = state.shape.x, dy = state.shape.y;
    let w = p.w * (1 + dx - dy * .13);
    let h = p.h * (1 + dy - dx * .13);
    w = Math.min(w, Math.max(group.scrollWidth, target.x + target.w) - 4);
    h = Math.min(h, Math.max(group.scrollHeight, target.y + target.h) - 4);
    let x = p.x + (p.w - w) / 2, y = p.y + (p.h - h) / 2;
    x = Math.max(2, Math.min(x, Math.max(group.scrollWidth, target.x + target.w) - w - 2));
    y = Math.max(2, Math.min(y, Math.max(group.scrollHeight, target.y + target.h) - h - 2));
    lens.style.width = `${w}px`;
    lens.style.height = `${h}px`;
    lens.style.transform = `translate3d(${x}px,${y}px,0)`;
    lens.style.setProperty('--light-x', `${50 - Math.tanh(v.x / 350) * 32}%`);
    lens.style.setProperty('--light-y', `${20 - Math.tanh(v.y / 350) * 18}%`);
    lens.style.setProperty('--liquid-energy', String(Math.min(.2, Math.hypot(v.x, v.y) / 4000)));
  }

  function snap(state) {
    Object.assign(state.position, state.target);
    for (const key of ['x', 'y', 'w', 'h']) state.velocity[key] = 0;
    state.shape = { x: 0, y: 0, vx: 0, vy: 0 };
    paint(state);
  }

  function tick(time) {
    frame = 0;
    const dt = Math.min((time - (lastTime || time - 16.67)) / 1000, .032);
    lastTime = time;
    let moving = false;
    for (const state of states.values()) {
      if (!state.group.isConnected) continue;
      if (reducedMotion.matches) { snap(state); continue; }
      let unsettled = false;
      // Small integration steps keep the spring stable at 60/120 Hz and after stalls.
      const steps = Math.ceil(dt / .008), step = dt / steps;
      for (let i = 0; i < steps; i++) {
        for (const key of ['x', 'y', 'w', 'h']) {
          const gap = state.target[key] - state.position[key];
          state.velocity[key] += (240 * gap - 29 * state.velocity[key]) * step;
          state.position[key] += state.velocity[key] * step;
        }
        for (const key of ['x', 'y']) {
          const desired = Math.min(.28, Math.abs(state.velocity[key]) / 2600);
          const speedKey = `v${key}`;
          state.shape[speedKey] += (360 * (desired - state.shape[key]) - 32 * state.shape[speedKey]) * step;
          state.shape[key] += state.shape[speedKey] * step;
        }
      }
      for (const key of ['x', 'y', 'w', 'h']) {
        unsettled ||= Math.abs(state.target[key] - state.position[key]) > .08 || Math.abs(state.velocity[key]) > .15;
      }
      unsettled ||= Math.abs(state.shape.x) + Math.abs(state.shape.y) > .001;
      if (unsettled) { paint(state); moving = true; } else snap(state);
    }
    if (moving) frame = requestAnimationFrame(tick);
    else lastTime = 0;
  }

  function wake() {
    if (!frame) { lastTime = 0; frame = requestAnimationFrame(tick); }
  }

  const resize = new ResizeObserver(entries => {
    for (const { target } of entries) {
      if (!target.isConnected) { resize.unobserve(target); continue; }
      if (target.matches(groups)) {
        for (const state of states.values()) {
          if (state.group !== target) continue;
          const active = target.querySelector(':scope>button.active');
          if (active) { state.target = box(active); setOptics(state.lens, state.target.w, state.target.h); }
        }
      } else if (target.offsetWidth && target.offsetHeight) {
        setOptics(target, target.offsetWidth, target.offsetHeight);
      }
    }
    wake();
  });

  function sync() {
    // Retain the physical state only across replacements of the same control.
    const present = new Set();
    document.querySelectorAll(groups).forEach(group => {
      group.classList.add('liquid-group');
      const buttons = [...group.querySelectorAll(':scope>button')];
      const key = group.className.split(' ').find(name => ['nav','role-tabs','period-tabs','payment-methods'].includes(name))
        + ':' + buttons.map(button => button.dataset.view || button.dataset.loginRole || button.dataset.paymentMethod || button.textContent.trim()).join('|');
      present.add(key);
      const active = group.querySelector(':scope>button.active');
      if (!active) return;
      const target = box(active);
      let state = states.get(key);
      if (!state) {
        state = { group, position: { ...target }, target, velocity: { x: 0, y: 0, w: 0, h: 0 }, shape: { x: 0, y: 0, vx: 0, vy: 0 } };
        states.set(key, state);
      }
      if (state.group !== group) resize.unobserve(state.group);
      state.group = group;
      state.target = target;
      let lens = group.querySelector(':scope>.liquid-lens');
      if (!lens) {
        lens = document.createElement('i');
        lens.className = 'liquid-lens';
        lens.setAttribute('aria-hidden', 'true');
        group.prepend(lens);
      }
      state.lens = lens;
      setOptics(lens, target.w, target.h);
      paint(state);
      if (!observed.has(group)) { resize.observe(group); observed.add(group); }
    });
    for (const [key, state] of states) {
      if (!present.has(key)) { resize.unobserve(state.group); states.delete(key); }
    }
    document.querySelectorAll('button').forEach(button => {
      button.classList.add('liquid-button');
      if (!button.parentElement.matches(groups) && !observed.has(button)) {
        setOptics(button, button.offsetWidth, button.offsetHeight);
        resize.observe(button);
        observed.add(button);
      }
    });
    wake();
  }

  function release(button) {
    if (!button) return;
    button.style.removeProperty('--light-x');
    button.style.removeProperty('--light-y');
    button.style.removeProperty('--lean-x');
    button.style.removeProperty('--lean-y');
    button.classList.remove('liquid-pressed');
  }
  document.addEventListener('pointermove', event => {
    if (!finePointer.matches || reducedMotion.matches) return;
    const button = event.target.closest('button:not(:disabled)');
    if (hovered !== button) { release(hovered); hovered = button; }
    if (!button || button.parentElement.matches(groups)) return;
    const rect = button.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
    button.style.setProperty('--light-x', `${x * 100}%`);
    button.style.setProperty('--light-y', `${y * 100}%`);
    button.style.setProperty('--lean-x', `${(x - .5) * 3}px`);
    button.style.setProperty('--lean-y', `${(y - .5) * 2}px`);
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (hovered && !hovered.contains(event.relatedTarget)) { release(hovered); hovered = null; }
  }, { passive: true });
  document.addEventListener('pointerdown', event => event.target.closest('button:not(:disabled)')?.classList.add('liquid-pressed'), { passive: true });
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, () => {
    document.querySelectorAll('.liquid-pressed').forEach(button => button.classList.remove('liquid-pressed'));
  }, { passive: true });
  reducedMotion.addEventListener('change', () => { release(hovered); wake(); });
  // Dialog controls are also created dynamically outside the main app container.
  new MutationObserver(sync).observe(document.querySelector('#dialog'), { childList: true, subtree: true });
  window.SonatikaGlass = { sync };
})();
