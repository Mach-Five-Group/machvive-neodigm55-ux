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
themeCss(myPalette, '.promo');     // or emit a stylesheet for a section, or for a build
```

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
- `setOnBeforeUserExit` is not ported.
- To lock page scroll while a popup is open, add
  `body:has(neodigm-sodapop[open]) { overflow: hidden }` to the page.

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

## Browser support

Anywhere `customElements`, Shadow DOM and CSS custom properties work. No build step, no
framework, no runtime dependencies — the files published are the files that run.

## Licence

[Apache-2.0](LICENSE) © MachFiveTech Chicago. Ported from
[neodigm55](https://github.com/arcanus55/neodigm55) by Arcanus 55, Inc.
