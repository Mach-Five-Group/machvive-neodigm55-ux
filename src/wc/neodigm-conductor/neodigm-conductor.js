/**
 * `<neodigm-conductor>` — the conductor, declared in markup.
 *
 * ```html
 * <neodigm-conductor></neodigm-conductor>
 *
 * <button data-n55-shake="#logo">Shake the logo</button>
 * <button data-n55-typeon-click='{"q1st": "#tagline", "msg": "Fast|Small|Yours", "mode": "LOOP"}'>Type</button>
 * <h2 data-n55-typeon-hover='{"msg": "Hello there"}'>Hover me</h2>
 * <button data-n55-notify="Your export is ready" data-n55-notify-title="Exports">Notify me</button>
 * ```
 *
 * It holds no logic of its own and draws nothing. While it is on the page it
 * wires the triggers above, and its methods call the conductor module, which
 * is where everything lives. One is enough; any number are harmless.
 *
 * Triggers:
 *
 * - `data-n55-shake`: shakes the elements its selector names when the trigger
 *   is clicked; empty, it shakes the trigger.
 * - `data-n55-typeon-click` / `data-n55-typeon-hover`: the original's JSON
 *   (`q1st`, `msg`, `uniqueDelay`, `mode`), plus `hold`. Without `q1st` it
 *   types into the trigger; a plain string is the message. Hover also fires on
 *   keyboard focus, and does not restart text that is still typing.
 * - `data-n55-notify`: shows the message as a system notification, with
 *   `data-n55-notify-title` and `data-n55-notify-icon`. A click is what lets
 *   the browser ask permission.
 *
 * A trigger themed `disabled` does nothing, as everywhere else.
 */
import { THEME_ATTR, OPT_OUT } from '../../conductor/theme.js';
import { shake, countTo, typeOn, typeOff, isTyping } from '../../conductor/effects.js';
import { notify } from '../../conductor/notify.js';

const TRIGGERS = Object.freeze({
  shake: 'data-n55-shake',
  typeClick: 'data-n55-typeon-click',
  typeHover: 'data-n55-typeon-hover',
  notify: 'data-n55-notify'
});

/** The nearest element on the event's path carrying `attr`, across shadow roots. */
function triggerOf(ev, attr) {
  const el = ev.composedPath?.().find((n) => n?.nodeType === 1 && n.hasAttribute(attr)) ??
    ev.target?.closest?.(`[${attr}]`);
  return el && el.getAttribute(THEME_ATTR) !== OPT_OUT ? el : null;
}

/** Read as the original read it: JSON if it parses, otherwise the message itself. */
function typeConfig(trigger, attr) {
  const raw = trigger.getAttribute(attr);
  let config;
  try { config = JSON.parse(raw); } catch { config = null; }
  if (config === null || typeof config !== 'object') config = { msg: raw };
  const options = { mode: config.mode ?? 'once' };
  if (Number.isFinite(config.uniqueDelay)) options.delay = config.uniqueDelay;
  if (Number.isFinite(config.hold)) options.hold = config.hold;
  return { target: config.q1st || trigger, message: config.msg ?? '', options };
}

/** A selector the page wrote wrong is the page's problem, not a crash. */
function attempt(attr, value, run) {
  try {
    run()?.catch?.((err) => console.warn(`neodigm-conductor: ${attr}="${value}": ${err.message}`));
  } catch (err) {
    console.warn(`neodigm-conductor: ${attr}="${value}": ${err.message}`);
  }
}

function onClick(ev) {
  const doc = this;
  const shaker = triggerOf(ev, TRIGGERS.shake);
  if (shaker) {
    const selector = shaker.getAttribute(TRIGGERS.shake).trim();
    attempt(TRIGGERS.shake, selector, () => shake(selector || shaker, { doc }));
  }
  const typer = triggerOf(ev, TRIGGERS.typeClick);
  if (typer) {
    const { target, message, options } = typeConfig(typer, TRIGGERS.typeClick);
    attempt(TRIGGERS.typeClick, target, () => typeOn(target, message, { ...options, doc }));
  }
  const notifier = triggerOf(ev, TRIGGERS.notify);
  if (notifier) {
    const message = notifier.getAttribute(TRIGGERS.notify);
    const title = notifier.getAttribute('data-n55-notify-title') ?? undefined;
    const icon = notifier.getAttribute('data-n55-notify-icon') ?? undefined;
    if (message) attempt(TRIGGERS.notify, message, () => notify(message, { title, icon }));
  }
}

function onHover(ev) {
  const doc = this;
  const typer = triggerOf(ev, TRIGGERS.typeHover);
  if (!typer) return;
  const { target, message, options } = typeConfig(typer, TRIGGERS.typeHover);
  attempt(TRIGGERS.typeHover, target, () => {
    const el = typeof target === 'string' ? doc.querySelector(target) : target;
    // mouseover repeats for every child crossed; restarting would never finish.
    if (el && !isTyping(el)) return typeOn(el, message, { ...options, doc });
  });
}

/** How many conductors are connected to each document, and its listeners. */
const wired = new Map();

function wire(doc) {
  const entry = wired.get(doc);
  if (entry) { entry.count += 1; return; }
  const click = onClick.bind(doc);
  const hover = onHover.bind(doc);
  doc.addEventListener('click', click);
  doc.addEventListener('mouseover', hover);
  doc.addEventListener('focusin', hover);
  wired.set(doc, {
    count: 1,
    off() {
      doc.removeEventListener('click', click);
      doc.removeEventListener('mouseover', hover);
      doc.removeEventListener('focusin', hover);
    }
  });
}

function unwire(doc) {
  const entry = wired.get(doc);
  if (!entry || --entry.count > 0) return;
  entry.off();
  wired.delete(doc);
}

export class NeodigmConductor extends HTMLElement {
  #doc = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this.shadowRoot.firstChild) {
      this.shadowRoot.innerHTML = '<style>:host { display: none; }</style>';
    }
    this.#doc = this.ownerDocument;
    wire(this.#doc);
  }

  disconnectedCallback() {
    if (this.#doc) unwire(this.#doc);
    this.#doc = null;
  }

  /** Shakes the elements named. See the conductor's `shake`. */
  shake(target) {
    return shake(target, { doc: this.ownerDocument });
  }

  /** Counts each element's number to `value`. See the conductor's `countTo`. */
  countTo(target, value, options = {}) {
    return countTo(target, value, { ...options, doc: this.ownerDocument });
  }

  /** Types a message into the first element named. See the conductor's `typeOn`. */
  typeOn(target, message, options = {}) {
    return typeOn(target, message, { ...options, doc: this.ownerDocument });
  }

  /** Erases the first element named. See the conductor's `typeOff`. */
  typeOff(target, options = {}) {
    return typeOff(target, { ...options, doc: this.ownerDocument });
  }

  /** Shows a system notification. See the conductor's `notify`. */
  notify(message, options = {}) {
    return notify(message, options);
  }
}

if (!customElements.get('neodigm-conductor')) {
  customElements.define('neodigm-conductor', NeodigmConductor);
}
