export type ActIconSize = 'pico' | 'micro' | 'milli' | 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';

/** The original's sizes: [circle, glyph] in px. */
export const ACTICON_SIZES: Readonly<Record<ActIconSize, readonly [number, number]>>;

export class NeodigmActIcon extends HTMLElement {
  /** Whether it is themed `disabled`. */
  readonly disabled: boolean;
}

declare global {
  interface HTMLElementTagNameMap { 'neodigm-acticon': NeodigmActIcon }
}
