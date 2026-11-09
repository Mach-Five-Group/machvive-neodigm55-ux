import type { EffectTarget, CountOptions, TypeOptions } from '../../conductor/effects.js';
import type { NotifyResult } from '../../conductor/notify.js';

/**
 * The conductor, declared in markup. Draws nothing; while connected it wires
 * `data-n55-shake`, `data-n55-typeon-click`, `data-n55-typeon-hover` and
 * `data-n55-notify` triggers. Its methods call the conductor module.
 */
export class NeodigmConductor extends HTMLElement {
  shake(target: EffectTarget): Promise<number>;
  countTo(target: EffectTarget, value: number, options?: Omit<CountOptions, 'doc'>): Promise<number>;
  typeOn(target: string | Element, message: string, options?: Omit<TypeOptions, 'doc'>): Promise<boolean>;
  typeOff(target: string | Element, options?: { delay?: number }): Promise<boolean>;
  notify(message: string, options?: { title?: string; icon?: string } & Omit<NotificationOptions, 'body'>): Promise<NotifyResult>;
}

declare global {
  interface HTMLElementTagNameMap {
    'neodigm-conductor': NeodigmConductor;
  }
}
