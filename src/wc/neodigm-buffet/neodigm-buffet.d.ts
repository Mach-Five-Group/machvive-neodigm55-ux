/** One menu entry. The schema `m5t-primary-nav` uses, so existing data drops in. */
export interface BuffetItem {
  /** Unique identifier. Selection, events and `updateCount` are keyed by it. */
  token: string;
  /** Display text. Falls back to the token. Shown as text, never parsed as markup. */
  caption?: string;
  /** Only `false` disables; a missing value means enabled. */
  enabled?: boolean;
  /** Selects this item initially. */
  selected?: boolean;
  /** Accepted for compatibility and ignored. Icons are deferred; no icon fonts. */
  icon?: string;
  /** Shown as the native tooltip. */
  tagline?: string;
  /** A badge. */
  count?: number;
  /** A palette theme used as this item's accent. Not reached by sweeps. */
  theme?: string;
  /** Children, shown in the half-height row when this item is selected. */
  secondary?: BuffetItem[];
  [key: string]: unknown;
}

export interface BuffetSelection {
  primary: string | null;
  secondary: string | null;
}

export interface BuffetSelectDetail extends BuffetSelection {
  level: 'primary' | 'secondary';
  token: string;
  item: BuffetItem;
}

/** Parses metadata: JSON or an array. Never throws; drops items without a token. */
export function readItems(raw: string | unknown[] | null): BuffetItem[];

export class NeodigmBuffet extends HTMLElement {
  /** The metadata, as a copy. Assign to change it; selection survives where tokens do. */
  items: BuffetItem[];
  /** The current selection at both levels. */
  readonly selection: BuffetSelection;
  /**
   * Selects without dispatching an event, for keeping in step with a route.
   * Omit `secondary` for the child last chosen under `primary`.
   * False if either token is unknown or disabled.
   */
  select(primary: string, secondary?: string | null): boolean;
  /** Updates a badge in place; `null` removes it. False if no item has that token. */
  updateCount(token: string, count: number | null): boolean;
}

declare global {
  interface HTMLElementTagNameMap { 'neodigm-buffet': NeodigmBuffet }
  interface HTMLElementEventMap {
    /** Cancelable. Fires on every click, including the current selection. */
    'neodigm-buffet-select': CustomEvent<BuffetSelectDetail>;
  }
}
