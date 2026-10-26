/**
 * The conductor: everything that is not a component.
 *
 * This subpath deliberately contains **no custom element and no reference to
 * HTMLElement**, so it imports cleanly in Node — a build step, a CI check or a
 * theme-builder script can generate a stylesheet or reason about the palette
 * with no DOM at all. Importing `./toast` evaluates `class extends HTMLElement`
 * at module load and would throw there. A test pins both halves of that.
 */
export {
  THEMES, THEME_NAMES, OPT_OUT, THEME_ATTR, PULSE_ATTR,
  themeCss, installTheme, resolveTheme
} from './theme.js';

export {
  motionAllowed, setMotionAllowed, pause, play, onMotionChange, resetMotion
} from './motion.js';

export {
  robinTheme, pulseTheme, flashTitle, resetTitle
} from './choreography.js';

export { place, rectOf } from './anchor.js';
