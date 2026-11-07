/**
 * `<neodigm-icon>` — an icon drawn from CSS, with no icon font.
 *
 * ```html
 * <neodigm-icon name="search"></neodigm-icon>
 * <neodigm-icon class="material-symbols-outlined">dark_mode</neodigm-icon>
 * <neodigm-icon name="send" label="Send"></neodigm-icon>
 * ```
 *
 * The original put Material Symbols ligature text inside `<neodigm-icon>` and
 * relied on Google's icon font to turn it into a picture. That text is still
 * read as the name, in either spelling, so existing markup works once the font
 * is gone. `name` wins when both are present.
 *
 * The shape is a mask over `currentColor`, so an icon takes the colour of
 * whatever it sits in — an ActIcon's ink, a link, a dark surface. With a theme
 * of its own it takes that colour, and a sweep moves across it.
 *
 * The set is `--n55-icon-<name>` custom properties. The built-in shape is only
 * the fallback, so a page restyles an icon, or adds one, with CSS:
 *
 * ```css
 * :root { --n55-icon-rocket: url("data:image/svg+xml,…"); }
 * ```
 *
 * A name that is neither built in nor defined draws nothing, and logs one
 * warning per page. Decorative unless `label` is given, in which case it is an
 * image with that name.
 */
import { THEMES, THEME_ATTR, paletteReaches } from '../../conductor/theme.js';
import { ICONS, iconName } from '../../conductor/icons.js';

/** A mask that hides everything: what an unknown name draws. */
const BLANK = 'linear-gradient(transparent, transparent)';

let warned = false;
/** Lets the next unknown name warn again. For tests. */
export function resetIconWarning() { warned = false; }

const STYLES = `
  :host {
    display: inline-block;
    inline-size: var(--n55-icon-size, 24px);
    block-size: var(--n55-icon-size, 24px);
    vertical-align: middle;
    flex: none;
  }
  :host([hidden]) { display: none; }

  .glyph {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    background-color: currentColor;
    -webkit-mask-image: var(--n55-glyph);
    mask-image: var(--n55-glyph);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
  }

  ${Object.keys(THEMES).map((name) => `
  :host([${THEME_ATTR}="${name}"]) { color: var(--n55-${name}); }`).join('')}
`;

export class NeodigmIcon extends HTMLElement {
  static get observedAttributes() { return ['name', 'label']; }

  #observer = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this.shadowRoot.firstChild) {
      this.shadowRoot.innerHTML =
        `<style>${STYLES}</style><span class="glyph" part="glyph"></span>`;
    }
    // Ligature text can change after connecting: a dark_mode/light_mode toggle.
    this.#observer ??= new MutationObserver(() => this.#render());
    this.#observer.observe(this, { childList: true, characterData: true, subtree: true });
    this.#render();
    this.#label();
    setTimeout(() => {
      if (!this.isConnected) return;
      paletteReaches(this);
      this.#check();
    });
  }

  disconnectedCallback() { this.#observer?.disconnect(); }

  attributeChangedCallback(attr) {
    if (!this.shadowRoot.firstChild) return;
    if (attr === 'name') this.#render();
    else this.#label();
  }

  /** The icon's name as the set spells it, from `name` or the text inside. */
  get name() { return iconName(this.getAttribute('name') ?? this.textContent); }
  set name(value) { this.setAttribute('name', String(value)); }

  #render() {
    const name = this.name;
    const glyph = this.shadowRoot.querySelector('.glyph');
    glyph?.style.setProperty('--n55-glyph',
      name ? `var(--n55-icon-${name}, ${ICONS[name] ?? BLANK})` : BLANK);
  }

  #label() {
    const label = this.getAttribute('label');
    if (label) {
      this.setAttribute('role', 'img');
      this.setAttribute('aria-label', label);
      this.removeAttribute('aria-hidden');
    } else {
      this.removeAttribute('role');
      this.removeAttribute('aria-label');
      this.setAttribute('aria-hidden', 'true');
    }
  }

  /** Warns, once per page, about a name that draws nothing. */
  #check() {
    const name = this.name;
    if (!name || ICONS[name] || warned) return;
    const defined = globalThis.getComputedStyle?.(this).getPropertyValue(`--n55-icon-${name}`).trim();
    if (defined) return;
    warned = true;
    console.warn(`Neodigm 55: <neodigm-icon> "${name}" is not in the icon set, so it draws nothing. ` +
      `Define --n55-icon-${name} in your CSS, or use one of ICON_NAMES.`);
  }
}

if (!customElements.get('neodigm-icon')) {
  customElements.define('neodigm-icon', NeodigmIcon);
}
