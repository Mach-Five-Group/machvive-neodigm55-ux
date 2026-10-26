export interface Rect { x: number; y: number; width: number; height: number }
export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface Placement {
  x: number;
  y: number;
  /** The side actually used, which may differ from the one asked for. */
  side: Side;
  /** True when the preferred side did not fit and another was chosen. */
  flipped: boolean;
  /** True when no side fitted and the surface was pulled back on screen. */
  clamped: boolean;
}

/** Chooses a side and position for a floating surface. Pure: no DOM. */
export function place(options: {
  trigger: Rect;
  surface: Rect;
  viewport: { width: number; height: number };
  position?: Side;
  gap?: number;
  pad?: number;
}): Placement;

/** Reads an element's rectangle in the shape `place` expects. */
export function rectOf(el: Element): Rect;
