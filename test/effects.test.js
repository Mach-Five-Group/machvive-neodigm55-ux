import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  shake, countTo, typeOn, typeOff, isTyping, SHAKE_KEYFRAMES, SHAKE_TIMING
} from '../src/conductor/effects.js';
import { notify } from '../src/conductor/notify.js';
import { setMotionAllowed, resetMotion } from '../src/conductor/motion.js';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** Every text the element showed, in order: the visible letters while staged. */
function textTrail(el) {
  const seen = [];
  const read = () => {
    const view = el.querySelector('[aria-hidden="true"]');
    const text = view ? view.textContent : el.textContent;
    if (seen.at(-1) !== text) seen.push(text);
  };
  read();
  const mo = new MutationObserver(read);
  mo.observe(el, { childList: true, characterData: true, subtree: true });
  return { seen, stop: () => { read(); mo.disconnect(); return seen; } };
}

/** Every value an attribute took, in order. */
function attrTrail(el, name) {
  const seen = [];
  const mo = new MutationObserver(() => {
    const v = el.getAttribute(name);
    if (seen.at(-1) !== v) seen.push(v);
  });
  mo.observe(el, { attributes: true, attributeFilter: [name] });
  return { seen, stop: () => { mo.disconnect(); return seen; } };
}

function element(html = '', tag = 'div') {
  const el = document.createElement(tag);
  el.textContent = html;
  document.body.append(el);
  return el;
}

beforeEach(() => { document.body.replaceChildren(); setMotionAllowed(true); });
afterEach(() => { resetMotion(); delete HTMLElement.prototype.animate; });

/** A stand-in for Element.animate, which jsdom lacks. */
function stubAnimate() {
  const calls = [];
  HTMLElement.prototype.animate = function (frames, timing) {
    let finish;
    const run = {
      el: this, frames, timing, cancelled: false,
      finished: new Promise((resolve, reject) => { finish = { resolve, reject }; }),
      cancel() { run.cancelled = true; finish.reject(new DOMException('cancelled', 'AbortError')); },
      end() { finish.resolve(run); }
    };
    calls.push(run);
    return run;
  };
  return calls;
}

describe('shake', () => {
  test('shakes every element a selector names, as the original did, from where it stands', async () => {
    const calls = stubAnimate();
    const a = element('a'); a.className = 'x';
    const b = element('b'); b.className = 'x';
    element('c');
    const done = shake('.x');
    assert.deepEqual(calls.map((c) => c.el), [a, b]);
    for (const c of calls) {
      assert.equal(c.frames, SHAKE_KEYFRAMES);
      assert.deepEqual(c.timing, { ...SHAKE_TIMING, composite: 'add' });
    }
    assert.equal(SHAKE_KEYFRAMES.length, 11);
    calls.forEach((c) => c.end());
    assert.equal(await done, 2);
  });

  test('resolves only once every shake has finished', async () => {
    const calls = stubAnimate();
    let settled = false;
    shake(element()).then(() => { settled = true; });
    await tick();
    assert.equal(settled, false);
    calls[0].end();
    await tick();
    assert.equal(settled, true);
  });

  test('takes an element or a list as well as a selector', async () => {
    const calls = stubAnimate();
    const a = element(); const b = element();
    shake(a); shake([a, b, 'not an element']); shake(document.querySelectorAll('div'));
    assert.deepEqual(calls.map((c) => c.el), [a, a, b, a, b]);
  });

  test('a second shake restarts the first rather than stacking on it', async () => {
    const calls = stubAnimate();
    const el = element();
    const first = shake(el);
    shake(el);
    assert.equal(calls[0].cancelled, true);
    assert.equal(calls[1].cancelled, false);
    assert.equal(await first, 1, 'a restarted shake still resolves');
  });

  test('does nothing under suppressed motion', async () => {
    const calls = stubAnimate();
    setMotionAllowed(false);
    assert.equal(await shake(element()), 0);
    assert.equal(calls.length, 0);
  });

  test('does nothing where Element.animate does not exist', async () => {
    assert.equal(await shake(element()), 0);
  });
});

describe('countTo', () => {
  test('counts in sixteen even steps and lands exactly', async () => {
    const el = element('0');
    const trail = textTrail(el);
    assert.equal(await countTo(el, 160, { interval: 1 }), 1);
    assert.deepEqual(trail.stop(), ['0', ...Array.from({ length: 16 }, (_, i) => String((i + 1) * 10))]);
  });

  test('counts down, and every step is a whole number', async () => {
    const el = element('100');
    const trail = textTrail(el);
    await countTo(el, 3, { interval: 1, steps: 7 });
    const seen = trail.stop().map(Number);
    assert.equal(seen.at(-1), 3);
    assert.ok(seen.every(Number.isInteger));
    assert.ok(seen.every((n, i) => i === 0 || n < seen[i - 1]), seen.join());
  });

  test('a small difference still moves every step to the end', async () => {
    // The original moved by round(diff / 16): 0 for a difference of 5, so the
    // number sat still for fifteen ticks and jumped on the last.
    const el = element('0');
    const trail = textTrail(el);
    await countTo(el, 5, { interval: 1 });
    assert.deepEqual(trail.stop(), ['0', '1', '2', '3', '4', '5']);
  });

  test('starts from the number in the text, and reads its own numbers back, not the formatting', async () => {
    const el = element('1,000 visits');
    const format = (n) => `${n.toLocaleString('en-US')} visits`;
    const trail = textTrail(el);
    await countTo(el, 1016, { interval: 1, format });
    assert.equal(trail.seen[1], '1,001 visits');
    await countTo(el, 1000, { interval: 1, steps: 2, format: (n) => `${n} (de: ${String(n).replace(/(\d)(\d{3})$/, '$1.$2')})` });
    assert.equal(el.textContent, '1000 (de: 1.000)');
    await countTo(el, 1002, { interval: 1, steps: 2 });
    assert.equal(trail.stop().at(-2), '1001', 'counted from 1000, not from the formatted text');
  });

  test('every element a selector names', async () => {
    const a = element('0'); a.className = 'n';
    const b = element('50'); b.className = 'n';
    assert.equal(await countTo('.n', 10, { interval: 1 }), 2);
    assert.deepEqual([a.textContent, b.textContent], ['10', '10']);
  });

  test('a second count takes over from where the first had got to', async () => {
    const el = element('0');
    const first = countTo(el, 1600, { interval: 2 });
    await tick(12);
    const reached = Number(el.textContent);
    assert.ok(reached > 0 && reached < 1600, `got to ${reached}`);
    const trail = textTrail(el);
    await countTo(el, 0, { interval: 1, steps: 2 });
    await first;
    await tick(10);
    assert.deepEqual(trail.stop(), [String(reached), String(Math.round(reached / 2)), '0']);
  });

  test('lands at once under suppressed motion', async () => {
    setMotionAllowed(false);
    const el = element('3');
    const trail = textTrail(el);
    await countTo(el, 900);
    assert.deepEqual(trail.stop(), ['3', '900']);
  });

  test('an element that leaves the page lands and stops scheduling', async () => {
    const el = element('0');
    const done = countTo(el, 160, { interval: 5 });
    await tick(7);
    el.remove();
    const trail = textTrail(el);
    await done;
    await tick(20);
    assert.deepEqual(trail.stop().slice(1), ['160'], 'one write to land, then nothing');
  });

  test('refuses a value that is not a number', async () => {
    await assert.rejects(countTo(element(), NaN), TypeError);
    await assert.rejects(countTo(element(), '12'), TypeError);
  });
});

describe('typeOn', () => {
  const fast = { delay: 1, hold: 1 };

  test('types a letter at a time and finishes as plain text', async () => {
    const el = element();
    const trail = textTrail(el);
    assert.equal(await typeOn(el, 'Hey', fast), true);
    assert.deepEqual(trail.stop(), ['', 'H', 'He', 'Hey']);
    assert.equal(el.childNodes.length, 1);
    assert.equal(el.firstChild.nodeType, Node.TEXT_NODE);
  });

  test('a screen reader gets the phrase whole, never the letters', async () => {
    const el = element();
    const done = typeOn(el, 'Hello', { delay: 5 });
    await tick(12);
    const [spoken, view] = el.children;
    assert.equal(spoken.textContent, 'Hello');
    assert.match(spoken.getAttribute('style'), /clip-path:inset\(50%\)/);
    assert.ok(!spoken.hasAttribute('aria-hidden'));
    assert.equal(view.getAttribute('aria-hidden'), 'true');
    assert.ok(view.textContent.length < 5, 'still typing');
    await done;
  });

  test('erases what was there first', async () => {
    const el = element('Old');
    const trail = textTrail(el);
    await typeOn(el, 'New', fast);
    assert.deepEqual(trail.stop(), ['Old', 'Ol', 'O', '', 'N', 'Ne', 'New']);
  });

  test('types each phrase in turn, erasing between, and data-n55-typeon follows', async () => {
    const el = element();
    const text = textTrail(el);
    const index = attrTrail(el, 'data-n55-typeon');
    await typeOn(el, 'ab | cd', fast);
    assert.deepEqual(text.stop(), ['', 'a', 'ab', 'a', '', 'c', 'cd']);
    assert.deepEqual(index.stop(), ['0', '1']);
  });

  test('the first element a selector names, as the original\'s q1st', async () => {
    const a = element(); a.className = 't';
    const b = element(); b.className = 't';
    await typeOn('.t', 'x', fast);
    assert.deepEqual([a.textContent, b.textContent], ['x', '']);
  });

  test('loop goes round until something else types there', async () => {
    const el = element();
    const index = attrTrail(el, 'data-n55-typeon');
    const looping = typeOn(el, 'a|b', { ...fast, mode: 'LOOP' });
    while (index.seen.length < 4) await tick(1);
    assert.equal(isTyping(el), true);
    await typeOff(el, { delay: 1 });
    assert.equal(await looping, false);
    assert.deepEqual(index.stop().slice(0, 4), ['0', '1', '0', '1']);
    assert.equal(el.textContent, '');
    assert.equal(isTyping(el), false);
  });

  test('random types one phrase, and marks which', async () => {
    const random = Math.random;
    Math.random = () => 0.7;
    try {
      const el = element();
      await typeOn(el, 'a|b|c', { ...fast, mode: 'random' });
      assert.equal(el.textContent, 'c');
      assert.equal(el.getAttribute('data-n55-typeon'), '2');
    } finally { Math.random = random; }
  });

  test('under suppressed motion, the phrase that would end up showing appears whole', async () => {
    setMotionAllowed(false);
    const el = element('Old');
    const trail = textTrail(el);
    assert.equal(await typeOn(el, 'a|b', fast), true);
    assert.deepEqual(trail.stop(), ['Old', 'b']);
    assert.equal(el.getAttribute('data-n55-typeon'), '1');
    await typeOn(el, 'a|b', { ...fast, mode: 'loop' });
    assert.equal(el.textContent, 'a', 'a loop shows its first phrase and does not cycle');
    assert.equal(isTyping(el), false);
  });

  test('suppressing motion mid-typing stops the typing, rather than racing it', async () => {
    for (const finish of [(el) => typeOff(el), (el) => typeOn(el, 'still')]) {
      setMotionAllowed(true);
      const el = element();
      const first = typeOn(el, 'abcdefgh', { delay: 2 });
      await tick(6);
      setMotionAllowed(false);
      const expected = await finish(el).then(() => el.textContent);
      assert.equal(await first, false);
      await tick(30);
      assert.equal(el.textContent, expected, 'the first job did not carry on');
      assert.equal(isTyping(el), false);
    }
  });

  test('an emoji is one letter, never half of one', async () => {
    const el = element();
    const trail = textTrail(el);
    await typeOn(el, 'a\u{1F680}b', fast);
    assert.deepEqual(trail.stop(), ['', 'a', 'a\u{1F680}', 'a\u{1F680}b']);
  });

  test('taking over mid-phrase erases only the letters showing', async () => {
    const el = element();
    const first = typeOn(el, 'abcdefghij', { delay: 4 });
    await tick(14);
    const showing = el.children[1].textContent;
    assert.ok(showing.length > 0 && showing.length < 10, showing);
    const trail = textTrail(el);
    await typeOn(el, 'z', fast);
    assert.equal(await first, false);
    const seen = trail.stop();
    assert.deepEqual(seen.slice(0, 2), [showing, showing.slice(0, -1)],
      'the hidden copy was not erased as if it were visible');
    assert.equal(el.textContent, 'z');
  });

  test('stops when the element leaves the page', async () => {
    const el = element();
    const done = typeOn(el, 'abcdef', { delay: 3 });
    await tick(5);
    el.remove();
    assert.equal(await done, false);
    assert.equal(isTyping(el), false);
  });

  test('mode off erases', async () => {
    const el = element('bye');
    const trail = textTrail(el);
    assert.equal(await typeOn(el, 'ignored', { delay: 1, mode: 'OFF' }), true);
    assert.deepEqual(trail.stop(), ['bye', 'by', 'b', '']);
  });

  test('nothing to type into resolves false', async () => {
    assert.equal(await typeOn('#nowhere', 'x', fast), false);
  });
});

describe('typeOff', () => {
  test('erases a letter at a time', async () => {
    const el = element('abc');
    const trail = textTrail(el);
    assert.equal(await typeOff(el, { delay: 1 }), true);
    assert.deepEqual(trail.stop(), ['abc', 'ab', 'a', '']);
    assert.equal(el.childNodes.length, 0);
  });

  test('empties at once under suppressed motion', async () => {
    setMotionAllowed(false);
    const el = element('abc');
    const trail = textTrail(el);
    await typeOff(el);
    assert.deepEqual(trail.stop(), ['abc', '']);
  });
});

describe('notify', () => {
  /** A Notification stand-in that records what it was given. */
  function stubNotification(permission, answer = permission) {
    const shown = [];
    let asked = 0;
    globalThis.Notification = class {
      static permission = permission;
      static requestPermission() { asked += 1; return Promise.resolve(answer); }
      constructor(title, options) { shown.push({ title, options }); }
    };
    return { shown, asked: () => asked };
  }
  afterEach(() => { delete globalThis.Notification; });

  test('is unsupported where there is no Notification', async () => {
    assert.equal(await notify('x'), 'unsupported');
  });

  test('shows the message with the title and icon given', async () => {
    const n = stubNotification('granted');
    assert.equal(await notify('Done', { title: 'Exports', icon: '/i.png', tag: 't' }), 'shown');
    assert.deepEqual(n.shown, [{ title: 'Exports', options: { tag: 't', body: 'Done', icon: '/i.png' } }]);
    assert.equal(n.asked(), 0);
  });

  test('fetches no icon of its own, and titles itself with the time', async () => {
    // The original defaulted to a GitHub avatar URL.
    const n = stubNotification('granted');
    await notify('Done');
    assert.ok(!('icon' in n.shown[0].options));
    assert.match(n.shown[0].title, /\d/);
  });

  test('asks first when never asked, and reports the answer', async () => {
    const yes = stubNotification('default', 'granted');
    assert.equal(await notify('x'), 'shown');
    assert.equal(yes.asked(), 1);
    const no = stubNotification('default', 'denied');
    assert.equal(await notify('x'), 'denied');
    assert.equal(no.shown.length, 0);
    stubNotification('default', 'default');
    assert.equal(await notify('x'), 'default');
  });

  test('never asks again once denied', async () => {
    const n = stubNotification('denied');
    assert.equal(await notify('x'), 'denied');
    assert.equal(n.asked(), 0);
  });

  test('a browser that notifies only from a service worker is unsupported, not an error', async () => {
    stubNotification('granted');
    globalThis.Notification = class extends globalThis.Notification {
      constructor() { super(); throw new TypeError('Illegal constructor'); }
    };
    assert.equal(await notify('x'), 'unsupported');
  });
});
