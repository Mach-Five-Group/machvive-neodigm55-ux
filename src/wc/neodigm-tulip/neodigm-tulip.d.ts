import type { Side } from '../../conductor/anchor.js';

export interface TulipConfig {
  /** Message text. `|` breaks a line. Shown as text, never parsed as markup. */
  msg: string;
  /** Route the message through `<neodigm-marquee>`. */
  mrq: boolean;
  /** Template reference, carried from the original format. */
  tmpt: string;
  theme: string;
  size: 'small' | 'medium' | 'large';
  position: Side;
  /** Optional glyph shown before the message. */
  icon: string;
}

export const TULIP_DEFAULTS: Readonly<TulipConfig>;

/** Parses a `data-n55-tulip` value: JSON, or a bare string as the message. */
export function readConfig(raw: string): TulipConfig;

/** Finds the nearest configuration walking up from a node. */
export function configFrom(node: Node | null): { element: Element; config: TulipConfig } | null;

export class NeodigmTulip extends HTMLElement {
  readonly open: boolean;
  /** The element the current tip describes. */
  readonly trigger: Element | null;
  /** Shows the tip for an element or selector. False if vetoed or empty. */
  openFor(target: Element | string, override?: Partial<TulipConfig>): boolean;
  close(): this;
}

declare global {
  interface HTMLElementTagNameMap { 'neodigm-tulip': NeodigmTulip }
  interface HTMLElementEventMap {
    /** Cancelable. preventDefault() stops the tip showing. */
    'neodigm-tulip-open': CustomEvent<{ trigger: Element; config: TulipConfig }>;
    'neodigm-tulip-close': CustomEvent<{ trigger: Element | null }>;
  }
}
