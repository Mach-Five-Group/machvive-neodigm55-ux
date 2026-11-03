export interface Rect { x: number; y: number; width: number; height: number }
export type Side = 'top' | 'right' | 'bottom' | 'left';

/** The sides a surface can take, shared by `place` and Tulip's config reader. */
export const SIDES: readonly Side[];

export type Align = 'start' | 'center' | 'end';

/** Where along the trigger's edge a surface lines up. */
export const ALIGNS: readonly Align[];

export interface Placement {
  x: number;
  y: number;
  /** Always the side asked for. */
  side: Side;
}

/**
 * The surface's position on the declared side of its trigger, moved by the
 * offsets. No viewport check, no flipping, no clamping: fit is the designer's
 * call, made with the offsets. Pure: no DOM.
 */
export function place(options: {
  trigger: Rect;
  surface: Rect;
  position?: Side;
  /** Along the trigger's edge. `start` is the left edge above or below, the top edge beside. Default `center`. */
  align?: Align;
  gap?: number;
  /** Added to x, in pixels. */
  offsetX?: number;
  /** Added to y, in pixels. */
  offsetY?: number;
}): Placement;

/** Reads an element's rectangle in the shape `place` expects. */
export function rectOf(el: Element): Rect;
