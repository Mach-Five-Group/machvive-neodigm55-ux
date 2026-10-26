/**
 * Placing a floating surface next to the thing it describes.
 *
 * Deliberately pure: it takes rectangles and returns coordinates, reads nothing
 * from the DOM and touches nothing. That keeps it in the headless conductor —
 * testable in Node, and shared by every floating surface rather than
 * reimplemented in each. The components do the measuring; this does the
 * deciding.
 *
 * The original computed `left` inline inside Tulip's `open()` from
 * `getBoundingClientRect()` and never checked whether the result fitted on
 * screen, so a tip on a trigger near the right edge rendered off the viewport.
 */

/** @typedef {{ x: number, y: number, width: number, height: number }} Rect */
/** @typedef {'top'|'right'|'bottom'|'left'} Side */

/** The order to try when a preferred side does not fit: its opposite first. */
const FALLBACKS = {
  top: ['top', 'bottom', 'right', 'left'],
  bottom: ['bottom', 'top', 'right', 'left'],
  left: ['left', 'right', 'top', 'bottom'],
  right: ['right', 'left', 'top', 'bottom']
};

/** Where the surface would sit on a given side, before any clamping. */
function sideOffset(trigger, surface, side, gap) {
  const midX = trigger.x + trigger.width / 2 - surface.width / 2;
  const midY = trigger.y + trigger.height / 2 - surface.height / 2;
  switch (side) {
    case 'top':    return { x: midX, y: trigger.y - surface.height - gap };
    case 'bottom': return { x: midX, y: trigger.y + trigger.height + gap };
    case 'left':   return { x: trigger.x - surface.width - gap, y: midY };
    default:       return { x: trigger.x + trigger.width + gap, y: midY };
  }
}

const fits = (at, surface, viewport, pad) =>
  at.x >= pad && at.y >= pad &&
  at.x + surface.width <= viewport.width - pad &&
  at.y + surface.height <= viewport.height - pad;

/**
 * Chooses a side and position for a floating surface.
 *
 * Tries the preferred side, then its opposite, then the two perpendicular ones,
 * and takes the first that fits the viewport. If none fits — a surface larger
 * than the space available — it keeps the preferred side and clamps, because
 * a tip half off-screen is still readable and one placed somewhere arbitrary is
 * confusing.
 *
 * @param {object} options
 * @param {Rect} options.trigger The element being described, in viewport coordinates.
 * @param {Rect} options.surface The floating surface's own size.
 * @param {{ width: number, height: number }} options.viewport
 * @param {Side} [options.position] Preferred side.
 * @param {number} [options.gap] Space between trigger and surface.
 * @param {number} [options.pad] Minimum distance from the viewport edge.
 * @returns {{ x: number, y: number, side: Side, flipped: boolean, clamped: boolean }}
 */
export function place({ trigger, surface, viewport, position = 'top', gap = 8, pad = 4 }) {
  const order = FALLBACKS[position] ?? FALLBACKS.top;

  for (const side of order) {
    const at = sideOffset(trigger, surface, side, gap);
    if (fits(at, surface, viewport, pad)) {
      return { ...at, side, flipped: side !== position, clamped: false };
    }
  }

  // Nothing fitted. Keep the author's chosen side and pull it back on screen.
  const at = sideOffset(trigger, surface, position, gap);
  const maxX = Math.max(pad, viewport.width - surface.width - pad);
  const maxY = Math.max(pad, viewport.height - surface.height - pad);
  return {
    x: Math.min(Math.max(at.x, pad), maxX),
    y: Math.min(Math.max(at.y, pad), maxY),
    side: position,
    flipped: false,
    clamped: true
  };
}

/**
 * Reads a DOM element's rectangle in the shape `place` expects.
 *
 * The one DOM-touching function here, kept beside the maths so a component does
 * not have to remember which coordinate space `place` works in. Returns zeroes
 * where there is no layout engine, which is what jsdom reports anyway.
 *
 * @param {Element} el
 * @returns {Rect}
 */
export function rectOf(el) {
  const r = el?.getBoundingClientRect?.();
  return {
    x: r?.left ?? 0,
    y: r?.top ?? 0,
    width: r?.width ?? 0,
    height: r?.height ?? 0
  };
}
