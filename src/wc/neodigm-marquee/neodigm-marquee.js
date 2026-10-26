/**
 * `<neodigm-marquee>` — scrolling text that rotates character by character.
 *
 * The retro step-scroll is the point, not a limitation: the text advances one
 * character per tick rather than sliding on a transform, which is the look the
 * original library was after.
 *
 * Three things changed in the port, each of which the original could not do
 * because it drove light DOM it did not own:
 *
 * **The source text survives.** The original rotated the string and wrote the
 * result back over `data-n55-marquee-text` every frame, so after one tick the
 * attribute no longer held the message — and Tulip, which sets that attribute,
 * could never read back what it had set. Here the text is kept and only the
 * rendered view rotates.
 *
 * **Colour is spans, not invisible Unicode.** The original delimited coloured
 * runs with zero-width and bidi control characters — U+202A LEFT-TO-RIGHT
 * EMBEDDING, U+2028 LINE SEPARATOR and a dozen more — and painted them
 * through the CSS Custom Highlight API. That meant no colour at all on a browser without the API,
 * invisible control characters riding along on every copy-paste, real bidi
 * reordering risk in mixed-direction text, and one run per colour because it
 * matched with `indexOf`. Owning a shadow root makes all of that unnecessary.
 *
 * **It stops for reduced motion**, showing the text at rest instead.
 *
 * ```html
 * <neodigm-marquee text="Ready when you are"></neodigm-marquee>
 * <neodigm-marquee text="Shipping [brand]free[/brand] this week"></neodigm-marquee>
 * <neodigm-marquee>Rich <span data-n55-theme="danger">markup</span> works too</neodigm-marquee>
 * ```
 */
import { THEMES, THEME_ATTR } from '../../conductor/theme.js';
import { motionAllowed, onMotionChange } from '../../conductor/motion.js';

/** ms between steps. The original drove this from a shared metronome at ~132ms. */
export const DEFAULT_SPEED = 132;

/** `[brand]…[/brand]` — readable in an attribute, and nothing invisible. */
const RUN = /\[([a-z]+)\]([\s\S]*?)\[\/\1\]/g;

const STYLES = `
  :host {
    display: block;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: pre;
    color: var(--n55-night-deep, #2b2b2b);
  }
  :host([hidden]) { display: none; }

  /* The host theme colours the whole marquee; per-run themes win inside it. */
  ${Object.keys(THEMES).map((name) => `
  :host([${THEME_ATTR}="${name}"]) { color: var(--n55-${name}-deep); }`).join('')}

  .view { display: block; margin: 0; font: inherit; }

  /* One rule per theme, so a coloured run needs no inline style. */
  ${Object.keys(THEMES).map((name) => `
  .view [data-run="${name}"] { color: var(--n55-${name}); font-weight: 600; }`).join('')}
`;

/**
 * Parses `[theme]text[/theme]` into per-character themes.
 *
 * Returns one entry per character so rotation stays trivial: the array is the
 * model, and a run is just neighbouring characters that share a theme. That is
 * also what lets a colour appear more than once, which the original's
 * first-match `indexOf` could not do.
 *
 * @param {string} source
 * @returns {{ char: string, theme: string|null }[]}
 */
export function parseRuns(source) {
  const cells = [];
  let at = 0;
  for (const match of source.matchAll(RUN)) {
    for (const char of source.slice(at, match.index)) cells.push({ char, theme: null });
    const theme = THEMES[match[1]] ? match[1] : null;
    for (const char of match[2]) cells.push({ char, theme });
    at = match.index + match[0].length;
  }
  for (const char of source.slice(at)) cells.push({ char, theme: null });
  return cells;
}

/** The text with its markup removed, for assistive technology and `.text`. */
export const plainText = (source) => source.replace(RUN, '$2');

export class NeodigmMarquee extends HTMLElement {
  /** @type {{ char: string, theme: string|null }[]} */
  #cells = [];
  #offset = 0;
  #timer = null;
  #paused = false;
  #unwatchMotion = null;

  static get observedAttributes() {
    return ['text', 'data-n55-marquee-text', 'direction', 'speed', 'paused'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this.shadowRoot.firstChild) {
      this.shadowRoot.innerHTML =
        `<style>${STYLES}</style><span class="view" part="view" aria-hidden="true"></span>`;
    }
    // The visible text changes every tick, which is unreadable to a screen
    // reader. The animated copy is hidden from the accessibility tree and the
    // host carries the settled text instead.
    this.#load();

    // Hovering reverses, holding pauses — both from the original.
    if (this.getAttribute('direction') !== 'false') {
      this.addEventListener('mouseenter', this.#reverse);
      this.addEventListener('mouseleave', this.#reverse);
    }
    this.addEventListener('mousedown', this.#hold);
    this.addEventListener('mouseup', this.#release);

    this.#unwatchMotion = onMotionChange(() => this.#schedule());
    this.#schedule();
  }

  disconnectedCallback() {
    clearInterval(this.#timer);
    this.#timer = null;
    this.removeEventListener('mouseenter', this.#reverse);
    this.removeEventListener('mouseleave', this.#reverse);
    this.removeEventListener('mousedown', this.#hold);
    this.removeEventListener('mouseup', this.#release);
    this.#unwatchMotion?.();
    this.#unwatchMotion = null;
  }

  attributeChangedCallback(name) {
    if (!this.isConnected) return;
    if (name === 'speed' || name === 'paused') { this.#schedule(); return; }
    if (name === 'direction') return;
    this.#load();
    this.#schedule();
  }

  /** The message, with any `[theme]` markup stripped. */
  get text() { return plainText(this.#source); }

  /** Sets the message. Markup is accepted and parsed. */
  set text(value) { this.setAttribute('text', String(value ?? '')); }

  /** Whether the marquee is currently stepping. */
  get running() { return this.#timer !== null; }

  /** Stops stepping. The text stays where it is. */
  pause() { this.#paused = true; this.#schedule(); return this; }

  /** Resumes stepping. */
  play() { this.#paused = false; this.#schedule(); return this; }

  /** Advances one character, whether or not it is running. */
  step(by = 1) {
    if (this.#cells.length === 0) return this;
    const n = this.#cells.length;
    this.#offset = (((this.#offset + by) % n) + n) % n;
    this.#paint();
    return this;
  }

  get #source() {
    // `text` wins, but the original's data attribute is still read because it
    // is what Tulip writes and what existing markup uses.
    return this.getAttribute('text')
      ?? this.getAttribute('data-n55-marquee-text')
      ?? this.textContent
      ?? '';
  }

  get #stepSize() { return this.getAttribute('direction') === 'rtl' ? -1 : 1; }

  #load() {
    this.#cells = parseRuns(this.#source);
    this.#offset = 0;
    // The settled text, for assistive technology. Set on the host rather than
    // in the shadow root so it is what a screen reader announces.
    const settled = plainText(this.#source);
    if (settled) this.setAttribute('aria-label', settled);
    if (!this.hasAttribute('role')) this.setAttribute('role', 'marquee');
    this.#paint();
  }

  #schedule() {
    clearInterval(this.#timer);
    this.#timer = null;
    // A disconnected element must never hold a timer. Reachable because the
    // motion subscription can fire between disconnect and unsubscribe, and a
    // stray interval keeps the whole process alive — which is how this first
    // showed up: the test run stopped terminating.
    if (!this.isConnected) return;
    const stopped = this.#paused
      || this.hasAttribute('paused')
      || !motionAllowed()
      || this.#cells.length === 0;
    if (stopped) { this.#paint(); return; }

    const speed = Number(this.getAttribute('speed')) || DEFAULT_SPEED;
    this.#timer = setInterval(() => this.step(this.#stepSize), Math.max(16, speed));
  }

  #reverse = () => {
    this.setAttribute('direction', this.getAttribute('direction') === 'rtl' ? 'ltr' : 'rtl');
  };
  #hold = () => { this.#paused = true; this.#schedule(); };
  #release = () => { this.#paused = false; this.#schedule(); };

  /**
   * Renders the rotated view, grouping neighbouring characters that share a
   * theme into one span. Text nodes and spans only — never innerHTML, since the
   * message routinely comes from a page's own data.
   */
  #paint() {
    const view = this.shadowRoot?.querySelector('.view');
    if (!view) return;
    view.replaceChildren();
    if (this.#cells.length === 0) return;

    const rotated = [...this.#cells.slice(this.#offset), ...this.#cells.slice(0, this.#offset)];
    let run = null;
    for (const cell of rotated) {
      if (!run || run.theme !== cell.theme) {
        run = { theme: cell.theme, chars: [] };
        const node = cell.theme
          ? Object.assign(this.ownerDocument.createElement('span'), {})
          : null;
        if (node) node.setAttribute('data-run', cell.theme);
        run.node = node;
        view.append(node ?? this.ownerDocument.createTextNode(''));
        run.target = node ?? view.lastChild;
      }
      run.chars.push(cell.char);
      const text = run.chars.join('');
      if (run.node) run.node.textContent = text;
      else run.target.textContent = text;
    }
  }
}

if (!customElements.get('neodigm-marquee')) {
  customElements.define('neodigm-marquee', NeodigmMarquee);
}
