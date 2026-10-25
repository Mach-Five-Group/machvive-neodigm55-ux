import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES, THEME_NAMES, THEME_ATTR, PULSE_ATTR,
  themeCss, installTheme, resolveTheme,
  robinTheme, pulseTheme, flashTitle, resetTitle,
  setMotionAllowed, motionAllowed, resetMotion
} from '../src/conductor/index.js';

const themed = (theme, tag = 'button') => {
  const el = document.createElement(tag);
  if (theme !== null) el.setAttribute(THEME_ATTR, theme);
  document.body.append(el);
  return el;
};
const themesOf = () =>
  [...document.body.querySelectorAll(`[${THEME_ATTR}]`)].map((e) => e.getAttribute(THEME_ATTR));
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Records every value an element's theme attribute takes while `fn` runs.
 *
 * Asserting the end state cannot tell a swept element from an untouched one —
 * a sweep restores what it changed, so both read the same afterwards. Two
 * mutation-test survivors hid there until the assertion moved to the transitions.
 */
async function themeTrail(el, fn) {
  const seen = [];
  const observer = new window.MutationObserver((records) => {
    for (const r of records) {
      if (r.attributeName === THEME_ATTR) seen.push(el.getAttribute(THEME_ATTR));
    }
  });
  observer.observe(el, { attributes: true, attributeFilter: [THEME_ATTR] });
  await fn();
  observer.disconnect();
  return seen;
}

beforeEach(() => {
  document.body.replaceChildren();
  resetMotion();
  resetTitle();
  document.title = 'Neodigm';
});
afterEach(() => { resetMotion(); resetTitle(); });

describe('the palette', () => {
  test('carries all thirteen themes from the original library', () => {
    assert.equal(THEME_NAMES.length, 13);
    // Spot-check against N55_THEME_COLORS so a typo in the port is caught.
    assert.equal(THEMES.brand.color, '#EDBA08');
    assert.equal(THEMES.brand.deep, '#915E00');
    assert.equal(THEMES.brand.glyph, '🟧');
    assert.equal(THEMES.party.color, '#FF6F61');
  });

  test('round-robin order is preserved, since robinTheme defaults to the first', () => {
    // The original defaulted to Object.keys(N55_THEME_COLORS)[0], which was brand.
    assert.equal(THEME_NAMES[0], 'brand');
  });

  test('emits every theme as three custom properties', () => {
    const css = themeCss();
    for (const name of THEME_NAMES) {
      assert.match(css, new RegExp(`--n55-${name}:`), `${name} colour missing`);
      assert.match(css, new RegExp(`--n55-${name}-deep:`), `${name} deep missing`);
      assert.match(css, new RegExp(`--n55-${name}-glyph:`), `${name} glyph missing`);
    }
  });

  test('a custom selector scopes the palette, so a section can have its own', () => {
    assert.match(themeCss(THEMES, '.promo'), /^\.promo \{/);
  });

  test('installing twice replaces rather than stacking, so a builder can preview live', () => {
    installTheme();
    installTheme();
    assert.equal(document.querySelectorAll('#n55-theme-tokens').length, 1);
  });

  test('resolveTheme falls back to the built-in when the document cannot answer', () => {
    // jsdom computes custom properties as empty; the fallback is what keeps the
    // tab glyph working rather than silently flashing an empty string.
    assert.equal(resolveTheme('brand').glyph, '🟧');
    assert.equal(resolveTheme('nonsuch'), null);
  });
});

describe('robinTheme — the page-wide sweep', () => {
  test('sweeps every themed element and restores each to its own theme', async () => {
    themed('primary'); themed('success'); themed('danger');
    const swept = await robinTheme('brand', { stagger: 5, hold: 10, flashTab: false });

    assert.equal(swept, 3);
    assert.deepEqual(themesOf(), ['primary', 'success', 'danger'],
      'every element must end on the theme it started with');
  });

  test('the colour actually lands mid-sweep', async () => {
    const a = themed('primary');
    const run = robinTheme('brand', { stagger: 5, hold: 60, flashTab: false });
    await settle(20);
    assert.equal(a.getAttribute(THEME_ATTR), 'brand', 'first element should be showing the sweep');
    await run;
    assert.equal(a.getAttribute(THEME_ATTR), 'primary');
  });

  test('every element holds the colour for the same duration', async () => {
    // The original restored at index*(delay+delay) while setting at index*delay,
    // so element 0 held for 0ms and element N for N*delay — the wave smeared as
    // it travelled, and the first element never visibly changed at all.
    const first = themed('primary');
    const last = [themed('primary'), themed('primary'), themed('primary')].at(-1);
    const run = robinTheme('brand', { stagger: 10, hold: 80, flashTab: false });

    await settle(5);
    assert.equal(first.getAttribute(THEME_ATTR), 'brand', 'element 0 must visibly change');
    await settle(35);
    assert.equal(last.getAttribute(THEME_ATTR), 'brand', 'element 3 should have started');
    await run;
  });

  test('a disabled element is never touched, not merely put back', async () => {
    const off = themed('disabled');
    const on = themed('primary');

    const offTrail = await themeTrail(off, () =>
      robinTheme('brand', { stagger: 5, hold: 10, flashTab: false }));

    assert.deepEqual(offTrail, [], 'disabled means do not choreograph me — no writes at all');
    assert.equal(off.getAttribute(THEME_ATTR), 'disabled');
    assert.equal(on.getAttribute(THEME_ATTR), 'primary');
  });

  test('context scopes the sweep to a subtree', async () => {
    const scope = document.createElement('section');
    document.body.append(scope);
    const inside = document.createElement('button');
    inside.setAttribute(THEME_ATTR, 'primary');
    scope.append(inside);
    const outside = themed('success');

    const swept = await robinTheme('brand', { context: scope, stagger: 5, hold: 10, flashTab: false });
    assert.equal(swept, 1, 'only the scoped element counts');
    assert.equal(outside.getAttribute(THEME_ATTR), 'success');
  });

  test('does NOT reach inside a shadow root — the contract is the host', async () => {
    // This is the central constraint of the port, and the one way to use it
    // wrong. A component is swept by its host attribute; its internals follow
    // via :host() or the inherited custom properties. If this ever starts
    // passing a shadow-internal node, the architecture has drifted.
    const host = document.createElement('div');
    host.setAttribute(THEME_ATTR, 'primary');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    inner.setAttribute(THEME_ATTR, 'success');
    shadow.append(inner);

    const swept = await robinTheme('brand', { stagger: 5, hold: 10, flashTab: false });
    assert.equal(swept, 1, 'the host is swept, the shadow child is not');
    assert.equal(inner.getAttribute(THEME_ATTR), 'success', 'shadow internals are untouched');
  });

  test('an element with no themed elements is a no-op, not an error', async () => {
    assert.equal(await robinTheme('brand', { flashTab: false }), 0);
  });

  test('aborting restores every element immediately', async () => {
    const a = themed('primary');
    const controller = new AbortController();
    const run = robinTheme('brand', { stagger: 5, hold: 500, signal: controller.signal, flashTab: false });
    await settle(20);
    assert.equal(a.getAttribute(THEME_ATTR), 'brand');
    controller.abort();
    assert.equal(a.getAttribute(THEME_ATTR), 'primary', 'abort must not wait out the hold');
    controller.abort();  // idempotent
    await Promise.race([run, settle(50)]);
  });

  test('an element removed mid-sweep does not throw', async () => {
    const doomed = themed('primary');
    const run = robinTheme('brand', { stagger: 5, hold: 30, flashTab: false });
    await settle(10);
    doomed.remove();
    await run;  // must not reject
  });

  test('restores an element that had no theme of its own', async () => {
    // Reachable when a page adds data-n55-theme="" or the attribute is removed
    // between the capture and the restore.
    const el = themed('');
    await robinTheme('brand', { stagger: 5, hold: 10, flashTab: false });
    assert.equal(el.getAttribute(THEME_ATTR), '', 'an empty theme is still its own theme');
  });
});

describe('reduced motion', () => {
  test('suppresses the sweep but still reports what it would have swept', async () => {
    const el = themed('primary');
    setMotionAllowed(false);

    let swept;
    const trail = await themeTrail(el, async () => {
      swept = await robinTheme('brand', { stagger: 5, hold: 10, flashTab: false });
    });

    assert.equal(swept, 1, 'the caller contract is unchanged');
    assert.deepEqual(trail, [], 'nothing moved — not even changed-then-restored');
    assert.equal(el.getAttribute(THEME_ATTR), 'primary');
  });

  test('a normal sweep DOES write, so the checks above can tell the difference', async () => {
    // The control for the two tests that assert an empty trail. Without it, a
    // themeTrail that silently never recorded would make both of them pass.
    const el = themed('primary');
    const trail = await themeTrail(el, () =>
      robinTheme('brand', { stagger: 5, hold: 10, flashTab: false }));
    assert.deepEqual(trail, ['brand', 'primary'], 'swept to brand, then restored');
  });

  test('still flashes the tab, because that is information rather than motion', async () => {
    themed('primary');
    setMotionAllowed(false);
    await robinTheme('brand', { stagger: 5, hold: 10 });
    assert.match(document.title, /^🟧/, 'the signal survives even when the animation does not');
  });

  test('motion is allowed by default where no media query can be consulted', () => {
    // A library whose entire purpose is movement must not default to off just
    // because the environment cannot answer the question.
    assert.equal(motionAllowed(), true);
  });

  test('an explicit setting overrides the OS, and null hands control back', () => {
    setMotionAllowed(false);
    assert.equal(motionAllowed(), false);
    setMotionAllowed(null);
    assert.equal(motionAllowed(), true);
  });
});

describe('flashTitle', () => {
  test('prefixes the glyph and restores the real title', async () => {
    assert.equal(flashTitle('brand', 30), true);
    assert.equal(document.title, '🟧Neodigm');
    await settle(60);
    assert.equal(document.title, 'Neodigm');
  });

  test('overlapping flashes do not accumulate prefixes', async () => {
    flashTitle('brand', 200);
    flashTitle('danger', 30);
    assert.equal(document.title, '🟥Neodigm', 'the second flash replaces the first');
    await settle(60);
    assert.equal(document.title, 'Neodigm', 'and restores to the real title, not a prefixed one');
  });

  test('an unknown theme changes nothing', () => {
    assert.equal(flashTitle('nonsuch'), false);
    assert.equal(document.title, 'Neodigm');
  });
});

describe('pulseTheme', () => {
  test('sweeps the pulse attribute on its own slower cadence', async () => {
    const el = document.createElement('div');
    el.setAttribute(PULSE_ATTR, 'primary');
    document.body.append(el);

    const run = pulseTheme('marcom', { stagger: 5, hold: 40 });
    await settle(15);
    assert.equal(el.getAttribute(PULSE_ATTR), 'marcom');
    await run;
    assert.equal(el.getAttribute(PULSE_ATTR), 'primary');
  });

  test('is independent of robinTheme, which the original did not allow', async () => {
    // The original ran both from one robinTheme() call, so a page that wanted
    // only the fast sweep got the 3s pulse as well.
    const pulse = document.createElement('div');
    pulse.setAttribute(PULSE_ATTR, 'primary');
    document.body.append(pulse);
    themed('success');

    await robinTheme('brand', { stagger: 5, hold: 10, flashTab: false });
    assert.equal(pulse.getAttribute(PULSE_ATTR), 'primary', 'pulse elements are not swept by robinTheme');
  });
});
