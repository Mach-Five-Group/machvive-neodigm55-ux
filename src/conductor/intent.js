/**
 * Exit intent: the pointer leaving the page through the top, toward the tabs
 * and the address bar, as if to close or leave.
 *
 * The original hung this on SodaPop as `setOnBeforeUserExit`, though it has
 * nothing to do with a popup. It is a page signal, so it lives here, and what
 * happens next — a toast, a popup, a sweep — is the caller's choice:
 *
 * ```js
 * onExitIntent(() => toast.show('Thanks for visiting|Bookmark us!', { theme: 'info' }));
 * ```
 *
 * What changed:
 *
 * - **Only the top edge counts.** The original fired on leaving through any
 *   edge, so moving the pointer to a second monitor or the devtools panel
 *   counted as leaving.
 * - **Any number of subscribers**, each with an unsubscribe. The original kept
 *   one callback, and a second call replaced the first.
 * - **Once per session still holds, and still survives storage failing.** A
 *   sandboxed frame throws on `sessionStorage`; then it is once per page.
 *
 * Touches the DOM only when called, never at import, so the conductor stays
 * headless.
 */

/** The sessionStorage key the original used, so a migrated site does not re-fire mid-session. */
export const EXIT_KEY = 'n55_userExit';

/** The storage, or null where reading it throws. */
function storageOf(view) {
  try { return view?.sessionStorage ?? null; } catch { return null; }
}

/**
 * Calls `fn` once when the pointer leaves the page through its top edge.
 *
 * @param {(event: MouseEvent) => void} fn
 * @param {{ once?: 'session'|'page', doc?: Document }} [options]
 *   `'session'` (the default, as the original): not again in this tab once it
 *   has fired, across pages. `'page'`: once per page load.
 * @returns {() => void} unsubscribe. A no-op when it already fired this session.
 */
export function onExitIntent(fn, { once = 'session', doc = globalThis.document } = {}) {
  if (!doc) return () => {};
  const storage = once === 'session' ? storageOf(doc.defaultView) : null;
  const seen = () => { try { return storage?.getItem(EXIT_KEY) != null; } catch { return false; } };
  // Fired earlier this session, perhaps on another page: stay dormant.
  if (seen()) return () => {};

  const onOut = (ev) => {
    // Leaving the document has no related target; leaving through the top
    // has the pointer at or above the viewport's first row.
    if (ev.relatedTarget || ev.clientY > 0) return;
    off();
    try { storage?.setItem(EXIT_KEY, String(Date.now())); } catch { /* once per page, then */ }
    fn(ev);
  };
  const off = () => doc.removeEventListener('mouseout', onOut);
  doc.addEventListener('mouseout', onOut);
  return off;
}
