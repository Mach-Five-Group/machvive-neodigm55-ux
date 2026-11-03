/**
 * `<neodigm-poptart>` — a floating surface beside the element that opened it.
 *
 * Each Poptart is its own element holding its own content, which stays in the
 * page while it is closed — so a form inside keeps what was typed, as in the
 * original. A trigger names it by id, and says how it opens:
 *
 * ```html
 * <button data-n55-poptart-click="js-signin">Sign in</button>
 * <a data-n55-poptart-hover="js-about" href="/about">About</a>
 * <div data-n55-poptart-rightclick="js-menu">Right-click me</div>
 *
 * <neodigm-poptart id="js-signin"
 *   data-n55-poptart='{"w": 256, "h": 284, "position": "bottom", "offset": {"x": 0, "y": 0}}'>
 *   YOUR CONTENT HERE
 * </neodigm-poptart>
 * ```
 *
 * Migrating is renaming `<neodigm-template>` to `<neodigm-poptart>`; the
 * triggers and the JSON are read as before. It is never modal: a click
 * outside, Escape or `close()` closes it, and opening one closes any other.
 * Without a theme of its own it takes its trigger's. What changed:
 *
 * - **The declared side is binding, and the offsets are the designer's tool.**
 *   Placement is the shared `place()`. `offset.x` and `offset.y` move it, as
 *   the cheat sheet documents; the original read only `offset.l` and
 *   `offset.t` (where `t` moved it *up*), and both are still read.
 * - **`top` puts it above the trigger.** The original subtracted the trigger's
 *   height a second time, and measured the surface before giving it its width.
 * - **`left` and `right` sit flush beside the trigger** at any width. The
 *   original centred first and then shifted by the trigger's width, which was
 *   flush only when the Poptart was exactly as wide as the trigger. Beside it
 *   lines up with the trigger's top edge, as before; `align` changes that.
 * - **`x` and `y` are the coordinate itself**, in the viewport, and `0`
 *   counts. The original treated them as a base that the side then moved,
 *   and ignored `0`.
 * - **It follows its trigger** when the page scrolls or resizes, rather than
 *   closing on resize and drifting on scroll.
 * - **Callbacks are cancelable events.** `setOnBeforeOpen`, `setOnAfterOpen`
 *   and `setOnClose` were registries keyed by id. `pause()` and `play()` are
 *   gone with them: a listener that calls `preventDefault()` does the same.
 * - **A hover trigger also opens on focus**, so a keyboard reaches it.
 * - **A borrowed theme is read on every open**, not stamped on the first.
 * - **Sound, haptics and analytics are not wired in.** Listen for the events.
 *
 * `arrow` and `dismiss` appear in the original's markup but were never
 * implemented; they are still ignored.
 */
import { THEMES, THEME_ATTR, OPT_OUT, paletteReaches } from '../../conductor/theme.js';
import { place, rectOf, SIDES, ALIGNS } from '../../conductor/anchor.js';
import { motionAllowed } from '../../conductor/motion.js';

/** The original's gaps: 10px above and below, flush beside. */
const GAP = Object.freeze({ top: 10, bottom: 10, left: 0, right: 0 });
const TRIGGERS = Object.freeze(['click', 'hover', 'rightclick']);

/** A finite number, or null where the key is absent or not a number. */
const numberOr = (value, fallback) => {
  if (typeof value !== 'number' && typeof value !== 'string') return fallback;
  if (value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Reads a Poptart's `data-n55-poptart` JSON. Never throws: unparseable or
 * missing configuration is the defaults, since a Poptart in the wrong place
 * beats one that never opens.
 *
 * @param {string|null} raw
 */
export function readPoptart(raw) {
  let given = {};
  try { given = JSON.parse(String(raw ?? '')) ?? {}; } catch { given = {}; }
  if (typeof given !== 'object') given = {};
  const offset = given.offset && typeof given.offset === 'object' ? given.offset : {};

  const position = SIDES.includes(given.position) ? given.position : 'bottom';
  // Centred above and below, top edges lined up beside: the original's layout.
  const align = ALIGNS.includes(given.align) ? given.align
    : position === 'left' || position === 'right' ? 'start' : 'center';
  const size = (v) => { const n = numberOr(v, null); return n > 0 ? n : null; };

  return {
    position,
    align,
    w: size(given.w),
    h: size(given.h),
    x: numberOr(given.x, null),
    y: numberOr(given.y, null),
    z: numberOr(given.z, null),
    // Tulip's names, the cheat sheet's, and the original code's, summed.
    offsetX: numberOr(given.offsetX, 0) + numberOr(offset.x, 0) + numberOr(offset.l, 0),
    offsetY: numberOr(given.offsetY, 0) + numberOr(offset.y, 0) - numberOr(offset.t, 0),
    offsetW: numberOr(offset.w, 0),
    offsetH: numberOr(offset.h, 0)
  };
}

/**
 * The trigger nearest the target for one Poptart and one way of opening, or
 * null. A trigger that is disabled, or inside a disabled region, opens nothing.
 */
export function triggerFor(node, id, kind) {
  const attr = `data-n55-poptart-${kind}`;
  const el = node?.closest?.(`[${attr}]`);
  if (!el || !id || el.getAttribute(attr) !== id) return null;
  if (el.closest(`[${THEME_ATTR}]`)?.getAttribute(THEME_ATTR) === OPT_OUT) return null;
  return el;
}

/** Poptarts showing. Opening one closes the others. */
const showing = new Set();

const STYLES = `
  :host {
    position: fixed;
    top: 0; left: 0;
    z-index: 2147482980;
    display: none;
    box-sizing: border-box;
  }
  :host([open]) { display: block; }
  :host([hidden]) { display: none; }

  .popup {
    box-sizing: border-box;
    block-size: 100%;
    overflow: hidden auto;
    overscroll-behavior: contain;
    border: 2px solid var(--n55-surface-ink, #1a1a1a);
    border-radius: 4px;
    background: var(--n55-surface, #fff);
    color: var(--n55-surface-ink, #1a1a1a);
  }

  ${Object.keys(THEMES).map((name) => `
  :host([${THEME_ATTR}="${name}"]) .popup { border-color: var(--n55-${name}); }`).join('')}

  .popup.shake { animation: n55-poptart-shake .2s 4; }
  @keyframes n55-poptart-shake {
    0%   { transform: translate(1px, -3px) rotate(-2deg); }
    10%  { transform: translate(-1px, 2px) rotate(-1deg); }
    20%  { transform: translate(1px, 3px) rotate(0deg); }
    30%  { transform: translate(2px, 3px) rotate(1deg); }
    40%  { transform: translate(1px, -1px) rotate(2deg); }
    50%  { transform: translate(-1px, -3px) rotate(-1deg); }
    60%  { transform: translate(-2px, 1px) rotate(0deg); }
    70%  { transform: translate(3px, 1px) rotate(-1deg); }
    80%  { transform: translate(-1px, -1px) rotate(2deg); }
    90%  { transform: translate(-3px, 0) rotate(1deg); }
    100% { transform: translate(1px, 1px) rotate(0deg); }
  }
  @media (prefers-reduced-motion: reduce) { .popup.shake { animation: none; } }
  @media print { :host, :host([open]) { display: none; } }
`;

export class NeodigmPoptart extends HTMLElement {
  #trigger = null;
  #borrowed = false;
  #delegated = false;
  #following = false;
  #frame = 0;
  /** Marquees this Poptart paused on closing, and so may start again. */
  #hushed = new Set();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this.shadowRoot.firstChild) {
      this.shadowRoot.innerHTML =
        `<style>${STYLES}</style>` +
        `<div class="popup" part="popup"><slot></slot></div>`;
      this.shadowRoot.querySelector('.popup').addEventListener('animationend', (ev) => {
        if (ev.animationName === 'n55-poptart-shake') ev.currentTarget.classList.remove('shake');
      });
    }
    this.#listen(true);
    // Content parsed after this element connects is not here yet.
    const doc = this.ownerDocument;
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', () => this.#hush(), { once: true });
    } else {
      this.#hush();
    }
  }

  disconnectedCallback() {
    this.#listen(false);
    this.#follow(false);
    showing.delete(this);
  }

  #listen(on) {
    const doc = this.ownerDocument;
    if (!doc || on === this.#delegated) return;
    const fn = on ? 'addEventListener' : 'removeEventListener';
    doc[fn]('click', this.#onClick, true);
    doc[fn]('contextmenu', this.#onContext, true);
    doc[fn]('mouseover', this.#onHover, true);
    doc[fn]('focusin', this.#onHover, true);
    // Capture, so a Poptart inside a SideDish closes before the SideDish does.
    doc[fn]('keydown', this.#onKey, true);
    this.#delegated = on;
  }

  /** Scroll and resize listeners, held only while open. */
  #follow(on) {
    const win = this.ownerDocument?.defaultView;
    if (!win || on === this.#following) return;
    const fn = on ? 'addEventListener' : 'removeEventListener';
    win[fn]('scroll', this.#onMove, true);
    win[fn]('resize', this.#onMove);
    this.#following = on;
    if (!on) { win.cancelAnimationFrame?.(this.#frame); this.#frame = 0; }
  }

  /** Whether it is showing. */
  get open() { return this.hasAttribute('open'); }

  /** The element it is showing beside, or null when closed. */
  get trigger() { return this.open ? this.#trigger : null; }

  /**
   * Opens beside a trigger. Replaces the original's `autoOpen`.
   *
   * Without an argument it uses the last trigger, else the first in the page
   * that names this Poptart. Dispatches a cancelable `neodigm-poptart-open`
   * first and `neodigm-poptart-opened` after; calling it while open moves it
   * to the new trigger.
   *
   * @param {Element|string} [target] Element or selector.
   * @returns {boolean} false if it was vetoed or there was nothing to open beside.
   */
  show(target) {
    const doc = this.ownerDocument;
    const el = typeof target === 'string' ? doc?.querySelector(target)
      : target ?? (this.#trigger?.isConnected ? this.#trigger : this.#firstTrigger());
    const config = readPoptart(this.getAttribute('data-n55-poptart'));
    if (!this.isConnected || (!el && (config.x === null || config.y === null))) return false;

    const detail = { id: this.id, trigger: el ?? null };
    if (!this.#announce('open', detail)) return false;
    for (const other of showing) {
      if (other !== this && !other.close('replace')) return false;
    }

    if (this.#trigger && this.#trigger !== el) this.#trigger.setAttribute('aria-expanded', 'false');
    this.#trigger = el ?? null;
    this.#borrowTheme(el);
    const wasOpen = this.open;
    this.setAttribute('open', '');
    this.#layout(config);
    el?.setAttribute('aria-expanded', 'true');
    showing.add(this);
    this.#follow(true);
    if (!wasOpen) this.#wake();
    paletteReaches(this);
    this.#announce('opened', detail, false);
    return true;
  }

  /**
   * Closes it. Dispatches a cancelable `neodigm-poptart-close` whose detail
   * says what asked: `'outside'` (a click elsewhere), `'escape'`, `'trigger'`
   * (its click trigger again), `'api'` or `'replace'` (another opening).
   *
   * @param {'outside'|'escape'|'trigger'|'api'|'replace'} [reason]
   * @returns {boolean} false if it was not open or a listener vetoed it.
   */
  close(reason = 'api') {
    if (!this.open) return false;
    const trigger = this.#trigger;
    if (!this.#announce('close', { id: this.id, trigger, reason })) return false;
    const doc = this.ownerDocument;
    const hadFocus = this.contains(doc.activeElement);
    this.removeAttribute('open');
    showing.delete(this);
    this.#follow(false);
    trigger?.setAttribute('aria-expanded', 'false');
    this.#hush();
    // Hiding it with focus inside would drop focus on the body, so it goes
    // back to where it came from.
    if (hadFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
    return true;
  }

  /**
   * Shakes it, if open. Nothing happens when motion is suppressed.
   * @returns {this}
   */
  shake() {
    const pop = this.shadowRoot?.querySelector('.popup');
    if (!this.open || !pop || !motionAllowed()) return this;
    pop.classList.remove('shake');
    void pop.offsetWidth;       // restart the animation if it is mid-shake
    pop.classList.add('shake');
    return this;
  }

  #announce(kind, detail, cancelable = true) {
    return this.dispatchEvent(new CustomEvent(`neodigm-poptart-${kind}`, {
      bubbles: true, composed: true, cancelable, detail
    }));
  }

  #firstTrigger() {
    if (!this.id) return null;
    for (const el of this.ownerDocument.querySelectorAll(
      TRIGGERS.map((kind) => `[data-n55-poptart-${kind}]`).join(','))) {
      if (TRIGGERS.some((kind) => el.getAttribute(`data-n55-poptart-${kind}`) === this.id)) return el;
    }
    return null;
  }

  /** Without a theme of its own, it wears its trigger's — read now, not once. */
  #borrowTheme(el) {
    if (this.hasAttribute(THEME_ATTR) && !this.#borrowed) return;
    const theme = el?.closest(`[${THEME_ATTR}]`)?.getAttribute(THEME_ATTR) ?? null;
    if (theme) this.setAttribute(THEME_ATTR, theme);
    else this.removeAttribute(THEME_ATTR);
    this.#borrowed = true;
  }

  /** Size first, then measure and place, so `top` knows its real height. */
  #layout(config = readPoptart(this.getAttribute('data-n55-poptart'))) {
    const trigger = this.#trigger ? rectOf(this.#trigger) : null;
    const width = config.w ?? (trigger ? trigger.width + config.offsetW : null);
    const height = config.h === null ? null : config.h + config.offsetH;
    this.style.width = width === null ? '' : `${width}px`;
    this.style.height = height === null ? '' : `${height}px`;
    this.style.zIndex = config.z === null ? '' : String(config.z);

    const at = trigger
      ? place({
        trigger,
        surface: rectOf(this),
        position: config.position,
        align: config.align,
        gap: GAP[config.position],
        offsetX: config.offsetX,
        offsetY: config.offsetY
      })
      : { x: 0, y: 0, side: config.position };
    const x = config.x ?? at.x;
    const y = config.y ?? at.y;
    this.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    this.setAttribute('data-side', at.side);
  }

  /** Pauses running marquees inside, so nothing animates while closed. */
  #hush() {
    if (this.open) return;
    for (const m of this.querySelectorAll('neodigm-marquee:not([paused])')) {
      m.setAttribute('paused', '');
      this.#hushed.add(m);
    }
  }

  /** Starts again only what #hush stopped. */
  #wake() {
    for (const m of this.#hushed) m.removeAttribute('paused');
    this.#hushed.clear();
  }

  #onClick = (ev) => {
    const own = triggerFor(ev.target, this.id, 'click');
    if (own) {
      ev.preventDefault();
      if (this.open && own === this.#trigger) this.close('trigger');
      else this.show(own);
      return;
    }
    if (!this.open || ev.composedPath().includes(this)) return;
    // Clicking the hover or right-click trigger it is showing beside is not
    // leaving it.
    if (this.#trigger?.contains(ev.target)) return;
    this.close('outside');
  };

  #onContext = (ev) => {
    const own = triggerFor(ev.target, this.id, 'rightclick');
    if (!own) return;
    ev.preventDefault();
    this.show(own);
  };

  #onHover = (ev) => {
    const own = triggerFor(ev.target, this.id, 'hover');
    if (own && !(this.open && own === this.#trigger)) this.show(own);
  };

  #onKey = (ev) => {
    if (ev.key !== 'Escape' || !this.open || ev.defaultPrevented) return;
    ev.preventDefault();
    this.close('escape');
  };

  #onMove = () => {
    const win = this.ownerDocument.defaultView;
    if (this.#frame || !win.requestAnimationFrame) return;
    this.#frame = win.requestAnimationFrame(() => {
      this.#frame = 0;
      this.#layout();
    });
  };
}

if (!customElements.get('neodigm-poptart')) {
  customElements.define('neodigm-poptart', NeodigmPoptart);
}
