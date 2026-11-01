export interface NeodigmTheme {
  /** The theme's colour. */
  color: string;
  /** Its darker companion, for a second surface or for hover. */
  deep: string;
  /** The emoji the tab title flashes. */
  glyph: string;
  /** Text on `color`. Computed with `inkFor` when omitted. */
  ink?: string;
  /** Text on `deep`. Computed with `inkFor` when omitted. */
  deepInk?: string;
}

/** The components' neutral dark ink. */
export const INK_DARK: '#1a1a1a';
/** White ink. */
export const INK_LIGHT: '#fff';
/** WCAG contrast ratio between two hex colours, 1–21; NaN if either is not hex. Pure. */
export function contrast(a: string, b: string): number;
/** INK_DARK or INK_LIGHT, whichever contrasts more with `surface`. Pure. */
export function inkFor(surface: string): '#1a1a1a' | '#fff';

/** The thirteen Neodigm 55 themes, in round-robin order. */
export const THEMES: Readonly<Record<string, NeodigmTheme>>;
export const THEME_NAMES: readonly string[];
/** The theme that also means "do not choreograph me". */
export const OPT_OUT: 'disabled';
/** The attribute that opts an element into choreography. */
export const THEME_ATTR: 'data-n55-theme';
export const PULSE_ATTR: 'data-n55-theme-pulse';

/** A `[light, dark]` pair, emitted as `light-dark(light, dark)`. */
export type SchemePair = readonly [light: string, dark: string];

/**
 * The page surfaces components paint when not wearing a theme, as
 * `--n55-surface`, `--n55-surface-ink`, `--n55-line`, `--n55-inverse`,
 * `--n55-inverse-ink`. Each resolves against the using element's color-scheme.
 */
export const NEUTRALS: Readonly<{
  surface: SchemePair;
  surfaceInk: SchemePair;
  line: SchemePair;
  inverse: SchemePair;
  inverseInk: SchemePair;
}>;

/** `data-n55-scheme="light|dark"` pins a subtree, or one component, to a mode. */
export const SCHEME_ATTR: 'data-n55-scheme';

/** Renders the palette as CSS custom properties, for a stylesheet or a builder. */
export function themeCss(
  themes?: Record<string, NeodigmTheme>,
  selector?: string,
  neutrals?: Record<string, SchemePair>
): string;

/** Puts the palette on the document. Idempotent; a second call replaces the first. */
export function installTheme(options?: {
  themes?: Record<string, NeodigmTheme>;
  selector?: string;
  neutrals?: Record<string, SchemePair>;
  doc?: Document;
}): HTMLStyleElement | null;

/** Reads a theme's *resolved* values, honouring any page override. Inks always present. */
export function resolveTheme(name: string, options?: { doc?: Document }): NeodigmTheme | null;
