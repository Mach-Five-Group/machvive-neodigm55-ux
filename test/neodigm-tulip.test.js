import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import '../src/wc/neodigm-marquee/neodigm-marquee.js';
import '../src/wc/neodigm-tulip/neodigm-tulip.js';
import { readConfig, configFrom, TULIP_DEFAULTS } from '../src/wc/neodigm-tulip/neodigm-tulip.js';
import { place } from '../src/conductor/anchor.js';
import { THEME_ATTR, resetMotion } from '../src/conductor/index.js';

const mount = () => {
  const el = document.createElement('neodigm-tulip');
  document.body.append(el);
  return el;
};
const trigger = (config, tag = 'button') => {
  const el = document.createElement(tag);
  if (config !== null) el.setAttribute('data-n55-tulip', config);
  document.body.append(el);
  return el;
};
const trigger_ = (config) => trigger(config);
const message = (el) => el.shadowRoot.querySelector('.msg').textContent;

beforeEach(() => { document.body.replaceChildren(); resetMotion(); });
afterEach(() => { document.body.replaceChildren(); resetMotion(); });

describe('the declarative format', () => {
  test('accepts the full JSON configuration from the cheat sheet', () => {
    const c = readConfig('{"msg":"Advanced Config","mrq":false,"tmpt":"","theme":"brand","size":"small","position":"top","icon":""}');
    assert.equal(c.msg, 'Advanced Config');
    assert.equal(c.theme, 'brand');
    assert.equal(c.size, 'small');
    assert.equal(c.position, 'top');
    assert.equal(c.mrq, false);
  });

  test('accepts a bare string as the message', () => {
    assert.equal(readConfig('Just a tip').msg, 'Just a tip');
    assert.equal(readConfig('Just a tip').theme, TULIP_DEFAULTS.theme);
  });

  test('unparseable JSON becomes the message rather than vanishing', () => {
    // A tip with the wrong styling beats a tip that silently never appears.
    const c = readConfig('{not valid json');
    assert.equal(c.msg, '{not valid json');
  });

  test('a partial object keeps the defaults for everything else', () => {
    const c = readConfig('{"msg":"hi","theme":"danger"}');
    assert.equal(c.theme, 'danger');
    assert.equal(c.position, TULIP_DEFAULTS.position);
    assert.equal(c.size, TULIP_DEFAULTS.size);
  });

  test('an unknown theme, size or position falls back rather than reaching CSS', () => {
    const c = readConfig('{"msg":"hi","theme":"chartreuse","size":"enormous","position":"sideways"}');
    assert.equal(c.theme, 'brand');
    assert.equal(c.size, 'small');
    assert.equal(c.position, 'top');
  });

  test('config is found by walking up from whatever was hovered', () => {
    // The original's walkDOM3: the config may sit on an ancestor, and the
    // hovered node is usually a child like an icon or a label span.
    const outer = trigger('{"msg":"from the ancestor"}');
    const inner = document.createElement('span');
    outer.append(inner);
    assert.equal(configFrom(inner).config.msg, 'from the ancestor');
    assert.equal(configFrom(inner).element, outer);
  });

  test('a disabled element opts out, even with a config above it', () => {
    const outer = trigger('{"msg":"should not show"}');
    const inner = document.createElement('span');
    inner.setAttribute(THEME_ATTR, 'disabled');
    outer.append(inner);
    assert.equal(configFrom(inner), null);
  });

  test('an element with no config anywhere above it yields nothing', () => {
    const orphan = document.createElement('span');
    document.body.append(orphan);
    assert.equal(configFrom(orphan), null);
  });
});

describe('showing a tip', () => {
  test('opens for a trigger and shows its message', () => {
    const tip = mount();
    const btn = trigger('Hello there');
    assert.equal(tip.openFor(btn), true);
    assert.equal(tip.open, true);
    assert.equal(message(tip), 'Hello there');
    assert.equal(tip.trigger, btn);
  });

  test('applies theme and size to the host, where a sweep can see them', () => {
    const tip = mount();
    tip.openFor(trigger('{"msg":"x","theme":"marcom","size":"medium"}'));
    assert.equal(tip.getAttribute(THEME_ATTR), 'marcom');
    assert.equal(tip.getAttribute('size'), 'medium');
  });

  test('every pipe breaks a line, not only the first', () => {
    // The original used String.replace with a string needle, which is why it
    // was documented as supporting "up to two text lines".
    const tip = mount();
    tip.openFor(trigger('one|two|three'));
    assert.equal(tip.shadowRoot.querySelectorAll('.msg br').length, 2);
  });

  test('the message is text, never parsed as markup', () => {
    const tip = mount();
    tip.openFor(trigger('<img src=x onerror=alert(1)>'));
    assert.equal(tip.shadowRoot.querySelectorAll('.msg img').length, 0);
    assert.match(message(tip), /<img/);
  });

  test('an icon is rendered beside the message and hidden from screen readers', () => {
    const tip = mount();
    tip.openFor(trigger('{"msg":"Saved","icon":"\\u2728"}'));
    const icon = tip.shadowRoot.querySelector('.icon');
    assert.ok(icon);
    assert.equal(icon.getAttribute('aria-hidden'), 'true');
  });

  test('the accessible name is the message with pipes read as spaces', () => {
    const tip = mount();
    tip.openFor(trigger('one|two'));
    assert.equal(tip.getAttribute('aria-label'), 'one two');
  });

  test('an empty message shows nothing', () => {
    const tip = mount();
    assert.equal(tip.openFor(trigger('{"msg":""}')), false);
    assert.equal(tip.open, false);
  });

  test('closing clears the trigger and fires an event', () => {
    const tip = mount();
    const seen = [];
    document.addEventListener('neodigm-tulip-close', (e) => seen.push(e.detail.trigger));
    const btn = trigger('x');
    tip.openFor(btn);
    tip.close();
    assert.equal(tip.open, false);
    assert.equal(tip.trigger, null);
    assert.deepEqual(seen, [btn]);
  });
});

describe('the open event, which replaces setOnBeforeOpen', () => {
  test('fires before showing, carrying the trigger and config', () => {
    const tip = mount();
    const seen = [];
    document.addEventListener('neodigm-tulip-open', (e) => seen.push(e.detail.config.msg));
    tip.openFor(trigger('watch me'));
    assert.deepEqual(seen, ['watch me']);
  });

  test('preventDefault vetoes the tip', () => {
    // The original's callback could not refuse; it only observed.
    const tip = mount();
    const veto = (e) => e.preventDefault();
    document.addEventListener('neodigm-tulip-open', veto);
    const shown = tip.openFor(trigger('blocked'));
    document.removeEventListener('neodigm-tulip-open', veto);
    assert.equal(shown, false);
    assert.equal(tip.open, false);
  });

  test('more than one listener can watch', () => {
    // The original keyed callbacks by element id, so a second registration for
    // the same id replaced the first.
    const tip = mount();
    const seen = [];
    const a = () => seen.push('a'), b = () => seen.push('b');
    document.addEventListener('neodigm-tulip-open', a);
    document.addEventListener('neodigm-tulip-open', b);
    tip.openFor(trigger('x'));
    document.removeEventListener('neodigm-tulip-open', a);
    document.removeEventListener('neodigm-tulip-open', b);
    assert.deepEqual(seen, ['a', 'b']);
  });
});

describe('pointer, keyboard and dismissal', () => {
  test('hovering a trigger opens it', () => {
    const tip = mount();
    const btn = trigger('on hover');
    btn.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
    assert.equal(message(tip), 'on hover');
  });

  test('focus opens it too, so a keyboard reaches the tip', () => {
    // The original bound only mouseover/mouseout and bailed out entirely on
    // mobile, leaving the tip unreachable without a pointer.
    const tip = mount();
    const btn = trigger('on focus');
    btn.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
    assert.equal(tip.open, true);
  });

  test('Escape dismisses it', () => {
    const tip = mount();
    tip.openFor(trigger('x'));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(tip.open, false);
  });

  test('a click anywhere dismisses it', () => {
    const tip = mount();
    tip.openFor(trigger('x'));
    document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.equal(tip.open, false);
  });

  test('openFor accepts a selector, for touch where hover never fires', () => {
    const tip = mount();
    const btn = trigger('by selector');
    btn.id = 'tip-target';
    assert.equal(tip.openFor('#tip-target'), true);
    assert.equal(message(tip), 'by selector');
  });

  test('stops listening once removed from the page', () => {
    const tip = mount();
    const btn = trigger('x');
    tip.remove();
    btn.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
    assert.equal(tip.open, false, 'a detached tip must not react to the document');
  });
});

describe('placement', () => {
  const trigger = { x: 400, y: 300, width: 100, height: 40 };
  const surface = { x: 0, y: 0, width: 200, height: 50 };

  test('puts the surface on the declared side, centred, with the gap', () => {
    assert.deepEqual(place({ trigger, surface, position: 'top' }), { x: 350, y: 242, side: 'top' });
    assert.deepEqual(place({ trigger, surface, position: 'bottom' }), { x: 350, y: 348, side: 'bottom' });
    assert.deepEqual(place({ trigger, surface, position: 'left' }), { x: 192, y: 295, side: 'left' });
    assert.deepEqual(place({ trigger, surface, position: 'right' }), { x: 508, y: 295, side: 'right' });
    assert.equal(place({ trigger, surface, position: 'sideways' }).side, 'top');
  });

  test('adds the designer\'s offsets', () => {
    assert.deepEqual(place({ trigger, surface, position: 'top', offsetX: 12, offsetY: -6 }),
      { x: 362, y: 236, side: 'top' });
  });

  test('never second-guesses the declared side, even off screen', () => {
    // Fit is the designer's call, made with the offsets. An earlier version of
    // this port moved a tip to another side near a viewport edge.
    const corner = { x: 0, y: 0, width: 20, height: 20 };
    const at = place({ trigger: corner, surface, position: 'top' });
    assert.equal(at.side, 'top');
    assert.equal(at.y, -58, 'above the trigger, off screen, as declared');
    assert.equal(at.x, -90);
  });

  test('Tulip opens on the declared side, at the top-left corner too', () => {
    // jsdom has no layout, so every rect is zero: a trigger in the corner.
    for (const position of ['top', 'right', 'bottom', 'left']) {
      const el = mount();
      el.openFor(trigger_(JSON.stringify({ msg: 'tip', position })));
      assert.equal(el.getAttribute('data-side'), position);
      el.close();
    }
  });

  test('Tulip applies offsetX and offsetY from the declaration', () => {
    const el = mount();
    el.openFor(trigger_('{"msg":"tip","position":"top","offsetX":12,"offsetY":-6}'));
    // Zero rects: top is y = 0 - 0 - 8, then the offsets.
    assert.equal(el.style.transform, 'translate(12px, -14px)');
    el.close();
    el.openFor(trigger_('{"msg":"tip","position":"top"}'));
    assert.equal(el.style.transform, 'translate(0px, -8px)', 'no offsets, no adjustment');
  });

  test('offsets read numbers and numeric strings, and ignore anything else', () => {
    assert.equal(readConfig('{"msg":"a","offsetX":"14","offsetY":-3}').offsetX, 14);
    assert.equal(readConfig('{"msg":"a","offsetX":"14","offsetY":-3}').offsetY, -3);
    assert.equal(readConfig('{"msg":"a","offsetX":"left"}').offsetX, 0);
    assert.equal(readConfig('plain').offsetY, 0);
    assert.equal(TULIP_DEFAULTS.offsetX, 0, 'the published defaults carry both keys');
    assert.equal(TULIP_DEFAULTS.offsetY, 0);
  });
});

describe('marquee integration', () => {
  test('mrq routes the message through the marquee', () => {
    const tip = mount();
    tip.openFor(trigger('{"msg":"scrolling news","mrq":true}'));
    const mq = tip.shadowRoot.querySelector('neodigm-marquee');
    assert.equal(mq.getAttribute('text'), 'scrolling news');
    assert.equal(tip.hasAttribute('mrq'), true);
  });

  test('the marquee keeps the text readable back, which the original lost', () => {
    // The original rotated the string into the same attribute it read from, so
    // once scrolling began the message could not be recovered.
    const tip = mount();
    tip.openFor(trigger('{"msg":"abcdef","mrq":true}'));
    const mq = tip.shadowRoot.querySelector('neodigm-marquee');
    mq.step(); mq.step();
    assert.equal(mq.text, 'abcdef');
  });

  test('the marquee carries the tip theme', () => {
    const tip = mount();
    tip.openFor(trigger('{"msg":"x","mrq":true,"theme":"party"}'));
    assert.equal(tip.shadowRoot.querySelector('neodigm-marquee').getAttribute(THEME_ATTR), 'party');
  });

  test('a plain tip leaves the marquee empty and paused', () => {
    const tip = mount();
    tip.openFor(trigger('{"msg":"static","mrq":false}'));
    const mq = tip.shadowRoot.querySelector('neodigm-marquee');
    assert.equal(mq.getAttribute('text'), '');
    assert.equal(mq.hasAttribute('paused'), true, 'no timer for a tip that is not scrolling');
    assert.equal(tip.hasAttribute('mrq'), false);
  });

  test('closing stops the marquee, so a hover does not leak a timer', () => {
    const tip = mount();
    tip.openFor(trigger('{"msg":"scrolling","mrq":true}'));
    const mq = tip.shadowRoot.querySelector('neodigm-marquee');
    assert.equal(mq.running, true, 'it scrolls while shown');
    tip.close();
    assert.equal(mq.running, false, 'and stops when the tip goes away');
  });

  test('switching between modes does not leave the other showing', () => {
    const tip = mount();
    tip.openFor(trigger('{"msg":"scroll","mrq":true}'));
    tip.openFor(trigger('{"msg":"static","mrq":false}'));
    assert.equal(message(tip), 'static');
    assert.equal(tip.shadowRoot.querySelector('neodigm-marquee').getAttribute('text'), '');
  });
});

describe('theming', () => {
  test('text is the palette\'s ink on the theme colour, for every theme', async () => {
    // Was -deep on the colour, below AA on twelve of the thirteen themes, with
    // a hand-written exception for white and ghost.
    const { THEMES } = await import('../src/conductor/index.js');
    const tip = document.createElement('neodigm-tulip');
    document.body.append(tip);
    const css = tip.shadowRoot.querySelector('style').textContent;
    for (const name of Object.keys(THEMES)) {
      assert.match(css, new RegExp(
        `\\[${THEME_ATTR}="${name}"\\]\\) \\{\\s*background: var\\(--n55-${name}\\);\\s*color: var\\(--n55-${name}-ink\\);`
      ), `${name}`);
    }
    assert.doesNotMatch(css, /color: var\(--n55-[a-z]+-deep\)/);
  });
});
