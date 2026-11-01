/**
 * `<neodigm-buffet>` — a full-width, two-level menu, driven by metadata.
 *
 * The top row splits the width of its container evenly between its buttons.
 * Below it sits the selected button's children, at half the height and in a
 * smaller type. Both levels keep a selection, and each top-level button
 * remembers which child was last chosen under it.
 *
 * ```html
 * <neodigm-buffet data-n55-theme="brand" data-n55-buffet='[
 *   {"token":"shows","caption":"Shows","selected":true,"secondary":[
 *     {"token":"live","caption":"Live"},{"token":"vod","caption":"VOD"}]},
 *   {"token":"people","caption":"People","count":3}
 * ]'></neodigm-buffet>
 * ```
 *
 * The metadata is the schema `m5t-primary-nav` already uses — `token`,
 * `caption`, `enabled`, `selected`, `icon`, `tagline`, `count`, children under
 * `secondary` — so existing navigation data drops straight in. `data-buttons`
 * is read as an alias for the same reason. What did not come across, and why:
 *
 * - **The logo, PubSub, the i18n listener and `admin_role`** belong to the app.
 *   An app that re-resolves its labels sets `items` again; selection survives
 *   wherever the tokens do.
 * - **Re-rendering on every click.** That one rebuilt its whole shadow root per
 *   selection, which dropped keyboard focus. Here the top row is built once per
 *   `items` and selection only moves attributes.
 * - **`innerHTML` with captions and taglines**, which made every label an
 *   injection point. Labels are text nodes and the tagline is a `title`.
 * - **A missing `enabled` meant disabled.** Only `enabled: false` disables.
 * - **`icon` is not rendered.** It held a Font Awesome class there, which
 *   cannot style anything inside a shadow root, and icon fonts are not
 *   wanted here at all. Icons are deferred; until then the field is accepted
 *   and ignored, so existing data neither breaks nor prints class names.
 *
 * **Theming.** The whole menu is one instrument: `data-n55-theme` on the host
 * colours the selection and the child row, so a `robinTheme()` sweep recolours
 * the menu as a unit. An item may carry a `theme` of its own as an accent; that
 * lives inside the shadow root, so a sweep passes it by — deliberately, it is
 * the item's identity rather than page state.
 */
import { THEMES, THEME_ATTR } from '../../conductor/theme.js';

/**
 * The four colours the menu is painted from, for one theme: two surfaces and
 * the palette's ink for each. Every theme sets all four, so an accent inside a
 * menu of another theme never inherits the wrong ink.
 */
const colours = (name) =>
  `--_fill: var(--n55-${name}); --_ink: var(--n55-${name}-ink); ` +
  `--_row: var(--n55-${name}-deep); --_row-ink: var(--n55-${name}-deep-ink);`;

const STYLES = `
  :host {
    /* Unthemed: the palette's inverse surface for the selection — dark on a
       light page, light on a dark one — and a dark child row in both. The
       literals are fallbacks for a page that never called installTheme(). */
    --_fill: var(--n55-inverse, #1a1a1a);
    --_ink: var(--n55-inverse-ink, #fff);
    --_row: #2b2b2b;
    --_row-ink: #fff;

    display: block;
    inline-size: 100%;
    box-sizing: border-box;
    font: 600 .875rem/1.2 system-ui, sans-serif;
    user-select: none;
    -webkit-user-select: none;
  }
  :host([hidden]) { display: none; }

  /* Theme comes from the host attribute, which is what a sweep sets. Generated
     from the palette so a new theme cannot be missed here. */
  ${Object.keys(THEMES).map((name) => `
  :host([${THEME_ATTR}="${name}"]) { ${colours(name)} }`).join('')}

  /* Per-item accents. Not data-n55-theme: that attribute is the page's
     contract, and putting it on a shadow-internal node implies a sweep can
     reach it, which it cannot. */
  ${Object.keys(THEMES).map((name) => `
  [data-accent="${name}"] { ${colours(name)} }`).join('')}

  .primary, .secondary {
    display: grid;
    grid-auto-flow: column;
    /* minmax(0, …) rather than 1fr, so a long caption truncates instead of
       widening its column: the width is the container's divided by the count. */
    grid-auto-columns: minmax(0, 1fr);
  }
  .primary {
    block-size: var(--n55-buffet-height, 64px);
    /* The page's surface, so the top row follows light and dark. */
    background: var(--n55-surface, #fff);
    border-block-end: 1px solid var(--n55-line, rgb(0 0 0 / .12));
  }
  .secondary {
    block-size: calc(var(--n55-buffet-height, 64px) / 2);
    background: var(--_row);
    color: var(--_row-ink);
    font-size: .8em;
    font-weight: 500;
  }

  .item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .4em;
    min-inline-size: 0;
    margin: 0;
    padding: 0 .75em;
    border: 0;
    border-inline-start: 1px solid var(--n55-line, rgb(0 0 0 / .12));
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background-color .2s ease, color .2s ease;
  }
  .item:first-child { border-inline-start: 0; }
  .primary .item { color: var(--n55-surface-ink, #1a1a1a); }
  .secondary .item { border-inline-start-color: rgb(255 255 255 / .14); }

  .primary .item:hover:not(:disabled):not([aria-current]) {
    background: color-mix(in srgb, var(--_fill) 14%, transparent);
  }
  .secondary .item:hover:not(:disabled):not([aria-current]) {
    background: color-mix(in srgb, var(--_row-ink) 12%, transparent);
  }

  /* Selected, at either level: the theme's colour with its own ink, plus a bar
     along the bottom so selection never rests on colour alone — white on a
     white row would otherwise be invisible. */
  .item[aria-current] {
    background: var(--_fill);
    color: var(--_ink);
    box-shadow: inset 0 -3px 0 var(--_ink);
  }
  .secondary .item[aria-current] { box-shadow: inset 0 -2px 0 var(--_ink); }

  .item:focus-visible { outline: 2px solid currentColor; outline-offset: -5px; }
  .item:disabled { opacity: .45; cursor: not-allowed; }

  .caption { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .count {
    position: absolute;
    inset-block-start: 6px;
    inset-inline-end: 8px;
    min-inline-size: 1.5em;
    padding: .15em .45em;
    border-radius: 1em;
    box-sizing: border-box;
    background: var(--_row);
    color: var(--_row-ink);
    font-size: .75em;
    line-height: 1.2;
  }
  .secondary .count { inset-block-start: 2px; }

  @media (prefers-reduced-motion: reduce) {
    .item { transition: none; }
  }
`;

/**
 * Reads menu metadata: a JSON array, or an array already parsed.
 *
 * Never throws. A menu that renders empty is easier to diagnose than one that
 * takes the page down, and anything without a string `token` is dropped,
 * because selection, events and `updateCount` are all keyed by it.
 *
 * @param {string|unknown[]|null} raw
 * @returns {object[]}
 */
export function readItems(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(list)) return [];
  const clean = (item) => item && typeof item === 'object' && typeof item.token === 'string';
  return list.filter(clean).map((item) => ({
    ...item,
    secondary: Array.isArray(item.secondary)
      ? item.secondary.filter(clean).map((child) => ({ ...child }))
      : []
  }));
}

const usable = (item) => item && item.enabled !== false;
const copy = (item) => (item ? JSON.parse(JSON.stringify(item)) : null);

export class NeodigmBuffet extends HTMLElement {
  #items = [];
  #primary = null;
  #secondary = null;
  /** primary token → the child last selected under it */
  #memory = new Map();

  static get observedAttributes() { return ['data-n55-buffet', 'data-buttons']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.addEventListener('click', this.#onClick);
  }

  connectedCallback() {
    if (!this.shadowRoot.firstChild) {
      this.shadowRoot.innerHTML =
        `<style>${STYLES}</style>` +
        `<div class="primary" part="primary"></div>` +
        `<div class="secondary" part="secondary"></div>`;
    }
    if (!this.hasAttribute('role')) this.setAttribute('role', 'navigation');
    if (!this.#items.length) this.#setItems(readItems(this.#source()));
    else this.#render();
  }

  attributeChangedCallback(name, before, after) {
    if (before === after) return;
    this.#setItems(readItems(this.#source()));
  }

  /** The menu's metadata. A copy: change it by assigning, not by mutating. */
  get items() { return copy(this.#items); }
  set items(value) { this.#setItems(readItems(value)); }

  /** The current selection at both levels. */
  get selection() { return { primary: this.#primary, secondary: this.#secondary }; }

  /**
   * Selects by token without announcing it, for keeping the menu in step with
   * a route. Clicks announce; this does not, or syncing would loop.
   *
   * @param {string} primary
   * @param {string|null} [secondary] Omitted: the child last chosen under it.
   * @returns {boolean} false if either token is unknown or disabled.
   */
  select(primary, secondary) {
    const item = this.#find(primary);
    if (!usable(item)) return false;
    let child = secondary === undefined ? this.#remembered(item) : secondary;
    if (child !== null && !usable(item.secondary.find((c) => c.token === child))) return false;
    this.#apply(primary, child);
    return true;
  }

  /**
   * Updates a badge in place. `null` removes it.
   * @returns {boolean} false if no item has that token.
   */
  updateCount(token, count) {
    for (const item of this.#items) {
      const hit = item.token === token ? item : item.secondary.find((c) => c.token === token);
      if (!hit) continue;
      if (typeof count === 'number') hit.count = count; else delete hit.count;
      const level = hit === item ? 'primary' : 'secondary';
      const button = [...this.shadowRoot.querySelectorAll(`.${level} .item`)]
        .find((b) => b.dataset.token === token);
      if (button) this.#fill(button, hit);
      return true;
    }
    return false;
  }

  #source() {
    return this.getAttribute('data-n55-buffet') ?? this.getAttribute('data-buttons');
  }

  #find(token) { return this.#items.find((item) => item.token === token) ?? null; }

  #remembered(item) {
    const token = this.#memory.get(item.token);
    return usable(item.secondary.find((c) => c.token === token)) ? token : null;
  }

  /**
   * Takes new metadata, keeping the selection wherever its tokens survive —
   * which is what lets an app swap in relabelled items without the menu
   * jumping.
   */
  #setItems(items) {
    this.#items = items;
    for (const item of items) {
      const flagged = item.secondary.find((c) => c.selected && usable(c));
      if (flagged) this.#memory.set(item.token, flagged.token);
    }
    const kept = usable(this.#find(this.#primary)) ? this.#primary : null;
    const primary = kept
      ?? items.find((i) => i.selected && usable(i))?.token
      ?? items.find(usable)?.token
      ?? null;
    const item = this.#find(primary);
    const child = item?.secondary.find((c) => c.token === this.#secondary && usable(c))
      ? this.#secondary
      : item ? this.#remembered(item) : null;
    this.#primary = primary;
    this.#secondary = child;
    this.#render();
  }

  #render() {
    const row = this.shadowRoot.querySelector('.primary');
    if (!row) return;   // not connected yet; connectedCallback renders
    row.replaceChildren(...this.#items.map((item) => this.#button(item, 'primary')));
    this.#renderChildren();
    this.#paint();
  }

  #renderChildren() {
    const row = this.shadowRoot.querySelector('.secondary');
    if (!row) return;
    const item = this.#find(this.#primary);
    row.replaceChildren(...(item?.secondary ?? []).map((c) => this.#button(c, 'secondary')));
    // The child row belongs to its parent, so it takes the parent's accent.
    this.#accent(row, item?.theme);
  }

  #apply(primary, secondary) {
    const moved = primary !== this.#primary;
    this.#primary = primary;
    this.#secondary = secondary;
    if (secondary !== null) this.#memory.set(primary, secondary);
    if (moved) this.#renderChildren();
    this.#paint();
  }

  /** Moves the selection markers. Nothing is rebuilt, so focus stays put. */
  #paint() {
    for (const [level, token] of [['primary', this.#primary], ['secondary', this.#secondary]]) {
      for (const button of this.shadowRoot.querySelectorAll(`.${level} .item`)) {
        if (button.dataset.token === token) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      }
    }
  }

  #button(item, level) {
    const button = this.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'item';
    button.setAttribute('part', `item ${level}-item`);
    button.dataset.token = item.token;
    button.dataset.level = level;
    button.disabled = item.enabled === false;
    if (typeof item.tagline === 'string' && item.tagline) button.title = item.tagline;
    this.#accent(button, item.theme);
    this.#fill(button, item);
    return button;
  }

  #accent(node, theme) {
    if (theme && Object.hasOwn(THEMES, theme)) node.dataset.accent = theme;
    else delete node.dataset.accent;
  }

  /** Writes a button's contents as text nodes, never markup. */
  #fill(button, item) {
    const doc = this.ownerDocument;
    const span = (cls, text) => {
      const s = doc.createElement('span');
      s.className = cls;
      s.textContent = text;
      return s;
    };
    const parts = [span('caption', String(item.caption ?? item.token))];
    if (typeof item.count === 'number') parts.push(span('count', String(item.count)));
    button.replaceChildren(...parts);
  }

  #onClick = (ev) => {
    const button = ev.target.closest?.('.item');
    if (!button || button.disabled) return;
    const { token, level } = button.dataset;

    let primary = this.#primary;
    let secondary = token;
    let item;
    if (level === 'primary') {
      item = this.#find(token);
      primary = token;
      secondary = item ? this.#remembered(item) : null;
    } else {
      item = this.#find(this.#primary)?.secondary.find((c) => c.token === token);
    }
    if (!item) return;

    // Cancelable, as Tulip's open is: a page with unsaved work can veto the
    // move. It fires on every click, including the current selection, because
    // re-choosing where you are is how a user asks to go back to its start.
    const proceed = this.dispatchEvent(new CustomEvent('neodigm-buffet-select', {
      bubbles: true, composed: true, cancelable: true,
      detail: { level, token, item: copy(item), primary, secondary }
    }));
    if (proceed) this.#apply(primary, secondary);
  };
}

if (!customElements.get('neodigm-buffet')) {
  customElements.define('neodigm-buffet', NeodigmBuffet);
}
