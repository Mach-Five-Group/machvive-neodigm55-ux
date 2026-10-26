/** One character of the message, with the theme it belongs to. */
export interface MarqueeCell {
  char: string;
  theme: string | null;
}

/** ms between steps. Matches the original's metronome interval. */
export const DEFAULT_SPEED: 132;

/** Parses `[theme]text[/theme]` markup into per-character themes. */
export function parseRuns(source: string): MarqueeCell[];

/** The message with its `[theme]` markup removed. */
export function plainText(source: string): string;

export class NeodigmMarquee extends HTMLElement {
  /** The message, with any `[theme]` markup stripped. */
  text: string;
  /** Whether the marquee is currently stepping. */
  readonly running: boolean;
  /** Stops stepping; the text stays where it is. */
  pause(): this;
  /** Resumes stepping. */
  play(): this;
  /** Advances by `by` characters, whether or not it is running. */
  step(by?: number): this;
}

declare global {
  interface HTMLElementTagNameMap {
    'neodigm-marquee': NeodigmMarquee;
  }
}
