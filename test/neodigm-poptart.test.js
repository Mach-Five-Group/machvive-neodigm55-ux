import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import '../src/wc/neodigm-marquee/neodigm-marquee.js';
import '../src/wc/neodigm-side-dish/neodigm-side-dish.js';
import '../src/wc/neodigm-poptart/neodigm-poptart.js';
import { readPoptart, triggerFor } from '../src/wc/neodigm-poptart/neodigm-poptart.js';
import { place } from '../src/conductor/anchor.js';
import { THEME_NAMES, THEME_ATTR, setMotionAllowed, resetMotion } from '../src/conductor/index.js';

const frame = () => new Promise((r) => window.requestAnimationFrame(() => r()));

/** jsdom has no layout: give an element a rectangle. */
const at = (el, left, top, width, height) => {
  el.getBoundingClientRect = () => ({ left, top, width, height });
  return el;
};
/**
 * A Poptart whose measured size is what it was given, and whose content is
 * `contentHeight` tall once it is showing — zero while closed, as
 * `display: none` reports.
 */
const mount = (id = 'pt', config = null, { contentHeight = 120, html = '<p>content</p>' } = {}) => {
  const el = document.createElement('neodigm-poptart');
  el.id = id;
  if (config) el.setAttribute('data-n55-poptart', JSON.stringify(config));
  el.innerHTML = html;
  el.getBoundingClientRect = function () {
    const shown = this.hasAttribute('open');
    return {
      left: 0, top: 0,
      width: shown ? parseFloat(this.style.width) || 0 : 0,
      height: shown ? parseFloat(this.style.height) || contentHeight : 0
    };
  };
  document.body.append(el);
  return el;
};
const trigger = (id, kind = 'click', attrs = {}) => {
  const b = document.createElement('button');
  b.setAttribute(`data-n55-poptart-${kind}`, id);
  for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
  b.append(document.createElement('span'));
  document.body.append(b);
  return at(b, 400, 300, 100, 40);
};
const click = (el) => {
  const ev = new window.MouseEvent('click', { bubbles: true, cancelable: true, composed: true });
  el.dispatchEvent(ev);
  return ev;
};
const fire = (el, type) => {
  const ev = new window.MouseEvent(type, { bubbles: true, cancelable: true, composed: true });
  el.dispatchEvent(ev);
  return ev;
};
const escape = (from = document.body) => {
  const ev = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  from.dispatchEvent(ev);
  return ev;
};
const record = (el, kind) => {
  const seen = [];
  el.addEventListener(`neodigm-poptart-${kind}`, (e) => seen.push(e.detail));
  return seen;
};
const xy = (el) => el.style.transform.match(/-?\d+/g).map(Number);

beforeEach(() => { document.body.replaceChildren(); resetMotion(); });
afterEach(() => { document.body.replaceChildren(); resetMotion(); });

describe('the declarative format', () => {
  test('reads the original markup, ignoring keys it never implemented', () => {
    // From the original's e-commerce demo, `Q`-prefixed keys and all.
    const c = readPoptart('{"Qx": 176, "Qy": 176, "Qz": 176, "h": 256, "w": 352, "position":"bottom", ' +
      '"arrow": false, "offset":{"h": 0, "l":0, "t":0, "w":0}, "dismiss":"hover"}');
    assert.deepEqual(c, {
      position: 'bottom', align: 'center', w: 352, h: 256, x: null, y: null, z: null,
      offsetX: 0, offsetY: 0, offsetW: 0, offsetH: 0
    });
  });

  test('missing or unparseable configuration is the defaults', () => {
    const defaults = readPoptart(null);
    assert.equal(defaults.position, 'bottom');
    assert.equal(defaults.align, 'center');
    assert.equal(defaults.w, null);
    assert.deepEqual(readPoptart('{nope'), defaults);
    assert.deepEqual(readPoptart('"a string"'), defaults);
    assert.deepEqual(readPoptart('null'), defaults);
  });

  test('an unknown side is bottom; beside it lines up top edges unless told otherwise', () => {
    assert.equal(readPoptart('{"position":"sideways"}').position, 'bottom');
    assert.equal(readPoptart('{"position":"right"}').align, 'start');
    assert.equal(readPoptart('{"position":"left"}').align, 'start');
    assert.equal(readPoptart('{"position":"top"}').align, 'center');
    assert.equal(readPoptart('{"position":"right","align":"end"}').align, 'end');
    assert.equal(readPoptart('{"position":"top","align":"middle"}').align, 'center');
  });

  test('sums every spelling of the offsets, and the original\'s t moves up', () => {
    const c = readPoptart(JSON.stringify({
      offsetX: 1, offsetY: 2, offset: { x: 10, y: 20, l: 100, t: 200, w: 7, h: 9 }
    }));
    assert.equal(c.offsetX, 111);
    assert.equal(c.offsetY, 2 + 20 - 200);
    assert.equal(c.offsetW, 7);
    assert.equal(c.offsetH, 9);
    assert.equal(readPoptart('{"offset":{"x":"a","y":true,"l":null}}').offsetX, 0);
    assert.equal(readPoptart('{"offset":{"x":"a","y":true,"l":null}}').offsetY, 0);
  });

  test('x of 0 counts, a size of 0 does not, and numeric strings are numbers', () => {
    const c = readPoptart('{"x": 0, "y": "12", "w": 0, "h": "-5", "z": "264"}');
    assert.equal(c.x, 0);
    assert.equal(c.y, 12);
    assert.equal(c.w, null);
    assert.equal(c.h, null);
    assert.equal(c.z, 264);
    assert.equal(readPoptart('{"x": ""}').x, null);
  });
});

describe('triggers', () => {
  test('a click trigger opens it, and clicking it again closes it', () => {
    const pop = mount();
    const b = trigger('pt');
    const closes = record(pop, 'close');
    const ev = click(b.firstChild);
    assert.equal(pop.open, true);
    assert.equal(pop.trigger, b);
    assert.equal(ev.defaultPrevented, true);
    click(b);
    assert.equal(pop.open, false);
    assert.equal(closes[0].reason, 'trigger');
  });

  test('a hover trigger opens it on pointer and on keyboard focus', () => {
    const pop = mount();
    const b = trigger('pt', 'hover');
    fire(b.firstChild, 'mouseover');
    assert.equal(pop.open, true);
    pop.close();
    b.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
    assert.equal(pop.open, true);
  });

  test('hovering inside the trigger it already shows beside does not reopen it', () => {
    const pop = mount();
    const b = trigger('pt', 'hover');
    const opens = record(pop, 'open');
    fire(b, 'mouseover');
    fire(b.firstChild, 'mouseover');
    assert.equal(opens.length, 1);
  });

  test('a right-click trigger opens it instead of the browser menu', () => {
    const pop = mount();
    const b = trigger('pt', 'rightclick');
    const ev = fire(b, 'contextmenu');
    assert.equal(pop.open, true);
    assert.equal(ev.defaultPrevented, true);
    assert.equal(fire(document.body, 'contextmenu').defaultPrevented, false);
  });

  test('only triggers naming its id, and of the right kind, open it', () => {
    const pop = mount();
    click(trigger('other'));
    fire(trigger('pt', 'click'), 'mouseover');
    fire(trigger('pt', 'hover'), 'contextmenu');
    assert.equal(pop.open, false);
  });

  test('a disabled trigger, or one inside a disabled region, opens nothing', () => {
    const pop = mount();
    click(trigger('pt', 'click', { [THEME_ATTR]: 'disabled' }));
    const region = document.createElement('div');
    region.setAttribute(THEME_ATTR, 'disabled');
    region.append(trigger('pt'));
    document.body.append(region);
    click(region.firstChild);
    assert.equal(pop.open, false);
    assert.equal(triggerFor(region.firstChild, 'pt', 'click'), null);
    region.setAttribute(THEME_ATTR, 'brand');
    assert.equal(triggerFor(region.firstChild, 'pt', 'click'), region.firstChild);
  });

  test('says on its trigger whether it is expanded', () => {
    const pop = mount();
    const b = trigger('pt');
    click(b);
    assert.equal(b.getAttribute('aria-expanded'), 'true');
    pop.close();
    assert.equal(b.getAttribute('aria-expanded'), 'false');
  });

  test('moving to another trigger collapses the first', () => {
    const pop = mount();
    const a = trigger('pt', 'hover');
    const b = trigger('pt', 'hover');
    fire(a, 'mouseover');
    fire(b, 'mouseover');
    assert.equal(pop.trigger, b);
    assert.equal(a.getAttribute('aria-expanded'), 'false');
    assert.equal(b.getAttribute('aria-expanded'), 'true');
  });

  test('once disconnected it listens to nothing', () => {
    const pop = mount();
    const b = trigger('pt');
    pop.remove();
    click(b);
    assert.equal(pop.open, false);
  });
});

describe('dismissal', () => {
  test('a click outside closes it; a click inside does not', () => {
    const pop = mount();
    const closes = record(pop, 'close');
    click(trigger('pt'));
    click(pop.querySelector('p'));
    assert.equal(pop.open, true);
    click(document.body);
    assert.equal(pop.open, false);
    assert.equal(closes[0].reason, 'outside');
  });

  test('clicking the hover trigger it is showing beside does not close it', () => {
    const pop = mount();
    const b = trigger('pt', 'hover');
    fire(b, 'mouseover');
    click(b.firstChild);
    assert.equal(pop.open, true);
  });

  test('Escape closes it and hands focus back if focus was inside', () => {
    const pop = mount('pt', null, { html: '<input>' });
    const b = trigger('pt');
    click(b);
    pop.querySelector('input').focus();
    const ev = escape(pop.querySelector('input'));
    assert.equal(pop.open, false);
    assert.equal(ev.defaultPrevented, true);
    assert.equal(document.activeElement, b);
  });

  test('closing any other way with focus inside hands focus back too', () => {
    const pop = mount('pt', null, { html: '<input>' });
    const b = trigger('pt');
    pop.show(b);
    pop.querySelector('input').focus();
    pop.close();
    assert.equal(document.activeElement, b);
  });

  test('Escape leaves focus alone when it was elsewhere', () => {
    const pop = mount();
    const b = trigger('pt');
    const elsewhere = document.createElement('input');
    document.body.append(elsewhere);
    click(b);
    elsewhere.focus();
    escape(elsewhere);
    assert.equal(pop.open, false);
    assert.equal(document.activeElement, elsewhere);
  });

  test('an Escape already handled is left alone', () => {
    const pop = mount();
    click(trigger('pt'));
    const ev = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    ev.preventDefault();
    document.body.dispatchEvent(ev);
    assert.equal(pop.open, true);
  });

  test('Escape inside a SideDish closes the Poptart and not the SideDish', () => {
    const dish = document.createElement('neodigm-side-dish');
    document.body.append(dish);
    dish.show();
    const pop = mount();
    dish.append(pop);
    const b = trigger('pt');
    dish.append(b);
    click(b);
    escape(b);
    assert.equal(pop.open, false);
    assert.equal(dish.open, true);
    escape(b);
    assert.equal(dish.open, false);
  });

  test('opening one Poptart closes another', () => {
    const one = mount('one');
    const two = mount('two');
    const closes = record(one, 'close');
    trigger('one', 'hover');
    fire(document.querySelector('[data-n55-poptart-hover="one"]'), 'mouseover');
    fire(trigger('two', 'hover'), 'mouseover');
    assert.equal(one.open, false);
    assert.equal(two.open, true);
    assert.equal(closes[0].reason, 'replace');
  });

  test('if the one showing vetoes being replaced, the other does not open', () => {
    const one = mount('one');
    const two = mount('two');
    one.show(trigger('one'));
    one.addEventListener('neodigm-poptart-close', (e) => e.preventDefault());
    assert.equal(two.show(trigger('two')), false);
    assert.equal(one.open, true);
    assert.equal(two.open, false);
  });
});

describe('events', () => {
  test('open is cancelable, opened follows, and both say which and beside what', () => {
    const pop = mount('js-signin');
    const b = trigger('js-signin');
    const opened = record(pop, 'opened');
    let veto = true;
    pop.addEventListener('neodigm-poptart-open', (e) => {
      assert.deepEqual(e.detail, { id: 'js-signin', trigger: b });
      if (veto) e.preventDefault();
    });
    click(b);
    assert.equal(pop.open, false);
    assert.equal(opened.length, 0);
    veto = false;
    click(b);
    assert.equal(pop.open, true);
    assert.deepEqual(opened, [{ id: 'js-signin', trigger: b }]);
  });

  test('close is cancelable', () => {
    const pop = mount();
    click(trigger('pt'));
    pop.addEventListener('neodigm-poptart-close', (e) => e.preventDefault());
    click(document.body);
    assert.equal(pop.open, true);
    assert.equal(pop.close(), false);
  });

  test('the events bubble out of a shadow root', () => {
    const pop = mount();
    const seen = [];
    document.addEventListener('neodigm-poptart-opened', () => seen.push('opened'), { once: true });
    pop.show(trigger('pt'));
    assert.deepEqual(seen, ['opened']);
  });

  test('close when not open does nothing', () => {
    const pop = mount();
    const closes = record(pop, 'close');
    assert.equal(pop.close(), false);
    assert.equal(closes.length, 0);
  });
});

describe('show()', () => {
  test('with no argument, opens beside the first trigger naming it', () => {
    const pop = mount();
    trigger('other');
    const b = trigger('pt', 'hover');
    assert.equal(pop.show(), true);
    assert.equal(pop.trigger, b);
  });

  test('takes a selector', () => {
    const pop = mount();
    trigger('pt', 'click', { id: 'go' });
    pop.show('#go');
    assert.equal(pop.trigger, document.getElementById('go'));
  });

  test('with nothing to open beside, opens only if x and y pin it', () => {
    const lost = mount('lost');
    assert.equal(lost.show(), false);
    assert.equal(mount('half', { x: 20 }).show(), false);
    const pinned = mount('pinned', { x: 20, y: 30, w: 100 });
    assert.equal(pinned.show(), true);
    assert.deepEqual(xy(pinned), [20, 30]);
  });
});

describe('state', () => {
  test('content stays in the page while closed, so a form keeps what was typed', () => {
    const pop = mount('pt', null, { html: '<input value="">' });
    const b = trigger('pt');
    click(b);
    const input = pop.querySelector('input');
    input.value = 'half-typed';
    click(document.body);
    click(b);
    assert.equal(pop.querySelector('input'), input);
    assert.equal(input.value, 'half-typed');
  });

  test('a marquee inside stops while closed and starts again on open', () => {
    const pop = mount('pt', null, { html: '<neodigm-marquee text="news"></neodigm-marquee>' });
    const m = pop.querySelector('neodigm-marquee');
    assert.equal(m.hasAttribute('paused'), true, 'paused before it ever opens');
    pop.show(trigger('pt'));
    assert.equal(m.hasAttribute('paused'), false);
    pop.close();
    assert.equal(m.hasAttribute('paused'), true);
  });

  test('a marquee the page paused stays paused', () => {
    const pop = mount('pt', null, { html: '<neodigm-marquee text="news" paused></neodigm-marquee>' });
    pop.show(trigger('pt'));
    assert.equal(pop.querySelector('neodigm-marquee').hasAttribute('paused'), true);
  });
});

describe('theme', () => {
  test('without its own theme it wears its trigger\'s, read on every open', () => {
    const pop = mount();
    const a = trigger('pt', 'click', { [THEME_ATTR]: 'danger' });
    const b = trigger('pt', 'click', { [THEME_ATTR]: 'success' });
    const plain = trigger('pt');
    pop.show(a);
    assert.equal(pop.getAttribute(THEME_ATTR), 'danger');
    pop.show(b);
    assert.equal(pop.getAttribute(THEME_ATTR), 'success');
    pop.show(plain);
    assert.equal(pop.hasAttribute(THEME_ATTR), false);
  });

  test('its own theme is never replaced', () => {
    const pop = mount();
    pop.setAttribute(THEME_ATTR, 'brand');
    pop.show(trigger('pt', 'click', { [THEME_ATTR]: 'danger' }));
    assert.equal(pop.getAttribute(THEME_ATTR), 'brand');
  });

  test('has a border rule for every theme', () => {
    const css = mount().shadowRoot.querySelector('style').textContent;
    for (const name of THEME_NAMES) {
      assert.match(css, new RegExp(`\\[${THEME_ATTR}="${name}"\\]\\) \\.popup \\{ border-color: var\\(--n55-${name}\\)`));
    }
  });
});

describe('placement', () => {
  const t = { x: 400, y: 300, width: 100, height: 40 };
  const s = { x: 0, y: 0, width: 200, height: 50 };

  test('place() lines up along the edge as asked, centre by default', () => {
    assert.equal(place({ trigger: t, surface: s, position: 'bottom', align: 'start' }).x, 400);
    assert.equal(place({ trigger: t, surface: s, position: 'bottom', align: 'end' }).x, 300);
    assert.equal(place({ trigger: t, surface: s, position: 'bottom' }).x, 350);
    assert.equal(place({ trigger: t, surface: s, position: 'bottom', align: 'diagonal' }).x, 350);
    assert.equal(place({ trigger: t, surface: s, position: 'bottom', align: 'constructor' }).x, 350);
    assert.equal(place({ trigger: t, surface: s, position: 'right', align: 'start' }).y, 300);
    assert.equal(place({ trigger: t, surface: s, position: 'right', align: 'end' }).y, 290);
    assert.equal(place({ trigger: t, surface: s, position: 'left' }).y, 295);
  });

  test('bottom: centred, 10px below, as wide as the trigger', () => {
    const pop = mount();
    pop.show(trigger('pt'));
    assert.equal(pop.style.width, '100px');
    assert.deepEqual(xy(pop), [400, 350]);
    assert.equal(pop.getAttribute('data-side'), 'bottom');
  });

  test('top: above the trigger by its own height, measured after sizing', () => {
    // The original subtracted the trigger's height twice, and measured the
    // surface before it had its width.
    const pop = mount('pt', { position: 'top', w: 200 });
    pop.show(trigger('pt'));
    assert.deepEqual(xy(pop), [350, 300 - 120 - 10]);
  });

  test('right and left: flush beside, top edges level, at any width', () => {
    const right = mount('r', { position: 'right', w: 250, h: 80 });
    right.show(trigger('r'));
    assert.deepEqual(xy(right), [500, 300]);
    const left = mount('l', { position: 'left', w: 250, h: 80 });
    left.show(trigger('l'));
    assert.deepEqual(xy(left), [150, 300]);
  });

  test('the offsets move it and grow it', () => {
    const pop = mount('pt', { h: 60, offset: { x: 5, y: -7, w: 20, h: 4 } });
    pop.show(trigger('pt'));
    assert.equal(pop.style.width, '120px');
    assert.equal(pop.style.height, '64px');
    assert.deepEqual(xy(pop), [390 + 5, 350 - 7]);
  });

  test('a given width ignores offset.w, as the original did', () => {
    const pop = mount('pt', { w: 300, offset: { w: 20 } });
    pop.show(trigger('pt'));
    assert.equal(pop.style.width, '300px');
  });

  test('x and y pin it, whatever the side and offsets say', () => {
    const pop = mount('pt', { position: 'right', x: 0, y: 64, offset: { x: 50, y: 50 } });
    pop.show(trigger('pt'));
    assert.deepEqual(xy(pop), [0, 64]);
  });

  test('z sets its stacking', () => {
    const pop = mount('pt', { z: 264 });
    pop.show(trigger('pt'));
    assert.equal(pop.style.zIndex, '264');
  });

  test('never second-guesses the declared side, even off screen', () => {
    const pop = mount('pt', { position: 'top', w: 200 });
    const corner = at(trigger('pt'), 0, 0, 20, 20);
    pop.show(corner);
    assert.equal(pop.getAttribute('data-side'), 'top');
    assert.deepEqual(xy(pop), [-90, -130]);
  });

  test('follows its trigger when the page scrolls, and stops once closed', async () => {
    const pop = mount();
    const b = trigger('pt');
    pop.show(b);
    at(b, 400, 100, 100, 40);
    window.dispatchEvent(new window.Event('scroll'));
    await frame();
    assert.deepEqual(xy(pop), [400, 150]);
    pop.close();
    at(b, 400, 0, 100, 40);
    window.dispatchEvent(new window.Event('resize'));
    await frame();
    assert.deepEqual(xy(pop), [400, 150]);
  });

  test('holds no scroll or resize listener while closed', () => {
    const pop = mount();
    pop.show(trigger('pt'));
    pop.close();
    const real = window.requestAnimationFrame;
    let asked = 0;
    window.requestAnimationFrame = (fn) => { asked++; return real(fn); };
    try {
      window.dispatchEvent(new window.Event('scroll'));
      window.dispatchEvent(new window.Event('resize'));
    } finally { window.requestAnimationFrame = real; }
    assert.equal(asked, 0);
  });

  test('closing cancels a placement already queued', async () => {
    const pop = mount();
    const b = trigger('pt');
    pop.show(b);
    const before = pop.style.transform;
    at(b, 0, 0, 100, 40);
    window.dispatchEvent(new window.Event('scroll'));
    pop.close();
    await frame();
    assert.equal(pop.style.transform, before);
  });

  test('follows on resize too', async () => {
    const pop = mount();
    const b = trigger('pt');
    pop.show(b);
    at(b, 10, 20, 60, 40);
    window.dispatchEvent(new window.Event('resize'));
    await frame();
    assert.equal(pop.style.width, '60px');
    assert.deepEqual(xy(pop), [10, 70]);
  });
});

describe('shake', () => {
  test('shakes when open, and not when closed or motion is suppressed', () => {
    const pop = mount();
    const surface = pop.shadowRoot.querySelector('.popup');
    pop.shake();
    assert.equal(surface.classList.contains('shake'), false);
    pop.show(trigger('pt'));
    assert.equal(pop.shake(), pop);
    assert.equal(surface.classList.contains('shake'), true);
    surface.classList.remove('shake');
    setMotionAllowed(false);
    pop.shake();
    assert.equal(surface.classList.contains('shake'), false);
  });
});
