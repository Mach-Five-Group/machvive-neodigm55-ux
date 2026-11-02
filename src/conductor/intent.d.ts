/** The sessionStorage key, shared with the original so a migrated site does not re-fire mid-session. */
export const EXIT_KEY: 'n55_userExit';

/**
 * Calls `fn` once when the pointer leaves the page through its top edge.
 * Replaces SodaPop's `setOnBeforeUserExit`. Returns an unsubscribe.
 */
export function onExitIntent(
  fn: (event: MouseEvent) => void,
  options?: {
    /** `'session'` (default): not again in this tab once fired. `'page'`: once per page load. */
    once?: 'session' | 'page';
    doc?: Document;
  }
): () => void;
