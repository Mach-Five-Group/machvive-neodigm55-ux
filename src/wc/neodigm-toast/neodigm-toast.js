/**
 * `<neodigm-toast>` — a queued, themed notification from the bottom of the screen.
 *
 * Ported from the original `neodigmToast` IIFE, which was a page singleton that
 * required `<div id="js-snackbar__id">` to already exist in the markup, wrote
 * through global `.snackbar__cont--*` classes, and reached into four other
 * subsystems for timing, sound, haptics and analytics. Here the element *is*
 * the surface: it renders its own markup into a shadow root, owns its queue,
 * and treats every one of those integrations as opt-in.
 *
 * It participates in page choreography the same way anything else does — by
 * carrying `data-n55-theme` on its host — so a `robinTheme()` sweep colours the
 * toast along with every button on the page. Its internals follow through
 * `:host([data-n55-theme=…])`, because a sweep cannot reach inside a shadow root.
 *
 * ```html
 * <neodigm-toast data-n55-theme="brand"></neodigm-toast>
 * <button data-n55-toast="Saved ✨" data-n55-theme="success">Save</button>
 * ```
 * ```js
 * document.querySelector('neodigm-toast').show('Saved ✨', { theme: 'success' });
 * ```
 */
import { THEMES, THEME_ATTR, OPT_OUT } from '../../conductor/theme.js';
import { motionAllowed } from '../../conductor/motion.js';
import { flashTitle } from '../../conductor/choreography.js';

/** The original's default, kept so an existing page's timing does not shift. */
export const DEFAULT_DURATION = 5200;

/** Gap between one toast closing and the next opening. The original used 1200. */
const GAP = 1200;

const STYLES = `
  :host {
    /* Fixed, centred, above almost everything. The original measured
       body.clientWidth and set a pixel left offset on every open; a translate
       does the same job without reading layout, which also means it stays
       centred when the window resizes mid-toast. */
    position: fixed;
    inset-block-end: 24px;
    inset-inline-start: 50%;
    transform: translateX(-50%) translateY(16px);
    z-index: 2147483000;

    display: block;
    opacity: 0;
    visibility: hidden;
    transition: opacity .32s ease, transform .32s ease;

    max-width: min(92vw, 560px);
    box-sizing: border-box;
    /* Clips the progress bar to the rounded corners. */
    overflow: hidden;
    padding: 18px;
    border-radius: 8px;
    /* The original's type, white on every theme but the two light ones below.
       A faint shadow keeps it legible at the light end of the gradient. */
    font: 18px/1.4 'Helvetica', 'Helvetica Neue', sans-serif;
    text-shadow: 0 1px 2px rgb(0 0 0 / .35);
    text-align: center;
    user-select: none;
    -webkit-user-select: none;
    box-shadow: 0 6px 24px rgb(0 0 0 / .28);

    /* The unthemed default, for a page that imported the toast but never called
       installTheme(). The fallback is deliberately NOT a palette value: copying
       night-deep here would mean the two drift apart the first time anyone edits
       the palette, and nothing would fail. Both sides are declared so the toast
       never inherits a page colour it cannot guarantee contrast against. */
    background: linear-gradient(45deg, var(--n55-night, #2b2b2b), var(--n55-night-deep, #2b2b2b));
    color: #fff;
  }

  :host([open]) {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
    animation: n55-toast-in .5s ease-in-out;
  }

  /* From the original's toast_bottom: rise from below the fold, overshoot,
     settle back. Entry only — leaving is the plain transition above. */
  @keyframes n55-toast-in {
    0%   { transform: translateX(-50%) translateY(136px); }
    80%  { transform: translateX(-50%) translateY(-6px); }
    100% { transform: translateX(-50%) translateY(0); }
  }

  /* Time remaining, filling left to right across the top over the toast's own
     duration, which #next() writes onto it. The original fixed this at 5.2s
     whatever the toast's duration. Like the original it runs dark to light,
     the reverse of the background; each theme's colours are set below. */
  .bar {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    block-size: 3px;
    inline-size: 0;
    background: linear-gradient(90deg, var(--n55-night-deep, #2b2b2b), var(--n55-night, #2b2b2b));
    animation: n55-toast-bar linear forwards;
  }
  @keyframes n55-toast-bar { to { inline-size: 100%; } }

  /* A visitor who asked for less motion still gets the toast — it carries
     information — but it appears rather than slides. */
  @media (prefers-reduced-motion: reduce) {
    :host { transition: opacity .01s linear; transform: translateX(-50%); }
    :host([open]) { transform: translateX(-50%); animation: none; }
    .bar { display: none; }
  }

  :host([hidden]) { display: none; }

  /* Theme comes from the host attribute, which is what a page-wide sweep sets.
     Generated rather than hand-written so a theme cannot be added to the palette
     and silently missed here. */
  ${Object.keys(THEMES).map((name) => `
  :host([${THEME_ATTR}="${name}"]) {
    background: linear-gradient(45deg, var(--n55-${name}), var(--n55-${name}-deep));
  }
  :host([${THEME_ATTR}="${name}"]) .bar {
    background: linear-gradient(90deg, var(--n55-${name}-deep), var(--n55-${name}));
  }`).join('')}

  /* white and ghost start from pure white, where white text would vanish. The
     original never styled a toast for either; dark ink is the readable choice. */
  :host([${THEME_ATTR}="white"]),
  :host([${THEME_ATTR}="ghost"]) { color: #1a1a1a; text-shadow: none; }
  /* white's two colours are both white, so its bar would vanish too. */
  :host([${THEME_ATTR}="white"]) .bar { background: currentColor; }

  .msg { margin: 0; }
  .msg b { font-weight: 600; }
`;

/** Installed once, however many toasts are on the page. */
let delegatedListener = null;

/**
 * Wires the declarative trigger: any element carrying `data-n55-toast` shows
 * its value when clicked.
 *
 * The original routed this through NeodigmKeylime, a separate subscribe-based
 * multiplexer over thirteen event types. One delegated listener does the job
 * for this component, and `composed` events mean it still fires for a click
 * that originated inside someone else's shadow root.
 */
function installDelegate(doc) {
  if (delegatedListener || !doc) return;
  delegatedListener = (ev) => {
    const trigger = ev.composedPath?.().find?.(
      (n) => n?.nodeType === 1 && n.hasAttribute?.('data-n55-toast')
    ) ?? ev.target?.closest?.('[data-n55-toast]');
    if (!trigger) return;

    const message = trigger.getAttribute('data-n55-toast');
    const theme = trigger.getAttribute(THEME_ATTR);
    if (!message || theme === OPT_OUT) return;

    const toast = doc.querySelector('neodigm-toast');
    toast?.show(message, theme ? { theme } : {});
  };
  doc.addEventListener('click', delegatedListener);
}

export class NeodigmToast extends HTMLElement {
  /** @type {{ message: string, theme: string|null, duration: number }[]} */
  #queue = [];
  #paused = false;
  #timer = null;
  #showing = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this.shadowRoot.firstChild) {
      this.shadowRoot.innerHTML = `<style>${STYLES}</style><p class="msg" part="message"></p>`;
    }
    // Announced politely rather than assertively: a toast is incidental, and
    // `alert` would interrupt whatever a screen-reader user was reading.
    if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    if (!this.hasAttribute('aria-live')) this.setAttribute('aria-live', 'polite');
    installDelegate(this.ownerDocument);
  }

  disconnectedCallback() {
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  /**
   * Queues a message.
   *
   * @param {string} message Use `|` for a line break.
   * @param {{ theme?: string, duration?: number, flashTab?: boolean }} [options]
   * @returns {this}
   */
  show(message, { theme = null, duration = DEFAULT_DURATION, flashTab = false } = {}) {
    if (this.#paused || typeof message !== 'string' || message.length === 0) return this;

    // Temporal debounce, from the original: the same message twice in a row is
    // the same notification, usually a double-fired handler.
    const last = this.#queue.at(-1);
    if (last?.message === message) return this;

    this.#queue.push({ message, theme, duration });
    if (flashTab && theme) flashTitle(theme);
    if (!this.#showing) this.#next();
    return this;
  }

  /** Messages still waiting, including the one on screen. */
  get queue() { return this.#queue.map((q) => ({ ...q })); }

  /** Empties the queue. The message on screen finishes its own duration. */
  clear() { this.#queue = this.#queue.slice(0, this.#showing ? 1 : 0); return this; }

  /** Stops accepting messages. */
  pause() { this.#paused = true; return this; }

  /** Accepts messages again. */
  play() { this.#paused = false; return this; }

  /** Whether a message is currently on screen. */
  get open() { return this.hasAttribute('open'); }

  #next() {
    const entry = this.#queue[0];
    if (!entry) { this.#showing = false; return; }
    this.#showing = true;

    this.#render(entry.message);
    this.#progress(entry.duration);
    if (entry.theme) this.setAttribute(THEME_ATTR, entry.theme);
    this.setAttribute('open', '');
    this.dispatchEvent(new CustomEvent('neodigm-toast-show', {
      bubbles: true, composed: true, detail: { ...entry }
    }));

    this.#timer = setTimeout(() => this.#close(), entry.duration);
  }

  #close() {
    const entry = this.#queue.shift();
    this.removeAttribute('open');
    this.dispatchEvent(new CustomEvent('neodigm-toast-hide', {
      bubbles: true, composed: true, detail: { ...entry }
    }));
    // Wait out the exit transition before the next one, unless motion is off —
    // then there is no transition to wait for.
    const gap = motionAllowed() ? GAP : 0;
    this.#timer = setTimeout(() => this.#next(), gap);
  }

  /**
   * Replaces the progress bar with a fresh one, which is what restarts its CSS
   * animation for each queued message. Left out entirely when motion is off: a
   * moving bar is motion, and the toast still closes on time without it.
   */
  #progress(duration) {
    this.shadowRoot.querySelector('.bar')?.remove();
    if (!motionAllowed()) return;
    const bar = this.ownerDocument.createElement('span');
    bar.className = 'bar';
    bar.setAttribute('part', 'progress');
    bar.style.animationDuration = `${duration}ms`;
    this.shadowRoot.append(bar);
  }

  /**
   * Writes the message.
   *
   * The original did `innerHTML = msg.replace("|", "<br>")`, which made every
   * toast an HTML injection point — and toast text is routinely built from user
   * input or a server error. Here the message is split and written as text
   * nodes with real `<br>` elements between, so `|` still breaks the line and
   * markup in the message stays inert.
   */
  #render(message) {
    const target = this.shadowRoot.querySelector('.msg');
    if (!target) return;
    target.replaceChildren();
    const parts = message.replace(/##/g, '').split('|');
    parts.forEach((part, index) => {
      if (index > 0) target.append(this.ownerDocument.createElement('br'));
      target.append(this.ownerDocument.createTextNode(part));
    });
  }
}

if (!customElements.get('neodigm-toast')) {
  customElements.define('neodigm-toast', NeodigmToast);
}
