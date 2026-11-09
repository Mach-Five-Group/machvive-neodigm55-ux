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

npm run sync-icons       # copy the icon set from ../machvive-chat-syncopation-ai,
                         # writing src/conductor/icons.js and src/icons.css
npm run sync-icons -- --check   # exit 1 if src/conductor/icons.js is behind it
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
5. A row in the README's vendoring table: the conductor modules it needs at
   runtime and its `part` names. A test compares the row to the code. Part names
   are public API — a consumer styles through them — so removing one is breaking.
6. A section in the Claude skill at
   `plugins/machvive-neodigm55/skills/machvive-neodigm55/SKILL.md`, and its tag in
   that skill's trigger description. A test fails until both are there, so this is
   not optional — and bump the plugin and marketplace versions together.

Call `paletteReaches(this)` when the component first shows something themed (on
open, or a tick after connecting if it is always visible). It is the only signal
a consumer gets when an `installTheme` selector misses: otherwise the component
just renders unthemed.

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
| Poptart `top` subtracted the trigger's height twice; `left`/`right` centred, then shifted by the trigger's width | `place()` with a 10px gap above and below, flush beside | Its `top` landed a trigger-height too high, and beside the trigger it sat flush only when exactly as wide as the trigger. Offsets that pages added to compensate are now wrong, and the README says so. |
| `neodigmUtils.shake` added a `shake__an` class with global keyframes | `el.animate(…, { composite: 'add' })` in the conductor | The keyframes replaced the element's own `transform`: a centred element jumped 31px while it shook (measured in Chrome). A class also cannot reach light DOM from a shadow root. |
| `typeOn` started erasing a phrase while still typing its padding, and pinned `height` inline | type, hold, erase, in sequence; no inline height | The erase was timed from the text's length and raced the typing; the pinned height outlived the text it was measured for. Typed letters are `aria-hidden`, with the whole phrase in a visually hidden span. |
| `countTo` moved by `round(diff / 16)` and snapped | true sixteenths | A difference under 8 moved 0 per step and jumped on the last; larger ones overshot. |
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

## Claude Code plugin

The repo doubles as a plugin marketplace, so a consumer can install a skill that
teaches Claude to use these components:

```
.claude-plugin/marketplace.json                       # must be at the repo root
plugins/machvive-neodigm55/
  .claude-plugin/plugin.json
  skills/machvive-neodigm55/SKILL.md
```

Installed with `/plugin marketplace add Mach-Five-Group/machvive-neodigm55-ux`
then `/plugin install machvive-neodigm55@machvive-neodigm55`.

- **Claude Code does not scan `node_modules`.** Shipping the skill inside the npm
  tarball would reach every consumer and be discovered by none; the plugin route is
  the only one with real discovery. The `files` allowlist keeps `plugins/` and
  `.claude-plugin/` out of the tarball, and a test asserts it.
- **The plugin versions independently of the package.** Bump `plugin.json` and the
  marketplace entry when the *skill's guidance* changes, not when the package ships —
  tying them to the npm version forces a reinstall for every user on releases the
  skill does not describe. A test asserts the two stay equal to each other.
- **The skill drifts silently.** Nothing fails when it is stale: tests pass,
  publishes succeed, and the only evidence is an agent confidently teaching something
  untrue. A sibling package's skill sat four releases behind, missing a whole
  component. Here that is mechanical instead: tests assert every component tag and
  every published subpath appears in SKILL.md, and that the trigger description names
  the tags. Adding a component therefore fails the suite until the skill mentions it.
- **The description is the whole triggering mechanism.** A component absent from it
  means the skill never loads for the person asking about that component.

## Wiki

`design/wiki/` is a **local mirror, not the source of truth** — the published wiki is
edited on github.com and pulled down with `design/wiki/sync-wiki.sh`. The script
never deletes; a page existing only locally is reported, not removed, because on the
sibling repo that mistake cost a 170-line page. `design/` is gitignored, so none of
it is committed or shipped.

To change a page: clone `machvive-neodigm55-ux.wiki.git`, edit and push there, then
run `design/wiki/sync-wiki.sh --apply` to refresh the mirror. Pages: **Home**, and
**Icons**, which is the full guide to `icons.css`, `<neodigm-icon>` and ActIcon. When
the icon set changes, its name table changes too; it is generated from `ICON_NAMES`,
never typed.

## Publishing

Releases publish from CI over OIDC. No token exists, and none should be created.

```bash
npm run sync-icons                  # 1. regenerate src/conductor/icons.js and src/icons.css
npm test                            # 2. icons.css must match icons.js, among the rest
git commit -am "…"                  # 3. include both icon files; npm version refuses a dirty tree
npm version <patch|minor|major>     # 4. checks the icons, then bumps, commits, tags v<x.y.z>
git push origin main --follow-tags  # 5. the tag is what publishes
```

**Step 1 is how `icons.css` gets generated, and the release enforces it.** The icon
set is added to in `machvive-chat-syncopation`; `npm run sync-icons` copies it into
both files. `npm version` runs `preversion` first, which is `sync-icons --check`: if
the icons here are behind syncopation it exits 1 and nothing is bumped. It checks
rather than writes on purpose: `npm version` commits only `package.json`, so a
regenerated `icons.css` would be left out of the tagged commit and never published.
Run step 1, commit, and version again.

**When a sync adds or removes icons, two lists follow it.** The skill names every
icon (so Claude never suggests one that does not exist), and a test fails until its
list matches `ICON_NAMES`. The wiki's Icons page has the same table, which no test can
reach: regenerate it from `ICON_NAMES` and push the wiki. Removing an icon is a
breaking change for any page that names it.

`--if-present` lets the check pass, with a message, in a checkout without
syncopation beside it. The suite still guards the other half everywhere, CI
included: `icons.css` must be exactly what `icons.js` generates. Never edit
`icons.css` or the ICONS block by hand; the next sync overwrites both.

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

Ported so far: the conductor (with `neodigmUtils`' shake, countTo, typeOn and
messageNotification, and `<neodigm-conductor>` to declare them), `<neodigm-toast>`, `<neodigm-marquee>`,
`<neodigm-tulip>`, `<neodigm-sodapop>`, `<neodigm-poptart>`, `<neodigm-acticon>`
(with `<neodigm-icon>`, which replaces the Material Symbols font). Built new, with no original to port: `<neodigm-buffet>`, a
two-level menu that takes `m5t-primary-nav`'s metadata unchanged and themes as
one instrument (per-item `theme` accents live inside and are not swept), and
`<neodigm-side-dish>`, a panel over its container whose host theme colours only
the X. The
original has roughly a dozen more — Juicebar,
Carousel, Enchanted CTA, Picnic, Claire, Wired4Sound.

Poptart is the second floating surface on `place()`. It needed an `align` option
(`start`/`center`/`end`, default `center` so Tulip is unchanged), because the
original top-aligned its left/right flyouts. Like the side, alignment is declared,
never computed from the viewport. Unlike Tulip and SodaPop, each Poptart is its own
element and keeps its content in the page while closed. A form inside it keeping
its values is the original's documented behaviour.

**`<neodigm-conductor>` exists as the declarative facade**, and holds no logic: while
connected it wires `data-n55-shake`, `data-n55-typeon-click`/`-hover` and
`data-n55-notify` (refcounted per document, so any number are harmless), and its
methods call `effects.js` and `notify.js` in the conductor. Its subpath is
`/conductor-element`, because `/conductor` is the headless module. Choreography
attributes (`robin="8s"`) are the obvious next addition and belong on it, still
calling the engine rather than holding timers of their own.

One decision deliberately deferred:

**A page-level theme builder.** Now cheap, because the palette is already CSS custom
properties: a UI that writes `--n55-*` to `:root` and exports a stylesheet or token
JSON. `themeCss(themes, selector)` exists for exactly this and is Node-importable.

Still missing from the release pipeline: a playground with a Playwright contrast
audit across themes, and the wiki's actual content (the workflow is set up; no pages
are written yet).
