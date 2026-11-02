/**
 * `<neodigm-side-dish>` — a scrollable panel that slides in from the right
 * over its container, with a scrim over the rest.
 *
 * ```html
 * <main style="position: relative">
 *   <neodigm-side-dish label="Filters" data-n55-theme="brand">
 *     <h2 slot="title">Filters</h2>
 *     …any content; the panel scrolls…
 *   </neodigm-side-dish>
 * </main>
 * ```
 *
 * ```js
 * dish.show();                       // or set the `open` attribute
 * dish.addEventListener('neodigm-side-dish-close', (e) => {
 *   if (hasUnsavedWork()) e.preventDefault();   // cancelable
 * });
 * ```
 *
 * Built new; the original has no equivalent. The host covers its containing
 * block — `position: absolute; inset: 0`, so the container needs a position —
 * and the panel takes `--n55-side-dish-width` (40%) of it at full height. For
 * the whole viewport, style the host `position: fixed`.
 *
 * The scrim, Escape and the X all close it. The panel is a light/dark surface
 * from the palette's neutrals; the theme on the host colours only the X, using
 * the theme's legible shade, so a sweep reaches it and it stays readable.
 *
 * Not a modal in the `showModal()` sense: the top layer is the viewport, and
 * this is deliberately bounded by its container. Focus moves into the panel on
 * open and returns on close, but Tab is not trapped.
 */
import { THEMES, THEME_ATTR, paletteReaches } from '../../conductor/theme.js';
import { motionAllowed } from '../../conductor/motion.js';

/** Open instances, most recent last, so Escape closes only the topmost. */
const stack = [];

const STYLES = `
  :host {
    position: absolute;
    inset: 0;
    z-index: 2147483000;
    display: block;
    overflow: hidden;
    pointer-events: none;
    visibility: hidden;
    /* Hidden only once the slide out has finished. */
    transition: visibility 0s linear .3s;
  }
  :host([open]) { visibility: visible; pointer-events: auto; transition-delay: 0s; }
  :host([hidden]) { display: none; }

  .scrim {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / .5);
    opacity: 0;
    transition: opacity .3s ease;
  }
  :host([open]) .scrim { opacity: 1; }

  .panel {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    inline-size: var(--n55-side-dish-width, 40%);
    box-sizing: border-box;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--n55-surface, #fff);
    color: var(--n55-surface-ink, #1a1a1a);
    border-inline-start: 1px solid var(--n55-line, rgb(0 0 0 / .12));
    box-shadow: -8px 0 24px rgb(0 0 0 / .24);
    font: 16px/1.5 system-ui, sans-serif;
    transform: translateX(100%);
    transition: transform .3s cubic-bezier(.2, .8, .2, 1);
    outline: none;
  }
  :host([open]) .panel { transform: none; }

  header {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 12px 12px 20px;
    background: inherit;
  }
  ::slotted([slot="title"]) { margin: 0; flex: 1; font-size: 1.15em; }
  .spacer { flex: 1; }
  .body { padding: 0 20px 20px; }

  .close {
    flex: none;
    display: grid;
    place-items: center;
    inline-size: 40px;
    block-size: 40px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition: background-color .2s, color .2s;
  }
  .close:hover { background: var(--n55-line, rgb(0 0 0 / .12)); }
  .close:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .close svg { inline-size: 18px; block-size: 18px; }

  ${Object.keys(THEMES).map((name) => `
  :host([${THEME_ATTR}="${name}"]) .close {
    background: var(--n55-${name}-legible);
    color: var(--n55-${name}-legible-ink);
  }`).join('')}

  .still .scrim, .still .panel, .still .close { transition: none; }
  @media (prefers-reduced-motion: reduce) {
    :host, .scrim, .panel, .close { transition: none; }
  }
`;

// Drawn, not a glyph: no emoji, no icon font.
const X = '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">' +
  '<path d="M3 3l12 12M15 3L3 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export class NeodigmSideDish extends HTMLElement {
  static observedAttributes = ['open', 'label'];

  #returnFocus = null;
  #listening = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this.shadowRoot.firstChild) {
      this.shadowRoot.innerHTML =
        `<style>${STYLES}</style>` +
        `<div class="frame">` +
        `<div class="scrim" part="scrim"></div>` +
        `<section class="panel" part="panel" role="dialog" aria-modal="true" tabindex="-1">` +
        `<header part="header"><slot name="title"><span class="spacer"></span></slot>` +
        `<button class="close" part="close" type="button" aria-label="Close">${X}</button></header>` +
        `<div class="body" part="body"><slot></slot></div>` +
        `</section></div>`;
      this.shadowRoot.addEventListener('click', this.#onClick);
    }
    this.#label();
    this.#sync();
  }

  disconnectedCallback() { this.#sync(); }

  attributeChangedCallback(name) {
    if (!this.shadowRoot.firstChild) return;
    if (name === 'label') this.#label();
    else this.#sync();
  }

  /** Whether the panel is showing. Setting it opens or closes with no event. */
  get open() { return this.hasAttribute('open'); }
  set open(value) { this.toggleAttribute('open', Boolean(value)); }

  /**
   * Opens the panel. Dispatches a cancelable `neodigm-side-dish-open`.
   * @returns {boolean} false if it was already open or a listener vetoed it.
   */
  show() {
    if (this.open || !this.#announce('open', {})) return false;
    this.open = true;
    paletteReaches(this);
    return true;
  }

  /**
   * Closes the panel. Dispatches a cancelable `neodigm-side-dish-close` whose
   * detail says what asked: `'scrim'`, `'escape'`, `'close'` (the X) or `'api'`.
   * @param {'scrim'|'escape'|'close'|'api'} [reason]
   * @returns {boolean} false if it was already closed or a listener vetoed it.
   */
  close(reason = 'api') {
    if (!this.open || !this.#announce('close', { reason })) return false;
    this.open = false;
    return true;
  }

  #announce(kind, detail) {
    return this.dispatchEvent(new CustomEvent(`neodigm-side-dish-${kind}`, {
      bubbles: true, composed: true, cancelable: true, detail
    }));
  }

  #onClick = (ev) => {
    const target = /** @type {Element} */ (ev.target);
    if (target.closest?.('.close')) this.close('close');
    else if (target.classList?.contains('scrim')) this.close('scrim');
  };

  #onKey = (ev) => {
    if (ev.key !== 'Escape' || ev.defaultPrevented || stack.at(-1) !== this) return;
    if (this.close('escape')) ev.preventDefault();
  };

  #label() {
    const panel = this.shadowRoot.querySelector('.panel');
    const label = this.getAttribute('label');
    if (label) panel.setAttribute('aria-label', label);
    else panel.removeAttribute('aria-label');
  }

  /** Brings listeners, the Escape stack and focus in line with `open`. */
  #sync() {
    const live = this.open && this.isConnected;
    // The motion gate can be overridden from JavaScript, which the media
    // query in the stylesheet cannot see.
    this.shadowRoot.querySelector('.frame')?.classList.toggle('still', !motionAllowed());
    if (live === this.#listening) return;
    this.#listening = live;

    const doc = this.ownerDocument;
    const at = stack.indexOf(this);
    if (live) {
      stack.push(this);
      doc.addEventListener('keydown', this.#onKey);
      this.#returnFocus = doc.activeElement;
      this.shadowRoot.querySelector('.panel').focus({ preventScroll: true });
    } else {
      if (at !== -1) stack.splice(at, 1);
      doc.removeEventListener('keydown', this.#onKey);
      const back = this.#returnFocus;
      this.#returnFocus = null;
      // Only if focus is still ours to give back; a page that moved it on
      // purpose keeps it where it put it.
      const ours = this.contains(doc.activeElement) || doc.activeElement === this ||
        doc.activeElement === doc.body;
      if (back?.isConnected && ours && this.isConnected) back.focus({ preventScroll: true });
    }
  }
}

if (!customElements.get('neodigm-side-dish')) {
  customElements.define('neodigm-side-dish', NeodigmSideDish);
}
