<h1 align="center">machvive-neodigm55-ux</h1>

<p align="center">
  <strong>Remember when the Web was fun?</strong><br>
  The UX for those that think for themselves — Neodigm 55 as dependency-free
  Web Components, by <a href="https://github.com/Mach-Five-Group">MachFiveTech Chicago</a>.
</p>

<p align="center">
  <img alt="dependencies" src="https://img.shields.io/badge/dependencies-0-brightgreen.svg">
  <img alt="types" src="https://img.shields.io/badge/types-included-blue.svg">
</p>

Most component libraries give you parts. [Neodigm 55](https://www.thescottkrause.com/emerging_tech/neodigm55_ux_library/)
does something else: it is **aware of every themed element on the page** and can move
colour and attention across all of them at once — to pull a visitor toward a call to
action, to acknowledge that something happened, to make a page feel alive.

This package is that idea rebuilt as standards-based custom elements, with the
choreography kept as the product rather than discarded as an implementation detail.

```js
import { robinTheme } from '@machfivetechchicago/machvive-neodigm55-ux/conductor';

await robinTheme('brand');   // a wave of colour crosses every themed element, then recedes
```

## Two layers, one contract

**The conductor** owns the palette, the motion gate and the choreography. It has no
custom elements and never touches `HTMLElement`, so it imports in bare Node — a build
step, a CI check or a theme builder can use it with no DOM at all.

**The components** are instruments. They opt into choreography the same way anything
else does: by carrying `data-n55-theme` on the host.

That attribute is the entire contract, which is what keeps this open-ended:

```html
<button data-n55-theme="brand">          <!-- plain HTML        -->
<neodigm-toast data-n55-theme="brand">   <!-- a component here   -->
<my-lit-card data-n55-theme="brand">     <!-- a Lit component    -->
<div data-n55-theme="brand">             <!-- React output       -->
```

All four are swept by the same call. Nothing in the conductor knows what a Neodigm
component is, so adopting it never means adopting a framework.

> **Shadow DOM is deliberately out of reach.** `querySelectorAll` does not cross a
> shadow boundary, so a component is swept by its *host* attribute and styles its
> internals from that (`:host([data-n55-theme="brand"])`) or from the inherited
> custom properties. A test pins this, because it is the one way to use it wrong.

## Install

```bash
npm i @machfivetechchicago/machvive-neodigm55-ux
```

```js
import '@machfivetechchicago/machvive-neodigm55-ux';            // everything
import '@machfivetechchicago/machvive-neodigm55-ux/toast';      // one component
import { robinTheme } from '@machfivetechchicago/machvive-neodigm55-ux/conductor';
```

## The palette

Thirteen themes, carried over unchanged: `brand`, `primary`, `secondary`, `success`,
`white`, `ghost`, `danger`, `warning`, `info`, `disabled`, `night`, `marcom`, `party`.

They install as CSS custom properties rather than living in a JavaScript object, which
is the difference that makes a theme builder possible:

```js
import { installTheme, themeCss } from '@machfivetechchicago/machvive-neodigm55-ux/conductor';

installTheme();                    // --n55-brand, --n55-brand-deep, --n55-brand-ink, …
installTheme({ selector: '#app' }); // or scope it to a container, off :root
themeCss(myPalette, '.promo');     // or emit a stylesheet for a section, or for a build
```

**A scoping selector must match an ancestor of the themed elements**, a container
or `:root`, never a component's tag. The palette reaches into a component's
shadow DOM only by inheritance from outside it, so a component nested inside
another (Tulip's marquee) is reached only through its outer host. A themed
component that the palette doesn't reach logs one `console.warn` naming this;
otherwise it would just look unthemed.

Override `--n55-brand` on a page and every component follows, with no rebuild and no
component aware it happened. `disabled` doubles as the opt-out: an element themed
`disabled` is never choreographed.

Text on a theme colour uses `--n55-<name>-ink` (and `-deep-ink` on the deep shade):
near-black or white, whichever contrasts more, computed by `inkFor()` so a custom
palette stays readable. `contrast()` is exported for auditing a palette in CI.

Every theme has one shade, light or deep, that carries text at WCAG AA (4.5:1) with
its ink. Danger and marcom are mid-tones that miss on the light shade with either
neutral, and pass on the deep one. `--n55-<name>-legible` and `-legible-ink` name
that shade, preferring the light one, so a component can rely on it without knowing
which; `legibleFor(theme)` gives the same answer in Node.

### Light and dark

Components follow the `color-scheme` they inherit, per instance, with no JavaScript.
Surfaces that are not a theme colour — Buffet's top row, an unthemed selection — come
from `--n55-surface`, `--n55-surface-ink`, `--n55-line`, `--n55-inverse` and
`--n55-inverse-ink`, each a `light-dark()` pair.

```html
<html style="color-scheme: light dark">        <!-- follow the OS -->
<html data-n55-scheme="dark">                   <!-- pin the page -->
<aside data-n55-scheme="dark">                  <!-- or one section -->
<neodigm-buffet data-n55-scheme="light">        <!-- or one instance -->
```

The palette never sets `color-scheme` on `:root` itself, because that also restyles
the page's scrollbars and form controls. Theme colours and their inks are the same in
both modes.

## Toast

```html
<neodigm-toast></neodigm-toast>
<button data-n55-toast="Saved ✨" data-n55-theme="success">Save</button>
```

```js
document.querySelector('neodigm-toast')
  .show('Saved ✨', { theme: 'success' })
  .show('Queued behind it', { duration: 3000 });
```

Queued, with the original's debounce — the same message twice in a row is the same
notification. `|` breaks the line. **Message text is never parsed as HTML**, unlike the
original's `innerHTML`, because toast text is routinely built from user input.

## Buffet

A full-width, two-level menu driven by metadata. The top row divides its
container's width evenly; the selection's children sit below at half the height.
Both levels keep a selection, and each item remembers its last child.

```html
<neodigm-buffet data-n55-theme="brand" data-n55-buffet='[
  {"token":"shows","caption":"Shows","selected":true,"secondary":[
    {"token":"live","caption":"Live"},{"token":"vod","caption":"VOD"}]},
  {"token":"people","caption":"People","count":3,"theme":"marcom"}
]'></neodigm-buffet>
```

```js
const menu = document.querySelector('neodigm-buffet');
menu.addEventListener('neodigm-buffet-select', (e) => {
  if (hasUnsavedWork()) e.preventDefault();      // cancelable, at either level
  else route(e.detail.primary, e.detail.secondary);
});
menu.select('shows', 'vod');                     // sync to a route, silently
menu.items = relabelled;                         // selection survives where tokens do
menu.updateCount('people', 4);
```

The theme on the host colours the whole menu, so a sweep moves across it as one
instrument. An item's own `theme` is an accent that a sweep does not reach. Height
is `--n55-buffet-height` (default `64px`). Sticky positioning is left to the page.

## SodaPop

Popups from templates, in the original's declarative format. One element serves
every trigger on the page.

```html
<neodigm-sodapop></neodigm-sodapop>

<button data-n55-sodapop-id="myPopup_id" aria-haspopup="dialog">Try Me</button>

<template id="myPopup_id" data-n55-sodapop-modal="false"
  data-n55-sodapop-size="small" data-n55-sodapop-fullscreen="false">
  YOUR CONTENT HERE
</template>
```

```js
const pop = document.querySelector('neodigm-sodapop');
pop.show('myPopup_id').shake();      // was neodigmSodaPop.autoOpen(id).shake()
pop.close();                         // the only way a modal popup closes
pop.addEventListener('neodigm-sodapop-close', (e) => {
  if (e.detail.id === 'checkout' && hasUnsavedWork()) e.preventDefault();
});
```

| Template attribute | Values |
| --- | --- |
| `data-n55-sodapop-modal` | `true`: the scrim and Escape shake it instead of closing, and there is no X |
| `data-n55-sodapop-size` | `xsmall` \| `small` \| `medium` (default) \| `large` |
| `data-n55-sodapop-fullscreen` | `true`: full screen while open, when opened by a user gesture |
| `data-n55-sodapop-transition` | `slide-right`: a full-height drawer from the right |
| `data-n55-scheme` | `light` \| `dark`: pins this popup's surface |

**Migrating from the original:**
- Replace `<neodigm-sodapop-scrim>` and `<neodigm-sodapop-scrim-close>` with one
  `<neodigm-sodapop>`.
- The callbacks become events, each with `e.detail.id`:
  - `setOnBeforeOpen` becomes `neodigm-sodapop-open`, which is cancelable.
  - `setOnAfterOpen` becomes `neodigm-sodapop-opened`.
  - `setOnClose` becomes `neodigm-sodapop-close`, which is cancelable. Its
    `e.detail.reason` is `scrim`, `escape`, `close`, `api` or `replace`.
- Template content is cloned. Scripts in it are dropped, as they never ran
  under the original's `innerHTML`.
- `setOnBeforeUserExit` is now `onExitIntent()` in the conductor (below).
- To lock page scroll while a popup is open, add
  `body:has(neodigm-sodapop[open]) { overflow: hidden }` to the page.

### Exit intent

`setOnBeforeUserExit` belonged to the page, not the popup, so it moved to the
conductor:

```js
import { onExitIntent } from '@machfivetechchicago/machvive-neodigm55-ux/conductor';

const off = onExitIntent(() => toast.show('Thanks for visiting|Bookmark us!', { theme: 'info' }));
```

It fires when the pointer leaves through the top of the page, once per tab session
by default (`{ once: 'page' }` for once per load). It uses the original's storage key,
so a visitor partway through a session on a migrated site isn't asked twice. Unlike the
original, it ignores the other three edges (a second monitor isn't leaving), and
any number of subscribers can listen.

## SideDish

A scrollable panel that slides in from the right over its container — 40% of the
width, full height — with a scrim over the rest. The scrim, Escape and the X close it.

```html
<main style="position: relative">
  <neodigm-side-dish label="Filters" data-n55-theme="brand">
    <h2 slot="title">Filters</h2>
    …content; the panel scrolls…
  </neodigm-side-dish>
</main>
```

```js
const dish = document.querySelector('neodigm-side-dish');
dish.show();
dish.addEventListener('neodigm-side-dish-close', (e) => {
  if (hasUnsavedWork()) e.preventDefault();        // cancelable; e.detail.reason says
});                                                // 'scrim', 'escape', 'close' or 'api'
```

The host covers its containing block, so give the container a position; style the
host `position: fixed` to cover the viewport instead. Width is
`--n55-side-dish-width` (default `40%`). The panel is a light/dark surface; the theme
colours the X, on its legible shade. Escape closes only the most recently opened
panel. Focus moves into the panel and comes back on close, but Tab is not trapped.

## Poptart

A floating surface beside the element that opened it. Each Poptart holds its own
content, which stays in the page while it is closed, so a form inside keeps what was
typed. Triggers name it by id:

```html
<button data-n55-poptart-click="js-signin">Sign in</button>
<a data-n55-poptart-hover="js-about" href="/about">About</a>
<div data-n55-poptart-rightclick="js-menu">Right-click me</div>

<neodigm-poptart id="js-signin"
  data-n55-poptart='{"w": 256, "h": 284, "position": "bottom", "offset": {"x": 0, "y": 0}}'>
  …content; it scrolls if taller than h…
</neodigm-poptart>
```

```js
const pop = document.getElementById('js-signin');
pop.show(button);                  // was neodigmPopTart.autoOpen(el, conf, bound)
pop.addEventListener('neodigm-poptart-open', (e) => {
  if (busy) e.preventDefault();    // cancelable; also replaces pause()
});
```

| `data-n55-poptart` key | Meaning |
| --- | --- |
| `position` | `top` \| `right` \| `bottom` (default) \| `left`. Binding: nothing moves it to another side |
| `align` | `start` \| `center` \| `end` along the trigger. Default `center` above and below, `start` (top edges level) beside |
| `w`, `h` | Size in px. Without `w` it is as wide as the trigger; without `h`, as tall as its content |
| `offset` | `{x, y, w, h}` in px: `x` and `y` move it, `w` and `h` add to the size |
| `x`, `y` | Pin that edge to a viewport coordinate, ignoring side and offsets |
| `z` | z-index |

It is never modal: a click outside, Escape or `close()` closes it, and its click
trigger toggles it. Opening one Poptart closes any other. It follows its trigger when
the page scrolls or resizes. Without a theme of its own it takes its trigger's, which
colours the border; the surface is light/dark.

**Migrating from the original:**
- Rename `<neodigm-template id="…" data-n55-poptart='…'>` to
  `<neodigm-poptart id="…" data-n55-poptart='…'>`. Triggers are unchanged.
- The original read `offset.l` and `offset.t`, where a positive `t` moved it *up*.
  Both are still read. Its `top` placement subtracted the trigger's height twice, and
  `left`/`right` sat flush only when the Poptart was as wide as the trigger; markup
  that compensated for either with an offset needs the offset removed.
- `x` and `y` are now the coordinate itself; the original then moved it by the side.
- The callbacks become events, each with `e.detail.id` and `e.detail.trigger`:
  `setOnBeforeOpen` is `neodigm-poptart-open` (cancelable), `setOnAfterOpen` is
  `neodigm-poptart-opened`, `setOnClose` is `neodigm-poptart-close` (cancelable,
  with `e.detail.reason`: `outside`, `escape`, `trigger`, `api` or `replace`).
- `pause()` and `play()` are gone: veto `neodigm-poptart-open` instead. `arrow` and
  `dismiss` were never implemented and are still ignored.
- Place it outside transformed or filtered containers, which would capture its fixed
  positioning.

## Icons and ActIcon

`<neodigm-icon>` draws an icon from CSS, with no icon font. `<neodigm-acticon>` is the
original's round, themed icon button around one.

```html
<neodigm-icon name="search"></neodigm-icon>
<neodigm-icon name="send" label="Send"></neodigm-icon>        <!-- an image, not decoration -->

<neodigm-acticon data-n55-theme="brand" data-n55-size="small" icon="settings"
  label="Settings" data-n55-poptart-click="js-settings"></neodigm-acticon>
```

The 44 built-in icons are Google's Material Symbols (Outlined, Apache-2.0), the same
set as `machvive-chat-syncopation`. `ICON_NAMES` in the conductor lists them. Each is
a mask over `currentColor`, so it takes the colour of whatever it sits in, and a
`<neodigm-icon>` with a `data-n55-theme` of its own takes that theme's colour. Size is
`--n55-icon-size` (default `24px`).

The set is `--n55-icon-<name>` custom properties, and the built-in shape is only the
fallback, so a page replaces an icon or adds one with CSS:

```css
:root { --n55-icon-rocket: url("data:image/svg+xml,…"); }
```

A name that is neither built in nor defined draws nothing and logs one warning.

### Icons as pure CSS

No JavaScript, no component: the set also ships as a stylesheet,
`icons.css`, so a page can put an icon on any element it already has.

```css
/* with a bundler (Vite, webpack, Parcel, esbuild) */
@import "@machfivetechchicago/machvive-neodigm55-ux/icons.css";
```

```html
<!-- without one: from node_modules, or from a CDN that serves npm packages -->
<link rel="stylesheet" href="/node_modules/@machfivetechchicago/machvive-neodigm55-ux/src/icons.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@machfivetechchicago/machvive-neodigm55-ux@0.1.9/src/icons.css">
```

It defines one custom property per icon on `:root`, `--n55-icon-<name>`, holding the
icon as a data-URI SVG. There are three ways to use it.

**As a mask, which takes the element's text colour.** This is the usual way: one
icon, any colour, light or dark, themed or not.

```css
.search-field::before {
  content: "";
  display: inline-block;
  inline-size: 20px;
  block-size: 20px;
  background-color: currentColor;          /* the icon's colour */
  -webkit-mask: var(--n55-icon-search) center / contain no-repeat;
  mask: var(--n55-icon-search) center / contain no-repeat;
}
.danger-zone .icon { color: var(--n55-danger); }   /* recolour by setting color */
```

**As a background image, exactly as drawn.** The icons are black, with no colour of
their own, so this suits a light surface where black is what you want.

```css
.empty-state {
  background: var(--n55-icon-folder-open) no-repeat center / 64px;
}
```

**With the classes it provides**, when you would rather not write CSS:

```html
<span class="n55-icon n55-icon-search"></span>
<button><span class="n55-icon n55-icon-send" style="--n55-icon-size: 18px"></span> Send</button>
```

`.n55-icon` does the drawing and needs one `.n55-icon-<name>` beside it; on its own it
draws nothing. It is `--n55-icon-size` square (default `24px`) and takes `currentColor`.
These are decorative: give the button or link around them its accessible name.

**A two-state caret.** `arrow-drop-down` and `arrow-drop-up` are a pair, for a
disclosure, a dropdown or a sortable column:

```css
/* A two-state caret: down while closed, up while open. No JavaScript beyond
   whatever already sets aria-expanded on the button. */
.disclosure::after {
  content: "";
  display: inline-block;
  inline-size: 24px;
  block-size: 24px;
  background-color: currentColor;
  -webkit-mask: var(--n55-icon-arrow-drop-down) center / contain no-repeat;
  mask: var(--n55-icon-arrow-drop-down) center / contain no-repeat;
}
.disclosure[aria-expanded="true"]::after {
  -webkit-mask-image: var(--n55-icon-arrow-drop-up);
  mask-image: var(--n55-icon-arrow-drop-up);
}
```

With the classes, switch the glyph instead:

```html
<button class="disclosure" aria-expanded="false">
  Details <span class="n55-icon n55-icon-arrow-drop-down"></span>
</button>
```

```css
.disclosure[aria-expanded="true"] .n55-icon { --n55-glyph: var(--n55-icon-arrow-drop-up); }
```

To replace an icon, or add one, define the property after the stylesheet loads:

```css
:root { --n55-icon-rocket: url("data:image/svg+xml,…"); }
```

```html
<span class="n55-icon" style="--n55-glyph: var(--n55-icon-rocket)"></span>
```

`<neodigm-icon>` reads the same properties, so an override reaches both. It does not
need the stylesheet: without it, the component falls back to its built-in shapes.
`iconCss()` in the conductor emits a set of your own in the same form, for a build step.

| ActIcon attribute | Values |
| --- | --- |
| `data-n55-size` | `pico` 14px \| `micro` 18 \| `milli`, `xsmall` (default) 24 \| `small` 29 \| `medium` 35 \| `large` 42 \| `xlarge` 50 |
| `data-n55-theme` | any theme. `ghost` is an outline; `disabled` is greyed, unfocusable and `aria-disabled` |
| `icon` | the icon's name, instead of a `<neodigm-icon>` child |
| `label` | its accessible name. Without one, the icon's name is used (`chevron right`) |

It is a button: focusable, and Enter or Space clicks it, so the Tulip, Poptart and
Toast triggers on it work from the keyboard. The glyph is the theme's ink, which
clears WCAG's 3:1 for graphics on every theme.

**Migrating from the original:**
- Drop the Material Symbols font. `<neodigm-icon class="material-symbols-outlined">dark_mode</neodigm-icon>`
  still works: the text inside is read as the name, in either spelling.
- The set has 44 icons, not the font's thousands. Define `--n55-icon-<name>` for any
  other; the warning names the missing one.
- `data-n55-ampm-theme` is replaced by `color-scheme`, as everywhere in this package.

## The conductor element: shake, count, type, notify

`<neodigm-conductor>` is the original's `neodigmUtils` effects, in markup. It draws
nothing: while one is on the page it wires the triggers below, and its methods call
the conductor module, which also exports each effect for pages that would rather
write JavaScript.

```html
<neodigm-conductor></neodigm-conductor>

<button data-n55-shake="#logo">Shake the logo</button>   <!-- empty: shakes itself -->
<button data-n55-typeon-click='{"q1st": "#tagline", "msg": "Fast|Small|Yours", "mode": "LOOP"}'>Type</button>
<h2 data-n55-typeon-hover='{"msg": "Hello there"}'>Hover me</h2>
<button data-n55-notify="Your export is ready" data-n55-notify-title="Exports">Notify me</button>
```

```js
import { shake, countTo, typeOn, typeOff, notify }
  from '@machfivetechchicago/machvive-neodigm55-ux/conductor';

await shake('#logo');                                   // was neodigmUtils.shake(q)
await countTo('#spend', 4609, { format: new Intl.NumberFormat().format });
await typeOn('#tagline', 'Fast|Small|Yours', { mode: 'loop', delay: 80, hold: 1500 });
await typeOff('#tagline');
await notify('Your export is ready', { title: 'Exports' });  // from a click
```

| Effect | What it does | Under reduced motion |
| --- | --- | --- |
| `shake(target)` | Four 0.2s shakes, from wherever the element stands | nothing |
| `countTo(target, value)` | Sixteen whole-number steps, 116ms apart, landing on `value` | lands at once |
| `typeOn(target, msg)` | Types; `\|` separates phrases, erased between. Modes `once`, `loop`, `random`, `off` | the final phrase appears whole |
| `typeOff(target)` | Erases | empties at once |
| `notify(msg)` | A system notification, asking permission first | the same |

`target` is a selector, an element or a list; `typeOn` and `typeOff` take the first
match, as the original's `q1st` did. A trigger themed `disabled` does nothing.

- **Shake an inline element** by giving it `display: inline-block`: a transform does
  not apply to an inline box.
- **Typed text is read whole.** While typing, the phrase sits in a visually hidden
  span and the letters in an `aria-hidden` one, so a screen reader hears each phrase
  once; when it finishes the element is plain text again. `data-n55-typeon` is the
  index of the phrase showing, for styling each one.
- **A typed element collapses when it empties** unless it has a `min-block-size`.
- **`notify` must run from a click or a key**, or the browser will not ask. It
  resolves `'shown'`, `'denied'`, `'default'` (dismissed) or `'unsupported'`.
- **Hover also fires on keyboard focus**, and does not restart text still typing.

**Migrating from the original:**
- `neodigmUtils.shake(q)` → `shake(q)`. The `shake__an` class and its global CSS are
  gone; it no longer replaces the element's own `transform`, so a centred element
  stays centred. Haptics and sound are not wired.
- `neodigmUtils.countTo(q, n, t)` → `countTo(q, n, { interval: t })`. Steps are now
  even: the original moved by `round(diff / 16)` and snapped at the end.
- `neodigmUtils.typeOn({q1st, msg, uniqueDelay, mode})` →
  `typeOn(q1st, msg, { delay: uniqueDelay, mode })`. The trigger attributes take the
  original's JSON unchanged. Phrases now type, hold (`hold`, default 1500ms), erase
  and type in sequence, where the original's erase raced the typing; and the
  element's `height` is no longer pinned inline.
- `neodigmUtils.messageNotification(msg, icon, title)` → `notify(msg, { icon, title })`.
  There is no default icon: the original fetched a GitHub avatar for each one.
- The other utils (`isMobile`, `genHash`, `capFirst`, `prettyTime`, `isJSON`,
  `fAsyncJS`…) are not ported; the platform covers each.

## What changed in the port

| | Original | Here |
| --- | --- | --- |
| Markup | required `<div id="js-snackbar__id">` on the page | the element renders its own |
| Styling | global `.snackbar__cont--*` classes | scoped to a shadow root |
| Theme | hex values in a JS object | CSS custom properties |
| Sound, haptics, GTM | always on, via four other modules | opt-in, none wired by default |
| Reduced motion | a `// TODO` above `robinTheme` | respected; the sweep is suppressed, the signal is not |
| Sweep timing | each element held the colour for `index × 56ms`, so the first never visibly changed | constant `hold`, so the wave keeps its shape |
| Message text | `innerHTML` | text nodes |

## Using the files directly

Every file is published as authored, so a page that can't load modules (a
single-file build, or a strict security policy) can vendor them. What each
component needs from the conductor when it runs, counting what those modules
import in turn, and the `part` names it exposes for `::part()` styling:

| Component | Conductor modules at runtime | Parts |
| --- | --- | --- |
| `neodigm-toast` | theme, motion, choreography | message |
| `neodigm-marquee` | theme, motion | view |
| `neodigm-tulip` | theme, anchor | marquee, message |
| `neodigm-buffet` | theme | primary, secondary |
| `neodigm-side-dish` | theme, motion | body, close, header, panel, scrim |
| `neodigm-sodapop` | theme, motion | close, popup, scrim |
| `neodigm-poptart` | theme, anchor, motion | popup |
| `neodigm-icon` | theme, icons | glyph |
| `neodigm-acticon` | theme, icons | icon |
| `neodigm-conductor` | effects, motion, notify, theme | — |

ActIcon renders `<neodigm-icon>`, so vendoring it means vendoring that file too.

Part names are public API: removing or renaming one is a breaking change. A
test keeps this table in step with the code.

Importing a module has no effect beyond defining it: a component file registers
its tag (guarded by `customElements.get`, so loading it twice is harmless), and
the conductor does nothing until called.

## Browser support

Anywhere `customElements`, Shadow DOM and CSS custom properties work. No build step, no
framework, no runtime dependencies — the files published are the files that run.

## More from MachFiveTech

Everything we publish is listed at **[npmx.dev/~machfivetech](https://npmx.dev/~machfivetech)**:
this package, [machvive-webmcp-ai](https://www.npmjs.com/package/@machfivetechchicago/machvive-webmcp-ai)
for making a page callable by an AI agent, and
[machvive-chat-syncopation-ai](https://www.npmjs.com/package/@machfivetechchicago/machvive-chat-syncopation-ai)
for building chat surfaces. All three are dependency-free web components.

## Licence

[Apache-2.0](LICENSE) © MachFiveTech Chicago. Ported from
[neodigm55](https://github.com/arcanus55/neodigm55) by Arcanus 55, Inc.
