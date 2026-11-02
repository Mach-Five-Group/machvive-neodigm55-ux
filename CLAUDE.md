# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

`@machfivetechchicago/machvive-neodigm55-ux` — a published npm library of vanilla
Web Components, porting [Neodigm 55](https://github.com/arcanus55/neodigm55) from an
IIFE micro-library to dependency-free ESM. Consumers install it and `import` the
modules; there is no app shell, no bundler, and no framework here.

The original still lives at `/Users/neodigm/Documents/2022/neodigm55` (branch
`gh-pages`, bundles under `dist/neodigm55__v5_0.js`). Read it before porting any
component — several behaviours only make sense once you have seen the original, and
several are bugs you must not faithfully reproduce.

## The thing to understand first

**Neodigm is not a component library that happens to have themes. It is a page
choreographer whose components are instruments.** The library knows about every
themed element on the page and moves colour across all of them to pull attention
somewhere — that is the product. Port the widgets and drop the choreography and you
have shipped a worse Shoelace.

`robinTheme` is the whole idea in one function: find every `[data-n55-theme]`
element, sweep a colour across them staggered 56ms apart, restore each to its own
theme, and flash the tab title.

## Architecture: two layers, one contract

**`src/conductor/`** — the engine. Palette, motion gate, placement maths, and the
choreography primitives. **No custom elements, no reference to `HTMLElement`.**

**`src/wc/<tag-name>/`** — the instruments. Vanilla custom elements that opt into
choreography by carrying `data-n55-theme` on their host.

Between them sits an **attribute contract, not a class hierarchy**. That is what
keeps this open-ended:

```html
<button data-n55-theme="brand">          <!-- plain HTML     -->
<neodigm-toast data-n55-theme="brand">   <!-- our component   -->
<my-lit-card data-n55-theme="brand">     <!-- Lit             -->
<div data-n55-theme="brand">             <!-- React output    -->
```

One `robinTheme()` sweeps all four. Nothing in the conductor knows what a Neodigm
component is, so a future Lit build is a sibling package driven by the *same*
conductor — no fork, no adapter.

### Three rules that hold the architecture together

**The conductor must stay headless.** `test/package.test.js` runs both halves in a
bare Node subprocess: the conductor must import cleanly, and a component subpath must
still throw `HTMLElement is not defined`. That is not pedantry — it is what lets a
theme builder, a CI check or a build step use the palette and the placement maths
with no DOM. If you ever need the DOM in the conductor, you have put something in the
wrong layer.

**Theme lives on the host; internals derive from it.** `querySelectorAll` does not
cross a shadow boundary, so a sweep finds component *hosts* and nothing inside them.
A component styles itself with `:host([data-n55-theme="brand"])` or reads
`var(--n55-brand)`. Putting `data-n55-theme` on a shadow-internal node and expecting
a sweep to reach it is the one way to use this wrong, and a test pins it.

**The palette is CSS custom properties, never hex in JavaScript.** The original kept
colours in `neodigmOpt.N55_THEME_COLORS`, so a page could not restyle anything
without touching the bundle. Here `installTheme()` writes `--n55-<name>`,
`--n55-<name>-deep` and `--n55-<name>-glyph` onto `:root`, plus `--n55-<name>-ink`
and `--n55-<name>-deep-ink`. Custom properties are the
one mechanism that both cascades through light DOM *and* inherits through a shadow
boundary — which is what makes a page-level theme builder possible with no component
changes and no rebuild. A test scans each component file and fails on any hex
outside the three known neutrals.

**Text on a theme surface uses its ink, never `-deep`.** `-deep` on the colour
measured below WCAG AA on twelve of thirteen themes (party: 1.76). Each ink is the
better of `#1a1a1a` and `#fff` for its surface, computed by `inkFor()` in the
conductor so a custom palette is readable without anyone measuring it; a theme may
pass `ink`/`deepInk` explicitly. Toast is the deliberate exception — white on a
colour-to-deep gradient, where no single ink suits both ends.

**Every theme has one shade that reaches AA with its ink, and `-legible` names it.**
Danger (4.32) and marcom (4.30) cannot reach 4.5 on their light shade with any
neutral; their deep shades pass. `--n55-<name>-legible` / `-legible-ink` point at the
light shade when it passes and the deep one otherwise, via `legibleFor()`. A test
pins the rule for the built-in palette. New components that put text or a glyph on
a theme surface should use `-legible`.

**Light and dark are `color-scheme`, resolved per instance.** Non-theme surfaces come
from `NEUTRALS` in the conductor, emitted as `--n55-surface: light-dark(…, …)` and
friends. `light-dark()` resolves on the element that uses the variable, against the
`color-scheme` it inherits — which crosses shadow boundaries — so every instance knows
its mode with no listener. `data-n55-scheme="light|dark"` pins any subtree. The palette
must never set `color-scheme` on `:root`; that restyles the host page's own controls.
jsdom cannot resolve `light-dark()`, so verify rendering in a real browser, and wait
out the components' 0.2s colour transitions before reading computed colours.

`disabled` is a real theme and also the opt-out: an element themed `disabled` is never
choreographed.

## Commands

```bash
npm test                 # whole suite, ~1.3s
npm run test:watch

node --test --import ./test/setup.js test/conductor.test.js            # one file
node --test --import ./test/setup.js "test/*.test.js" --test-name-pattern "robinTheme"
```

`--import ./test/setup.js` is required, not optional: component modules self-register
and evaluate `class extends HTMLElement` at import time, so the DOM has to exist
first. The runner gives each file its own process, so each starts clean.

jsdom is the only dependency, dev-only. No build step and no linter — files are
published as authored, so whatever is on disk is what consumers load.

## Adding a component

Four places, and missing any one breaks either the bulk import or the cherry-pick:

1. `src/wc/<tag-name>/<tag-name>.js` — named `export class` in PascalCase,
   `attachShadow({ mode: 'open' })` in the constructor, markup and scoped `<style>`
   written in `connectedCallback`, self-registration at the bottom guarded by
   `if (!customElements.get('<tag-name>'))`.
2. A sibling `.d.ts`.
3. The import/export pair in `index.js` and `index.d.ts`.
4. A new subpath in `package.json` `exports`, **with `types` first**.

Generate per-theme CSS rules from `THEMES` rather than hand-writing them, so adding a
colour to the palette cannot silently leave a component unstyled for it.

## What changed from the original, and why

Do not "restore" any of these. Each was verified against
`dist/neodigm55__v5_0.js` before changing.

| Original | Here | Why |
| --- | --- | --- |
| `robinTheme` set at `index × 56ms`, restored at `index × 112ms` | constant `hold` | Each element held the colour for `index × stagger` ms, so element 0 held for **0ms** and never visibly changed, while element 50 held nearly three seconds. The wave smeared as it travelled. |
| `flashTitle` recaptured `document.title` every call | captured once | Two overlapping flashes baked a glyph into the "real" title permanently. |
| Marquee rotated the string into `data-n55-marquee-text` each frame | source kept, only the view rotates | After one tick nobody could read the message back — including Tulip, which sets that very attribute. |
| Marquee coloured runs with zero-width and bidi control characters + CSS Custom Highlight API | real `<span>` elements, `[brand]…[/brand]` syntax | No colour at all without the Highlight API, invisible characters on every copy-paste, bidi reordering risk, and one run per colour because it matched with `indexOf`. A shadow root makes the hack unnecessary. *(This colour mechanism was a recent AI addition to the original, not long-standing design.)* |
| Tulip and Toast rendered messages with `innerHTML` | text nodes | Both are routinely built from user input or a server string. |
| `.replace("|", "<br>")` | `split('|')` | A string needle replaces one occurrence, which is why Tulip was documented as supporting "up to two text lines". |
| Tulip's `setOnBeforeOpen`, a callback registry keyed by element id | cancelable `neodigm-tulip-open` event | One callback per id, and it could only observe. Now several listeners can watch and any can veto. |
| Tulip bound hover only, and bailed out entirely on mobile | hover, focus, Escape, `openFor()` | The tip was unreachable without a pointer. |
| Tulip positioned by inline offsets from a fixed constant | shared `place()` in the conductor, plus `offsetX`/`offsetY` | Same rule as the original: the declared side is final. **Never add fit detection, flipping or clamping** — whether a tip fits is the designer's call, made with the offsets. An earlier version of this port flipped sides near viewport edges and overrode declared positions. |
| `// TODO test OS/UA motion mq` above `robinTheme` | `prefers-reduced-motion` honoured throughout | Suppressed motion still applies end state and still flashes the tab — that is information, not movement. |

## Testing

**Mutation-test every new test.** A green suite is evidence of nothing until you have
watched it fail. Two of the first five mutations survived here, both the same flaw:
asserting the *end state* of a sweep, which restores everything, so a swept element
reads identically to an untouched one. `test/conductor.test.js` has a `themeTrail`
helper that records attribute transitions through a `MutationObserver` — use it for
anything that changes and then changes back.

**Commit before a mutation round, and restore with `git checkout`, not a `cp`
backup.** A backgrounded mutation run was killed partway and left a mutation applied
— `#paint()` writing its own `text` attribute, which recursed infinitely through
`attributeChangedCallback`. That presented as a hang and a suite silently down from
88 tests to 60. Verify `git diff --quiet` after each round. Never background a
mutation run.

**jsdom cannot see.** No layout, no computed style. Anything visual needs a real
browser, and contrast needs measuring rather than eyeballing.

**A silently shrinking test count is the dangerous failure.** A file that throws on
import takes its tests with it and the run still reports success. Check the total,
not just the pass count.

### Guards that exist because something got through

- **No invisible control characters in any shipped source.** This package documents
  and replaces a colour mechanism built from them, so they turn up in comments and
  tests constantly. Two reached a shipped file while Marquee was being written:
  U+2028 LINE SEPARATOR is a JavaScript line terminator and broke the file outright;
  U+202A LEFT-TO-RIGHT EMBEDDING reorders whatever follows. **Name them, never paste
  them.**
- **Nothing that animates may outlive its visibility.** Closing a Tulip pauses its
  embedded marquee; a disconnected marquee refuses to schedule a timer. Both were
  found by a smoke script that stopped being able to exit.

## Publishing

Releases publish from CI over OIDC. No token exists, and none should be created.

```bash
git commit -am "…"                  # npm version refuses a dirty tree
npm version <patch|minor|major>     # bumps, commits, and creates annotated tag v<x.y.z>
git push origin main --follow-tags
```

`--follow-tags` is the part people forget. Pushing the branch alone does nothing —
`.github/workflows/publish.yml` triggers on `tags: ['v*']`.

The workflow checks the tag against `package.json` and runs the suite before
publishing with `--provenance`. `permissions: id-token: write` is what mints the OIDC
token; remove it and publishing fails with nothing able to substitute. The trusted
publisher is configured against this repo **and this workflow filename** — renaming
`publish.yml` breaks publishing until the npm config is updated to match.

**Registry propagation takes minutes, not seconds.** `0.0.1` took roughly three
minutes to appear. npm's own notice says so. Poll; do not conclude the publish failed.

Things that will break a publish or a consumer, all currently satisfied:

- **`sideEffects` must never be `false`** — components register on import, and a
  bundler will drop a bare `import "pkg/toast"` and silently skip the tag.
- **`types` must be first in each `exports` subpath** — TypeScript resolves in order.
- **Every `.js` entry point needs a sibling `.d.ts`**, and `index.d.ts` must not
  declare exports `index.js` lacks.
- **Apache-2.0 requires `LICENSE` to ship.**

### History worth not repeating

`0.0.1` was a token-based bootstrap, published only to claim the name, and is
deprecated. A brand-new npm name **cannot** start on trusted publishing: the config
form lives at `npmjs.com/package/<name>/access`, which does not exist until the
package does. Getting that one publish out cost three opaque failures:

- `E404` on `PUT` — the token was scoped to "Only select packages", which lists
  *existing* packages and therefore cannot create a name. Use the **scope** or "All
  packages".
- `EOTP` — "Bypass 2FA" on the token was not enough; the account requires 2FA for
  writes. `npm login` (web flow) works with a passkey.
- `EOTP` again from a non-interactive shell — npm hands off to a browser for the
  second factor and errors when it cannot. **That publish must be run by the user in
  their own terminal.**

## Where this is going

Ported so far: the conductor, `<neodigm-toast>`, `<neodigm-marquee>`,
`<neodigm-tulip>`, `<neodigm-sodapop>`. Built new, with no original to port: `<neodigm-buffet>`, a
two-level menu that takes `m5t-primary-nav`'s metadata unchanged and themes as
one instrument (per-item `theme` accents live inside and are not swept), and
`<neodigm-side-dish>`, a panel over its container whose host theme colours only
the X. The
original has roughly a dozen more — ActIcon, Juicebar, Poptart,
Carousel, Enchanted CTA, Picnic, Claire, Wired4Sound.

Next, and cheaper than Tulip was because `place()` already exists: **Poptart**, a
floating surface.

Two decisions deliberately deferred:

**`<neodigm-conductor>` as a declarative facade.** The conductor stays a module —
that is what keeps it headless — but Neodigm is declarative to its core, and a page
should be able to write `<neodigm-conductor robin="8s">` rather than JavaScript. The
element would hold no logic of its own: read attributes, call the engine.

**A page-level theme builder.** Now cheap, because the palette is already CSS custom
properties: a UI that writes `--n55-*` to `:root` and exports a stylesheet or token
JSON. `themeCss(themes, selector)` exists for exactly this and is Node-importable.

Still missing from the release pipeline: the Claude Code plugin/skill, the wiki, and a
playground with a Playwright contrast audit across themes.
