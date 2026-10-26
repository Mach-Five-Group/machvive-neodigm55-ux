/**
 * `<neodigm-tulip>` — one floating tip, serving every trigger on the page.
 *
 * The declarative format is carried over unchanged, because it is the part of
 * Tulip people actually use. A trigger carries its whole configuration in
 * `data-n55-tulip`, either as plain text or as JSON:
 *
 * ```html
 * <neodigm-tulip></neodigm-tulip>
 *
 * <button data-n55-tulip="Simple tip">Hover me</button>
 * <button data-n55-tulip='{"msg":"Advanced|Two lines","theme":"brand","position":"right","size":"medium"}'>
 *   Hover me
 * </button>
 * <button data-n55-tulip='{"msg":"Scrolling news","mrq":true}'>Hover me</button>
 * ```
 *
 * One surface, many triggers, config found by walking up from whatever was
 * hovered — all as the original. What changed:
 *
 * - **It is placed by the shared anchor**, which flips to another side when the
 *   preferred one would run off screen. The original computed a left offset and
 *   never checked, so a tip on a trigger near the right edge rendered off the
 *   viewport.
 * - **`msg` is text, never markup.** The original used `innerHTML`, and a tip
 *   is routinely built from a product name or a server string.
 * - **Every `|` breaks a line**, not just the first. `String.replace` with a
 *   string needle replaces one occurrence, which is why the original was
 *   documented as supporting "up to two lines".
 * - **`onBeforeOpen` is a cancelable event** rather than a callback registry
 *   keyed by element id, so more than one listener can watch and any of them
 *   can veto.
 * - **Keyboard and touch reach it.** The original bound mouseover/mouseout and
 *   excluded mobile outright, leaving the tip unreachable without a pointer.
 */
import { THEMES, THEME_ATTR, OPT_OUT } from '../../conductor/theme.js';
import { place, rectOf } from '../../conductor/anchor.js';

/** Matches the original's `oCnfDef`. */
export const TULIP_DEFAULTS = Object.freeze({
  msg: 'tulip',
  mrq: false,
  tmpt: '',
  theme: 'brand',
  size: 'small',
  position: 'top',
  icon: ''
});

const SIZES = new Set(['small', 'medium', 'large']);
const SIDES = new Set(['top', 'right', 'bottom', 'left']);

/**
 * Reads a trigger's configuration.
 *
 * Accepts JSON or a bare string, because both appear in real markup and the
 * original's `getValJSON` quietly allowed it. Anything unparseable is treated
 * as the message rather than discarded — a tip that shows the wrong styling is
 * better than a tip that silently never appears.
 *
 * @param {string} raw
 * @returns {typeof TULIP_DEFAULTS}
 */
export function readConfig(raw) {
  let parsed = null;
  const text = String(raw ?? '').trim();
  if (text.startsWith('{')) {
    try { parsed = JSON.parse(text); } catch { parsed = null; }
  }
  const given = parsed && typeof parsed === 'object' ? parsed : { msg: text };
  const config = { ...TULIP_DEFAULTS, ...given };

  // Unknown values fall back rather than reaching CSS as a bogus attribute.
  if (!THEMES[config.theme]) config.theme = TULIP_DEFAULTS.theme;
  if (!SIZES.has(config.size)) config.size = TULIP_DEFAULTS.size;
  if (!SIDES.has(config.position)) config.position = TULIP_DEFAULTS.position;
  config.mrq = Boolean(config.mrq);
  config.msg = String(config.msg ?? '');
  return config;
}

/** The config nearest the event target, walking up. The original's walkDOM3. */
export function configFrom(node) {
  for (let el = node; el; el = el.parentElement) {
    if (el.nodeType !== 1) continue;
    if (el.getAttribute(THEME_ATTR) === OPT_OUT) return null;
    const raw = el.getAttribute('data-n55-tulip');
    if (raw !== null) return { element: el, config: readConfig(raw) };
  }
  return null;
}

const STYLES = `
  :host {
    position: fixed;
    top: 0; left: 0;
    z-index: 2147483001;
    display: block;
    opacity: 0;
    visibility: hidden;
    transition: opacity .18s ease;
    pointer-events: none;

    max-width: min(80vw, 320px);
    box-sizing: border-box;
    border-radius: 6px;
    padding: 7px 11px;
    font: 13px/1.4 system-ui, sans-serif;
    text-align: center;
    box-shadow: 0 4px 16px rgb(0 0 0 / .24);
    background: var(--n55-brand, #2b2b2b);
    color: var(--n55-brand-deep, #fff);
  }
  :host([open]) { opacity: 1; visibility: visible; }
  :host([hidden]) { display: none; }

  @media (prefers-reduced-motion: reduce) { :host { transition: none; } }

  :host([size="medium"]) { font-size: 15px; padding: 9px 14px; max-width: min(80vw, 420px); }
  :host([size="large"])  { font-size: 17px; padding: 11px 17px; max-width: min(84vw, 520px); }

  ${Object.keys(THEMES).map((name) => `
  :host([${THEME_ATTR}="${name}"]) {
    background: var(--n55-${name});
    color: var(--n55-${name}-deep);
  }`).join('')}
  :host([${THEME_ATTR}="white"]),
  :host([${THEME_ATTR}="ghost"]) { color: #1a1a1a; }

  .msg { margin: 0; }
  .icon { margin-inline-end: 6px; font-style: normal; }
  neodigm-marquee { display: block; }
  :host(:not([mrq])) neodigm-marquee { display: none; }
  :host([mrq]) .msg { display: none; }
`;

export class NeodigmTulip extends HTMLElement {
  #trigger = null;
  #delegated = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this.shadowRoot.firstChild) {
      this.shadowRoot.innerHTML =
        `<style>${STYLES}</style>` +
        `<p class="msg" part="message"></p>` +
        `<neodigm-marquee part="marquee" paused></neodigm-marquee>`;
    }
    if (!this.hasAttribute('role')) this.setAttribute('role', 'tooltip');
    this.#listen(true);
  }

  disconnectedCallback() { this.#listen(false); }

  #listen(on) {
    const doc = this.ownerDocument;
    if (!doc || on === this.#delegated) return;
    const fn = on ? 'addEventListener' : 'removeEventListener';
    // Pointer and keyboard both open it. The original bound mouseover/mouseout
    // and skipped mobile entirely, so a tip was unreachable without a mouse.
    doc[fn]('mouseover', this.#onEnter, true);
    doc[fn]('focusin', this.#onEnter, true);
    doc[fn]('mouseout', this.#onLeave, true);
    doc[fn]('focusout', this.#onLeave, true);
    doc[fn]('click', this.#onLeave, true);
    doc[fn]('keydown', this.#onKey, true);
    globalThis.window?.[fn]('scroll', this.#onLeave, true);
    globalThis.window?.[fn]('resize', this.#onLeave);
    globalThis.window?.[fn]('orientationchange', this.#onLeave);
    this.#delegated = on;
  }

  #onEnter = (ev) => {
    const found = configFrom(ev.target);
    if (found) this.openFor(found.element, found.config);
  };
  #onLeave = () => { if (this.open) this.close(); };
  #onKey = (ev) => { if (ev.key === 'Escape' && this.open) this.close(); };

  /** Whether a tip is showing. */
  get open() { return this.hasAttribute('open'); }

  /** The element the current tip describes. */
  get trigger() { return this.#trigger; }

  /**
   * Shows the tip for an element, which must carry `data-n55-tulip` unless a
   * configuration is passed. Replaces the original's `autoOpen`, and works on
   * touch where hover never fires.
   *
   * @param {Element|string} target Element or a selector.
   * @param {Partial<typeof TULIP_DEFAULTS>} [override]
   * @returns {boolean} false if it was vetoed or there was nothing to show.
   */
  openFor(target, override) {
    const el = typeof target === 'string' ? this.ownerDocument?.querySelector(target) : target;
    if (!el) return false;
    const config = override ?? readConfig(el.getAttribute('data-n55-tulip') ?? '');
    if (!config.msg) return false;

    // Cancelable, which is what replaces setOnBeforeOpen — and unlike a
    // callback registry keyed by id, several listeners can watch at once.
    const proceed = this.dispatchEvent(new CustomEvent('neodigm-tulip-open', {
      bubbles: true, composed: true, cancelable: true,
      detail: { trigger: el, config }
    }));
    if (!proceed) return false;

    this.#trigger = el;
    this.#fill(config);
    this.setAttribute('open', '');
    this.#position(el, config.position);
    return true;
  }

  /** Hides the tip. */
  close() {
    if (!this.open) return this;
    this.removeAttribute('open');
    // Stop the marquee. A scrolling tip that is no longer visible is a timer
    // running for nothing, and every hover would start another — which is how
    // this surfaced: a smoke script stopped being able to exit.
    this.shadowRoot?.querySelector('neodigm-marquee')?.setAttribute('paused', '');
    const trigger = this.#trigger;
    this.#trigger = null;
    this.dispatchEvent(new CustomEvent('neodigm-tulip-close', {
      bubbles: true, composed: true, detail: { trigger }
    }));
    return this;
  }

  #fill(config) {
    this.setAttribute(THEME_ATTR, config.theme);
    this.setAttribute('size', config.size);
    this.toggleAttribute('mrq', config.mrq);

    const marquee = this.shadowRoot.querySelector('neodigm-marquee');
    const message = this.shadowRoot.querySelector('.msg');

    if (config.mrq) {
      // The marquee keeps its own source text, so unlike the original this can
      // be read back after it starts scrolling.
      marquee?.setAttribute('text', config.msg);
      marquee?.setAttribute(THEME_ATTR, config.theme);
      marquee?.removeAttribute('paused');
      message?.replaceChildren();
    } else {
      marquee?.setAttribute('paused', '');
      marquee?.setAttribute('text', '');
      this.#writeLines(message, config);
    }
    // The accessible name, since the surface itself is what gets announced.
    this.setAttribute('aria-label', config.msg.replace(/\|/g, ' '));
  }

  /** Writes the message as text nodes, one `<br>` per `|`. */
  #writeLines(target, config) {
    if (!target) return;
    target.replaceChildren();
    if (config.icon) {
      const icon = this.ownerDocument.createElement('i');
      icon.className = 'icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = config.icon;
      target.append(icon);
    }
    config.msg.split('|').forEach((line, index) => {
      if (index > 0) target.append(this.ownerDocument.createElement('br'));
      target.append(this.ownerDocument.createTextNode(line));
    });
  }

  #position(el, position) {
    const view = globalThis.window;
    const at = place({
      trigger: rectOf(el),
      surface: rectOf(this),
      viewport: { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 },
      position
    });
    this.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
    // Exposed so a page can style the pointer, and so a test can assert that a
    // tip near an edge actually flipped rather than running off screen.
    this.setAttribute('data-side', at.side);
  }
}

if (!customElements.get('neodigm-tulip')) {
  customElements.define('neodigm-tulip', NeodigmTulip);
}
