/**
 * Page-wide choreography.
 *
 * This is the part of Neodigm 55 that is not a component: the library knows
 * about every themed element on the page and can move colour across all of them
 * to draw attention somewhere. The components are instruments; this is the
 * conductor.
 *
 * Everything here works on the `data-n55-theme` attribute, never on a component
 * class. A plain `<button>`, a vanilla custom element, a Lit component and a
 * React-rendered `<div>` all participate identically by carrying the attribute,
 * which is what keeps the choreography independent of how any given element is
 * built.
 *
 * **Shadow DOM is deliberately out of reach.** `querySelectorAll` does not
 * cross a shadow boundary, so a component is swept by its *host* attribute and
 * styles its internals from that (`:host([data-n55-theme="brand"])`) or from
 * the inherited custom properties. Putting the attribute on a shadow-internal
 * node and expecting a sweep to find it is the one way to use this wrong.
 */
import { THEME_NAMES, OPT_OUT, THEME_ATTR, PULSE_ATTR, resolveTheme } from './theme.js';
import { motionAllowed } from './motion.js';

/**
 * Each element's own theme, so a sweep can put it back.
 *
 * A WeakMap rather than the original's `element.n55Theme` expando: it does not
 * show up in devtools as a mystery property, cannot collide with a page's own
 * code, and releases automatically when an element is removed mid-sweep.
 */
const ownTheme = new WeakMap();

/** @param {Element} el @returns {string|null} */
const currentTheme = (el) => el.getAttribute(THEME_ATTR);

/**
 * Sweeps a colour across every themed element, then restores each one.
 *
 * The signature difference from the original worth knowing about: there, the
 * restore was scheduled at `index * (delay + delay)` while the change happened
 * at `index * delay`, so each element held the new colour for `index * delay`
 * ms — the first element for 0ms (it never visibly changed) and the fiftieth
 * for nearly three seconds. The wave smeared as it travelled. Here `hold` is a
 * constant, so every element shows the colour for the same duration and the
 * wave keeps its shape. Pass `hold: 0` for the original behaviour if a page
 * depended on the smear.
 *
 * @param {string} [theme] Theme to sweep. Defaults to the first in round-robin order.
 * @param {object} [options]
 * @param {ParentNode} [options.context] Subtree to sweep. Defaults to the whole document.
 * @param {number} [options.stagger] ms between each element starting. Original: 56.
 * @param {number} [options.hold] ms each element holds the colour. Original: effectively `index * stagger`.
 * @param {AbortSignal} [options.signal] Aborting restores every element immediately.
 * @param {boolean} [options.flashTab] Also flash the tab title. Original did this unconditionally.
 * @returns {Promise<number>} how many elements were swept.
 */
export async function robinTheme(theme = THEME_NAMES[0], {
  context = globalThis.document,
  stagger = 56,
  hold = 420,
  signal,
  flashTab = true
} = {}) {
  if (!context?.querySelectorAll) return 0;

  const targets = [...context.querySelectorAll(`[${THEME_ATTR}]`)]
    .filter((el) => currentTheme(el) !== OPT_OUT);
  if (targets.length === 0) return 0;

  // Reduced motion still gets the tab flash — it is information, not movement —
  // but no sweep. Returning the count keeps the caller's contract identical.
  if (!motionAllowed()) {
    if (flashTab) flashTitle(theme);
    return targets.length;
  }

  for (const el of targets) {
    if (!ownTheme.has(el)) ownTheme.set(el, currentTheme(el));
  }

  const timers = [];
  const restoreAll = () => {
    for (const t of timers) clearTimeout(t);
    timers.length = 0;
    for (const el of targets) restore(el);
  };
  signal?.addEventListener('abort', restoreAll, { once: true });

  const done = new Promise((resolve) => {
    targets.forEach((el, index) => {
      const startsAt = index * stagger;
      timers.push(setTimeout(() => {
        if (el.isConnected) el.setAttribute(THEME_ATTR, theme);
      }, startsAt));
      timers.push(setTimeout(() => restore(el), startsAt + hold));
    });
    // Resolve once the last element has been put back.
    timers.push(setTimeout(resolve, (targets.length - 1) * stagger + hold));
  });

  if (flashTab) flashTitle(theme);
  await done;
  signal?.removeEventListener?.('abort', restoreAll);
  return targets.length;
}

/** Puts one element back to the theme it had before the sweep. */
function restore(el) {
  if (!ownTheme.has(el)) return;
  const original = ownTheme.get(el);
  ownTheme.delete(el);
  if (!el.isConnected) return;
  if (original === null) el.removeAttribute(THEME_ATTR);
  else el.setAttribute(THEME_ATTR, original);
}

/**
 * Sweeps the slower pulse cycle, for `data-n55-theme-pulse` elements.
 *
 * Kept separate from `robinTheme` because the original ran both from one call
 * on different cadences (56ms vs 256ms stagger, 3s hold), and a page wanting
 * only one of them had no way to ask.
 *
 * @param {string} [theme]
 * @param {{ context?: ParentNode, stagger?: number, hold?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<number>}
 */
export async function pulseTheme(theme = THEME_NAMES[0], {
  context = globalThis.document,
  stagger = 256,
  hold = 3000,
  signal
} = {}) {
  if (!context?.querySelectorAll) return 0;
  const targets = [...context.querySelectorAll(`[${PULSE_ATTR}]`)];
  if (targets.length === 0 || !motionAllowed()) return targets.length;

  const previous = new Map(targets.map((el) => [el, el.getAttribute(PULSE_ATTR)]));
  const timers = [];
  const undo = () => {
    for (const t of timers) clearTimeout(t);
    for (const [el, value] of previous) {
      if (!el.isConnected) continue;
      if (value === null) el.removeAttribute(PULSE_ATTR);
      else el.setAttribute(PULSE_ATTR, value);
    }
  };
  signal?.addEventListener('abort', undo, { once: true });

  await new Promise((resolve) => {
    targets.forEach((el, index) => {
      const startsAt = index * stagger;
      timers.push(setTimeout(() => {
        if (el.isConnected) el.setAttribute(PULSE_ATTR, theme);
      }, startsAt));
      timers.push(setTimeout(() => {
        const value = previous.get(el);
        if (!el.isConnected) return;
        if (value === null) el.removeAttribute(PULSE_ATTR);
        else el.setAttribute(PULSE_ATTR, value);
      }, startsAt + hold));
    });
    timers.push(setTimeout(resolve, (targets.length - 1) * stagger + hold));
  });
  return targets.length;
}

/** The page's real title, captured before anything prefixes it. */
let realTitle = null;
let titleTimer = null;

/**
 * Prefixes the tab title with a theme's glyph, then restores it.
 *
 * Cheap and surprisingly effective: a backgrounded tab showing 🟧 is how the
 * original signalled "something happened over here". The glyph is read from the
 * resolved custom property, so a page that overrode the palette gets its own.
 *
 * @param {string} theme
 * @param {number} [ms]
 * @param {{ doc?: Document }} [options]
 * @returns {boolean} whether the title was changed.
 */
export function flashTitle(theme, ms = 2000, { doc = globalThis.document } = {}) {
  if (!doc) return false;
  const resolved = resolveTheme(theme, { doc });
  if (!resolved?.glyph) return false;

  // Capture once. Calling twice in a row must not leave a glyph in the "real"
  // title and then restore to it — which is what made the original's title
  // accumulate prefixes when two flashes overlapped.
  if (realTitle === null) realTitle = doc.title;
  if (titleTimer) clearTimeout(titleTimer);

  doc.title = `${resolved.glyph}${realTitle}`;
  titleTimer = setTimeout(() => {
    doc.title = realTitle;
    realTitle = null;
    titleTimer = null;
  }, ms);
  return true;
}

/** Test seam: drop the captured title and any pending restore. */
export function resetTitle() {
  if (titleTimer) clearTimeout(titleTimer);
  titleTimer = null;
  realTitle = null;
}
