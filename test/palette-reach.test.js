import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import '../src/wc/neodigm-marquee/neodigm-marquee.js';
import '../src/wc/neodigm-tulip/neodigm-tulip.js';
import '../src/wc/neodigm-buffet/neodigm-buffet.js';
import '../src/wc/neodigm-toast/neodigm-toast.js';
import '../src/wc/neodigm-side-dish/neodigm-side-dish.js';
import '../src/wc/neodigm-sodapop/neodigm-sodapop.js';
import { installTheme, paletteReaches, resetPaletteWarning, THEME_ATTR } from '../src/conductor/index.js';

const settle = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const warnings = () => {
  const seen = [];
  const original = console.warn;
  console.warn = (msg) => seen.push(String(msg));
  return { seen, restore: () => { console.warn = original; } };
};
const themed = (tag, theme = 'night') => {
  const el = document.createElement(tag);
  el.setAttribute(THEME_ATTR, theme);
  document.body.append(el);
  return el;
};

beforeEach(() => {
  document.body.replaceChildren();
  document.getElementById('n55-theme-tokens')?.remove();
  resetPaletteWarning();
});

test('true for an unthemed element, an unknown theme, or one the palette reaches', () => {
  const w = warnings();
  try {
    assert.equal(paletteReaches(document.body), true);
    assert.equal(paletteReaches(themed('div', 'chartreuse')), true);
    installTheme();
    assert.equal(paletteReaches(themed('div')), true);
    assert.deepEqual(w.seen, []);
  } finally { w.restore(); }
});

test('false, with one warning per page naming the cause, when it does not arrive', () => {
  const w = warnings();
  try {
    assert.equal(paletteReaches(themed('neodigm-tulip')), false);
    assert.equal(paletteReaches(themed('div', 'brand')), false);
    assert.equal(w.seen.length, 1, 'once, not once per element');
    assert.match(w.seen[0], /<neodigm-tulip> has data-n55-theme="night"/);
    assert.match(w.seen[0], /ancestor in the light DOM/);
  } finally { w.restore(); }
});

test('the case from the field: scoped to the inner tag, the Tulip host is never reached', () => {
  // installTheme({ selector: 'neodigm-marquee' }) matches no Tulip, so the
  // marquee in Tulip's shadow root inherits nothing. Silent until now.
  const w = warnings();
  try {
    installTheme({ selector: 'neodigm-marquee' });
    const tip = document.createElement('neodigm-tulip');
    document.body.append(tip);
    const trigger = document.createElement('button');
    trigger.setAttribute('data-n55-tulip', '{"msg":"news","mrq":true,"theme":"night"}');
    document.body.append(trigger);
    tip.openFor(trigger);
    assert.equal(w.seen.length, 1);
    assert.match(w.seen[0], /<neodigm-tulip>/);
  } finally { w.restore(); }
});

test('scoped to a container ancestor, as the docs now advise, nothing warns', () => {
  const w = warnings();
  try {
    const app = document.createElement('main');
    app.id = 'app';
    document.body.append(app);
    installTheme({ selector: '#app' });
    const tip = document.createElement('neodigm-tulip');
    app.append(tip);
    const trigger = document.createElement('button');
    trigger.setAttribute('data-n55-tulip', '{"msg":"hi","theme":"night"}');
    app.append(trigger);
    tip.openFor(trigger);
    assert.deepEqual(w.seen, []);
  } finally { w.restore(); }
});

test('always-visible components check a tick after connecting, so a later install counts', async () => {
  const w = warnings();
  try {
    themed('neodigm-buffet', 'brand');
    themed('neodigm-marquee', 'brand');
    installTheme();                     // the usual order: imports, then install
    await settle();
    assert.deepEqual(w.seen, []);
    document.getElementById('n55-theme-tokens').remove();
    themed('neodigm-buffet', 'brand');
    await settle();
    assert.equal(w.seen.length, 1, 'and without one, Buffet does warn');
  } finally { w.restore(); }
});

test('a component removed before the tick does not check', async () => {
  const w = warnings();
  try {
    themed('neodigm-marquee', 'brand').remove();
    await settle();
    assert.deepEqual(w.seen, []);
  } finally { w.restore(); }
});

test('every component that opens checks when it opens', () => {
  const opens = {
    'neodigm-toast': (el) => el.show('hi', { theme: 'night' }),
    'neodigm-side-dish': (el) => el.show(),
    'neodigm-sodapop': (el) => {
      const t = document.createElement('template');
      t.id = 'p';
      document.body.append(t);
      el.show('p');
    }
  };
  for (const [tag, open] of Object.entries(opens)) {
    document.body.replaceChildren();
    resetPaletteWarning();
    const w = warnings();
    try {
      open(themed(tag));
      assert.equal(w.seen.length, 1, `${tag} did not check`);
      assert.match(w.seen[0], new RegExp(`<${tag}>`));
    } finally { w.restore(); }
  }
});
