/** A selector, an element, or a list of elements. */
export type EffectTarget = string | Element | Iterable<Element>;

/** The original's `touch_shake` keyframes. */
export const SHAKE_KEYFRAMES: readonly Readonly<{ transform: string }>[];
/** Four 0.2s shakes. */
export const SHAKE_TIMING: Readonly<{ duration: 200; iterations: 4 }>;
/** Sixteen steps, 116ms apart. */
export const COUNT_DEFAULTS: Readonly<{ steps: 16; interval: 116 }>;
/** ms per letter, and ms a finished phrase holds. */
export const TYPE_DEFAULTS: Readonly<{ delay: 80; hold: 1500 }>;
export const TYPE_MODES: readonly ['once', 'loop', 'random', 'off'];

export type TypeMode = 'once' | 'loop' | 'random' | 'off' | 'ONCE' | 'LOOP' | 'RANDOM' | 'OFF';

/**
 * Shakes each element named, four times in 0.8s, from wherever it stands.
 * Nothing happens under suppressed motion. Resolves with how many shook.
 */
export function shake(target: EffectTarget, options?: { doc?: ParentNode }): Promise<number>;

export interface CountOptions {
  /** Default 16. */
  steps?: number;
  /** ms between steps. Default 116. */
  interval?: number;
  /** Writes each number, e.g. `new Intl.NumberFormat().format`. */
  format?: (n: number) => string;
  doc?: ParentNode;
}

/**
 * Counts each element's number to `value` in whole-number steps, landing on
 * it exactly. Under suppressed motion it lands at once. Resolves with how many.
 */
export function countTo(target: EffectTarget, value: number, options?: CountOptions): Promise<number>;

export interface TypeOptions {
  /** ms per letter. Default 80. Erasing runs four times as fast. */
  delay?: number;
  /** ms a finished phrase stays before it is erased. Default 1500. */
  hold?: number;
  /** Default `once`. Case does not matter. */
  mode?: TypeMode;
  doc?: ParentNode;
}

/**
 * Types a message into the first element named. `|` separates phrases, and
 * `data-n55-typeon` is the index of the one showing. Resolves true when
 * finished, false when stopped; a loop only ever resolves false.
 */
export function typeOn(target: string | Element, message: string, options?: TypeOptions): Promise<boolean>;

/** Erases the first element named, and stops anything typing there. */
export function typeOff(target: string | Element, options?: { delay?: number; doc?: ParentNode }): Promise<boolean>;

/** Whether an element is being typed into or erased right now. */
export function isTyping(el: Element): boolean;
