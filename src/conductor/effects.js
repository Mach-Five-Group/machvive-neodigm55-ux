/**
 * Effects on any element: shake, count to a number, type text on and off.
 *
 * These are the visual half of the original's `neodigmUtils`. Like the rest of
 * the conductor they work on plain elements, never on a component class, and
 * touch the DOM only when called, so this module still imports in bare Node.
 *
 * Each asks the motion gate first. Suppressed motion still applies the end
 * state: a count lands on its number and typed text appears whole. A shake has
 * no end state, so it does nothing.
 *
 * What changed from the original:
 *
 * - **Shake uses the Web Animations API, not a `shake__an` class.** The class
 *   needed a global stylesheet, and its keyframes replaced the element's own
 *   `transform`, so a centred element jumped while it shook. `composite: 'add'`
 *   shakes it where it stands.
 * - **countTo interpolates.** The original moved by a fixed `round(diff / 16)`
 *   each tick and then snapped, so a small difference stalled and a large one
 *   overshot before the last step. Each step here is a true sixteenth.
 * - **typeOn types, holds, erases and types again, in sequence.** The original
 *   started erasing a phrase while still typing padding after it, and timed the
 *   erase from the text's length, so the two raced. It also pinned the
 *   element's `height` inline, for good.
 * - **A screen reader hears each phrase once, whole.** Typed text is announced
 *   letter by letter, or not at all. While typing, the element holds the
 *   phrase in a visually hidden span and the letters in an `aria-hidden` one;
 *   when it finishes it is a single text node again.
 */
import { motionAllowed } from './motion.js';

/** The original's `touch_shake` keyframes, which Poptart and SodaPop also use. */
export const SHAKE_KEYFRAMES = Object.freeze([
  'translate(1px, -3px) rotate(-2deg)',
  'translate(-1px, 2px) rotate(-1deg)',
  'translate(1px, 3px) rotate(0deg)',
  'translate(2px, 3px) rotate(1deg)',
  'translate(1px, -1px) rotate(2deg)',
  'translate(-1px, -3px) rotate(-1deg)',
  'translate(-2px, 1px) rotate(0deg)',
  'translate(3px, 1px) rotate(-1deg)',
  'translate(-1px, -1px) rotate(2deg)',
  'translate(-3px, 0) rotate(1deg)',
  'translate(1px, 1px) rotate(0deg)'
].map((transform) => Object.freeze({ transform })));

/** The original's timing: four 0.2s shakes. */
export const SHAKE_TIMING = Object.freeze({ duration: 200, iterations: 4 });

/** The original's defaults: sixteen steps, 116ms apart. */
export const COUNT_DEFAULTS = Object.freeze({ steps: 16, interval: 116 });

/** ms per letter typed (the original's demos used 75–86), and between phrases. */
export const TYPE_DEFAULTS = Object.freeze({ delay: 80, hold: 1500 });

/** The modes typeOn accepts. Case does not matter: the original wrote them in capitals. */
export const TYPE_MODES = Object.freeze(['once', 'loop', 'random', 'off']);

/**
 * Every element a target names: a selector, an element, or a list of them.
 *
 * @param {string|Element|Iterable<Element>|null|undefined} target
 * @param {ParentNode} doc
 * @returns {Element[]}
 */
function elementsOf(target, doc) {
  if (target == null) return [];
  if (typeof target === 'string') return [...doc.querySelectorAll(target)];
  if (typeof target[Symbol.iterator] === 'function') {
    return [...target].filter((el) => el?.nodeType === 1);
  }
  return target.nodeType === 1 ? [target] : [];
}

/* -------------------------------------------------------------------- shake */

/** The shake running on each element, so a second one restarts it. */
const shaking = new WeakMap();

/**
 * Shakes each element named, four times in 0.8s.
 *
 * Nothing happens when motion is suppressed, or in an environment without
 * `Element.animate`. An inline element (a bare `<span>`, `<a>`, `<img>` is
 * fine) cannot be transformed: give it `display: inline-block`.
 *
 * @param {string|Element|Iterable<Element>} target
 * @param {{ doc?: ParentNode }} [options]
 * @returns {Promise<number>} how many elements shook, once they have finished.
 */
export async function shake(target, { doc = globalThis.document } = {}) {
  const elements = elementsOf(target, doc);
  if (!motionAllowed()) return 0;
  const runs = elements.filter((el) => typeof el.animate === 'function').map((el) => {
    shaking.get(el)?.cancel();
    const run = el.animate(SHAKE_KEYFRAMES, { ...SHAKE_TIMING, composite: 'add' });
    shaking.set(el, run);
    return run.finished.catch(() => {}).then(() => {
      if (shaking.get(el) === run) shaking.delete(el);
    });
  });
  await Promise.all(runs);
  return runs.length;
}

/* ------------------------------------------------------------------ countTo */

/** The count running on each element, and the number each last showed. */
const counting = new WeakMap();
const shown = new WeakMap();

/** The number an element's text shows, or 0. */
function numberIn(el) {
  if (shown.has(el)) return shown.get(el);
  const n = Number.parseFloat(el.textContent.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Counts each element's number up or down to `value`, in sixteen steps.
 *
 * The starting point is whatever number the element shows. Steps are whole
 * numbers; the last step lands on `value` exactly. A second count on the same
 * element takes over from wherever the first one got to.
 *
 * @param {string|Element|Iterable<Element>} target
 * @param {number} value
 * @param {{ steps?: number, interval?: number, format?: (n: number) => string, doc?: ParentNode }} [options]
 *   `interval` is ms between steps. `format` writes each number, for example
 *   `new Intl.NumberFormat().format`; the count reads its own numbers back,
 *   not the formatted text.
 * @returns {Promise<number>} how many elements were counted, once they have landed.
 */
export async function countTo(target, value, {
  steps = COUNT_DEFAULTS.steps,
  interval = COUNT_DEFAULTS.interval,
  format = String,
  doc = globalThis.document
} = {}) {
  if (!Number.isFinite(value)) throw new TypeError(`countTo needs a finite number, not ${value}`);
  const elements = elementsOf(target, doc);
  const write = (el, n) => { shown.set(el, n); el.textContent = format(n); };

  await Promise.all(elements.map((el) => new Promise((resolve) => {
    counting.get(el)?.();
    const from = numberIn(el);
    if (!motionAllowed() || from === value || steps < 2) { write(el, value); resolve(); return; }

    let step = 0;
    let timer = null;
    const stop = () => { clearTimeout(timer); counting.delete(el); resolve(); };
    const tick = () => {
      step += 1;
      // Gone from the page: land, and stop scheduling.
      if (step >= steps || !el.isConnected) { write(el, value); stop(); return; }
      write(el, Math.round(from + ((value - from) * step) / steps));
      timer = setTimeout(tick, interval);
    };
    counting.set(el, stop);
    timer = setTimeout(tick, interval);
  })));
  return elements.length;
}

/* ------------------------------------------------------------ typeOn/typeOff */

/** The typing job on each element, and the span its letters are in. */
const typing = new WeakMap();
const staged = new WeakMap();

/** Visually hidden, but read. No colour, so nothing for the palette to miss. */
const SR_ONLY = 'position:absolute;inline-size:1px;block-size:1px;margin:-1px;padding:0;' +
  'border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap';

/** What a reader sees as one letter: an emoji or accented letter is one, not several. */
function letters(text) {
  const Seg = globalThis.Intl?.Segmenter;
  return Seg ? [...new Seg().segment(text)].map((s) => s.segment) : [...text];
}

/**
 * Takes over an element for typing, cancelling whatever was typing there.
 * `sleep` resolves false once the job is cancelled or the element leaves the
 * page, so nothing keeps a timer running for an element nobody can see.
 */
function claim(el) {
  typing.get(el)?.cancel();
  let timer = null;
  let wake = null;
  let cancelled = false;
  const job = {
    get alive() { return !cancelled && el.isConnected && typing.get(el) === job; },
    sleep(ms) {
      return new Promise((resolve) => {
        wake = resolve;
        timer = setTimeout(() => { wake = null; resolve(job.alive); }, ms);
      });
    },
    cancel() {
      cancelled = true;
      clearTimeout(timer);
      wake?.(false);
      wake = null;
    },
    release() { if (typing.get(el) === job) typing.delete(el); }
  };
  typing.set(el, job);
  return job;
}

/**
 * Replaces an element's content with a hidden span for the reader and a
 * visible one for the letters, keeping the letters it shows. Returns both.
 */
function stage(el) {
  const was = staged.get(el);
  // Taken over mid-phrase: only the visible letters count, not the hidden copy.
  const visible = was?.parentNode === el ? was.textContent : el.textContent;
  const doc = el.ownerDocument;
  const spoken = doc.createElement('span');
  spoken.setAttribute('style', SR_ONLY);
  const view = doc.createElement('span');
  view.setAttribute('aria-hidden', 'true');
  view.textContent = visible;
  el.replaceChildren(spoken, view);
  staged.set(el, view);
  return { spoken, view };
}

/** Erases the letters one at a time, from the end. */
async function erase(job, view, ms) {
  const left = letters(view.textContent);
  while (left.length) {
    if (!await job.sleep(ms)) return false;
    left.pop();
    view.textContent = left.join('');
  }
  return true;
}

/** Whether an element is being typed into or erased right now. */
export function isTyping(el) {
  return typing.has(el);
}

/**
 * Types a message into the first element named, a letter at a time.
 *
 * `|` separates phrases. Each phrase is typed, held, erased, and the next
 * typed. The element's `data-n55-typeon` attribute is the index of the phrase
 * showing, so a page can style each one, as the original's demos did.
 *
 * - `once` (default): every phrase in turn; the last one stays.
 * - `loop`: every phrase, forever, until something else types there.
 * - `random`: one phrase, chosen at random; it stays.
 * - `off`: erases, as {@link typeOff}.
 *
 * Under suppressed motion the phrase that would end up showing appears whole
 * (for `loop`, the first; there is no cycling). Anything already in the
 * element is erased first. Calling it again on the same element takes over.
 *
 * An element that empties collapses, unless the page gives it a
 * `min-block-size`. The original pinned the height inline instead, which
 * outlived the text it was measured for.
 *
 * @param {string|Element} target
 * @param {string} message
 * @param {{ delay?: number, hold?: number, mode?: string, doc?: ParentNode }} [options]
 *   `delay` is ms per letter (erasing runs four times as fast); `hold` is ms a
 *   finished phrase stays before it is erased.
 * @returns {Promise<boolean>} true once it finished, false if it was stopped.
 *   A `loop` only ever resolves false.
 */
export async function typeOn(target, message, {
  delay = TYPE_DEFAULTS.delay,
  hold = TYPE_DEFAULTS.hold,
  mode = 'once',
  doc = globalThis.document
} = {}) {
  const el = elementsOf(target, doc)[0];
  const how = String(mode).toLowerCase();
  if (!el) return false;
  if (how === 'off') return typeOff(el, { delay });

  let phrases = String(message ?? '').split('|').map((p) => p.trim()).filter(Boolean);
  const indexes = phrases.map((_, i) => i);
  if (how === 'random' && phrases.length) {
    const pick = Math.floor(Math.random() * phrases.length);
    phrases = [phrases[pick]];
    indexes.splice(0, indexes.length, pick);
  }
  const loop = how === 'loop';
  const show = (i) => el.setAttribute('data-n55-typeon', String(indexes[i]));

  if (!motionAllowed() || !phrases.length) {
    typing.get(el)?.cancel();
    const last = loop ? 0 : phrases.length - 1;
    el.textContent = phrases[last] ?? '';
    if (phrases.length) show(last);
    return true;
  }

  const job = claim(el);
  const fast = Math.max(8, Math.round(delay / 4));
  const { spoken, view } = stage(el);
  try {
    if (!await erase(job, view, fast)) return false;
    for (let i = 0; ; i = (i + 1) % phrases.length) {
      show(i);
      spoken.textContent = phrases[i];
      const typed = [];
      for (const letter of letters(phrases[i])) {
        if (!await job.sleep(delay)) return false;
        typed.push(letter);
        view.textContent = typed.join('');
      }
      if (!loop && i === phrases.length - 1) {
        el.textContent = phrases[i];
        return true;
      }
      if (!await job.sleep(hold)) return false;
      if (!await erase(job, view, fast)) return false;
    }
  } finally {
    job.release();
  }
}

/**
 * Erases the first element named, a letter at a time, and stops anything
 * typing there. Under suppressed motion it empties at once.
 *
 * @param {string|Element} target
 * @param {{ delay?: number, doc?: ParentNode }} [options] `delay` as for typeOn.
 * @returns {Promise<boolean>} true once empty, false if something took over.
 */
export async function typeOff(target, { delay = TYPE_DEFAULTS.delay, doc = globalThis.document } = {}) {
  const el = elementsOf(target, doc)[0];
  if (!el) return false;
  if (!motionAllowed()) {
    typing.get(el)?.cancel();
    el.textContent = '';
    return true;
  }
  const job = claim(el);
  const { view } = stage(el);
  try {
    if (!await erase(job, view, Math.max(8, Math.round(delay / 4)))) return false;
    el.textContent = '';
    return true;
  } finally {
    job.release();
  }
}
