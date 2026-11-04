---
name: machvive-neodigm55
description: Build pages with the Neodigm 55 UX web components (@machfivetechchicago/machvive-neodigm55-ux) — a page-level choreographer that sweeps colour across every themed element, plus toast, marquee, tooltip, menu, popup, panel and popover components. Use this whenever the user mentions Neodigm, neodigm55, machvive UX, robinTheme, data-n55-theme, or any of the tags neodigm-toast, neodigm-marquee, neodigm-tulip, neodigm-buffet, neodigm-sodapop, neodigm-side-dish or neodigm-poptart — even when they don't name the package. Also use when someone is porting the original Neodigm 55 IIFE library to web components, asking how to theme a page so attention moves across it, building a theme builder on CSS custom properties, or debugging why a component renders unthemed or why a colour sweep misses something.
---

# Neodigm 55 UX components

`@machfivetechchicago/machvive-neodigm55-ux` is the [Neodigm 55](https://www.thescottkrause.com/emerging_tech/neodigm55_ux_library/)
UX library rebuilt as dependency-free ESM web components. No framework, no build
step, no runtime dependencies.

## The thing to understand first

**This is not a component library that happens to have themes. It is a page
choreographer whose components are instruments.** The library knows about every
themed element on the page and can move colour across all of them at once, to pull a
visitor toward a call to action or acknowledge that something happened.

```js
import { robinTheme } from '@machfivetechchicago/machvive-neodigm55-ux/conductor';
await robinTheme('brand');   // a wave crosses every themed element, then recedes
```

If you only wire up components and never use the choreography, the user has adopted
a worse Shoelace. Suggest `robinTheme` when they want to draw attention somewhere.

## Two layers, one contract

**The conductor** (`/conductor`) owns the palette, motion gate, placement maths and
choreography. It has **no custom elements and never touches `HTMLElement`**, so it
imports in bare Node — a build step, a CI check or a theme builder can use it with no
DOM. Never add DOM dependencies to it; a test pins this both ways.

**The components** opt in by carrying `data-n55-theme` on their **host**.

That attribute is the whole contract, so anything can participate:

```html
<button data-n55-theme="brand">          <!-- plain HTML     -->
<neodigm-toast data-n55-theme="brand">   <!-- a component     -->
<my-lit-card data-n55-theme="brand">     <!-- Lit             -->
<div data-n55-theme="brand">             <!-- React output    -->
```

One `robinTheme()` sweeps all four.

## Install

```bash
npm i @machfivetechchicago/machvive-neodigm55-ux
```

```js
import '@machfivetechchicago/machvive-neodigm55-ux';            // everything
import '@machfivetechchicago/machvive-neodigm55-ux/toast';      // one component
import { robinTheme, installTheme } from '@machfivetechchicago/machvive-neodigm55-ux/conductor';
```

Subpaths: `/conductor`, `/toast`, `/marquee`, `/tulip`, `/buffet`, `/side-dish`,
`/sodapop`, `/poptart`.

Importing a component registers its tag. There is nothing to call.

## The palette

Thirteen themes: `brand`, `primary`, `secondary`, `success`, `white`, `ghost`,
`danger`, `warning`, `info`, `disabled`, `night`, `marcom`, `party`.

```js
installTheme();                      // --n55-brand, --n55-brand-deep, --n55-brand-ink, …
installTheme({ selector: '#app' });  // or scope it to a container
themeCss(myPalette, '.promo');       // or emit a stylesheet, in Node
```

**Call `installTheme()` once, early.** Without it components render unthemed.

- **Text on a theme colour uses `--n55-<name>-ink`**, never `-deep`. The ink is
  near-black or white, whichever contrasts more, so a custom palette stays readable.
- **`--n55-<name>-legible`** names whichever shade (light or deep) reaches WCAG AA
  with its ink. Danger and marcom only pass on their deep shade. Use `-legible` for
  anything putting text or a glyph on a theme surface.
- **`disabled` is both a theme and the opt-out.** An element themed `disabled` is
  never choreographed.
- Override `--n55-brand` on the page and everything follows, no rebuild.

### Light and dark

Per instance, no JavaScript. Non-theme surfaces come from `--n55-surface`,
`--n55-surface-ink`, `--n55-line`, `--n55-inverse`, `--n55-inverse-ink`, each a
`light-dark()` pair resolved against the inherited `color-scheme`.

```html
<html style="color-scheme: light dark">   <!-- follow the OS -->
<html data-n55-scheme="dark">              <!-- pin the page -->
<neodigm-buffet data-n55-scheme="light">   <!-- or one instance -->
```

The palette deliberately never sets `color-scheme` on `:root` — that would restyle
the host page's own scrollbars and form controls.

## The components

### `<neodigm-toast>` — queued notification from the bottom

```html
<neodigm-toast></neodigm-toast>
<button data-n55-toast="Saved ✨" data-n55-theme="success">Save</button>
```
```js
toast.show('Saved ✨', { theme: 'success' }).show('Next', { duration: 3000 });
```
Queued, with a debounce: the same message twice in a row is one notification. `|`
breaks the line. Text is never parsed as HTML.

### `<neodigm-marquee>` — scrolling text, character by character

```html
<neodigm-marquee text="Shipping [brand]free[/brand] today"></neodigm-marquee>
```
`[theme]…[/theme]` colours a run. Attributes: `text`, `direction` (`ltr`/`rtl`, or
`false` to stop hover reversing), `speed` (ms per step), `paused`. Methods:
`pause()`, `play()`, `step(by)`. The accessible name is the plain text; the animated
copy is hidden from assistive technology. Stops entirely under reduced motion.

### `<neodigm-tulip>` — one tooltip, many triggers

```html
<neodigm-tulip></neodigm-tulip>
<button data-n55-tulip="Simple tip">Hover</button>
<button data-n55-tulip='{"msg":"Advanced|Two lines","theme":"brand","position":"right","size":"medium","mrq":false}'>Hover</button>
```
`data-n55-tulip` takes the original's JSON or a bare string. Config is found by
walking up from whatever was hovered. `mrq: true` routes the message through a
marquee. Opens on hover **and focus**; Escape closes. `openFor(el|selector)` for
touch. `neodigm-tulip-open` is cancelable.

### `<neodigm-buffet>` — full-width two-level menu

```html
<neodigm-buffet data-n55-theme="brand" data-n55-buffet='[
  {"token":"shows","caption":"Shows","selected":true,"secondary":[
    {"token":"live","caption":"Live"},{"token":"vod","caption":"VOD"}]},
  {"token":"people","caption":"People","count":3,"theme":"marcom"}
]'></neodigm-buffet>
```
```js
menu.select('shows', 'vod');        // sync to a route, silently
menu.items = relabelled;            // selection survives where tokens do
menu.updateCount('people', 4);
menu.addEventListener('neodigm-buffet-select', e => { /* cancelable */ });
```
Host theme colours the menu; an item's own `theme` is an accent a sweep does not
reach. Height is `--n55-buffet-height`. Sticky positioning is the page's job.

### `<neodigm-sodapop>` — popups from templates

```html
<neodigm-sodapop></neodigm-sodapop>
<button data-n55-sodapop-id="myPopup_id" aria-haspopup="dialog">Try Me</button>
<template id="myPopup_id" data-n55-sodapop-modal="false" data-n55-sodapop-size="small">
  YOUR CONTENT HERE
</template>
```
Template attributes: `data-n55-sodapop-modal`, `-size`
(`xsmall|small|medium|large`), `-fullscreen`, `-transition` (`slide-right`),
`data-n55-scheme`. `show(id)`, `close()`, `shake()`. Events
`neodigm-sodapop-open` / `-opened` / `-close`, the open and close ones cancelable,
close carrying `e.detail.reason`. Template content is cloned and scripts are dropped.
To lock page scroll: `body:has(neodigm-sodapop[open]) { overflow: hidden }`.

### `<neodigm-side-dish>` — panel sliding in from the right

```html
<main style="position: relative">
  <neodigm-side-dish label="Filters" data-n55-theme="brand">
    <h2 slot="title">Filters</h2>
    …content…
  </neodigm-side-dish>
</main>
```
Covers its containing block, so the container needs a position; make the host
`position: fixed` to cover the viewport. Width is `--n55-side-dish-width` (40%).
Scrim, Escape and the X close it; `neodigm-side-dish-close` is cancelable with a
`reason`. Focus moves in and returns, but Tab is **not** trapped.

### `<neodigm-poptart>` — floating surface beside its trigger

```html
<button data-n55-poptart-click="js-signin">Sign in</button>
<neodigm-poptart id="js-signin"
  data-n55-poptart='{"w":256,"h":284,"position":"bottom","offset":{"x":0,"y":0}}'>
  …content…
</neodigm-poptart>
```
Triggers: `data-n55-poptart-click`, `-hover`, `-rightclick`. Config keys:
`position`, `align`, `w`, `h`, `offset{x,y,w,h}`, `x`, `y`, `z`. Content stays in the
page while closed, so a form keeps what was typed. Never modal. Opening one closes
any other. Place it **outside transformed or filtered containers**, which capture
fixed positioning.

## Choreography

```js
import { robinTheme, pulseTheme, flashTitle, onExitIntent }
  from '@machfivetechchicago/machvive-neodigm55-ux/conductor';

await robinTheme('brand');                              // sweep the page
await robinTheme('brand', { context: section, hold: 300, signal });
pulseTheme('marcom');                                   // the slower pulse cycle
flashTitle('danger');                                   // tab title glyph
const off = onExitIntent(() => toast.show('Thanks for visiting!'));
```

`robinTheme` resolves with how many elements it swept. Reduced motion suppresses the
sweep but still flashes the tab — that is information, not movement.

`onExitIntent` fires when the pointer leaves through the **top** of the page, once
per tab session by default (`{ once: 'page' }` for once per load). It uses the
original's storage key, so a visitor on a migrated site is not asked twice.

## Five things that break an integration

**1. `installTheme()` was never called**, or its selector does not match. Symptom:
components render unthemed. The selector must match an **ancestor** of the themed
elements — a container or `:root` — never a component's tag, because the palette
reaches a shadow root only by inheritance from outside it. A themed component the
palette does not reach logs one `console.warn` saying so.

**2. `data-n55-theme` put inside a shadow root.** `querySelectorAll` does not cross a
shadow boundary, so a sweep finds component **hosts** and nothing within them. Style
internals from `:host([data-n55-theme="brand"])` or the inherited custom properties.

**3. Text coloured with `-deep` instead of `-ink`.** `-deep` on the colour fails WCAG
AA on twelve of thirteen themes. Use `--n55-<name>-ink`, or `-legible` plus
`-legible-ink` when putting text on a theme surface.

**4. `color-scheme` set on `:root` by the page expecting the palette to do it.** The
palette deliberately does not, because it would restyle the host page's controls. The
page opts in with `style="color-scheme: light dark"` or `data-n55-scheme`.

**5. A Poptart inside a transformed container.** `transform` and `filter` create a
containing block that captures `position: fixed`, so it lands in the wrong place.

## Browser-only, like all custom elements

Every component evaluates `class extends HTMLElement` at module load, so a static
import during a server render throws `ReferenceError: HTMLElement is not defined`. In
Next.js, Nuxt, Astro, SvelteKit or Remix, import from a client-only path:

```js
useEffect(() => { import('@machfivetechchicago/machvive-neodigm55-ux'); }, []);
```

The `/conductor` subpath is the exception: it has no DOM dependency and imports fine
in Node, which is what makes a build-time theme builder or a CI contrast audit
possible.

## Reference

- [Repository](https://github.com/Mach-Five-Group/machvive-neodigm55-ux) — the README has the full API
- [npm](https://www.npmjs.com/package/@machfivetechchicago/machvive-neodigm55-ux)
- [Original Neodigm 55](https://github.com/arcanus55/neodigm55) and its [Cheat Sheet](https://github.com/arcanus55/neodigm55/wiki/Cheat-Sheet)
