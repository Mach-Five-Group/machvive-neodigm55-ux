/**
 * The motion gate.
 *
 * Everything the conductor animates asks here first. The original library had a
 * `neodigmMetronome.isPaused()` check and, directly above `robinTheme`, the
 * comment `// TODO test OS/UA motion mq` — the OS preference was never wired
 * up. This closes that: `prefers-reduced-motion: reduce` suppresses motion by
 * default, and a page can still override in either direction.
 *
 * Suppressed does not mean skipped. A choreography that cannot animate still
 * applies its end state, so a reduced-motion visitor gets the same information
 * without the sweep.
 */

/** @type {boolean|null} null = follow the OS; true/false = explicit override. */
let override = null;

/** Listeners notified when the effective setting changes. */
const listeners = new Set();

/** @returns {MediaQueryList|null} */
function query() {
  if (typeof globalThis.matchMedia !== 'function') return null;
  try {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  } catch {
    // jsdom has matchMedia behind a flag and some environments stub it badly.
    return null;
  }
}

/**
 * Whether motion is currently allowed.
 *
 * Absent both an override and a usable media query, motion is **allowed** —
 * the conductor's whole purpose is movement, and defaulting to off in an
 * environment that simply cannot answer would make the library look broken.
 *
 * @returns {boolean}
 */
export function motionAllowed() {
  if (override !== null) return override;
  return query()?.matches !== true;
}

/**
 * Forces motion on or off regardless of the OS preference.
 *
 * `null` hands control back to the OS. A page that offers its own motion toggle
 * owns this; nothing else should call it.
 *
 * @param {boolean|null} value
 */
export function setMotionAllowed(value) {
  const before = motionAllowed();
  override = value === null ? null : Boolean(value);
  if (motionAllowed() !== before) notify();
}

/** Pauses motion. Mirrors the original `neodigmMetronome.pause()`. */
export const pause = () => setMotionAllowed(false);

/** Resumes motion, following the OS again. */
export const play = () => setMotionAllowed(null);

function notify() {
  const allowed = motionAllowed();
  for (const fn of listeners) {
    // One throwing listener must not stop the others, and must never reach the
    // animation that triggered this.
    try { fn(allowed); } catch { /* a subscriber's problem, not ours */ }
  }
}

/**
 * Subscribes to changes, including the OS preference changing mid-session.
 *
 * @param {(allowed: boolean) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onMotionChange(fn) {
  if (listeners.size === 0) {
    const mq = query();
    mq?.addEventListener?.('change', notify);
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) query()?.removeEventListener?.('change', notify);
  };
}

/** Test seam: forget every subscriber and any override. */
export function resetMotion() {
  query()?.removeEventListener?.('change', notify);
  listeners.clear();
  override = null;
}
