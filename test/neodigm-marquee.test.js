import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import '../src/wc/neodigm-marquee/neodigm-marquee.js';
import { parseRuns, plainText, DEFAULT_SPEED } from '../src/wc/neodigm-marquee/neodigm-marquee.js';
import { THEME_ATTR, robinTheme, setMotionAllowed, resetMotion } from '../src/conductor/index.js';

const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const mount = (attrs = {}) => {
  const el = document.createElement('neodigm-marquee');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  document.body.append(el);
  return el;
};
const view = (el) => el.shadowRoot.querySelector('.view');
const shown = (el) => view(el).textContent;
const runs = (el) =>
  [...view(el).querySelectorAll('[data-run]')].map((s) => [s.getAttribute('data-run'), s.textContent]);

beforeEach(() => { document.body.replaceChildren(); resetMotion(); });
afterEach(() => { document.body.replaceChildren(); resetMotion(); });

describe('parsing', () => {
  test('plain text has no runs', () => {
    assert.deepEqual(parseRuns('ab').map((c) => c.theme), [null, null]);
  });

  test('a themed run marks only its own characters', () => {
    const cells = parseRuns('a[brand]bc[/brand]d');
    assert.deepEqual(cells.map((c) => c.char).join(''), 'abcd');
    assert.deepEqual(cells.map((c) => c.theme), [null, 'brand', 'brand', null]);
  });

  test('the same colour can appear more than once', () => {
    // The original matched markers with indexOf, so only the first run of any
    // colour was ever highlighted.
    const cells = parseRuns('[brand]a[/brand]-[brand]b[/brand]');
    assert.deepEqual(cells.map((c) => c.theme), ['brand', null, 'brand']);
  });

  test('an unknown theme degrades to no colour rather than breaking the text', () => {
    const cells = parseRuns('[nonsuch]ab[/nonsuch]');
    assert.equal(cells.map((c) => c.char).join(''), 'ab');
    assert.deepEqual(cells.map((c) => c.theme), [null, null]);
  });

  test('plainText strips the markup, for the accessible name', () => {
    assert.equal(plainText('Shipping [brand]free[/brand] today'), 'Shipping free today');
  });

  test('characters outside the basic plane survive the split', () => {
    // The rotation spreads the string; a naive split would tear surrogate pairs
    // and render replacement characters.
    const cells = parseRuns('a🟧b');
    assert.equal(cells.length, 3);
    assert.equal(cells[1].char, '🟧');
  });
});

describe('rendering', () => {
  test('shows the text', () => {
    const el = mount({ text: 'hello', paused: '' });
    assert.equal(shown(el), 'hello');
  });

  test('a themed run becomes a real span, not an invisible marker', () => {
    // The original delimited runs with zero-width and bidi control characters
    // and painted them with the CSS Custom Highlight API, so a browser without
    // that API showed no colour at all and the control characters travelled
    // with any copy-paste.
    const el = mount({ text: 'go [danger]now[/danger]', paused: '' });
    assert.deepEqual(runs(el), [['danger', 'now']]);
    assert.equal(shown(el), 'go now', 'and the text reads normally');
  });

  test('no invisible control characters reach the rendered text', () => {
    // The ranges are built from a string rather than written as a regex
    // literal on purpose: U+2028 is LINE SEPARATOR, and pasting it into
    // source breaks the file. That it is hazardous even here is the whole
    // argument against using it to delimit coloured runs.
    const INVISIBLE = new RegExp(
      '[\\u200B-\\u200F\\u2028\\u2029\\u202A-\\u202E\\u2060-\\u2064\\u206A-\\u206F\\uFEFF]');
    const el = mount({ text: 'a[brand]b[/brand]c', paused: '' });
    assert.ok(!INVISIBLE.test(shown(el)),
      'the rendered text must be clean enough to copy');
  });

  test('neighbouring characters of one theme collapse into a single span', () => {
    const el = mount({ text: '[info]abc[/info]', paused: '' });
    assert.equal(view(el).querySelectorAll('[data-run]').length, 1);
  });

  test('markup in the message is text, never parsed', () => {
    const el = mount({ text: '<img src=x onerror=alert(1)>', paused: '' });
    assert.equal(view(el).querySelectorAll('img').length, 0);
    assert.match(shown(el), /<img/);
  });

  test('the animated copy is hidden from assistive technology', () => {
    // The visible text changes every tick, which is unreadable aloud.
    const el = mount({ text: 'rolling', paused: '' });
    assert.equal(view(el).getAttribute('aria-hidden'), 'true');
    assert.equal(el.getAttribute('aria-label'), 'rolling', 'the settled text is what is announced');
  });

  test('the accessible name carries the plain text, not the markup', () => {
    const el = mount({ text: 'buy [brand]now[/brand]', paused: '' });
    assert.equal(el.getAttribute('aria-label'), 'buy now');
  });
});

describe('scrolling', () => {
  test('one step rotates by one character', () => {
    const el = mount({ text: 'abcd', paused: '' });
    el.step();
    assert.equal(shown(el), 'bcda');
    el.step();
    assert.equal(shown(el), 'cdab');
  });

  test('a full rotation returns to the start', () => {
    const el = mount({ text: 'abcd', paused: '' });
    for (let i = 0; i < 4; i++) el.step();
    assert.equal(shown(el), 'abcd');
  });

  test('stepping backwards is the other direction', () => {
    const el = mount({ text: 'abcd', paused: '' });
    el.step(-1);
    assert.equal(shown(el), 'dabc');
  });

  test('a themed run travels with its characters', () => {
    const el = mount({ text: '[brand]ab[/brand]cd', paused: '' });
    assert.deepEqual(runs(el), [['brand', 'ab']]);
    el.step();
    // 'a' has wrapped to the end and is still branded, so the one run becomes
    // two — which is itself something the original could not represent, since
    // it matched a single range per colour.
    assert.deepEqual(runs(el), [['brand', 'b'], ['brand', 'a']]);
    assert.equal(shown(el), 'bcda', 'and the text reads correctly across the wrap');
  });

  test('the source text is never destroyed by scrolling', () => {
    // The original wrote the rotated string back over the data attribute every
    // frame, so after one tick nobody could read the message back — including
    // Tulip, which sets that very attribute.
    const el = mount({ text: 'abcd', paused: '' });
    el.step(); el.step();
    assert.equal(el.getAttribute('text'), 'abcd', 'the attribute still holds the message');
    assert.equal(el.text, 'abcd', 'and so does the property');
  });

  test('it actually animates when left running', async () => {
    const el = mount({ text: 'abcdef', speed: 16 });
    assert.equal(el.running, true);
    const before = shown(el);
    await settle(60);
    assert.notEqual(shown(el), before, 'the view should have advanced');
  });

  test('pause stops it and play resumes', async () => {
    const el = mount({ text: 'abcdef', speed: 16 });
    el.pause();
    assert.equal(el.running, false);
    const frozen = shown(el);
    await settle(50);
    assert.equal(shown(el), frozen);
    el.play();
    assert.equal(el.running, true);
  });

  test('an empty message does not spin a timer', () => {
    const el = mount({ text: '' });
    assert.equal(el.running, false);
  });

  test('the default speed matches the original metronome interval', () => {
    assert.equal(DEFAULT_SPEED, 132);
  });
});

describe('reduced motion', () => {
  test('does not scroll, and shows the text at rest', async () => {
    setMotionAllowed(false);
    const el = mount({ text: 'abcdef', speed: 16 });
    assert.equal(el.running, false, 'no timer at all');
    await settle(50);
    assert.equal(shown(el), 'abcdef', 'the whole message is readable');
  });

  test('starts scrolling if the preference changes mid-session', async () => {
    setMotionAllowed(false);
    const el = mount({ text: 'abcdef', speed: 16 });
    assert.equal(el.running, false);
    setMotionAllowed(true);
    assert.equal(el.running, true, 'it should pick the change up without a remount');
  });
});

describe('page choreography', () => {
  test('a sweep colours the marquee like anything else', async () => {
    const el = mount({ text: 'abc', paused: '' });
    el.setAttribute(THEME_ATTR, 'primary');
    const trail = [];
    new window.MutationObserver(() => trail.push(el.getAttribute(THEME_ATTR)))
      .observe(el, { attributes: true, attributeFilter: [THEME_ATTR] });

    await robinTheme('marcom', { stagger: 5, hold: 20, flashTab: false });
    assert.deepEqual(trail, ['marcom', 'primary']);
  });

  test('its stylesheet covers every theme, for the host and for runs', () => {
    const el = mount({ text: 'a', paused: '' });
    const css = el.shadowRoot.querySelector('style').textContent;
    for (const name of ['brand', 'danger', 'marcom', 'party']) {
      assert.match(css, new RegExp(`\\[${THEME_ATTR}="${name}"\\]`), `${name} host rule missing`);
      assert.match(css, new RegExp(`\\[data-run="${name}"\\]`), `${name} run rule missing`);
    }
  });
});

describe('composition, which is how Tulip will drive it', () => {
  test('reads the data attribute the original used', () => {
    const el = mount({ 'data-n55-marquee-text': 'from tulip', paused: '' });
    assert.equal(shown(el), 'from tulip');
  });

  test('setting the text later re-renders', () => {
    const el = mount({ text: 'first', paused: '' });
    el.text = 'second';
    assert.equal(shown(el), 'second');
    assert.equal(el.getAttribute('aria-label'), 'second');
  });

  test('changing the text resets the scroll position', () => {
    const el = mount({ text: 'abcd', paused: '' });
    el.step(); el.step();
    el.text = 'wxyz';
    assert.equal(shown(el), 'wxyz', 'a new message starts from its beginning');
  });

  test('falls back to its own light-DOM text', () => {
    const el = document.createElement('neodigm-marquee');
    el.textContent = 'slotted message';
    el.setAttribute('paused', '');
    document.body.append(el);
    assert.equal(shown(el), 'slotted message');
  });
});
