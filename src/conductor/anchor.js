/**
 * Placing a floating surface next to the thing it describes.
 *
 * Deliberately pure: it takes rectangles and returns coordinates, reads nothing
 * from the DOM and touches nothing. That keeps it in the headless conductor —
 * testable in Node, and shared by every floating surface rather than
 * reimplemented in each. The components do the measuring; this does the maths.
 *
 * It does not decide anything. The side is declared, and whether the result
 * fits is the designer's call, made with the offsets — so there is no viewport
 * check, no flipping and no clamping. An earlier version of this port moved a
 * tip to another side near a viewport edge, overriding the declared position.
 */

/** @typedef {{ x: number, y: number, width: number, height: number }} Rect */
/** @typedef {'top'|'right'|'bottom'|'left'} Side */

/** The sides a surface can take. Shared, so a validator and `place` cannot disagree. */
export const SIDES = Object.freeze(['top', 'right', 'bottom', 'left']);

/** Where along the trigger's edge a surface lines up. */
export const ALIGNS = Object.freeze(['start', 'center', 'end']);

/**
 * Where a floating surface sits on the declared side of its trigger: lined up
 * along the trigger's edge as `align` says, `gap` away from it, then moved by
 * the offsets. `start` lines up the left edges above or below the trigger,
 * and the top edges beside it.
 *
 * @param {object} options
 * @param {Rect} options.trigger The element being described, in viewport coordinates.
 * @param {Rect} options.surface The floating surface's own size.
 * @param {Side} [options.position] The side. Anything else is `top`.
 * @param {'start'|'center'|'end'} [options.align] Anything else is `center`.
 * @param {number} [options.gap] Space between trigger and surface.
 * @param {number} [options.offsetX] Added to x, in pixels. The designer's adjustment.
 * @param {number} [options.offsetY] Added to y, in pixels.
 * @returns {{ x: number, y: number, side: Side }}
 */
export function place({
  trigger, surface, position = 'top', align = 'center', gap = 8, offsetX = 0, offsetY = 0
}) {
  const side = SIDES.includes(position) ? position : 'top';
  // How far along the edge: 0 at the start, 1 at the end.
  const k = ALIGNS.includes(align) ? ALIGNS.indexOf(align) / 2 : 0.5;
  const alongX = trigger.x + (trigger.width - surface.width) * k;
  const alongY = trigger.y + (trigger.height - surface.height) * k;
  const at = {
    top:    { x: alongX, y: trigger.y - surface.height - gap },
    bottom: { x: alongX, y: trigger.y + trigger.height + gap },
    left:   { x: trigger.x - surface.width - gap, y: alongY },
    right:  { x: trigger.x + trigger.width + gap, y: alongY }
  }[side];
  return { x: at.x + offsetX, y: at.y + offsetY, side };
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
