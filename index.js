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
import { NeodigmTulip, TULIP_DEFAULTS, readConfig, configFrom } from './src/wc/neodigm-tulip/neodigm-tulip.js';
import { NeodigmBuffet, readItems } from './src/wc/neodigm-buffet/neodigm-buffet.js';
import { NeodigmSideDish } from './src/wc/neodigm-side-dish/neodigm-side-dish.js';
import { NeodigmSodaPop, readPopup } from './src/wc/neodigm-sodapop/neodigm-sodapop.js';
import { NeodigmPoptart, readPoptart, triggerFor } from './src/wc/neodigm-poptart/neodigm-poptart.js';
import { NeodigmIcon, resetIconWarning } from './src/wc/neodigm-icon/neodigm-icon.js';
import { NeodigmActIcon, ACTICON_SIZES } from './src/wc/neodigm-acticon/neodigm-acticon.js';

export { NeodigmToast, DEFAULT_DURATION };
export { NeodigmMarquee, DEFAULT_SPEED, parseRuns, plainText };
export { NeodigmTulip, TULIP_DEFAULTS, readConfig, configFrom };
export { NeodigmBuffet, readItems };
export { NeodigmSideDish };
export { NeodigmSodaPop, readPopup };
export { NeodigmPoptart, readPoptart, triggerFor };
export { NeodigmIcon, resetIconWarning };
export { NeodigmActIcon, ACTICON_SIZES };
export {
  THEMES, THEME_NAMES, OPT_OUT, THEME_ATTR, PULSE_ATTR,
  INK_DARK, INK_LIGHT, contrast, inkFor, WCAG_AA, legibleFor, NEUTRALS, SCHEME_ATTR,
  themeCss, installTheme, resolveTheme, paletteReaches, resetPaletteWarning,
  motionAllowed, setMotionAllowed, pause, play, onMotionChange, resetMotion,
  robinTheme, pulseTheme, flashTitle, resetTitle,
  place, rectOf, SIDES, ALIGNS, onExitIntent, EXIT_KEY,
  ICONS, ICON_NAMES, iconName, iconCss
} from './src/conductor/index.js';
