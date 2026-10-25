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
 * triple:
 *   --n55-<name>        the colour
 *   --n55-<name>-deep   its darker companion, for text on the colour or hover
 *   --n55-<name>-glyph  the emoji the tab title flashes (see flashTitle)
 */

/** @typedef {{ color: string, deep: string, glyph: string }} NeodigmTheme */

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
 * @returns {string}
 */
export function themeCss(themes = THEMES, selector = ':root') {
  const lines = Object.entries(themes).flatMap(([name, t]) => [
    `  --n55-${name}: ${t.color};`,
    `  --n55-${name}-deep: ${t.deep};`,
    `  --n55-${name}-glyph: "${t.glyph}";`
  ]);
  return `${selector} {\n${lines.join('\n')}\n}\n`;
}

/** The id of the stylesheet this installs, so a second call can replace it. */
const STYLE_ID = 'n55-theme-tokens';

/**
 * Puts the palette on the document.
 *
 * Idempotent: calling it again replaces the stylesheet rather than stacking a
 * second one, which is what lets a theme builder preview a palette live.
 *
 * @param {{ themes?: Record<string, NeodigmTheme>, selector?: string, doc?: Document }} [options]
 * @returns {HTMLStyleElement|null} null where there is no document.
 */
export function installTheme({ themes = THEMES, selector = ':root', doc = globalThis.document } = {}) {
  if (!doc?.head) return null;
  const style = doc.getElementById(STYLE_ID) ?? doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = themeCss(themes, selector);
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
  if (!root || typeof globalThis.getComputedStyle !== 'function') return THEMES[name];
  const read = (suffix) =>
    globalThis.getComputedStyle(root).getPropertyValue(`--n55-${name}${suffix}`).trim();
  return {
    color: read('') || THEMES[name].color,
    deep: read('-deep') || THEMES[name].deep,
    // The glyph round-trips through CSS as a quoted string.
    glyph: (read('-glyph') || '').replace(/^["']|["']$/g, '') || THEMES[name].glyph
  };
}
