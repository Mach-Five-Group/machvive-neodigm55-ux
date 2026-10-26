/**
 * Bulk entry point: imports every component (registering its tag) and
 * re-exports the conductor.
 *
 * Importing this evaluates `class extends HTMLElement`, so it needs a DOM.
 * For a build step, a CI check or a theme-builder script, import
 * `@machfivetechchicago/machvive-neodigm55-ux/conductor` instead — it has no
 * DOM dependency and loads in bare Node.
 */
import { NeodigmToast, DEFAULT_DURATION } from './src/wc/neodigm-toast/neodigm-toast.js';
import { NeodigmMarquee, DEFAULT_SPEED, parseRuns, plainText } from './src/wc/neodigm-marquee/neodigm-marquee.js';

export { NeodigmToast, DEFAULT_DURATION };
export { NeodigmMarquee, DEFAULT_SPEED, parseRuns, plainText };
export {
  THEMES, THEME_NAMES, OPT_OUT, THEME_ATTR, PULSE_ATTR,
  themeCss, installTheme, resolveTheme,
  motionAllowed, setMotionAllowed, pause, play, onMotionChange, resetMotion,
  robinTheme, pulseTheme, flashTitle, resetTitle
} from './src/conductor/index.js';
