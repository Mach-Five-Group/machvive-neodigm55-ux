import type { Side, Align } from '../../conductor/anchor.js';

/** A Poptart's `data-n55-poptart` JSON, as read. */
export interface PoptartConfig {
  /** The declared side, which is binding. Missing or unknown is `bottom`. */
  position: Side;
  /** Along the trigger's edge. Default `center` above and below, `start` beside. */
  align: Align;
  /** Width in px. Absent: the trigger's width plus `offset.w`. */
  w: number | null;
  /** Height in px, plus `offset.h`. Absent: as tall as its content. */
  h: number | null;
  /** Pins the left edge to this viewport coordinate, ignoring the side and offsets. */
  x: number | null;
  /** Pins the top edge to this viewport coordinate, ignoring the side and offsets. */
  y: number | null;
  /** z-index. Absent: the component's own. */
  z: number | null;
  /** `offsetX` + `offset.x` + `offset.l`. Positive moves right. */
  offsetX: number;
  /** `offsetY` + `offset.y` − `offset.t`. Positive moves down; the original's `t` moved up. */
  offsetY: number;
  offsetW: number;
  offsetH: number;
}

export type PoptartTrigger = 'click' | 'hover' | 'rightclick';

export interface PoptartOpenDetail { id: string; trigger: Element | null }
export interface PoptartCloseDetail {
  id: string;
  trigger: Element | null;
  reason: 'outside' | 'escape' | 'trigger' | 'api' | 'replace';
}

/** Reads the JSON. Never throws; anything unusable is the default. */
export function readPoptart(raw: string | null): PoptartConfig;

/** The nearest trigger of this kind naming this id, or null. Disabled triggers open nothing. */
export function triggerFor(node: Node | null, id: string, kind: PoptartTrigger): Element | null;

export class NeodigmPoptart extends HTMLElement {
  /** Whether it is showing. */
  readonly open: boolean;
  /** The element it is showing beside, or null when closed. */
  readonly trigger: Element | null;
  /** Opens beside a trigger (default: the last one, else the first naming it). False if vetoed. */
  show(target?: Element | string): boolean;
  /** Closes it. False if it was not open or a listener vetoed it. */
  close(reason?: PoptartCloseDetail['reason']): boolean;
  /** Shakes it, if open. Does nothing when motion is suppressed. */
  shake(): this;
}

declare global {
  interface HTMLElementTagNameMap { 'neodigm-poptart': NeodigmPoptart }
  interface HTMLElementEventMap {
    /** Cancelable. Replaces `setOnBeforeOpen`, and `pause()`. */
    'neodigm-poptart-open': CustomEvent<PoptartOpenDetail>;
    /** Replaces `setOnAfterOpen`. */
    'neodigm-poptart-opened': CustomEvent<PoptartOpenDetail>;
    /** Cancelable. Replaces `setOnClose`. */
    'neodigm-poptart-close': CustomEvent<PoptartCloseDetail>;
  }
}
