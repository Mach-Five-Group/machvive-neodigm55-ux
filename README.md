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

installTheme();                    // --n55-brand, --n55-brand-deep, --n55-brand-glyph, …
themeCss(myPalette, '.promo');     // or emit a stylesheet for a section, or for a build
```

Override `--n55-brand` on a page and every component follows, with no rebuild and no
component aware it happened. `disabled` doubles as the opt-out: an element themed
`disabled` is never choreographed.

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
