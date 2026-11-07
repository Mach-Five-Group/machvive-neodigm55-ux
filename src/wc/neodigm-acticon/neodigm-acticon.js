/**
 * `<neodigm-acticon>` — a round, themed icon button.
 *
 * ```html
 * <neodigm-acticon data-n55-theme="brand" data-n55-size="small" icon="search"
 *   label="Search" data-n55-poptart-click="js-search"></neodigm-acticon>
 *
 * <!-- the original's markup, unchanged -->
 * <neodigm-acticon data-n55-theme="brand" data-n55-size="xsmall" data-n55-tulip="Search">
 *   <neodigm-icon class="material-symbols-outlined">search</neodigm-icon>
 * </neodigm-acticon>
 * ```
 *
 * The original was CSS only: a circle around a Material Symbols glyph, with
 * the Tulip, Poptart and sound triggers doing the work. Those triggers still
 * work on it as before. What changed:
 *
 * - **No icon font.** The glyph is `<neodigm-icon>`, drawn from CSS. `icon`
 *   names one without writing the child element.
 * - **It is a button to assistive technology and the keyboard.** The original
 *   could be clicked and nothing else: no role, no focus, no name. Enter and
 *   Space click it, and it is named by `label`, else by its icon.
 * - **The glyph is the theme's ink.** The original drew every glyph white, which
 *   vanished on `white`, `warning` and `secondary`. Ink on the theme colour
 *   clears the 3:1 that WCAG asks of a graphic on every theme (lowest: marcom,
 *   4.30), so the light shade is kept rather than `-legible`'s deep one.
 * - **Light and dark come from `color-scheme`**, not `data-n55-ampm-theme`.
 *   Unthemed and `ghost` take the surface's ink.
 * - **`white` has a style.** The original had no rule for it.
 *
 * `disabled` greys it out, takes it out of the tab order and marks it
 * `aria-disabled`; triggers already refuse a disabled element.
 */
import { THEMES, THEME_ATTR, OPT_OUT, paletteReaches } from '../../conductor/theme.js';
import { iconName } from '../../conductor/icons.js';
import '../neodigm-icon/neodigm-icon.js';

/** The original's sizes: the circle, and the glyph inside it, in px. */
export const ACTICON_SIZES = Object.freeze({
  pico:   [14, 13],
  micro:  [18, 17],
  milli:  [24, 23],
  xsmall: [24, 23],
  small:  [29, 28],
  medium: [35, 34],
  large:  [42, 41],
  xlarge: [50, 49]
});

const INK = 'var(--n55-surface-ink, #1a1a1a)';

const STYLES = `
  :host {
    position: relative;
    display: inline-grid;
    place-items: center;
    vertical-align: middle;
    box-sizing: content-box;
    inline-size: 24px;
    block-size: 24px;
    --n55-icon-size: 23px;
    margin: 6px;
    padding: 6px;
    border: 1px solid currentColor;
    border-radius: 100%;
    background: transparent;
    color: ${INK};
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: background-color .4s ease-in-out, border-color .4s ease-in-out,
      color .4s ease-in-out, filter .4s ease-in-out;
  }
  :host([hidden]) { display: none; }
  :host(:focus-visible) { outline: 2px solid ${INK}; outline-offset: 2px; }

  ${Object.entries(ACTICON_SIZES).map(([size, [box, glyph]]) => `
  :host([data-n55-size="${size}"]) { inline-size: ${box}px; block-size: ${box}px; --n55-icon-size: ${glyph}px; }`).join('')}

  ${Object.keys(THEMES).map((name) => `
  :host([${THEME_ATTR}="${name}"]) {
    background: var(--n55-${name});
    border-color: var(--n55-${name});
    color: var(--n55-${name}-ink);
  }`).join('')}

  /* After the generated rules, so these win. */
  :host([${THEME_ATTR}="ghost"]) {
    background: transparent;
    border-color: var(--n55-disabled);
    color: ${INK};
  }
  :host([${THEME_ATTR}="ghost"]:hover) {
    background: color-mix(in srgb, currentColor 14%, transparent);
    border-color: currentColor;
  }
  /* A white circle needs an edge to be seen on a light page. */
  :host([${THEME_ATTR}="white"]) { border-color: var(--n55-line, currentColor); }
  :host(:hover:not([${THEME_ATTR}="${OPT_OUT}"]):not([${THEME_ATTR}="ghost"])) { filter: brightness(124%); }
  :host([${THEME_ATTR}="${OPT_OUT}"]) { cursor: default; }

  @media (prefers-reduced-motion: reduce) { :host { transition: none; } }
`;

/** `chevron-right` → `chevron right`, for a name when nothing better exists. */
const spoken = (name) => name.replace(/-/g, ' ');

export class NeodigmActIcon extends HTMLElement {
  static get observedAttributes() { return [THEME_ATTR, 'icon', 'label']; }

  /** Whether this element, not the page, set the tabindex and aria-label. */
  #ownTab = false;
  #ownLabel = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this.shadowRoot.firstChild) {
      // The fallback shows only when there are no children.
      this.shadowRoot.innerHTML =
        `<style>${STYLES}</style><slot><neodigm-icon part="icon"></neodigm-icon></slot>`;
      this.addEventListener('keydown', this.#onKeyDown);
      this.addEventListener('keyup', this.#onKeyUp);
    }
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
    this.#sync();
    setTimeout(() => {
      if (!this.isConnected) return;
      paletteReaches(this);
      this.#name();     // children parsed after connecting have arrived
    });
  }

  attributeChangedCallback() {
    if (this.shadowRoot.firstChild) this.#sync();
  }

  /** Whether it is themed `disabled`. */
  get disabled() { return this.getAttribute(THEME_ATTR) === OPT_OUT; }

  #sync() {
    this.shadowRoot.querySelector('neodigm-icon')
      ?.setAttribute('name', this.getAttribute('icon') ?? '');
    const disabled = this.disabled;
    if (!this.hasAttribute('tabindex') || this.#ownTab) {
      if (disabled) this.removeAttribute('tabindex');
      else this.setAttribute('tabindex', '0');
      this.#ownTab = true;
    }
    if (disabled) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
    this.#name();
  }

  /** `label`, else the page's own aria-label, else the icon's name. */
  #name() {
    const label = this.getAttribute('label');
    if (!label && this.hasAttribute('aria-label') && !this.#ownLabel) return;
    const child = this.querySelector('neodigm-icon');
    const icon = iconName(this.getAttribute('icon') ??
      child?.getAttribute('name') ?? child?.textContent ?? '');
    const name = label || (icon ? spoken(icon) : '');
    if (name) this.setAttribute('aria-label', name);
    else this.removeAttribute('aria-label');
    this.#ownLabel = true;
  }

  #onKeyDown = (ev) => {
    if (this.disabled || ev.target !== this) return;
    if (ev.key === 'Enter') { ev.preventDefault(); this.click(); }
    // Space clicks on release, as a native button does, and must not scroll.
    else if (ev.key === ' ') ev.preventDefault();
  };

  #onKeyUp = (ev) => {
    if (this.disabled || ev.target !== this || ev.key !== ' ') return;
    ev.preventDefault();
    this.click();
  };
}

if (!customElements.get('neodigm-acticon')) {
  customElements.define('neodigm-acticon', NeodigmActIcon);
}
