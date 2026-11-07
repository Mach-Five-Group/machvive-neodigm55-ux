/** Every built-in icon, name to CSS `url()`. Material Symbols Outlined, Apache-2.0. */
export const ICONS: Readonly<Record<string, string>>;
/** The built-in names, sorted. */
export const ICON_NAMES: readonly string[];
/** Lower case, hyphens, `[a-z0-9-]` only. Accepts Material's `dark_mode` spelling. */
export function iconName(raw: unknown): string;
/** The set as `--n55-icon-<name>` custom properties under `selector` (default `:root`). */
export function iconCss(icons?: Record<string, string>, selector?: string): string;
