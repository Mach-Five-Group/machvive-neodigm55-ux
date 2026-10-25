export interface ToastOptions {
  /** A theme name from the palette. Also set on the host, so a sweep can find it. */
  theme?: string;
  /** ms on screen. Defaults to DEFAULT_DURATION. */
  duration?: number;
  /** Also flash the tab title with the theme's glyph. */
  flashTab?: boolean;
}

export interface QueuedToast {
  message: string;
  theme: string | null;
  duration: number;
}

/** The original library's default, 5200ms. */
export const DEFAULT_DURATION: 5200;

export class NeodigmToast extends HTMLElement {
  /** Queues a message. Use `|` for a line break. Markup is shown as text. */
  show(message: string, options?: ToastOptions): this;
  /** Messages still waiting, including the one on screen. */
  readonly queue: QueuedToast[];
  /** Empties the queue; the message on screen finishes its own duration. */
  clear(): this;
  /** Stops accepting messages. */
  pause(): this;
  /** Accepts messages again. */
  play(): this;
  /** Whether a message is currently on screen. */
  readonly open: boolean;
}

declare global {
  interface HTMLElementTagNameMap {
    'neodigm-toast': NeodigmToast;
  }
  interface HTMLElementEventMap {
    'neodigm-toast-show': CustomEvent<QueuedToast>;
    'neodigm-toast-hide': CustomEvent<QueuedToast>;
  }
}
