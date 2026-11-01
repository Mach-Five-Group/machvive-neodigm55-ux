/**
 * The Neodigm 55 palette, as CSS custom properties.
 *
 * In the original library the palette was a JavaScript object
 * (`neodigmOpt.N55_THEME_COLORS`), which meant a component read a hex value at
 * runtime and a page could not restyle one without touching the bundle. Here
 * the same thirteen themes are emitted as custom properties on `:root`, because
 * that is the one mechanism that both cascades through the light DOM *and*
 * inherits through a shadow boundary. A component reads `var(--n55-brand)`; a
 * page — or a theme builder — overrides the variable and every component
 * follows, with no rebuild and no component aware it happened.
 *
 * Each theme carries three values, matching the original's `[light, dark, glyph]`
 * triple, plus two inks derived from them:
 *   --n55-<name>           the colour
 *   --n55-<name>-deep      its darker companion, for a second surface or hover
 *   --n55-<name>-glyph     the emoji the tab title flashes (see flashTitle)
 *   --n55-<name>-ink       text on the colour
 *   --n55-<name>-deep-ink  text on the deep companion
 *   --n55-<name>-legible   whichever of the two carries text at AA
 *   --n55-<name>-legible-ink  text on that
 *
 * The inks exist because `-deep` was used as text on the colour, and measured
 * that falls below WCAG AA (4.5:1) on twelve of the thirteen themes — party
 * manages 1.76. Each ink is whichever of two neutrals contrasts more with its
 * surface, computed rather than hand-picked so a custom palette gets readable
 * text without anyone measuring it.
 *
 * Ink alone cannot rescue every colour: danger and marcom are mid-tones, and
 * the better neutral on each measures 4.32 and 4.30. The rule is that every
 * theme has one shade, light or deep, that reaches AA with its ink — danger
 * and marcom do on their deep shade — and `-legible` names it, so a component
 * that has to put text on a theme can rely on it without knowing which.
 */

/**
 * @typedef {{ color: string, deep: string, glyph: string,
 *   ink?: string, deepInk?: string }} NeodigmTheme
 */

/**
 * Ported verbatim from `N55_THEME_COLORS` so an existing page's colours do not
 * shift. Order matters: it is the round-robin order `robinTheme` cycles through
 * when called with no argument, and the original used object key order.
 *
 * @type {Readonly<Record<string, NeodigmTheme>>}
 */
export const THEMES = Object.freeze({
  brand:     { color: '#EDBA08', deep: '#915E00', glyph: '🟧' },
  primary:   { color: '#92A8D1', deep: '#364C75', glyph: '🟦' },
  secondary: { color: '#EDCED0', deep: '#978284', glyph: '🟫' },
  success:   { color: '#009473', deep: '#003817', glyph: '🟩' },
  white:     { color: '#FFFFFF', deep: '#FDFDFD', glyph: '⬜' },
  ghost:     { color: '#FFFFFF', deep: '#000000', glyph: '⬜' },
  danger:    { color: '#DD4124', deep: '#810000', glyph: '🟥' },
  warning:   { color: '#F5DF4D', deep: '#988200', glyph: '🟨' },
  info:      { color: '#7BC4C4', deep: '#1F6868', glyph: '🟦' },
  disabled:  { color: '#868686', deep: '#767676', glyph: '⬜' },
  night:     { color: '#6A6A6A', deep: '#242424', glyph: '⬛' },
  marcom:    { color: '#B163A3', deep: '#5F4B8B', glyph: '🟪' },
  party:     { color: '#FF6F61', deep: '#C93F60', glyph: '🟪' }
});

/** The two inks a surface can take: the components' neutral dark, and white. */
export const INK_DARK = '#1a1a1a';
export const INK_LIGHT = '#fff';

/** WCAG relative luminance of `#rgb` or `#rrggbb`; null for anything else. */
function luminance(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two hex colours, 1 to 21. Pure, so a theme
 * builder or a CI check can audit a palette with no DOM. NaN if either is not
 * a hex colour.
 */
export function contrast(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  if (la === null || lb === null) return NaN;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The readable ink for text on `surface`: INK_DARK or INK_LIGHT, whichever
 * contrasts more. A surface that is not a hex colour gets INK_DARK — there is
 * nothing to measure, so the palette author should pass `ink` explicitly.
 */
export function inkFor(surface) {
  const dark = contrast(INK_DARK, surface);
  if (Number.isNaN(dark)) return INK_DARK;
  return contrast(INK_LIGHT, surface) > dark ? INK_LIGHT : INK_DARK;
}

/** WCAG AA for body text. */
export const WCAG_AA = 4.5;

/**
 * Which shade of a theme carries text: `'color'` if it reaches WCAG_AA with its
 * ink, else `'deep'` if that does, else whichever contrasts more. The light
 * shade is preferred because it is the theme as people recognise it.
 *
 * @param {NeodigmTheme} theme
 * @returns {'color'|'deep'}
 */
export function legibleFor(theme) {
  const color = contrast(theme.color, theme.ink ?? inkFor(theme.color));
  const deep = contrast(theme.deep, theme.deepInk ?? inkFor(theme.deep));
  if (color >= WCAG_AA) return 'color';
  if (deep >= WCAG_AA) return 'deep';
  return deep > color ? 'deep' : 'color';
}

/**
 * The page's own surfaces, as opposed to a theme's: what a component paints
 * when it is not wearing a theme. Each is a `[light, dark]` pair, emitted as
 * `light-dark(light, dark)`.
 *
 * That function resolves on the element that *uses* the variable, against the
 * `color-scheme` that element inherits — and `color-scheme` inherits through a
 * shadow boundary just as custom properties do. So every instance works out
 * its own mode where it stands, with no listener and no JavaScript: a dark
 * sidebar in a light page needs nothing but `color-scheme: dark` on the
 * sidebar. A browser without `light-dark()` drops the declaration and the
 * component's own `var()` fallback — the light value — applies.
 *
 *   --n55-surface          a resting surface, such as Buffet's top row
 *   --n55-surface-ink      text on it
 *   --n55-line             hairlines and dividers on it
 *   --n55-inverse          the emphasis surface when there is no theme
 *   --n55-inverse-ink      text on that
 */
export const NEUTRALS = Object.freeze({
  surface:      ['#fff', '#1a1a1a'],
  surfaceInk:   ['#1a1a1a', '#fff'],
  line:         ['rgb(0 0 0 / .12)', 'rgb(255 255 255 / .16)'],
  inverse:      ['#1a1a1a', '#e8e8e8'],
  inverseInk:   ['#fff', '#1a1a1a']
});

/**
 * The attribute that pins a subtree to light or dark: `data-n55-scheme="dark"`
 * on `<html>`, a section, or a single component. Without it, components follow
 * whatever `color-scheme` the page already sets — `light dark` follows the OS.
 * The palette deliberately does not set `color-scheme` on `:root` itself: that
 * also restyles the page's own scrollbars and form controls, which is the
 * page's decision.
 */
export const SCHEME_ATTR = 'data-n55-scheme';

const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Theme names in round-robin order. */
export const THEME_NAMES = Object.freeze(Object.keys(THEMES));

/**
 * `disabled` is a real theme with a real colour, but it also means "do not
 * choreograph me". The original checked the string in three separate places;
 * naming it once keeps those honest.
 */
export const OPT_OUT = 'disabled';

/** The attribute that opts an element into choreography. The whole contract. */
export const THEME_ATTR = 'data-n55-theme';

/** Its pulsing sibling, swept on a slower cycle. */
export const PULSE_ATTR = 'data-n55-theme-pulse';

/**
 * Renders the palette as CSS text.
 *
 * Exported separately from `installTheme` so a build step can write a static
 * stylesheet, and so a theme builder can round-trip: edit the object, emit the
 * CSS, hand it to a page that never loads this module at all.
 *
 * @param {Record<string, NeodigmTheme>} [themes]
 * @param {string} [selector] Where to hang the variables. A section-scoped
 *   selector gives that subtree its own palette, since custom properties cascade.
 * @param {Record<string, [string, string]>} [neutrals] `[light, dark]` pairs.
 * @returns {string}
 */
export function themeCss(themes = THEMES, selector = ':root', neutrals = NEUTRALS) {
  const lines = Object.entries(themes).flatMap(([name, t]) => {
    // References rather than copies, so the pair stays a matched surface and
    // ink when a page overrides one of the shades.
    const shade = legibleFor(t) === 'deep' ? `--n55-${name}-deep` : `--n55-${name}`;
    return [
      `  --n55-${name}: ${t.color};`,
      `  --n55-${name}-deep: ${t.deep};`,
      `  --n55-${name}-glyph: "${t.glyph}";`,
      `  --n55-${name}-ink: ${t.ink ?? inkFor(t.color)};`,
      `  --n55-${name}-deep-ink: ${t.deepInk ?? inkFor(t.deep)};`,
      `  --n55-${name}-legible: var(${shade});`,
      `  --n55-${name}-legible-ink: var(${shade}-ink);`
    ];
  });
  const surfaces = Object.entries(neutrals).map(([key, [light, dark]]) =>
    `  --n55-${kebab(key)}: light-dark(${light}, ${dark});`);
  return `${selector} {\n${[...lines, ...surfaces].join('\n')}\n}\n` +
    `[${SCHEME_ATTR}="light"] { color-scheme: light; }\n` +
    `[${SCHEME_ATTR}="dark"] { color-scheme: dark; }\n`;
}

/** The id of the stylesheet this installs, so a second call can replace it. */
const STYLE_ID = 'n55-theme-tokens';

/**
 * Puts the palette on the document.
 *
 * Idempotent: calling it again replaces the stylesheet rather than stacking a
 * second one, which is what lets a theme builder preview a palette live.
 *
 * @param {{ themes?: Record<string, NeodigmTheme>, selector?: string,
 *   neutrals?: Record<string, [string, string]>, doc?: Document }} [options]
 * @returns {HTMLStyleElement|null} null where there is no document.
 */
export function installTheme({
  themes = THEMES, selector = ':root', neutrals = NEUTRALS, doc = globalThis.document
} = {}) {
  if (!doc?.head) return null;
  const style = doc.getElementById(STYLE_ID) ?? doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = themeCss(themes, selector, neutrals);
  if (!style.isConnected) doc.head.append(style);
  return style;
}

/**
 * Reads a theme's resolved values from the document.
 *
 * Goes through `getComputedStyle` rather than the `THEMES` object on purpose:
 * once a page overrides `--n55-brand`, the object is no longer the truth. Any
 * code that needs the *actual* colour — the tab glyph, a canvas fill — has to
 * ask the document.
 *
 * @param {string} name
 * @param {{ doc?: Document }} [options]
 * @returns {NeodigmTheme|null}
 */
export function resolveTheme(name, { doc = globalThis.document } = {}) {
  if (!THEMES[name]) return null;
  const root = doc?.documentElement;
  const built = THEMES[name];
  if (!root || typeof globalThis.getComputedStyle !== 'function') {
    return { ...built, ink: inkFor(built.color), deepInk: inkFor(built.deep) };
  }
  const read = (suffix) =>
    globalThis.getComputedStyle(root).getPropertyValue(`--n55-${name}${suffix}`).trim();
  return {
    color: read('') || THEMES[name].color,
    deep: read('-deep') || THEMES[name].deep,
    // The glyph round-trips through CSS as a quoted string.
    glyph: (read('-glyph') || '').replace(/^["']|["']$/g, '') || THEMES[name].glyph,
    ink: read('-ink') || inkFor(THEMES[name].color),
    deepInk: read('-deep-ink') || inkFor(THEMES[name].deep)
  };
}
