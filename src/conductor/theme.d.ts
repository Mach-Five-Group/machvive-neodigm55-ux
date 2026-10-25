export interface NeodigmTheme {
  /** The theme's colour. */
  color: string;
  /** Its darker companion, for text on the colour or for hover. */
  deep: string;
  /** The emoji the tab title flashes. */
  glyph: string;
}

/** The thirteen Neodigm 55 themes, in round-robin order. */
export const THEMES: Readonly<Record<string, NeodigmTheme>>;
export const THEME_NAMES: readonly string[];
/** The theme that also means "do not choreograph me". */
export const OPT_OUT: 'disabled';
/** The attribute that opts an element into choreography. */
export const THEME_ATTR: 'data-n55-theme';
export const PULSE_ATTR: 'data-n55-theme-pulse';

/** Renders the palette as CSS custom properties, for a stylesheet or a builder. */
export function themeCss(themes?: Record<string, NeodigmTheme>, selector?: string): string;

/** Puts the palette on the document. Idempotent; a second call replaces the first. */
export function installTheme(options?: {
  themes?: Record<string, NeodigmTheme>;
  selector?: string;
  doc?: Document;
}): HTMLStyleElement | null;

/** Reads a theme's *resolved* values, honouring any page override. */
export function resolveTheme(name: string, options?: { doc?: Document }): NeodigmTheme | null;
