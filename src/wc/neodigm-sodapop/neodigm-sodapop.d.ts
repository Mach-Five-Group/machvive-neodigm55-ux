/** A template's popup options, read from its `data-n55-sodapop-*` attributes. */
export interface SodaPopOptions {
  /** `data-n55-sodapop-modal="true"`: the scrim and Escape shake instead of closing, and there is no X. */
  modal: boolean;
  /** `data-n55-sodapop-size`. Missing or unknown is `medium`. */
  size: 'xsmall' | 'small' | 'medium' | 'large';
  /** `data-n55-sodapop-fullscreen="true"`: asks the browser for full screen, which needs a user gesture. */
  fullscreen: boolean;
  /** `data-n55-sodapop-transition`. `'slide-right'` is a drawer; empty is the default popup. */
  transition: '' | 'slide-right';
  /** `data-n55-scheme` on the template pins the popup light or dark. */
  scheme: '' | 'light' | 'dark';
}

export interface SodaPopOpenDetail { id: string; popup: SodaPopOptions }
export interface SodaPopCloseDetail {
  id: string | null;
  reason: 'scrim' | 'escape' | 'close' | 'api' | 'replace';
}

/** Reads a template's options. Never throws; unknown values fall back. */
export function readPopup(el: Element | null): SodaPopOptions;

export class NeodigmSodaPop extends HTMLElement {
  /** Whether a popup is showing. */
  readonly open: boolean;
  /** The id of the template showing, or null. */
  readonly current: string | null;
  /** Whether the popup showing is modal. */
  readonly modal: boolean;
  /** Opens the template with this id at once. Check `current` to see whether it opened. */
  show(id: string): this;
  /** Closes, modal or not. False if nothing was open or a listener vetoed it. */
  close(reason?: SodaPopCloseDetail['reason']): boolean;
  /** Shakes the popup showing. Does nothing when motion is suppressed. */
  shake(): this;
}

declare global {
  interface HTMLElementTagNameMap { 'neodigm-sodapop': NeodigmSodaPop }
  interface HTMLElementEventMap {
    /** Cancelable. Replaces `setOnBeforeOpen`. */
    'neodigm-sodapop-open': CustomEvent<SodaPopOpenDetail>;
    /** Replaces `setOnAfterOpen`. */
    'neodigm-sodapop-opened': CustomEvent<SodaPopOpenDetail>;
    /** Cancelable. Replaces `setOnClose`. */
    'neodigm-sodapop-close': CustomEvent<SodaPopCloseDetail>;
  }
}
