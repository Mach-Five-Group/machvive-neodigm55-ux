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
  test('uses the preferred side when it fits', () => {
    const at = place({
      trigger: { x: 400, y: 300, width: 100, height: 40 },
      surface: { x: 0, y: 0, width: 200, height: 50 },
      viewport: { width: 1000, height: 800 },
      position: 'top'
    });
    assert.equal(at.side, 'top');
    assert.equal(at.flipped, false);
    assert.equal(at.y, 300 - 50 - 8, 'sits above the trigger, with the gap');
  });

  test('flips to the opposite side rather than running off screen', () => {
    // The original computed a left offset and never checked the viewport, so a
    // tip on a trigger near an edge simply rendered where it could not be read.
    const at = place({
      trigger: { x: 400, y: 4, width: 100, height: 40 },
      surface: { x: 0, y: 0, width: 200, height: 60 },
      viewport: { width: 1000, height: 800 },
      position: 'top'
    });
    assert.equal(at.side, 'bottom');
    assert.equal(at.flipped, true);
  });

  test('tries the perpendicular sides before giving up', () => {
    const at = place({
      trigger: { x: 450, y: 380, width: 100, height: 40 },
      // Tall enough that neither top nor bottom fits, short enough that a side
      // does — if it fitted nowhere this would clamp instead, which is the next
      // test.
      surface: { x: 0, y: 0, width: 120, height: 400 },
      viewport: { width: 1000, height: 700 },
      position: 'top'
    });
    assert.ok(at.side === 'right' || at.side === 'left', `fell back to ${at.side}`);
    assert.equal(at.clamped, false, 'it found a real fit, not a clamp');
  });

  test('clamps on screen when nothing fits at all', () => {
    const at = place({
      trigger: { x: 10, y: 10, width: 20, height: 20 },
      surface: { x: 0, y: 0, width: 900, height: 900 },
      viewport: { width: 400, height: 400 },
      position: 'top'
    });
    assert.equal(at.clamped, true);
    assert.ok(at.x >= 0 && at.y >= 0, 'never positioned off the top-left');
  });

  test('the chosen side is exposed on the host, for styling and for tests', () => {
    const tip = mount();
    tip.openFor(trigger('x'));
    assert.ok(['top', 'right', 'bottom', 'left'].includes(tip.getAttribute('data-side')));
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
