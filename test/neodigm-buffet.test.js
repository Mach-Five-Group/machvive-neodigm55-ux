import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readItems } from '../src/wc/neodigm-buffet/neodigm-buffet.js';
import { THEMES, THEME_ATTR, robinTheme, resetMotion, resetTitle } from '../src/conductor/index.js';

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

const MENU = [
  { token: 'home', caption: 'Home', enabled: true },
  { token: 'shows', caption: 'Shows', enabled: true, secondary: [
    { token: 'live', caption: 'Live', enabled: true },
    { token: 'vod', caption: 'VOD', enabled: true },
    { token: 'clips', caption: 'Clips', enabled: true }
  ] },
  { token: 'people', caption: 'People', enabled: true, secondary: [
    { token: 'team', caption: 'Team', enabled: true },
    { token: 'guests', caption: 'Guests', enabled: true }
  ] },
  { token: 'admin', caption: 'Admin', enabled: false }
];

const mount = (items = MENU, attrs = {}) => {
  const el = document.createElement('neodigm-buffet');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (items !== null) el.setAttribute('data-n55-buffet', JSON.stringify(items));
  document.body.append(el);
  return el;
};
const row = (el, level) => [...el.shadowRoot.querySelectorAll(`.${level} .item`)];
const button = (el, level, token) => row(el, level).find((b) => b.dataset.token === token);
const tokens = (el, level) => row(el, level).map((b) => b.dataset.token);
const current = (el, level) =>
  row(el, level).filter((b) => b.hasAttribute('aria-current')).map((b) => b.dataset.token);
const css = (el) => el.shadowRoot.querySelector('style').textContent;
// Identity, element by element. deepEqual on DOM nodes compares their own
// enumerable properties, of which they have none, so any two buttons "match".
const same = (a, b) => a.length === b.length && a.every((node, i) => node === b[i]);

beforeEach(() => {
  document.body.replaceChildren();
  resetMotion();
  resetTitle();
});

// Imported after the DOM exists; registration is the import's side effect.
await import('../src/wc/neodigm-buffet/neodigm-buffet.js');

describe('reading metadata', () => {
  test('accepts JSON or an array, and drops anything without a token', () => {
    assert.equal(readItems('[{"token":"a"},{"caption":"no token"},null,7]').length, 1);
    assert.equal(readItems([{ token: 'a' }, { token: 'b' }]).length, 2);
  });

  test('never throws on bad input', () => {
    for (const bad of ['{nope', '{"token":"a"}', '', null, undefined, 42]) {
      assert.deepEqual(readItems(bad), [], `${String(bad)} should read as empty`);
    }
  });

  test('a child without a token is dropped too', () => {
    const [item] = readItems([{ token: 'a', secondary: [{ token: 'x' }, { caption: 'y' }] }]);
    assert.deepEqual(item.secondary.map((c) => c.token), ['x']);
  });

  test('data-buttons is read as an alias, so m5t-primary-nav markup drops in', () => {
    const el = mount(null, { 'data-buttons': JSON.stringify(MENU) });
    assert.deepEqual(tokens(el, 'primary'), ['home', 'shows', 'people', 'admin']);
  });

  test('data-n55-buffet wins when both are present', () => {
    const el = mount([{ token: 'mine' }], { 'data-buttons': JSON.stringify(MENU) });
    assert.deepEqual(tokens(el, 'primary'), ['mine']);
  });
});

describe('layout', () => {
  test('registers itself and renders one button per item', () => {
    assert.ok(customElements.get('neodigm-buffet'));
    const el = mount();
    assert.equal(row(el, 'primary').length, 4);
    assert.equal(el.getAttribute('role'), 'navigation');
  });

  test('columns split the width evenly, whatever the caption length', () => {
    // minmax(0, 1fr): plain 1fr lets a long caption widen its own column.
    const style = css(mount());
    assert.match(style, /\.primary, \.secondary \{[^}]*grid-auto-columns: minmax\(0, 1fr\)/);
    assert.match(style, /\.primary, \.secondary \{[^}]*grid-auto-flow: column/);
  });

  test('the child row is half the height and a smaller type', () => {
    const style = css(mount());
    assert.match(style, /\.primary \{[^}]*block-size: var\(--n55-buffet-height, 64px\)/);
    assert.match(style, /\.secondary \{[^}]*block-size: calc\(var\(--n55-buffet-height, 64px\) \/ 2\)/);
    assert.match(style, /\.secondary \{[^}]*font-size: \.8em/);
  });

  test('is full width of its container, not of the viewport', () => {
    // The menu this replaces used 100vw, which overflows inside any padded
    // container and adds a horizontal scrollbar wherever a scrollbar exists.
    const style = css(mount());
    assert.match(style, /:host \{[^}]*inline-size: 100%/);
    assert.doesNotMatch(style, /100vw/);
  });

  test('caption and count render, as text', () => {
    const el = mount([{ token: 'a', caption: 'Inbox', count: 3 }]);
    const b = button(el, 'primary', 'a');
    assert.equal(b.querySelector('.caption').textContent, 'Inbox');
    assert.equal(b.querySelector('.count').textContent, '3');
  });

  test('icon is accepted and ignored: no glyph, no class name as text', () => {
    // m5t-primary-nav data carries Font Awesome classes here. Icons are
    // deferred, and printing "fas fa-home" as a caption would be worse.
    const el = mount([{ token: 'a', caption: 'Home', icon: 'fas fa-home' }]);
    const b = button(el, 'primary', 'a');
    assert.equal(b.textContent, 'Home');
    assert.equal(b.querySelector('.icon, i'), null);
  });

  test('a missing caption falls back to the token', () => {
    const el = mount([{ token: 'naked' }]);
    assert.equal(button(el, 'primary', 'naked').textContent, 'naked');
  });

  test('markup in a caption or tagline is inert', () => {
    // The menu this replaces interpolated both into innerHTML.
    const el = mount([{ token: 'a', caption: '<img src=x onerror=alert(1)>', tagline: '"><b>x</b>' }]);
    const b = button(el, 'primary', 'a');
    assert.equal(b.querySelector('img'), null);
    assert.match(b.textContent, /<img/);
    assert.equal(b.title, '"><b>x</b>');
    assert.equal(b.querySelector('b'), null);
  });

  test('only enabled: false disables; a missing value means enabled', () => {
    const el = mount([{ token: 'a' }, { token: 'b', enabled: false }, { token: 'c', enabled: true }]);
    assert.deepEqual(row(el, 'primary').map((b) => b.disabled), [false, true, false]);
  });
});

describe('selection', () => {
  test('starts on the first enabled item when none is flagged', () => {
    const el = mount([{ token: 'off', enabled: false }, { token: 'a' }, { token: 'b' }]);
    assert.deepEqual(el.selection, { primary: 'a', secondary: null });
    assert.deepEqual(current(el, 'primary'), ['a']);
  });

  test('honours selected flags at both levels', () => {
    const menu = structuredClone(MENU);
    menu[2].selected = true;
    menu[2].secondary[1].selected = true;
    const el = mount(menu);
    assert.deepEqual(el.selection, { primary: 'people', secondary: 'guests' });
    assert.deepEqual(current(el, 'secondary'), ['guests']);
  });

  test('the child row shows the selected item\'s children', () => {
    const el = mount();
    button(el, 'primary', 'shows').click();
    assert.deepEqual(tokens(el, 'secondary'), ['live', 'vod', 'clips']);
    button(el, 'primary', 'people').click();
    assert.deepEqual(tokens(el, 'secondary'), ['team', 'guests']);
  });

  test('an item with no children leaves the row empty, not stale', () => {
    const el = mount();
    button(el, 'primary', 'shows').click();
    button(el, 'primary', 'home').click();
    assert.deepEqual(tokens(el, 'secondary'), []);
  });

  test('both levels keep their selection', () => {
    const el = mount();
    button(el, 'primary', 'shows').click();
    button(el, 'secondary', 'vod').click();
    assert.deepEqual(el.selection, { primary: 'shows', secondary: 'vod' });
    assert.deepEqual(current(el, 'primary'), ['shows']);
    assert.deepEqual(current(el, 'secondary'), ['vod']);
  });

  test('each item remembers its last child', () => {
    const el = mount();
    button(el, 'primary', 'shows').click();
    button(el, 'secondary', 'clips').click();
    button(el, 'primary', 'people').click();
    assert.equal(el.selection.secondary, null, 'people has no remembered child yet');
    button(el, 'primary', 'shows').click();
    assert.deepEqual(el.selection, { primary: 'shows', secondary: 'clips' });
    assert.deepEqual(current(el, 'secondary'), ['clips']);
  });

  test('a disabled item cannot be selected by click', () => {
    const el = mount();
    button(el, 'primary', 'admin').click();
    assert.equal(el.selection.primary, 'home');
  });

  test('selecting does not rebuild the top row, so focus survives', () => {
    // The menu this replaces re-rendered its whole shadow root on every click,
    // which threw keyboard focus back to the document.
    const el = mount();
    const before = row(el, 'primary');
    button(el, 'primary', 'shows').click();
    assert.ok(same(row(el, 'primary'), before), 'the top row was rebuilt');
  });

  test('re-choosing the current item does not rebuild its children', () => {
    const el = mount();
    button(el, 'primary', 'shows').click();
    const before = row(el, 'secondary');
    button(el, 'primary', 'shows').click();
    assert.ok(before.length === 3 && same(row(el, 'secondary'), before), 'the child row was rebuilt');
  });
});

describe('the select event', () => {
  test('carries level, token, item and the resulting selection, across the shadow boundary', () => {
    const el = mount();
    const seen = [];
    document.addEventListener('neodigm-buffet-select', (e) => seen.push(e.detail), { once: false });
    button(el, 'primary', 'shows').click();
    button(el, 'secondary', 'live').click();
    assert.equal(seen.length, 2);
    assert.deepEqual(
      { level: seen[0].level, token: seen[0].token, primary: seen[0].primary, secondary: seen[0].secondary },
      { level: 'primary', token: 'shows', primary: 'shows', secondary: null });
    assert.equal(seen[0].item.caption, 'Shows');
    assert.deepEqual(
      { level: seen[1].level, token: seen[1].token, primary: seen[1].primary, secondary: seen[1].secondary },
      { level: 'secondary', token: 'live', primary: 'shows', secondary: 'live' });
  });

  test('announces the remembered child when returning to an item', () => {
    const el = mount();
    button(el, 'primary', 'shows').click();
    button(el, 'secondary', 'vod').click();
    button(el, 'primary', 'home').click();
    let detail;
    el.addEventListener('neodigm-buffet-select', (e) => { detail = e.detail; });
    button(el, 'primary', 'shows').click();
    assert.equal(detail.secondary, 'vod');
  });

  test('fires again for the current selection', () => {
    const el = mount();
    let n = 0;
    el.addEventListener('neodigm-buffet-select', () => n++);
    button(el, 'primary', 'home').click();
    button(el, 'primary', 'home').click();
    assert.equal(n, 2);
  });

  test('cancelling keeps the selection where it was, at either level', () => {
    const el = mount();
    button(el, 'primary', 'shows').click();
    button(el, 'secondary', 'live').click();
    el.addEventListener('neodigm-buffet-select', (e) => e.preventDefault());
    button(el, 'primary', 'people').click();
    button(el, 'secondary', 'vod').click();
    assert.deepEqual(el.selection, { primary: 'shows', secondary: 'live' });
    assert.deepEqual(tokens(el, 'secondary'), ['live', 'vod', 'clips']);
    assert.deepEqual(current(el, 'secondary'), ['live']);
  });

  test('the item in the event is a copy', () => {
    const el = mount();
    el.addEventListener('neodigm-buffet-select', (e) => { e.detail.item.caption = 'Hijacked'; });
    button(el, 'primary', 'home').click();
    assert.equal(el.items[0].caption, 'Home');
  });
});

describe('the API', () => {
  test('select() moves the selection without an event', () => {
    const el = mount();
    let n = 0;
    el.addEventListener('neodigm-buffet-select', () => n++);
    assert.equal(el.select('shows', 'clips'), true);
    assert.deepEqual(el.selection, { primary: 'shows', secondary: 'clips' });
    assert.deepEqual(current(el, 'secondary'), ['clips']);
    assert.equal(n, 0, 'route syncing must not announce, or it would loop');
  });

  test('select() with no child restores the remembered one; null clears it', () => {
    const el = mount();
    el.select('shows', 'vod');
    el.select('home');
    assert.equal(el.select('shows'), true);
    assert.equal(el.selection.secondary, 'vod');
    el.select('shows', null);
    assert.equal(el.selection.secondary, null);
  });

  test('select() refuses unknown or disabled tokens and changes nothing', () => {
    const el = mount();
    assert.equal(el.select('nope'), false);
    assert.equal(el.select('admin'), false);
    assert.equal(el.select('shows', 'team'), false, 'team belongs to people');
    assert.deepEqual(el.selection, { primary: 'home', secondary: null });
  });

  test('assigning items keeps the selection wherever its tokens survive', () => {
    // How an app relabels for a new language: same tokens, new captions.
    const el = mount();
    el.select('shows', 'vod');
    el.items = MENU.map((i) => ({ ...i, caption: i.caption.toUpperCase() }));
    assert.deepEqual(el.selection, { primary: 'shows', secondary: 'vod' });
    assert.equal(button(el, 'primary', 'shows').textContent, 'SHOWS');
  });

  test('assigning items without the selected token falls back', () => {
    const el = mount();
    el.select('people');
    el.items = [{ token: 'x' }, { token: 'y', selected: true }];
    assert.equal(el.selection.primary, 'y');
  });

  test('items is a copy', () => {
    const el = mount();
    el.items[0].caption = 'Changed';
    el.items[1].secondary[0].caption = 'Changed';
    assert.equal(el.items[0].caption, 'Home');
    assert.equal(el.items[1].secondary[0].caption, 'Live');
  });

  test('items can be set before the element is connected', () => {
    const el = document.createElement('neodigm-buffet');
    el.items = MENU;
    document.body.append(el);
    assert.deepEqual(tokens(el, 'primary'), ['home', 'shows', 'people', 'admin']);
  });

  test('updateCount changes a badge in place, at either level', () => {
    const el = mount();
    el.select('shows');
    const b = button(el, 'primary', 'home');
    assert.equal(el.updateCount('home', 7), true);
    assert.equal(button(el, 'primary', 'home'), b, 'the button is updated, not replaced');
    assert.equal(b.querySelector('.count').textContent, '7');
    el.updateCount('vod', 2);
    assert.equal(button(el, 'secondary', 'vod').querySelector('.count').textContent, '2');
    el.updateCount('home', null);
    assert.equal(b.querySelector('.count'), null);
    assert.equal(el.items[0].count, undefined, 'removed from the data too, not left as null');
    assert.equal(el.updateCount('nope', 1), false);
  });
});

describe('theming', () => {
  test('every palette theme has a host rule and an accent rule', () => {
    const style = css(mount());
    for (const name of Object.keys(THEMES)) {
      assert.match(style, new RegExp(`:host\\(\\[${THEME_ATTR}="${name}"\\]\\) \\{ --_fill: var\\(--n55-${name}\\)`), `${name} host`);
      assert.match(style, new RegExp(`\\[data-accent="${name}"\\] \\{ --_fill: var\\(--n55-${name}\\)`), `${name} accent`);
    }
  });

  test('the selection is the theme colour, the child row its deep shade', () => {
    const style = css(mount());
    assert.match(style, /\.item\[aria-current\] \{[^}]*background: var\(--_fill\)/);
    assert.match(style, /\.secondary \{[^}]*background: var\(--_row\)/);
    assert.match(style, new RegExp(`\\[${THEME_ATTR}="danger"\\]\\) \\{[^}]*--_row: var\\(--n55-danger-deep\\)`));
  });

  test('text takes the palette\'s ink for each surface, for every theme', () => {
    // Not -deep on the colour, which measured below AA on twelve of thirteen
    // themes, and no hand-written exception for white: the palette decides.
    const style = css(mount());
    const rule = (name) => style.match(new RegExp(`:host\\(\\[${THEME_ATTR}="${name}"\\]\\) \\{([^}]*)\\}`))[1];
    for (const name of Object.keys(THEMES)) {
      assert.match(rule(name), new RegExp(`--_ink: var\\(--n55-${name}-ink\\);`), `${name} ink`);
      assert.match(rule(name), new RegExp(`--_row-ink: var\\(--n55-${name}-deep-ink\\);`), `${name} row ink`);
    }
  });

  test('the top row is the page surface, so it follows light and dark', () => {
    const style = css(mount());
    assert.match(style, /\.primary \{[^}]*background: var\(--n55-surface, #fff\)/);
    assert.match(style, /\.primary \{[^}]*border-block-end: 1px solid var\(--n55-line,/);
    assert.match(style, /\.primary \.item \{ color: var\(--n55-surface-ink, #1a1a1a\); \}/);
  });

  test('unthemed, the selection is the inverse surface', () => {
    const host = css(mount()).match(/:host \{[\s\S]*?\n  \}/)[0];
    assert.match(host, /--_fill: var\(--n55-inverse, #1a1a1a\);/);
    assert.match(host, /--_ink: var\(--n55-inverse-ink, #fff\);/);
  });

  test('selection is marked by more than colour', () => {
    assert.match(css(mount()), /\.item\[aria-current\] \{[^}]*box-shadow: inset 0 -3px 0/);
  });

  test('a sweep recolours the menu as one instrument', async () => {
    const el = mount(MENU, { [THEME_ATTR]: 'primary' });
    const seen = [];
    const watch = new MutationObserver(() => seen.push(el.getAttribute(THEME_ATTR)));
    watch.observe(el, { attributes: true, attributeFilter: [THEME_ATTR] });
    await robinTheme('party', { stagger: 5, hold: 30, flashTab: false });
    await settle(0);
    watch.disconnect();
    assert.deepEqual(seen, ['party', 'primary']);
  });

  test('no node inside carries data-n55-theme, accents included', () => {
    // That attribute promises a sweep can reach the node, and inside a shadow
    // root it cannot. Accents use their own attribute.
    const menu = structuredClone(MENU);
    menu[1].theme = 'danger';
    menu[1].secondary[0].theme = 'success';
    const el = mount(menu);
    el.select('shows');
    assert.equal(el.shadowRoot.querySelectorAll(`[${THEME_ATTR}]`).length, 0);
    assert.equal(button(el, 'primary', 'shows').dataset.accent, 'danger');
    assert.equal(button(el, 'secondary', 'live').dataset.accent, 'success');
  });

  test('the child row takes its parent\'s accent', () => {
    const menu = structuredClone(MENU);
    menu[1].theme = 'marcom';
    const el = mount(menu);
    const secondary = el.shadowRoot.querySelector('.secondary');
    el.select('shows');
    assert.equal(secondary.dataset.accent, 'marcom');
    el.select('people');
    assert.equal(secondary.dataset.accent, undefined, 'and drops it for an unaccented parent');
  });

  test('an unknown accent is ignored rather than rendering unstyled', () => {
    const el = mount([{ token: 'a', theme: 'chartreuse' }]);
    assert.equal(button(el, 'primary', 'a').dataset.accent, undefined);
  });

  test('transitions stop for reduced motion', () => {
    const style = css(mount());
    assert.match(style.slice(style.indexOf('prefers-reduced-motion')), /\.item \{ transition: none; \}/);
  });
});
