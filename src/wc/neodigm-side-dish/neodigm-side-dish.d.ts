export interface SideDishCloseDetail {
  /** What asked: the scrim, the Escape key, the X, or a call to `close()`. */
  reason: 'scrim' | 'escape' | 'close' | 'api';
}

export class NeodigmSideDish extends HTMLElement {
  /** Whether the panel is showing. Setting it opens or closes with no event. */
  open: boolean;
  /** Opens, after a cancelable `neodigm-side-dish-open`. False if vetoed or already open. */
  show(): boolean;
  /** Closes, after a cancelable `neodigm-side-dish-close`. False if vetoed or already closed. */
  close(reason?: SideDishCloseDetail['reason']): boolean;
}

declare global {
  interface HTMLElementTagNameMap { 'neodigm-side-dish': NeodigmSideDish }
  interface HTMLElementEventMap {
    /** Cancelable. */
    'neodigm-side-dish-open': CustomEvent<Record<string, never>>;
    /** Cancelable, whatever asked. */
    'neodigm-side-dish-close': CustomEvent<SideDishCloseDetail>;
  }
}
