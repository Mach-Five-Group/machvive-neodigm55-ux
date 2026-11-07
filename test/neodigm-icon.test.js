import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import '../src/wc/neodigm-poptart/neodigm-poptart.js';
import '../src/wc/neodigm-acticon/neodigm-acticon.js';
import { resetIconWarning } from '../src/wc/neodigm-icon/neodigm-icon.js';
import { ACTICON_SIZES } from '../src/wc/neodigm-acticon/neodigm-acticon.js';
import { ICONS, ICON_NAMES, iconName, iconCss } from '../src/conductor/icons.js';
import { THEME_NAMES, THEME_ATTR, resetPaletteWarning, installTheme } from '../src/conductor/index.js';

const settle = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const make = (tag, attrs = {}, text = '') => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text) el.textContent = text;
  document.body.append(el);
  return el;
};
const glyph = (icon) => icon.shadowRoot.querySelector('.glyph').style.getPropertyValue('--n55-glyph');
const css = (el) => el.shadowRoot.querySelector('style').textContent;
const warnings = () => {
  const seen = [];
  const original = console.warn;
  console.warn = (msg) => seen.push(String(msg));
  return { seen, restore: () => { console.warn = original; } };
};
const key = (el, type, k) => {
  const ev = new window.KeyboardEvent(type, { key: k, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
};
const clicks = (el) => {
  const seen = [];
  el.addEventListener('click', () => seen.push(1));
  return seen;
};

beforeEach(() => {
  document.body.replaceChildren();
  document.getElementById('n55-theme-tokens')?.remove();
  resetIconWarning();
  resetPaletteWarning();
});
afterEach(() => { document.body.replaceChildren(); });

describe('the icon set', () => {
  test('carries 43 icons, sorted and frozen', () => {
    assert.equal(ICON_NAMES.length, 43);
    assert.deepEqual([...ICON_NAMES], [...ICON_NAMES].sort());
    assert.ok(Object.isFrozen(ICONS) && Object.isFrozen(ICON_NAMES));
    for (const name of ['search', 'close', 'settings', 'dark-mode', 'light-mode', 'arrow-drop-down', 'arrow-drop-up']) {
      assert.ok(ICONS[name], name);
    }
  });

  test('every icon is a data-URI SVG with its # characters encoded', () => {
    // An unencoded # ends a data URI early, and the icon silently vanishes.
    for (const [name, url] of Object.entries(ICONS)) {
      assert.match(url, /^url\("data:image\/svg\+xml,%3Csvg [^"#]+"\)$/, name);
      assert.match(name, /^[a-z0-9-]+$/);
    }
  });

  test('iconName takes Material\'s ligature spelling and nothing CSS could misread', () => {
    assert.equal(iconName('dark_mode'), 'dark-mode');
    assert.equal(iconName('  Dark_Mode \n'), 'dark-mode');
    assert.equal(iconName('more horiz'), 'more-horiz');
    assert.equal(iconName('x);background:red'), 'xbackgroundred');
    assert.equal(iconName(null), '');
  });

  test('iconCss emits every icon as a custom property, under any selector', () => {
    const sheet = iconCss();
    assert.ok(sheet.startsWith(':root {'));
    for (const name of ICON_NAMES) assert.ok(sheet.includes(`--n55-icon-${name}: ${ICONS[name]};`), name);
    assert.equal(iconCss({ My_Icon: 'url("a")' }, '#app'), '#app {\n  --n55-icon-my-icon: url("a");\n}\n');
  });
});

describe('<neodigm-icon>', () => {
  test('draws a named icon, a page definition first and the built-in as fallback', () => {
    const icon = make('neodigm-icon', { name: 'search' });
    assert.equal(glyph(icon), `var(--n55-icon-search, ${ICONS.search})`);
    assert.equal(icon.name, 'search');
  });

  test('reads the original\'s ligature text, and `name` wins over it', () => {
    const legacy = make('neodigm-icon', { class: 'material-symbols-outlined' }, 'dark_mode');
    assert.equal(glyph(legacy), `var(--n55-icon-dark-mode, ${ICONS['dark-mode']})`);
    const both = make('neodigm-icon', { name: 'send' }, 'search');
    assert.equal(both.name, 'send');
  });

  test('follows a change of text, as a dark/light toggle makes', async () => {
    const icon = make('neodigm-icon', {}, 'dark_mode');
    icon.textContent = 'light_mode';
    await settle(0);
    assert.equal(glyph(icon), `var(--n55-icon-light-mode, ${ICONS['light-mode']})`);
  });

  test('follows a change of name, and the property sets it', () => {
    const icon = make('neodigm-icon', { name: 'search' });
    icon.name = 'Close_Small';
    assert.equal(glyph(icon), `var(--n55-icon-close-small, ${ICONS['close-small']})`);
  });

  test('stops watching its text once disconnected, and catches up on return', async () => {
    const icon = make('neodigm-icon', {}, 'mic');
    icon.remove();
    icon.textContent = 'mic_off';
    await settle(0);
    assert.equal(glyph(icon), `var(--n55-icon-mic, ${ICONS.mic})`);
    document.body.append(icon);
    assert.equal(glyph(icon), `var(--n55-icon-mic-off, ${ICONS['mic-off']})`);
  });

  test('an unknown name draws nothing rather than a filled square', () => {
    const icon = make('neodigm-icon', { name: 'rocket' });
    assert.equal(glyph(icon), 'var(--n55-icon-rocket, linear-gradient(transparent, transparent))');
    assert.equal(glyph(make('neodigm-icon')), 'linear-gradient(transparent, transparent)');
  });

  test('an unknown name warns once per page, naming what to define', async () => {
    const w = warnings();
    try {
      make('neodigm-icon', { name: 'rocket' });
      make('neodigm-icon', { name: 'chevron_right' });
      make('neodigm-icon', { name: 'search' });
      await settle();
      assert.equal(w.seen.length, 1);
      assert.match(w.seen[0], /"rocket".*--n55-icon-rocket/);
    } finally { w.restore(); }
  });

  test('a name the page defines in CSS does not warn', async () => {
    const style = document.createElement('style');
    style.textContent = ':root { --n55-icon-rocket: url("data:image/svg+xml,x"); }';
    document.head.append(style);
    const w = warnings();
    try {
      make('neodigm-icon', { name: 'rocket' });
      await settle();
      assert.deepEqual(w.seen, []);
    } finally { w.restore(); style.remove(); }
  });

  test('is decorative unless labelled', () => {
    const icon = make('neodigm-icon', { name: 'send' });
    assert.equal(icon.getAttribute('aria-hidden'), 'true');
    assert.equal(icon.hasAttribute('role'), false);
    icon.setAttribute('label', 'Send');
    assert.equal(icon.getAttribute('role'), 'img');
    assert.equal(icon.getAttribute('aria-label'), 'Send');
    assert.equal(icon.hasAttribute('aria-hidden'), false);
    icon.removeAttribute('label');
    assert.equal(icon.getAttribute('aria-hidden'), 'true');
    assert.equal(icon.hasAttribute('aria-label'), false);
    assert.equal(icon.hasAttribute('role'), false);
  });

  test('a theme of its own colours it, for every theme', () => {
    const sheet = css(make('neodigm-icon'));
    for (const name of THEME_NAMES) {
      assert.ok(sheet.includes(`:host([${THEME_ATTR}="${name}"]) { color: var(--n55-${name}); }`), name);
    }
  });

  test('a themed icon checks that the palette reaches it', async () => {
    const w = warnings();
    try {
      make('neodigm-icon', { name: 'search', [THEME_ATTR]: 'brand' });
      await settle();
      assert.equal(w.seen.length, 1);
      assert.match(w.seen[0], /<neodigm-icon>/);
    } finally { w.restore(); }
  });
});

describe('<neodigm-acticon>', () => {
  test('is a focusable button named by its icon', () => {
    const a = make('neodigm-acticon', { icon: 'chevron_right' });
    assert.equal(a.getAttribute('role'), 'button');
    assert.equal(a.getAttribute('tabindex'), '0');
    assert.equal(a.getAttribute('aria-label'), 'chevron right');
  });

  test('`icon` names the glyph it draws when it has no children', () => {
    const a = make('neodigm-acticon', { icon: 'search' });
    const inner = a.shadowRoot.querySelector('slot > neodigm-icon[part="icon"]');
    assert.equal(inner.getAttribute('name'), 'search');
    a.setAttribute('icon', 'send');
    assert.equal(inner.getAttribute('name'), 'send');
    assert.equal(a.getAttribute('aria-label'), 'send');
  });

  test('the original\'s markup, a ligature child, names it once parsed', async () => {
    const a = document.createElement('neodigm-acticon');
    document.body.append(a);
    a.innerHTML = '<neodigm-icon class="material-symbols-outlined">dark_mode</neodigm-icon>';
    await settle();
    assert.equal(a.getAttribute('aria-label'), 'dark mode');
  });

  test('`label` names it; a page\'s own aria-label is left alone', () => {
    const a = make('neodigm-acticon', { icon: 'search', label: 'Find a pet' });
    assert.equal(a.getAttribute('aria-label'), 'Find a pet');
    a.removeAttribute('label');
    assert.equal(a.getAttribute('aria-label'), 'search');
    const own = make('neodigm-acticon', { icon: 'search', 'aria-label': 'Mine' });
    own.setAttribute('icon', 'send');
    assert.equal(own.getAttribute('aria-label'), 'Mine');
  });

  test('disabled leaves the tab order and says so, and comes back', () => {
    const a = make('neodigm-acticon', { icon: 'search', [THEME_ATTR]: 'disabled' });
    assert.equal(a.disabled, true);
    assert.equal(a.hasAttribute('tabindex'), false);
    assert.equal(a.getAttribute('aria-disabled'), 'true');
    a.setAttribute(THEME_ATTR, 'brand');
    assert.equal(a.getAttribute('tabindex'), '0');
    assert.equal(a.hasAttribute('aria-disabled'), false);
  });

  test('a page\'s own tabindex is kept', () => {
    const a = make('neodigm-acticon', { icon: 'search', tabindex: '-1' });
    assert.equal(a.getAttribute('tabindex'), '-1');
    a.setAttribute(THEME_ATTR, 'brand');
    assert.equal(a.getAttribute('tabindex'), '-1');
  });

  test('Enter clicks; Space clicks on release and does not scroll', () => {
    const a = make('neodigm-acticon', { icon: 'search' });
    const seen = clicks(a);
    assert.equal(key(a, 'keydown', 'Enter').defaultPrevented, true);
    assert.equal(seen.length, 1);
    assert.equal(key(a, 'keydown', ' ').defaultPrevented, true);
    assert.equal(seen.length, 1);
    key(a, 'keyup', ' ');
    assert.equal(seen.length, 2);
    key(a, 'keydown', 'a');
    assert.equal(seen.length, 2);
  });

  test('a disabled ActIcon ignores the keyboard', () => {
    const a = make('neodigm-acticon', { icon: 'search', [THEME_ATTR]: 'disabled' });
    const seen = clicks(a);
    key(a, 'keydown', 'Enter');
    key(a, 'keyup', ' ');
    assert.equal(seen.length, 0);
  });

  test('keys from something inside it are not its own', () => {
    const a = make('neodigm-acticon');
    a.innerHTML = '<input>';
    const seen = clicks(a);
    key(a.querySelector('input'), 'keydown', 'Enter');
    key(a.querySelector('input'), 'keyup', ' ');
    assert.equal(seen.length, 0);
  });

  test('so a Poptart trigger on it opens from the keyboard', () => {
    const pop = make('neodigm-poptart', { id: 'js-settings' });
    const a = make('neodigm-acticon', { icon: 'settings', 'data-n55-poptart-click': 'js-settings' });
    key(a, 'keydown', 'Enter');
    assert.equal(pop.open, true);
  });

  test('has the original\'s sizes, circle and glyph, xsmall by default', () => {
    const sheet = css(make('neodigm-acticon'));
    assert.deepEqual(ACTICON_SIZES.xsmall, [24, 23]);
    assert.match(sheet, /inline-size: 24px;\s*block-size: 24px;\s*--n55-icon-size: 23px;/);
    for (const [size, [box, g]] of Object.entries(ACTICON_SIZES)) {
      assert.ok(sheet.includes(
        `:host([data-n55-size="${size}"]) { inline-size: ${box}px; block-size: ${box}px; --n55-icon-size: ${g}px; }`), size);
    }
  });

  test('every theme fills it with the colour and draws the glyph in its ink', () => {
    const sheet = css(make('neodigm-acticon'));
    for (const name of THEME_NAMES) {
      assert.ok(sheet.includes(`background: var(--n55-${name});\n    border-color: var(--n55-${name});\n    color: var(--n55-${name}-ink);`), name);
    }
  });

  test('ghost is an outline, overriding its generated fill', () => {
    const sheet = css(make('neodigm-acticon'));
    const generated = sheet.indexOf(`:host([${THEME_ATTR}="ghost"]) {\n    background: var(--n55-ghost)`);
    const override = sheet.indexOf(`:host([${THEME_ATTR}="ghost"]) {\n    background: transparent;`);
    assert.ok(generated !== -1 && override > generated);
  });

  test('white has an edge, so it shows on a light page', () => {
    const sheet = css(make('neodigm-acticon'));
    const generated = sheet.indexOf(`:host([${THEME_ATTR}="white"]) {\n    background: var(--n55-white)`);
    const edge = sheet.indexOf(`:host([${THEME_ATTR}="white"]) { border-color: var(--n55-line, currentColor); }`);
    assert.ok(generated !== -1 && edge > generated);
  });

  test('neither ghost nor disabled brightens on hover', () => {
    assert.ok(css(make('neodigm-acticon')).includes(
      `:host(:hover:not([${THEME_ATTR}="disabled"]):not([${THEME_ATTR}="ghost"])) { filter: brightness(124%); }`));
  });

  test('checks a tick after connecting that the palette reaches it', async () => {
    const w = warnings();
    try {
      make('neodigm-acticon', { icon: 'search', [THEME_ATTR]: 'brand' });
      installTheme();
      await settle();
      assert.deepEqual(w.seen, []);
      document.getElementById('n55-theme-tokens').remove();
      make('neodigm-acticon', { icon: 'search', [THEME_ATTR]: 'brand' });
      await settle();
      assert.equal(w.seen.length, 1);
      assert.match(w.seen[0], /<neodigm-acticon>/);
    } finally { w.restore(); }
  });
});
