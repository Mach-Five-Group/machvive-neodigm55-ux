import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import '../src/wc/neodigm-side-dish/neodigm-side-dish.js';
import { THEME_NAMES, THEME_ATTR, setMotionAllowed, resetMotion } from '../src/conductor/index.js';

const mount = (attrs = {}) => {
  const el = document.createElement('neodigm-side-dish');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(Object.assign(document.createElement('p'), { textContent: 'content' }));
  document.body.append(el);
  return el;
};
const part = (el, sel) => el.shadowRoot.querySelector(sel);
const escape = (target = document.body) => {
  const ev = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
};
const closes = (el) => {
  const seen = [];
  el.addEventListener('neodigm-side-dish-close', (e) => seen.push(e.detail.reason));
  return seen;
};

beforeEach(() => { document.body.replaceChildren(); resetMotion(); });
afterEach(() => { document.body.replaceChildren(); resetMotion(); });

describe('opening', () => {
  test('starts closed, and show() opens it with an event', () => {
    const el = mount();
    let opened = 0;
    el.addEventListener('neodigm-side-dish-open', () => opened++);
    assert.equal(el.open, false);
    assert.equal(el.show(), true);
    assert.equal(el.open, true);
    assert.ok(el.hasAttribute('open'));
    assert.equal(opened, 1);
    assert.equal(el.show(), false, 'already open');
    assert.equal(opened, 1);
  });

  test('a listener can veto opening', () => {
    const el = mount();
    el.addEventListener('neodigm-side-dish-open', (e) => e.preventDefault());
    assert.equal(el.show(), false);
    assert.equal(el.open, false);
  });

  test('the content is slotted into a scrollable dialog', () => {
    const el = mount({ label: 'Filters' });
    const panel = part(el, '.panel');
    assert.equal(panel.getAttribute('role'), 'dialog');
    assert.equal(panel.getAttribute('aria-label'), 'Filters');
    assert.ok(panel.querySelector('slot:not([name])'), 'default slot inside the panel');
    assert.equal(el.querySelector('p').assignedSlot, panel.querySelector('slot:not([name])'));
    el.setAttribute('label', 'Sort');
    assert.equal(panel.getAttribute('aria-label'), 'Sort', 'label follows the attribute');
    el.removeAttribute('label');
    assert.equal(panel.hasAttribute('aria-label'), false);
  });

  test('moves focus into the panel, and gives it back on close', () => {
    const before = document.createElement('button');
    document.body.append(before);
    before.focus();
    const el = mount();
    el.show();
    assert.equal(el.shadowRoot.activeElement, part(el, '.panel'));
    el.close();
    assert.equal(document.activeElement, before);
  });

  test('does not take focus back from somewhere the page moved it', () => {
    const before = document.createElement('button');
    const elsewhere = document.createElement('input');
    document.body.append(before, elsewhere);
    before.focus();
    const el = mount();
    el.show();
    elsewhere.focus();
    el.close();
    assert.equal(document.activeElement, elsewhere);
  });
});

describe('the three ways out', () => {
  test('tapping the scrim closes it', () => {
    const el = mount();
    const seen = closes(el);
    el.show();
    part(el, '.scrim').click();
    assert.equal(el.open, false);
    assert.deepEqual(seen, ['scrim']);
  });

  test('clicking the X closes it, including a click on its drawing', () => {
    const el = mount();
    const seen = closes(el);
    el.show();
    part(el, '.close path').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    assert.equal(el.open, false);
    assert.deepEqual(seen, ['close']);
  });

  test('Escape closes it from anywhere on the page', () => {
    const el = mount();
    const seen = closes(el);
    el.show();
    const ev = escape();
    assert.equal(el.open, false);
    assert.deepEqual(seen, ['escape']);
    assert.equal(ev.defaultPrevented, true, 'the key was consumed');
  });

  test('clicks inside the panel do not close it', () => {
    const el = mount();
    el.show();
    part(el, '.panel').click();
    el.querySelector('p').click();
    assert.equal(el.open, true);
  });

  test('a listener can veto closing, whatever asked', () => {
    const el = mount();
    el.addEventListener('neodigm-side-dish-close', (e) => e.preventDefault());
    el.show();
    part(el, '.scrim').click();
    escape();
    part(el, '.close').click();
    assert.equal(el.close(), false);
    assert.equal(el.open, true);
  });

  test('close() reports the api as the reason, and is false when already closed', () => {
    const el = mount();
    const seen = closes(el);
    assert.equal(el.close(), false);
    el.show();
    assert.equal(el.close(), true);
    assert.deepEqual(seen, ['api']);
  });
});

describe('Escape', () => {
  test('closes only the topmost of several open', () => {
    const a = mount();
    const b = mount();
    a.show();
    b.show();
    escape();
    assert.equal(b.open, false);
    assert.equal(a.open, true);
    escape();
    assert.equal(a.open, false);
  });

  test('a closed panel stops listening', () => {
    const el = mount();
    const seen = closes(el);
    el.show();
    el.close();
    el.open = true;           // reopened silently, then closed silently
    el.open = false;
    escape();
    assert.deepEqual(seen, ['api']);
  });

  test('a removed panel stops listening, and leaves the stack', () => {
    const a = mount();
    const b = mount();
    a.show();
    b.show();
    b.remove();
    escape();
    assert.equal(a.open, false, 'a is the top once b has gone');
  });

  test('releases its document listener on close and on removal', () => {
    // The stack check makes a leaked listener behave correctly, so only a
    // count can see it — and a leak keeps a removed panel alive.
    const live = new Set();
    const { addEventListener: add, removeEventListener: remove } = document;
    document.addEventListener = function (type, fn, o) { if (type === 'keydown') live.add(fn); return add.call(this, type, fn, o); };
    document.removeEventListener = function (type, fn, o) { if (type === 'keydown') live.delete(fn); return remove.call(this, type, fn, o); };
    try {
      const el = mount();
      el.show();
      assert.equal(live.size, 1);
      el.close();
      assert.equal(live.size, 0, 'after close');
      el.show();
      el.remove();
      assert.equal(live.size, 0, 'after removal');
    } finally {
      document.addEventListener = add;
      document.removeEventListener = remove;
    }
  });

  test('ignores a key someone else already handled', () => {
    const el = mount();
    el.show();
    document.body.addEventListener('keydown', (e) => e.preventDefault(), { capture: true, once: true });
    escape();
    assert.equal(el.open, true);
  });

  test('the open attribute in markup is live from the start', () => {
    const el = mount({ open: '' });
    escape();
    assert.equal(el.open, false);
  });
});

describe('theming', () => {
  test('the host theme colours the X with the legible shade, for every theme', () => {
    const css = part(mount(), 'style').textContent;
    for (const name of THEME_NAMES) {
      const rule = new RegExp(
        `:host\\(\\[${THEME_ATTR}="${name}"\\]\\) \\.close \\{\\s*` +
        `background: var\\(--n55-${name}-legible\\);\\s*color: var\\(--n55-${name}-legible-ink\\);`);
      assert.match(css, rule, name);
    }
  });

  test('the panel is a light/dark surface from the neutrals', () => {
    const css = part(mount(), 'style').textContent;
    const panel = css.slice(css.indexOf('.panel {'), css.indexOf('}', css.indexOf('.panel {')));
    assert.match(panel, /background: var\(--n55-surface, #fff\)/);
    assert.match(panel, /color: var\(--n55-surface-ink, #1a1a1a\)/);
  });

  test('the theme sits on the host, where a sweep can reach it', () => {
    const el = mount({ [THEME_ATTR]: 'brand' });
    assert.ok(document.querySelectorAll(`[${THEME_ATTR}]`)[0] === el);
    assert.equal(el.shadowRoot.querySelector(`[${THEME_ATTR}]`), null);
  });

  test('the X is drawn, not a glyph', () => {
    const x = part(mount(), '.close');
    assert.equal(x.getAttribute('aria-label'), 'Close');
    assert.ok(x.querySelector('svg'));
    assert.equal(x.textContent.trim(), '');
  });
});

describe('motion', () => {
  test('the JavaScript motion gate stills the slide, which the media query cannot see', () => {
    setMotionAllowed(false);
    const el = mount();
    el.show();
    assert.ok(part(el, '.frame').classList.contains('still'));
    setMotionAllowed(true);
    el.close();
    assert.equal(part(el, '.frame').classList.contains('still'), false);
  });
});
