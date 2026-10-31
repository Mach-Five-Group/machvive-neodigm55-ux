import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import '../src/wc/neodigm-toast/neodigm-toast.js';
import { DEFAULT_DURATION } from '../src/wc/neodigm-toast/neodigm-toast.js';
import { THEME_ATTR, robinTheme, setMotionAllowed, resetMotion, resetTitle } from '../src/conductor/index.js';

const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const mount = () => {
  const el = document.createElement('neodigm-toast');
  document.body.append(el);
  return el;
};
const text = (el) => el.shadowRoot.querySelector('.msg').textContent;

beforeEach(() => {
  document.body.replaceChildren();
  resetMotion();
  resetTitle();
});

describe('rendering', () => {
  test('registers itself on import, with no markup required on the page', () => {
    // The original needed <div id="js-snackbar__id"> to already exist, and
    // silently did nothing when it did not.
    assert.ok(customElements.get('neodigm-toast'));
    const el = mount();
    assert.ok(el.shadowRoot.querySelector('.msg'), 'it renders its own surface');
  });

  test('shows a message and opens', async () => {
    const el = mount();
    el.show('Saved');
    assert.equal(text(el), 'Saved');
    assert.equal(el.open, true);
  });

  test('a pipe becomes a line break', () => {
    const el = mount();
    el.show('first|second');
    assert.equal(el.shadowRoot.querySelectorAll('.msg br').length, 1);
    assert.equal(text(el), 'firstsecond', 'both halves are present as text');
  });

  test('every pipe breaks, not just the first', () => {
    // The original used String.replace with a string needle, which replaces one
    // occurrence — so a three-line toast silently rendered as two.
    const el = mount();
    el.show('a|b|c');
    assert.equal(el.shadowRoot.querySelectorAll('.msg br').length, 2);
  });

  test('markup in a message is inert, not parsed', () => {
    // The original assigned innerHTML, and toast text is routinely built from
    // user input or a server error message.
    const el = mount();
    el.show('<img src=x onerror=alert(1)>');
    assert.equal(el.shadowRoot.querySelectorAll('.msg img').length, 0, 'no element was created');
    assert.match(text(el), /<img/, 'it is shown as literal text');
  });

  test('is announced politely rather than interrupting', () => {
    const el = mount();
    assert.equal(el.getAttribute('role'), 'status');
    assert.equal(el.getAttribute('aria-live'), 'polite');
  });
});

describe('the queue', () => {
  test('a second message waits for the first', async () => {
    const el = mount();
    el.show('one', { duration: 20 }).show('two', { duration: 20 });
    assert.equal(text(el), 'one');
    assert.equal(el.queue.length, 2);
  });

  test('the same message twice in a row is debounced', () => {
    // From the original: a repeat is almost always a double-fired handler.
    const el = mount();
    el.show('dup').show('dup');
    assert.equal(el.queue.length, 1);
  });

  test('the same message is allowed again after something else', () => {
    const el = mount();
    el.show('a').show('b').show('a');
    assert.equal(el.queue.length, 3, 'debounce is temporal, not a permanent block');
  });

  test('pause stops accepting, play resumes', () => {
    const el = mount();
    el.pause().show('ignored');
    assert.equal(el.queue.length, 0);
    el.play().show('accepted');
    assert.equal(el.queue.length, 1);
  });

  test('clear empties what is waiting but lets the current one finish', () => {
    const el = mount();
    el.show('showing', { duration: 50 }).show('waiting', { duration: 50 });
    el.clear();
    assert.equal(el.queue.length, 1);
    assert.equal(text(el), 'showing');
  });

  test('an empty message is ignored rather than showing a blank toast', () => {
    const el = mount();
    el.show('');
    el.show(null);
    assert.equal(el.queue.length, 0);
  });

  test('the default duration matches the original', () => {
    assert.equal(DEFAULT_DURATION, 5200);
  });
});

describe('events', () => {
  test('emits show and hide, and they cross the shadow boundary', async () => {
    const el = mount();
    const seen = [];
    document.addEventListener('neodigm-toast-show', (e) => seen.push(['show', e.detail.message]));
    document.addEventListener('neodigm-toast-hide', (e) => seen.push(['hide', e.detail.message]));

    el.show('ping', { duration: 15 });
    await settle(60);
    assert.deepEqual(seen, [['show', 'ping'], ['hide', 'ping']]);
  });
});

describe('the declarative trigger', () => {
  test('clicking [data-n55-toast] shows its value', async () => {
    const el = mount();
    const button = document.createElement('button');
    button.setAttribute('data-n55-toast', 'From markup');
    button.setAttribute(THEME_ATTR, 'success');
    document.body.append(button);

    button.click();
    await settle(10);
    assert.equal(text(el), 'From markup');
    assert.equal(el.getAttribute(THEME_ATTR), 'success', 'the trigger carries the theme too');
  });

  test('a disabled trigger does nothing', async () => {
    const el = mount();
    const button = document.createElement('button');
    button.setAttribute('data-n55-toast', 'Should not appear');
    button.setAttribute(THEME_ATTR, 'disabled');
    document.body.append(button);

    button.click();
    await settle(10);
    assert.equal(el.queue.length, 0);
  });

  test('a click on a child of the trigger still fires it', async () => {
    const el = mount();
    const button = document.createElement('button');
    button.setAttribute('data-n55-toast', 'Nested');
    const span = document.createElement('span');
    button.append(span);
    document.body.append(button);

    span.click();
    await settle(10);
    assert.equal(text(el), 'Nested', 'the original read only target and target.parentNode');
  });
});

describe('page choreography', () => {
  test('a sweep colours the toast along with everything else', async () => {
    // The point of the port: the toast is an instrument, not a special case.
    const el = mount();
    el.setAttribute(THEME_ATTR, 'primary');

    const run = robinTheme('brand', { stagger: 5, hold: 60, flashTab: false });
    await settle(20);
    assert.equal(el.getAttribute(THEME_ATTR), 'brand', 'swept like any themed element');
    await run;
    assert.equal(el.getAttribute(THEME_ATTR), 'primary', 'and restored');
  });

  test('its stylesheet covers every theme in the palette', () => {
    // Generated from THEMES rather than hand-written, so adding a colour to the
    // palette cannot silently leave the toast unstyled for it.
    const el = mount();
    const css = el.shadowRoot.querySelector('style').textContent;
    for (const name of ['brand', 'primary', 'danger', 'marcom', 'party', 'night']) {
      assert.match(css, new RegExp(`\\[${THEME_ATTR}="${name}"\\]`), `${name} has no rule`);
    }
  });

  test('reduced motion closes the gap between queued messages', async () => {
    // With no exit transition to wait out, the 1200ms gap is dead time.
    setMotionAllowed(false);
    const el = mount();
    el.show('one', { duration: 10 }).show('two', { duration: 10 });
    await settle(40);
    assert.equal(text(el), 'two', 'the second message should already be up');
  });
});

describe('the progress bar', () => {
  const bar = (el) => el.shadowRoot.querySelector('.bar');

  test('runs for the toast\'s own duration, not a fixed 5.2s', () => {
    // The original's bar was a 5.2s transition whatever the toast's duration,
    // so a short toast closed with its bar barely started.
    const el = mount();
    el.show('Saved', { duration: 1500 });
    assert.equal(bar(el)?.style.animationDuration, '1500ms');
  });

  test('defaults to the default duration', () => {
    const el = mount();
    el.show('Saved');
    assert.equal(bar(el)?.style.animationDuration, `${DEFAULT_DURATION}ms`);
  });

  test('each queued message gets a fresh bar, which restarts the animation', async () => {
    const el = mount();
    el.show('one', { duration: 10 }).show('two', { duration: 30 });
    const first = bar(el);
    await settle(1260);
    assert.equal(text(el), 'two');
    assert.notEqual(bar(el), first, 'the same element would not restart its animation');
    assert.equal(bar(el).style.animationDuration, '30ms');
    assert.equal(el.shadowRoot.querySelectorAll('.bar').length, 1, 'old bars are removed');
  });

  test('is left out when motion is off', () => {
    setMotionAllowed(false);
    const el = mount();
    el.show('Saved');
    assert.equal(bar(el), null);
  });

  test('the entry bounces and the bar fills, unless the OS asks for less motion', () => {
    const el = mount();
    const css = el.shadowRoot.querySelector('style').textContent;
    assert.match(css, /:host\(\[open\]\)\s*\{[^}]*animation:\s*n55-toast-in/);
    assert.match(css, /@keyframes n55-toast-in[\s\S]*80%[^}]*translateY\(-\d+px\)/, 'it overshoots before settling');
    const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
    assert.match(reduced, /:host\(\[open\]\)\s*\{[^}]*animation:\s*none/);
    assert.match(reduced, /\.bar\s*\{\s*display:\s*none/);
  });
});

describe('the legacy look', () => {
  const css = () => mount().shadowRoot.querySelector('style').textContent;

  test('every theme is a gradient from its colour to its deep companion', () => {
    for (const name of ['brand', 'danger', 'night', 'party']) {
      assert.match(css(), new RegExp(
        `\\[${THEME_ATTR}="${name}"\\]\\)\\s*\\{\\s*background:\\s*linear-gradient\\(45deg, var\\(--n55-${name}\\), var\\(--n55-${name}-deep\\)\\)`
      ), `${name} is not a light-to-deep gradient`);
    }
  });

  test('the text is white and cannot be selected', () => {
    const host = css().match(/:host \{[\s\S]*?\n  \}/)[0];
    assert.match(host, /\n\s*color: #fff;/);
    assert.match(host, /\n\s*user-select: none;/);
    assert.doesNotMatch(css(), new RegExp(`\\[${THEME_ATTR}="brand"\\]\\)\\s*\\{[^}]*color:`), 'a theme must not override the white');
  });
});

describe('the progress bar colour', () => {
  test('runs dark to light, the reverse of the background', () => {
    const css = mount().shadowRoot.querySelector('style').textContent;
    for (const name of ['brand', 'danger', 'night', 'party']) {
      assert.match(css, new RegExp(
        `\\[${THEME_ATTR}="${name}"\\]\\) \\.bar\\s*\\{\\s*background:\\s*linear-gradient\\(90deg, var\\(--n55-${name}-deep\\), var\\(--n55-${name}\\)\\)`
      ), `${name}'s bar is not a deep-to-light gradient`);
    }
  });

  test('white, whose two colours are both white, still shows a bar', () => {
    const css = mount().shadowRoot.querySelector('style').textContent;
    const at = css.lastIndexOf(`[${THEME_ATTR}="white"]) .bar`);
    assert.ok(at > css.indexOf(`[${THEME_ATTR}="white"]) .bar`), 'the override must come after the generated rule');
    assert.match(css.slice(at), /^\[[^\]]+\]\) \.bar \{ background: currentColor; \}/);
  });
});
