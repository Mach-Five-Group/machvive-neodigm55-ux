/** Lets the next unknown icon name warn again. For tests. */
export function resetIconWarning(): void;

export class NeodigmIcon extends HTMLElement {
  /** The name as the set spells it, from `name` or the text inside (`dark_mode` → `dark-mode`). */
  name: string;
}

declare global {
  interface HTMLElementTagNameMap { 'neodigm-icon': NeodigmIcon }
}
