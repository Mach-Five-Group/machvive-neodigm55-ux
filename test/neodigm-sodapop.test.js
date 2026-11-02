import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import '../src/wc/neodigm-marquee/neodigm-marquee.js';
import '../src/wc/neodigm-sodapop/neodigm-sodapop.js';
import { readPopup } from '../src/wc/neodigm-sodapop/neodigm-sodapop.js';
import { THEME_NAMES, THEME_ATTR, setMotionAllowed, resetMotion } from '../src/conductor/index.js';

const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const mount = () => {
  const el = document.createElement('neodigm-sodapop');
  document.body.append(el);
  return el;
};
/** A template as the wiki writes them. */
const template = (id, attrs = {}, html = `<p>${id} content</p>`) => {
  const t = document.createElement('template');
  t.id = id;
  for (const [k, v] of Object.entries(attrs)) t.setAttribute(`data-n55-sodapop-${k}`, v);
  t.innerHTML = html;
  document.body.append(t);
  return t;
};
const trigger = (id, attrs = {}) => {
  const b = document.createElement('button');
  b.setAttribute('data-n55-sodapop-id', id);
  for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
  b.append(document.createElement('span'));
  document.body.append(b);
  return b;
};
const part = (el, sel) => el.shadowRoot.querySelector(sel);
const escape = () => {
  const ev = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.body.dispatchEvent(ev);
  return ev;
};
const record = (el, kind) => {
  const seen = [];
  el.addEventListener(`neodigm-sodapop-${kind}`, (e) => seen.push(e.detail));
  return seen;
};

beforeEach(() => { document.body.replaceChildren(); resetMotion(); });
afterEach(() => { document.body.replaceChildren(); resetMotion(); });

describe('the declarative format', () => {
  test('reads the template options from the cheat sheet', () => {
    const t = template('p', { modal: 'true', size: 'small', fullscreen: 'true', transition: 'slide-right' });
    assert.deepEqual(readPopup(t),
      { modal: true, size: 'small', fullscreen: true, transition: 'slide-right', scheme: '' });
  });

  test('a missing or unknown size is medium, not a bogus class', () => {
    // The original produced `ndsp__size--undefined` and a full-width popup.
    assert.equal(readPopup(template('a')).size, 'medium');
    assert.equal(readPopup(template('b', { size: 'enormous' })).size, 'medium');
    assert.equal(readPopup(template('c', { transition: 'spin' })).transition, '');
    assert.deepEqual(readPopup(null),
      { modal: false, size: 'medium', fullscreen: false, transition: '', scheme: '' });
  });

  test('a scheme other than light or dark is ignored', () => {
    const t = template('p');
    t.setAttribute('data-n55-scheme', 'purple');
    assert.equal(readPopup(t).scheme, '');
    t.setAttribute('data-n55-scheme', 'light');
    assert.equal(readPopup(t).scheme, 'light');
  });

  test('only the string "true" turns modal or fullscreen on', () => {
    assert.equal(readPopup(template('a', { modal: 'false' })).modal, false);
    assert.equal(readPopup(template('b', { modal: '' })).modal, false);
    assert.equal(readPopup(template('c', { fullscreen: 'yes' })).fullscreen, false);
  });

  test('a trigger opens its template, and its own click goes no further', () => {
    const pop = mount();
    template('myPopup_id');
    const b = trigger('myPopup_id');
    const ev = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    b.firstChild.dispatchEvent(ev);        // a click on something inside the trigger
    assert.equal(pop.open, true);
    assert.equal(pop.current, 'myPopup_id');
    assert.equal(pop.textContent, 'myPopup_id content');
    assert.equal(ev.defaultPrevented, true);
  });

  test('a disabled trigger, or one in a disabled region, opens nothing', () => {
    const pop = mount();
    template('p');
    trigger('p', { [THEME_ATTR]: 'disabled' }).click();
    assert.equal(pop.open, false);
    const region = document.createElement('div');
    region.setAttribute(THEME_ATTR, 'disabled');
    region.append(trigger('p'));
    document.body.append(region);
    region.querySelector('button').click();
    assert.equal(pop.open, false);
    // The nearest theme decides: a themed trigger inside a disabled region opens.
    region.querySelector('button').setAttribute(THEME_ATTR, 'brand');
    region.querySelector('button').click();
    assert.equal(pop.open, true);
  });

  test('an unknown id opens nothing', () => {
    const pop = mount();
    pop.show('nope');
    assert.equal(pop.open, false);
    assert.equal(pop.current, null);
  });
});

describe('content', () => {
  test('is cloned into the light DOM on every open, so the template is untouched', () => {
    const pop = mount();
    const t = template('p', {}, '<p class="x">one</p><p>two</p>');
    pop.show('p');
    assert.equal(pop.querySelectorAll('p').length, 2);
    assert.equal(t.content.childNodes.length, 2, 'the template keeps its content');
    pop.querySelector('.x').textContent = 'changed';
    pop.close();
    pop.show('p');
    assert.equal(pop.querySelector('.x').textContent, 'one', 'a fresh copy each time');
  });

  test('drops scripts, which did not run under the original innerHTML', () => {
    const pop = mount();
    globalThis.ran = false;
    template('p', {}, '<p>hi</p><script>globalThis.ran = true</script>');
    pop.show('p');
    assert.equal(pop.querySelector('script'), null);
    assert.equal(globalThis.ran, false);
  });

  test('a plain element works as a source too, as it did with innerHTML', () => {
    const pop = mount();
    const div = document.createElement('div');
    div.id = 'plain';
    div.innerHTML = '<b>bold</b>';
    document.body.append(div);
    pop.show('plain');
    assert.equal(pop.querySelector('b').textContent, 'bold');
    assert.equal(div.querySelector('b').textContent, 'bold', 'copied, not moved');
  });

  test('leaves after the surface does, and stops anything animating inside it', async () => {
    const pop = mount();
    template('p', {}, '<neodigm-marquee text="news"></neodigm-marquee>');
    pop.show('p');
    pop.close();
    assert.ok(pop.querySelector('neodigm-marquee'), 'still there while it slides away');
    await settle(450);
    assert.equal(pop.childNodes.length, 0);
  });

  test('reopening before the content leaves keeps the new content', async () => {
    const pop = mount();
    template('a');
    template('b');
    pop.show('a');
    pop.close();
    pop.show('b');
    await settle(450);
    assert.equal(pop.textContent, 'b content');
  });

  test('removing the element cancels the pending clear-out', async () => {
    const pop = mount();
    template('p');
    pop.show('p');
    pop.close();
    pop.remove();
    await settle(450);
    assert.equal(pop.textContent, 'p content', 'no timer outlived the element');
  });
});

describe('closing', () => {
  test('the scrim, Escape and the X each close it, and say which', () => {
    const pop = mount();
    template('p');
    const seen = record(pop, 'close');
    pop.show('p');
    part(pop, '.scrim').click();
    pop.show('p');
    const ev = escape();
    pop.show('p');
    part(pop, '.close path').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    assert.equal(pop.open, false);
    assert.deepEqual(seen.map((d) => d.reason), ['scrim', 'escape', 'close']);
    assert.deepEqual(seen.map((d) => d.id), ['p', 'p', 'p']);
    assert.equal(ev.defaultPrevented, true);
  });

  test('clicks inside the popup do not close it', () => {
    const pop = mount();
    template('p');
    pop.show('p');
    part(pop, '.pop').click();
    pop.querySelector('p').click();
    assert.equal(pop.open, true);
  });

  test('a listener can veto closing, as returning false from setOnClose did', () => {
    const pop = mount();
    template('p');
    pop.addEventListener('neodigm-sodapop-close', (e) => e.preventDefault());
    pop.show('p');
    part(pop, '.scrim').click();
    escape();
    assert.equal(pop.close(), false);
    assert.equal(pop.open, true);
  });

  test('close() is false with nothing open, and reports the api', () => {
    const pop = mount();
    template('p');
    const seen = record(pop, 'close');
    assert.equal(pop.close(), false);
    pop.show('p');
    assert.equal(pop.close(), true);
    assert.deepEqual(seen, [{ id: 'p', reason: 'api' }]);
    assert.equal(pop.current, null);
  });

  test('Escape does nothing with nothing open, or once someone handled it', () => {
    const pop = mount();
    template('p');
    assert.equal(escape().defaultPrevented, false);
    pop.show('p');
    document.body.addEventListener('keydown', (e) => e.preventDefault(), { capture: true, once: true });
    escape();
    assert.equal(pop.open, true);
  });

  test('releases its document listeners on removal', () => {
    // show() refuses when detached, which hides a leak from behaviour; only a
    // count sees it, and a leak keeps a removed element alive.
    const live = new Set();
    const { addEventListener: add, removeEventListener: remove } = document;
    document.addEventListener = function (type, fn, o) { live.add(fn); return add.call(this, type, fn, o); };
    document.removeEventListener = function (type, fn, o) { live.delete(fn); return remove.call(this, type, fn, o); };
    try {
      const pop = mount();
      assert.equal(live.size, 2, 'click and keydown');
      pop.remove();
      assert.equal(live.size, 0);
    } finally {
      document.addEventListener = add;
      document.removeEventListener = remove;
    }
  });

  test('a removed element stops listening to the document', () => {
    const pop = mount();
    template('p');
    const b = trigger('p');
    pop.remove();
    b.click();
    assert.equal(pop.open, false);
  });
});

describe('modal', () => {
  test('the scrim and Escape shake instead of closing, and there is no X', () => {
    const pop = mount();
    template('m', { modal: 'true' });
    const seen = record(pop, 'close');
    pop.show('m');
    assert.equal(pop.modal, true);
    part(pop, '.scrim').click();
    assert.ok(part(pop, '.pop').classList.contains('shake'), 'the scrim shook it');
    part(pop, '.pop').classList.remove('shake');
    escape();
    assert.ok(part(pop, '.pop').classList.contains('shake'), 'Escape shook it');
    assert.equal(pop.open, true);
    assert.deepEqual(seen, [], 'no close was even attempted');
    assert.ok(part(pop, '.frame').classList.contains('modal'));
  });

  test('close() still closes it — the only way out, as documented', () => {
    const pop = mount();
    template('m', { modal: 'true' });
    pop.show('m');
    assert.equal(pop.close(), true);
    assert.equal(pop.modal, false);
  });

  test('a non-modal popup after a modal one is dismissable again', () => {
    const pop = mount();
    template('m', { modal: 'true' });
    template('p');
    pop.show('m');
    pop.show('p');
    part(pop, '.scrim').click();
    assert.equal(pop.open, false);
    assert.equal(part(pop, '.frame').classList.contains('modal'), false);
  });
});

describe('opening', () => {
  test('open is cancelable, then opened follows, both carrying the id and options', () => {
    const pop = mount();
    template('p', { size: 'large' });
    const opened = record(pop, 'opened');
    pop.addEventListener('neodigm-sodapop-open', (e) => e.preventDefault(), { once: true });
    pop.show('p');
    assert.equal(pop.open, false);
    assert.deepEqual(opened, []);
    pop.show('p');
    assert.equal(opened.length, 1);
    assert.equal(opened[0].id, 'p');
    assert.equal(opened[0].popup.size, 'large');
  });

  test('show(id).shake() shakes, which the cheat sheet\'s autoOpen(id).shake() never did', () => {
    const pop = mount();
    template('p');
    assert.equal(pop.show('p').shake(), pop);
    assert.ok(part(pop, '.pop').classList.contains('shake'));
  });

  test('shake does nothing when closed or when motion is suppressed', () => {
    const pop = mount();
    template('p');
    pop.shake();
    assert.equal(part(pop, '.pop').classList.contains('shake'), false);
    setMotionAllowed(false);
    pop.show('p').shake();
    assert.equal(part(pop, '.pop').classList.contains('shake'), false);
    assert.ok(part(pop, '.frame').classList.contains('still'));
  });

  test('a second popup replaces the first, which can veto it', () => {
    const pop = mount();
    template('a');
    template('b');
    const seen = record(pop, 'close');
    pop.show('a').show('b');
    assert.equal(pop.current, 'b');
    assert.equal(pop.textContent, 'b content');
    assert.deepEqual(seen, [{ id: 'a', reason: 'replace' }]);
    pop.addEventListener('neodigm-sodapop-close', (e) => e.preventDefault(), { once: true });
    pop.show('a');
    assert.equal(pop.current, 'b', 'vetoed, so b stays');
  });

  test('a vetoed open leaves the current popup showing', () => {
    const pop = mount();
    template('a');
    template('b');
    pop.show('a');
    pop.addEventListener('neodigm-sodapop-open', (e) => e.preventDefault(), { once: true });
    pop.show('b');
    assert.equal(pop.current, 'a');
    assert.equal(pop.open, true);
  });

  test('size, transition and scheme dress the frame', () => {
    const pop = mount();
    const t = template('p', { size: 'xsmall', transition: 'slide-right' });
    t.setAttribute('data-n55-scheme', 'dark');
    pop.show('p');
    const frame = part(pop, '.frame');
    assert.ok(frame.classList.contains('size-xsmall'));
    assert.ok(frame.classList.contains('slide-right'));
    assert.equal(frame.style.colorScheme, 'dark');
    template('q');
    pop.show('q');
    assert.equal(frame.className, 'frame size-medium', 'nothing carried over');
    assert.equal(frame.style.colorScheme, '');
  });

  test('moves focus into the popup and gives it back, past a replacement', () => {
    const pop = mount();
    template('a');
    template('b');
    const b = trigger('a');
    b.focus();
    pop.show('a');
    assert.equal(pop.shadowRoot.activeElement, part(pop, '.pop'));
    pop.show('b');
    pop.close();
    assert.equal(document.activeElement, b);
  });
});

describe('focus', () => {
  test('is not taken back from somewhere the page moved it', () => {
    const pop = mount();
    template('p');
    const b = trigger('p');
    const elsewhere = document.createElement('input');
    document.body.append(elsewhere);
    b.focus();
    pop.show('p');
    elsewhere.focus();
    pop.close();
    assert.equal(document.activeElement, elsewhere);
  });
});

describe('fullscreen', () => {
  const stubFullscreen = () => {
    const calls = { request: 0, exit: 0 };
    const root = document.documentElement;
    root.requestFullscreen = () => { calls.request++; document.fullscreenElement = root; return Promise.resolve(); };
    document.exitFullscreen = () => { calls.exit++; document.fullscreenElement = null; return Promise.resolve(); };
    return calls;
  };
  afterEach(() => {
    delete document.documentElement.requestFullscreen;
    delete document.exitFullscreen;
    delete document.fullscreenElement;
  });

  test('a fullscreen template asks for full screen, and leaves it on close', () => {
    const calls = stubFullscreen();
    const pop = mount();
    template('f', { fullscreen: 'true' });
    pop.show('f');
    assert.equal(calls.request, 1);
    assert.ok(part(pop, '.frame').classList.contains('fullscreen'));
    pop.close();
    assert.equal(calls.exit, 1);
  });

  test('an ordinary template leaves full screen alone', () => {
    const calls = stubFullscreen();
    const pop = mount();
    template('p');
    pop.show('p');
    pop.close();
    assert.deepEqual(calls, { request: 0, exit: 0 });
  });

  test('without a user gesture it does not ask, as the original skipped it from a URL', () => {
    const calls = stubFullscreen();
    Object.defineProperty(navigator, 'userActivation', { value: { isActive: false }, configurable: true });
    try {
      const pop = mount();
      template('f', { fullscreen: 'true' });
      pop.show('f');
      assert.equal(calls.request, 0);
    } finally {
      delete navigator.userActivation;
    }
  });
});

describe('theming', () => {
  test('the host theme colours the X with the legible shade, for every theme', () => {
    const css = part(mount(), 'style').textContent;
    for (const name of THEME_NAMES) {
      assert.match(css, new RegExp(
        `:host\\(\\[${THEME_ATTR}="${name}"\\]\\) \\.close \\{\\s*` +
        `background: var\\(--n55-${name}-legible\\);\\s*color: var\\(--n55-${name}-legible-ink\\);`), name);
    }
  });

  test('the popup is a light/dark surface from the neutrals', () => {
    const css = part(mount(), 'style').textContent;
    const pop = css.slice(css.indexOf('.pop {'), css.indexOf('}', css.indexOf('.pop {')));
    assert.match(pop, /background: var\(--n55-surface, #fff\)/);
    assert.match(pop, /color: var\(--n55-surface-ink, #1a1a1a\)/);
  });

  test('the theme sits on the host, where a sweep can reach it', () => {
    const pop = mount();
    pop.setAttribute(THEME_ATTR, 'brand');
    assert.equal(pop.shadowRoot.querySelector(`[${THEME_ATTR}]`), null);
  });
});
