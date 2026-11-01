import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES, THEME_NAMES, THEME_ATTR, PULSE_ATTR,
  themeCss, installTheme, resolveTheme,
  INK_DARK, INK_LIGHT, contrast, inkFor, WCAG_AA, legibleFor, NEUTRALS, SCHEME_ATTR,
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

  test('emits an ink for each surface of every theme', () => {
    const css = themeCss();
    for (const name of THEME_NAMES) {
      const t = THEMES[name];
      assert.match(css, new RegExp(`--n55-${name}-ink: ${inkFor(t.color)};`), `${name} ink`);
      assert.match(css, new RegExp(`--n55-${name}-deep-ink: ${inkFor(t.deep)};`), `${name} deep ink`);
    }
  });

  test('contrast matches the WCAG formula at its fixed points', () => {
    assert.equal(contrast('#000000', '#ffffff'), 21);
    assert.equal(contrast('#fff', '#fff'), 1);
    assert.equal(contrast('#777777', '#ffffff').toFixed(2), '4.48');
    // Greys hide the channel weights and the linear segment at the dark end;
    // a saturated colour and a near-black pin both.
    assert.equal(contrast('#ff0000', '#ffffff').toFixed(2), '4.00');
    assert.equal(contrast('#050505', '#000000').toFixed(3), '1.030');
    assert.ok(Number.isNaN(contrast('rgb(0 0 0)', '#fff')), 'only hex is measured');
  });

  test('inkFor picks whichever neutral contrasts more', () => {
    assert.equal(inkFor('#ffffff'), INK_DARK);
    assert.equal(inkFor('#000000'), INK_LIGHT);
    for (const { color, deep } of Object.values(THEMES)) {
      for (const surface of [color, deep]) {
        const best = Math.max(contrast(INK_DARK, surface), contrast(INK_LIGHT, surface));
        assert.equal(contrast(inkFor(surface), surface), best, `${surface} took the weaker ink`);
      }
    }
  });

  test('every theme\'s text on its colour now clears 4.25:1', () => {
    // -deep on the colour, which the components used before, measured 1.76
    // for party and 1.81 for marcom. Not 4.5, because two themes top out just
    // under AA with either neutral — marcom at 4.297, danger at 4.32. The fix
    // for those is the colour, not the ink.
    for (const [name, t] of Object.entries(THEMES)) {
      const ratio = contrast(inkFor(t.color), t.color);
      assert.ok(ratio >= 4.25, `${name}: ${ratio.toFixed(3)}`);
    }
  });

  test('every theme has one shade that carries text at AA, and -legible names it', () => {
    // The palette's rule: light or deep, one of them reaches 4.5 with its ink.
    // Danger and marcom only manage it on the deep shade (10.86 and 7.33).
    for (const [name, t] of Object.entries(THEMES)) {
      const shade = legibleFor(t);
      const surface = shade === 'deep' ? t.deep : t.color;
      const ratio = contrast(surface, inkFor(surface));
      assert.ok(ratio >= WCAG_AA, `${name} ${shade}: ${ratio.toFixed(2)}`);
    }
    assert.equal(WCAG_AA, 4.5);
  });

  test('legibleFor prefers the colour, and falls to deep only when it must', () => {
    assert.equal(legibleFor(THEMES.brand), 'color');
    assert.equal(legibleFor(THEMES.success), 'color', 'success passes at 4.54, by a hair');
    assert.equal(legibleFor(THEMES.danger), 'deep');
    assert.equal(legibleFor(THEMES.marcom), 'deep');
    // Neither passes: the better of the two, rather than a fixed side.
    // #777777 tops out at 4.48 and #808080 at 4.41.
    assert.equal(legibleFor({ color: '#777777', deep: '#808080', glyph: 'x' }), 'color');
    assert.equal(legibleFor({ color: '#808080', deep: '#777777', glyph: 'x' }), 'deep');
    // An explicit ink is what gets measured.
    assert.equal(legibleFor({ color: '#000000', deep: '#000000', glyph: 'x', ink: '#000000' }), 'deep');
  });

  test('emits -legible as references to the chosen shade and its ink', () => {
    const css = themeCss();
    assert.match(css, /--n55-brand-legible: var\(--n55-brand\);/);
    assert.match(css, /--n55-brand-legible-ink: var\(--n55-brand-ink\);/);
    assert.match(css, /--n55-danger-legible: var\(--n55-danger-deep\);/);
    assert.match(css, /--n55-marcom-legible-ink: var\(--n55-marcom-deep-ink\);/);
  });

  test('a custom theme gets inks computed, and an explicit ink wins', () => {
    const css = themeCss({ mine: { color: '#101010', deep: '#f0f0f0', glyph: 'x' } });
    assert.match(css, /--n55-mine-ink: #fff;/);
    assert.match(css, /--n55-mine-deep-ink: #1a1a1a;/);
    const set = themeCss({ mine: { color: '#101010', deep: '#f0f0f0', glyph: 'x', ink: '#ffcc00' } });
    assert.match(set, /--n55-mine-ink: #ffcc00;/);
  });

  test('a non-hex colour falls back to the dark ink rather than throwing', () => {
    assert.equal(inkFor('oklch(70% 0.1 200)'), INK_DARK);
    assert.equal(inkFor(undefined), INK_DARK);
  });

  test('emits each neutral as a light-dark pair', () => {
    const css = themeCss();
    assert.match(css, /--n55-surface: light-dark\(#fff, #1a1a1a\);/);
    assert.match(css, /--n55-surface-ink: light-dark\(#1a1a1a, #fff\);/);
    assert.match(css, /--n55-inverse-ink: light-dark\(#fff, #1a1a1a\);/);
    for (const key of Object.keys(NEUTRALS)) {
      const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      assert.match(css, new RegExp(`--n55-${name}: light-dark\\(`), `${name} missing`);
    }
  });

  test('every neutral ink reads on its surface in both modes', () => {
    for (const [surface, ink] of [['surface', 'surfaceInk'], ['inverse', 'inverseInk']]) {
      for (const mode of [0, 1]) {
        const ratio = contrast(NEUTRALS[ink][mode], NEUTRALS[surface][mode]);
        assert.ok(ratio >= 4.5, `${ink} on ${surface}, ${mode ? 'dark' : 'light'}: ${ratio.toFixed(2)}`);
      }
    }
  });

  test('data-n55-scheme pins a subtree to light or dark', () => {
    const css = themeCss();
    assert.equal(SCHEME_ATTR, 'data-n55-scheme');
    assert.match(css, /\[data-n55-scheme="dark"\] \{ color-scheme: dark; \}/);
    assert.match(css, /\[data-n55-scheme="light"\] \{ color-scheme: light; \}/);
  });

  test('the palette leaves the page\'s own color-scheme alone', () => {
    // Setting it on :root would also restyle the page's scrollbars and form
    // controls. Only the opt-in attribute sets it.
    const block = themeCss().split('}')[0];
    assert.doesNotMatch(block, /color-scheme/);
  });

  test('installTheme passes custom neutrals through', () => {
    const style = installTheme({ neutrals: { surface: ['#fafafa', '#101010'] } });
    assert.match(style.textContent, /--n55-surface: light-dark\(#fafafa, #101010\);/);
    installTheme();
  });

  test('custom neutrals replace the built-in pairs', () => {
    const css = themeCss({}, ':root', { surface: ['#fafafa', '#101010'] });
    assert.match(css, /--n55-surface: light-dark\(#fafafa, #101010\);/);
    assert.doesNotMatch(css, /--n55-inverse:/);
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
    assert.equal(resolveTheme('brand').ink, inkFor(THEMES.brand.color));
    assert.equal(resolveTheme('brand').deepInk, inkFor(THEMES.brand.deep));
    const headless = resolveTheme('brand', { doc: {} });
    assert.equal(headless.ink, inkFor(THEMES.brand.color), 'and with no document at all');
    assert.equal(headless.deepInk, inkFor(THEMES.brand.deep));
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
