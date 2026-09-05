import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/liquid-glass.js', import.meta.url), 'utf8');

// A small DOM fixture lets the real animation run on a deterministic clock.
function fixture() {
  let time = 0, nextFrame = 0;
  const queue = new Map(), maps = [];
  const motion = { matches: false, addEventListener() {} };
  function element(tag) {
    const node = {
      tag, className: '', children: [], style: {
        setProperty(key, value) { this[key] = value; },
        removeProperty(key) { delete this[key]; },
      },
      isConnected: true, dataset: {}, attributes: {},
      setAttribute(key, value) { this.attributes[key] = value; },
      append(...children) { this.children.push(...children); },
      prepend(child) { this.children.unshift(child); child.parentElement = this; },
      matches() { return this === group; },
    };
    node.classList = {
      add(...names) { node.className = [...new Set([...node.className.split(' ').filter(Boolean), ...names])].join(' '); },
      remove(name) { node.className = node.className.split(' ').filter(n => n !== name).join(' '); },
      contains(name) { return node.className.split(' ').includes(name); },
    };
    if (tag === 'canvas') {
      node.getContext = () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: image => maps.push(image.data),
      });
      node.toDataURL = () => 'data:image/png;base64,fixture';
    }
    return node;
  }
  function makeGroup(activeIndex) {
    const node = element('div');
    node.className = 'role-tabs';
    node.scrollWidth = 291;
    node.scrollHeight = 46;
    node.buttons = ['consumer', 'administrator'].map((role, index) => {
      const button = element('button');
      Object.assign(button, { offsetLeft: 5 + index * 141, offsetTop: 5, offsetWidth: 138, offsetHeight: 36, parentElement: node, textContent: role });
      button.dataset.loginRole = role;
      button.className = index === activeIndex ? 'active' : '';
      return button;
    });
    node.querySelectorAll = () => node.buttons;
    node.querySelector = selector => selector.endsWith('button.active')
      ? node.buttons.find(button => button.classList.contains('active'))
      : node.children.find(child => child.className === 'liquid-lens');
    return node;
  }
  let group = makeGroup(0);
  const document = {
    body: element('body'),
    createElement: element,
    createElementNS: (_, tag) => element(tag),
    querySelector: () => element('dialog'),
    querySelectorAll: selector => selector === 'button' ? group.buttons : [group],
    addEventListener() {},
  };
  const context = {
    document, window: {},
    matchMedia: query => query.includes('reduced-motion') ? motion : { matches: true },
    ResizeObserver: class { observe() {} unobserve() {} },
    MutationObserver: class { observe() {} },
    requestAnimationFrame(callback) { queue.set(++nextFrame, callback); return nextFrame; },
  };
  vm.runInNewContext(source, context);
  const sync = () => context.window.SonatikaGlass.sync();
  function advance(milliseconds) {
    for (let n = 0; n < milliseconds / (1000 / 60); n++) {
      time += 1000 / 60;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(time);
    }
  }
  function select(index, replace = false) {
    if (replace) { group.isConnected = false; group = makeGroup(index); }
    else group.buttons.forEach((button, i) => button.className = i === index ? 'active liquid-button' : 'liquid-button');
    sync();
  }
  function position() {
    const lens = group.querySelector(':scope>.liquid-lens');
    const match = lens.style.transform.match(/translate3d\(([^p]+)px,([^p]+)px/);
    return { x: Number(match[1]), y: Number(match[2]), w: parseFloat(lens.style.width), h: parseFloat(lens.style.height) };
  }
  sync();
  advance(100);
  return { sync, select, advance, position, maps, motion, queue };
}

test('a click travels continuously, deforms, then settles without a perpetual RAF', () => {
  const f = fixture();
  f.select(1);
  assert.equal(f.position().x, 5);
  f.advance(100);
  assert.ok(f.position().x > 5 && f.position().x < 146);
  assert.ok(f.position().w > 138, 'lens stretches while accelerating');
  f.advance(2000);
  assert.equal(f.position().x, 146);
  assert.equal(f.position().w, 138);
  assert.equal(f.queue.size, 0, 'idle glass consumes no animation frames');
});

test('rapid reversal across app rerenders retains the current position', () => {
  const f = fixture();
  f.select(1);
  f.advance(100);
  const before = f.position();
  f.select(0, true);
  assert.deepEqual(f.position(), before, 'recreated lens must not jump to either button');
  f.sync();
  assert.deepEqual(f.position(), before, 'observer resync must not cancel/reset travel');
  f.advance(2000);
  assert.equal(f.position().x, 5);
  assert.equal(f.queue.size, 0);
});

test('reduced motion lands directly on the active button', () => {
  const f = fixture();
  f.motion.matches = true;
  f.select(1, true);
  f.advance(17);
  assert.equal(f.position().x, 146);
  assert.equal(f.position().w, 138);
  assert.equal(f.queue.size, 0);
});

test('the generated refraction map has neutral centers and opposing edge normals', () => {
  const f = fixture();
  const map = f.maps[0];
  const red = [], green = [];
  for (let i = 0; i < map.length; i += 4) { red.push(map[i]); green.push(map[i + 1]); }
  assert.ok(red.includes(128) && green.includes(128));
  assert.ok(Math.min(...red) < 60 && Math.max(...red) > 195);
  assert.ok(Math.min(...green) < 60 && Math.max(...green) > 195);
});
