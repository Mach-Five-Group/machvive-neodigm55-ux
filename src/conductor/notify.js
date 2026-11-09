/**
 * A system notification, outside the page. The original's
 * `neodigmUtils.messageNotification`.
 *
 * What changed:
 *
 * - **No default icon.** The original fetched a GitHub avatar for every
 *   notification that did not name one, which told a third party each time
 *   one was shown.
 * - **The default title is in the visitor's locale**, not always `en-US`.
 * - **A browser that only notifies from a service worker** (Chrome on Android)
 *   throws from `new Notification`. That resolves `'unsupported'` rather than
 *   rejecting.
 *
 * Browsers ask permission only in response to a click or a key, so call this
 * from one. `<neodigm-conductor>`'s `data-n55-notify` trigger does.
 */

/**
 * Shows `message` as a notification, asking permission first if it has never
 * been asked.
 *
 * @param {string} message
 * @param {{ title?: string, icon?: string } & Record<string, unknown>} [options]
 *   Anything else is passed to the Notification as an option (`tag`, `silent`…).
 * @returns {Promise<'shown'|'denied'|'default'|'unsupported'>} `'default'`
 *   means the visitor dismissed the prompt without answering.
 */
export async function notify(message, { title, icon, ...rest } = {}) {
  const Notice = globalThis.Notification;
  if (typeof Notice !== 'function') return 'unsupported';
  let permission = Notice.permission;
  if (permission === 'default') permission = await Notice.requestPermission();
  if (permission !== 'granted') return permission;
  const heading = title ?? new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  try {
    new Notice(heading, { ...rest, body: String(message ?? ''), ...(icon ? { icon } : {}) });
  } catch {
    return 'unsupported';
  }
  return 'shown';
}
