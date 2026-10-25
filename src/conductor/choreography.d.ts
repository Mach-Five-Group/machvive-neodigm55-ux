export interface SweepOptions {
  /** Subtree to sweep. Defaults to the whole document. */
  context?: ParentNode;
  /** ms between each element starting. */
  stagger?: number;
  /** ms each element holds the colour. Constant, unlike the original. */
  hold?: number;
  /** Aborting restores every element immediately. */
  signal?: AbortSignal;
  /** Also flash the tab title. */
  flashTab?: boolean;
}

/**
 * Sweeps a colour across every `[data-n55-theme]` element, then restores each.
 *
 * Does not cross shadow boundaries: a component is swept by its host attribute
 * and styles its internals from that.
 *
 * @returns how many elements were swept.
 */
export function robinTheme(theme?: string, options?: SweepOptions): Promise<number>;

/** The slower `[data-n55-theme-pulse]` cycle. */
export function pulseTheme(
  theme?: string,
  options?: Omit<SweepOptions, 'flashTab'>
): Promise<number>;

/** Prefixes the tab title with a theme's glyph, then restores it. */
export function flashTitle(theme: string, ms?: number, options?: { doc?: Document }): boolean;

/** Test seam: drops the captured title and any pending restore. */
export function resetTitle(): void;
