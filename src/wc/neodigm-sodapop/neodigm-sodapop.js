/**
 * `<neodigm-sodapop>` — one popup surface, serving every trigger on the page.
 *
 * The declarative format is carried over unchanged. Content lives in a
 * template; a trigger names it:
 *
 * ```html
 * <neodigm-sodapop></neodigm-sodapop>
 *
 * <button data-n55-sodapop-id="myPopup_id" aria-haspopup="dialog">Try Me</button>
 *
 * <template id="myPopup_id" data-n55-sodapop-modal="false"
 *   data-n55-sodapop-size="small" data-n55-sodapop-fullscreen="false">
 *   YOUR CONTENT HERE
 * </template>
 * ```
 *
 * It stays fixed while the page scrolls, blurs what is behind it, and sizes to
 * its content. The scrim, Escape and the X close it; a modal popup shakes
 * instead and closes only from `close()`. What changed:
 *
 * - **One element replaces three.** The page used to carry
 *   `<neodigm-sodapop-scrim>` and `<neodigm-sodapop-scrim-close>`, and the
 *   popup itself was created on every open. This element renders all three.
 * - **Content is cloned, not copied as markup.** The original assigned the
 *   template's `innerHTML`, re-parsing it on every open. Scripts in the
 *   template are dropped: they did not run under `innerHTML`, and a clone
 *   would run them.
 * - **Callbacks are cancelable events.** `setOnBeforeOpen`, `setOnAfterOpen`
 *   and `setOnClose` were registries keyed by popup id, one callback per id.
 *   Now any number of listeners watch, `e.detail.id` says which popup, and
 *   `preventDefault()` vetoes — as returning false from a callback did.
 * - **`show(id).shake()` works.** The cheat sheet's `autoOpen(id).shake()`
 *   never shook: `autoOpen` waited 256ms, so `shake()` ran before anything was
 *   open. `show()` opens at once.
 * - **One working X.** The original drew a second X on the popup's corner
 *   with `::after`; it looked clickable and was not.
 * - **A missing size is `medium`.** It used to become the class
 *   `ndsp__size--undefined` and a full-width popup.
 * - **Light and dark come from the inherited `color-scheme`**, and a template
 *   can pin its popup with `data-n55-scheme`, replacing `data-n55-ampm-theme`.
 * - **Sound, haptics and analytics are not wired in.** Listen for the events.
 *
 * Not ported: `setOnBeforeUserExit`, an exit-intent hook unrelated to the
 * popup. Locking page scroll was a global option; a page that wants it writes
 * `body:has(neodigm-sodapop[open]) { overflow: hidden }`.
 */
import { THEMES, THEME_ATTR, OPT_OUT, SCHEME_ATTR } from '../../conductor/theme.js';
import { motionAllowed } from '../../conductor/motion.js';

const SIZES = new Set(['xsmall', 'small', 'medium', 'large']);
const TRANSITIONS = new Set(['slide-right']);
/** How long the surface takes to leave, after which its content is removed. */
const EXIT_MS = 400;

/**
 * Reads a template's popup options. Unknown values fall back rather than
 * reaching CSS as a bogus attribute.
 *
 * @param {Element|null} el
 */
export function readPopup(el) {
  const data = (key) => el?.getAttribute(`data-n55-sodapop-${key}`) ?? '';
  const size = data('size');
  const transition = data('transition');
  const scheme = el?.getAttribute(SCHEME_ATTR) ?? '';
  return {
    modal: data('modal') === 'true',
    size: SIZES.has(size) ? size : 'medium',
    fullscreen: data('fullscreen') === 'true',
    transition: TRANSITIONS.has(transition) ? transition : '',
    scheme: scheme === 'light' || scheme === 'dark' ? scheme : ''
  };
}

const STYLES = `
  :host {
    position: fixed;
    inset: 0;
    z-index: 2147482990;
    display: block;
    pointer-events: none;
    visibility: hidden;
    transition: visibility 0s linear ${EXIT_MS}ms;
  }
  :host([open]) { visibility: visible; pointer-events: auto; transition-delay: 0s; }
  :host([hidden]) { display: none; }

  .frame { position: absolute; inset: 0; }

  .scrim {
    position: absolute;
    inset: 0;
    cursor: pointer;
    background: rgb(255 255 255 / 0);
    backdrop-filter: blur(0);
    transition: backdrop-filter 1s ease-in-out, background-color 1s ease-in-out;
  }
  :host([open]) .scrim {
    backdrop-filter: blur(8px);
    background: light-dark(rgb(255 255 255 / .2), rgb(0 0 0 / .3));
  }
  .modal .scrim { cursor: default; }

  .pop {
    position: absolute;
    top: 74px;
    inset-inline: 0;
    margin: 0 auto;
    inline-size: 86%;
    box-sizing: border-box;
    min-block-size: 156px;
    max-block-size: calc(100vh - 156px);
    overflow: hidden auto;
    overscroll-behavior: contain;
    padding: 10px;
    border: 1px solid var(--n55-line, rgb(0 0 0 / .12));
    border-radius: 20px;
    box-shadow: 0 0 4px rgb(100 100 100 / .4);
    background: var(--n55-surface, #fff);
    color: var(--n55-surface-ink, #1a1a1a);
    outline: none;
    opacity: 0;
    transition: top .68s, border-radius .68s, opacity .3s, transform .35s cubic-bezier(0, 0, .2, 1);
  }
  :host([open]) .pop { top: 60px; border-radius: 8px; opacity: 1; }

  .size-xsmall .pop { inline-size: 66%; }
  .size-small  .pop { inline-size: 76%; }
  .size-large  .pop { inline-size: 96%; }
  @media (min-width: 62em) {
    .size-xsmall .pop { inline-size: 32%; }
    .size-small  .pop { inline-size: 44%; }
    .size-medium .pop { inline-size: 66%; }
    .size-large  .pop { inline-size: 88%; }
  }

  .fullscreen .pop { block-size: calc(100vh - 56px); max-block-size: calc(100vh - 56px); }
  :host([open]) .fullscreen .pop { top: 16px; }

  /* A drawer from the right, as the original's slide-right transition. */
  .slide-right .pop,
  :host([open]) .slide-right .pop {
    top: 0;
    inset-inline: auto 0;
    block-size: 100vh;
    max-block-size: 100vh;
    border-radius: 0;
    opacity: 1;
  }
  .slide-right .pop { transform: translateX(100%); }
  :host([open]) .slide-right .pop { transform: none; }

  .pop.shake { animation: n55-sodapop-shake .2s 4; }
  @keyframes n55-sodapop-shake {
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

  .close {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    inline-size: 44px;
    block-size: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--n55-surface-ink, #1a1a1a);
    cursor: pointer;
    transition: transform .4s ease-in-out, background-color .2s, color .2s;
  }
  .close:hover { transform: rotate(90deg); }
  .close:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .close svg { inline-size: 32px; block-size: 32px; }
  .modal .close { display: none; }

  ${Object.keys(THEMES).map((name) => `
  :host([${THEME_ATTR}="${name}"]) .close {
    background: var(--n55-${name}-legible);
    color: var(--n55-${name}-legible-ink);
  }`).join('')}

  .still .scrim, .still .pop, .still .close { transition: none; }
  .still .pop.shake { animation: none; }
  @media (prefers-reduced-motion: reduce) {
    :host, .scrim, .pop, .close { transition: none; }
    .pop.shake { animation: none; }
  }
  @media print { .close { display: none; } }
`;

// The original's own X, a circled cross. Drawn, so no emoji and no icon font.
const X = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">' +
  '<path d="M14.59 8 12 10.59 9.41 8 8 9.41 10.59 12 8 14.59 9.41 16 12 13.41 14.59 16 16 14.59 ' +
  '13.41 12 16 9.41zM12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 ' +
  '0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>';

export class NeodigmSodaPop extends HTMLElement {
  #id = null;
  #popup = readPopup(null);
  #returnFocus = null;
  #fullscreen = false;
  #clearTimer = 0;
  #delegated = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this.shadowRoot.firstChild) {
      this.shadowRoot.innerHTML =
        `<style>${STYLES}</style>` +
        `<div class="frame size-medium">` +
        `<div class="scrim" part="scrim"></div>` +
        `<section class="pop" part="popup" role="dialog" aria-modal="true" tabindex="-1">` +
        `<slot></slot></section>` +
        `<button class="close" part="close" type="button" aria-label="Close">${X}</button>` +
        `</div>`;
      this.shadowRoot.addEventListener('click', this.#onInside);
      this.shadowRoot.querySelector('.pop').addEventListener('animationend', (ev) => {
        if (ev.animationName === 'n55-sodapop-shake') ev.currentTarget.classList.remove('shake');
      });
    }
    this.#listen(true);
  }

  disconnectedCallback() {
    this.#listen(false);
    clearTimeout(this.#clearTimer);
  }

  #listen(on) {
    const doc = this.ownerDocument;
    if (!doc || on === this.#delegated) return;
    const fn = on ? 'addEventListener' : 'removeEventListener';
    doc[fn]('click', this.#onTrigger);
    doc[fn]('keydown', this.#onKey);
    this.#delegated = on;
  }

  /** Whether a popup is showing. */
  get open() { return this.hasAttribute('open'); }

  /** The id of the template showing, or null. */
  get current() { return this.#id; }

  /** Whether the popup showing is modal. */
  get modal() { return this.open && this.#popup.modal; }

  /**
   * Opens the popup whose template has this id. Replaces the original's
   * `open` and `autoOpen`, and opens at once.
   *
   * Dispatches a cancelable `neodigm-sodapop-open` first and
   * `neodigm-sodapop-opened` after. A popup already showing is closed first,
   * with the reason `'replace'`, and can veto that too.
   *
   * @param {string} id
   * @returns {this} for `show(id).shake()`; check `current` to see if it opened.
   */
  show(id) {
    const doc = this.ownerDocument;
    const source = doc?.getElementById(id);
    if (!source || !this.isConnected) return this;
    const popup = readPopup(source);
    // Asked before the current popup closes, so a veto leaves it showing.
    if (!this.#announce('open', { id, popup })) return this;
    const replacing = this.open;
    if (replacing && !this.close('replace')) return this;

    clearTimeout(this.#clearTimer);
    this.replaceChildren(this.#cloneContent(source));
    this.#id = id;
    this.#popup = popup;
    this.#dress(popup);
    // A replacement keeps the focus the first popup will give back.
    if (!replacing) this.#returnFocus = doc.activeElement;
    this.setAttribute('open', '');
    this.shadowRoot.querySelector('.pop').focus({ preventScroll: true });
    if (popup.fullscreen) this.#enterFullscreen();
    this.#announce('opened', { id, popup }, false);
    return this;
  }

  /**
   * Closes the popup, modal or not — the only way a modal one closes.
   * Dispatches a cancelable `neodigm-sodapop-close` whose detail carries the
   * id and what asked: `'scrim'`, `'escape'`, `'close'` (the X), `'api'` or
   * `'replace'` (another popup opening).
   *
   * @param {'scrim'|'escape'|'close'|'api'|'replace'} [reason]
   * @returns {boolean} false if nothing was open or a listener vetoed it.
   */
  close(reason = 'api') {
    if (!this.open || !this.#announce('close', { id: this.#id, reason })) return false;
    this.removeAttribute('open');
    if (this.#fullscreen) this.#exitFullscreen();
    this.#id = null;
    if (reason === 'replace') return true;

    // Content leaves once the surface has, so nothing inside it — a marquee,
    // a video — keeps running behind a closed popup. show() cancels this.
    clearTimeout(this.#clearTimer);
    this.#clearTimer = setTimeout(() => this.replaceChildren(), motionAllowed() ? EXIT_MS : 0);
    this.#restoreFocus();
    return true;
  }

  /**
   * Shakes the popup showing, which is also what a modal one does when
   * someone tries to dismiss it. Nothing happens when motion is suppressed.
   * @returns {this}
   */
  shake() {
    const pop = this.shadowRoot?.querySelector('.pop');
    if (!this.open || !pop || !motionAllowed()) return this;
    pop.classList.remove('shake');
    void pop.offsetWidth;       // restart the animation if it is mid-shake
    pop.classList.add('shake');
    return this;
  }

  #announce(kind, detail, cancelable = true) {
    return this.dispatchEvent(new CustomEvent(`neodigm-sodapop-${kind}`, {
      bubbles: true, composed: true, cancelable, detail
    }));
  }

  /** A template's content, or an ordinary element's children, minus scripts. */
  #cloneContent(source) {
    const doc = this.ownerDocument;
    const fragment = doc.createDocumentFragment();
    const from = source.content ?? source;
    for (const node of from.childNodes) fragment.append(doc.importNode(node, true));
    for (const script of fragment.querySelectorAll('script')) script.remove();
    return fragment;
  }

  #dress(popup) {
    const frame = this.shadowRoot.querySelector('.frame');
    frame.className = `frame size-${popup.size}`;
    frame.classList.toggle('modal', popup.modal);
    frame.classList.toggle('fullscreen', popup.fullscreen);
    if (popup.transition) frame.classList.add(popup.transition);
    // The motion gate can be overridden from JavaScript, which the media
    // query in the stylesheet cannot see.
    frame.classList.toggle('still', !motionAllowed());
    // color-scheme on the frame reaches the slotted content too, since
    // inheritance follows the flattened tree.
    frame.style.colorScheme = popup.scheme;
  }

  #enterFullscreen() {
    const root = this.ownerDocument.documentElement;
    // The browser refuses without a user gesture, which is why the original
    // skipped it for a popup opened from the URL.
    if (globalThis.navigator?.userActivation?.isActive === false) return;
    const request = root.requestFullscreen?.();
    if (!request) return;
    this.#fullscreen = true;
    request.catch(() => { this.#fullscreen = false; });
  }

  #exitFullscreen() {
    this.#fullscreen = false;
    const doc = this.ownerDocument;
    if (doc.fullscreenElement) doc.exitFullscreen?.()?.catch?.(() => {});
  }

  #restoreFocus() {
    const doc = this.ownerDocument;
    const back = this.#returnFocus;
    this.#returnFocus = null;
    // Only if focus is still ours to give back.
    const ours = doc.activeElement === this || this.contains(doc.activeElement) ||
      doc.activeElement === doc.body;
    if (back?.isConnected && ours) back.focus({ preventScroll: true });
  }

  /** Dismissal that a modal popup answers with a shake. */
  #dismiss(reason) {
    if (this.#popup.modal) this.shake();
    else this.close(reason);
  }

  #onInside = (ev) => {
    const target = /** @type {Element} */ (ev.target);
    if (target.closest?.('.close')) this.close('close');
    else if (target.classList?.contains('scrim')) this.#dismiss('scrim');
  };

  #onKey = (ev) => {
    if (ev.key !== 'Escape' || !this.open || ev.defaultPrevented) return;
    ev.preventDefault();
    this.#dismiss('escape');
  };

  #onTrigger = (ev) => {
    const trigger = ev.target?.closest?.('[data-n55-sodapop-id]');
    if (!trigger) return;
    // The nearest theme decides, as in the original: a disabled trigger, or
    // one inside a disabled region, does not open anything.
    if (trigger.closest(`[${THEME_ATTR}]`)?.getAttribute(THEME_ATTR) === OPT_OUT) return;
    ev.preventDefault();
    this.show(trigger.getAttribute('data-n55-sodapop-id'));
  };
}

if (!customElements.get('neodigm-sodapop')) {
  customElements.define('neodigm-sodapop', NeodigmSodaPop);
}
