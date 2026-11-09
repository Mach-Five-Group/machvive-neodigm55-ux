import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import '../src/wc/neodigm-conductor/neodigm-conductor.js';
import { isTyping } from '../src/conductor/effects.js';
import { setMotionAllowed, resetMotion } from '../src/conductor/motion.js';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** Records every element shaken. jsdom has no Element.animate. */
function stubAnimate() {
  const shaken = [];
  HTMLElement.prototype.animate = function () {
    shaken.push(this);
    return { finished: Promise.resolve(), cancel() {} };
  };
  return shaken;
}

function stubNotification() {
  const shown = [];
  globalThis.Notification = class {
    static permission = 'granted';
    constructor(title, options) { shown.push({ title, ...options }); }
  };
  return shown;
}

/** Captures console.warn for the length of a test. */
function warnings() {
  const said = [];
  const warn = console.warn;
  console.warn = (m) => said.push(String(m));
  return { said, restore: () => { console.warn = warn; } };
}

function mount(html) {
  document.body.innerHTML = html;
  return document.body;
}

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
const hover = (el) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
const MouseEvent = globalThis.window.MouseEvent;
const FocusEvent = globalThis.window.FocusEvent;

beforeEach(() => { setMotionAllowed(true); });
afterEach(() => {
  document.body.replaceChildren();   // disconnects every conductor, unwiring the page
  resetMotion();
  delete HTMLElement.prototype.animate;
  delete globalThis.Notification;
});

describe('<neodigm-conductor>', () => {
  test('draws nothing', () => {
    mount('<neodigm-conductor></neodigm-conductor>');
    const el = document.querySelector('neodigm-conductor');
    assert.match(el.shadowRoot.innerHTML, /:host \{ display: none; \}/);
    assert.equal(el.shadowRoot.children.length, 1);
  });

  test('data-n55-shake shakes what its selector names', () => {
    const shaken = stubAnimate();
    mount(`<neodigm-conductor></neodigm-conductor>
      <button data-n55-shake="#logo, .also"><span>Go</span></button>
      <img id="logo"><p class="also"></p>`);
    click(document.querySelector('span'));
    assert.deepEqual(shaken, [document.getElementById('logo'), document.querySelector('.also')]);
  });

  test('an empty data-n55-shake shakes the trigger', () => {
    const shaken = stubAnimate();
    mount('<neodigm-conductor></neodigm-conductor><button data-n55-shake>Go</button>');
    click(document.querySelector('button'));
    assert.deepEqual(shaken, [document.querySelector('button')]);
  });

  test('a trigger themed disabled does nothing', () => {
    const shaken = stubAnimate();
    mount(`<neodigm-conductor></neodigm-conductor>
      <button data-n55-shake data-n55-theme="disabled">Go</button>`);
    click(document.querySelector('button'));
    assert.deepEqual(shaken, []);
  });

  test('triggers work only while a conductor is on the page, however many there are', () => {
    const shaken = stubAnimate();
    mount('<button data-n55-shake>Go</button>');
    const button = document.querySelector('button');
    click(button);
    assert.equal(shaken.length, 0, 'no conductor yet');

    const a = document.createElement('neodigm-conductor');
    const b = document.createElement('neodigm-conductor');
    document.body.append(a, b);
    click(button);
    assert.equal(shaken.length, 1, 'two conductors still shake once');

    a.remove();
    click(button);
    assert.equal(shaken.length, 2, 'one left is enough');

    b.remove();
    click(button);
    assert.equal(shaken.length, 2, 'none left, no triggers');

    document.body.append(b);
    click(button);
    assert.equal(shaken.length, 3, 'reconnecting rewires');
  });

  test('a trigger inside another component\'s shadow root still fires', () => {
    const shaken = stubAnimate();
    mount('<neodigm-conductor></neodigm-conductor><div id="host"></div>');
    const root = document.getElementById('host').attachShadow({ mode: 'open' });
    root.innerHTML = '<button data-n55-shake>Go</button>';
    click(root.querySelector('button'));
    assert.deepEqual(shaken, [root.querySelector('button')]);
  });

  test('a selector the page wrote wrong warns rather than throwing', async () => {
    stubAnimate();
    const w = warnings();
    try {
      mount('<neodigm-conductor></neodigm-conductor><button data-n55-shake="#[">Go</button>');
      assert.doesNotThrow(() => click(document.querySelector('button')));
      await tick();
      assert.match(w.said.join('\n'), /neodigm-conductor: data-n55-shake="#\["/);
    } finally { w.restore(); }
  });

  test('data-n55-typeon-click reads the original\'s JSON', async () => {
    mount(`<neodigm-conductor></neodigm-conductor>
      <button data-n55-typeon-click='{"q1st": "#out", "msg": "ab|cd", "uniqueDelay": 1, "hold": 1, "mode": "RANDOM"}'>Go</button>
      <p id="out"></p>`);
    const random = Math.random;
    Math.random = () => 0.9;
    try {
      click(document.querySelector('button'));
      const out = document.getElementById('out');
      assert.equal(isTyping(out), true);
      while (isTyping(out)) await tick(1);
      assert.equal(out.textContent, 'cd');
      assert.equal(out.getAttribute('data-n55-typeon'), '1');
    } finally { Math.random = random; }
  });

  test('a plain string types itself into the trigger', async () => {
    mount('<neodigm-conductor></neodigm-conductor><h2 data-n55-typeon-click="Hi">Old</h2>');
    const h2 = document.querySelector('h2');
    click(h2);
    assert.equal(isTyping(h2), true);
    while (isTyping(h2)) await tick(1);
    assert.equal(h2.textContent, 'Hi');
  });

  test('a value that parses as JSON but is not an object is the message', async () => {
    mount('<neodigm-conductor></neodigm-conductor><h2 data-n55-typeon-click="42">Old</h2>');
    const h2 = document.querySelector('h2');
    click(h2);
    while (isTyping(h2)) await tick(1);
    assert.equal(h2.textContent, '42');
  });

  test('data-n55-typeon-hover starts on hover or focus, and does not restart while typing', async () => {
    mount(`<neodigm-conductor></neodigm-conductor>
      <a href="#" data-n55-typeon-hover='{"q1st": "#out", "msg": "abcdef", "uniqueDelay": 3}'><b>x</b></a>
      <p id="out"></p>`);
    const out = document.getElementById('out');
    hover(document.querySelector('b'));
    await tick(8);
    const before = out.children[1].textContent;
    assert.ok(before.length > 0, 'started');
    const seen = [];
    const mo = new MutationObserver(() => seen.push(out.querySelector('[aria-hidden]')?.textContent ?? out.textContent));
    mo.observe(out, { childList: true, characterData: true, subtree: true });
    hover(document.querySelector('a'));            // crossing into a child repeats mouseover
    while (isTyping(out)) await tick(1);
    mo.disconnect();
    assert.ok(seen.every((t, i) => t.length >= (seen[i - 1] ?? before).length),
      `carried on rather than erasing to start again: ${seen.join(' ')}`);
    assert.equal(out.textContent, 'abcdef');

    out.textContent = '';
    document.querySelector('a').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    assert.equal(isTyping(out), true, 'the keyboard reaches it too');
  });

  test('data-n55-notify shows a notification with its title and icon', async () => {
    const shown = stubNotification();
    mount(`<neodigm-conductor></neodigm-conductor>
      <button data-n55-notify="Ready" data-n55-notify-title="Exports" data-n55-notify-icon="/i.png">Go</button>`);
    click(document.querySelector('button'));
    await tick();
    assert.deepEqual(shown, [{ title: 'Exports', body: 'Ready', icon: '/i.png' }]);
  });

  test('one click fires every trigger on its path', () => {
    const shaken = stubAnimate();
    const shown = stubNotification();
    mount(`<neodigm-conductor></neodigm-conductor>
      <div data-n55-shake data-n55-notify="Hi"><button data-n55-typeon-click="Yo">Go</button></div>`);
    click(document.querySelector('button'));
    assert.deepEqual(shaken, [document.querySelector('div')]);
    assert.equal(isTyping(document.querySelector('button')), true);
    return tick().then(() => assert.equal(shown.length, 1));
  });

  test('its methods call the conductor', async () => {
    const shaken = stubAnimate();
    mount('<neodigm-conductor></neodigm-conductor><b id="n">0</b>');
    const c = document.querySelector('neodigm-conductor');
    assert.equal(await c.shake('#n'), 1);
    assert.deepEqual(shaken, [document.getElementById('n')]);
    const counted = [];
    const mo = new MutationObserver(() => counted.push(document.getElementById('n').textContent));
    mo.observe(document.getElementById('n'), { childList: true });
    assert.equal(await c.countTo('#n', 32, { interval: 1, steps: 2 }), 1);
    mo.disconnect();
    assert.deepEqual(counted, ['16', '32'], 'its options arrived');
    assert.equal(await c.typeOn('#n', 'ok', { delay: 1 }), true);
    assert.equal(document.getElementById('n').textContent, 'ok');
    assert.equal(await c.typeOff('#n', { delay: 1 }), true);
    assert.equal(document.getElementById('n').textContent, '');
    assert.equal(await c.notify('x'), 'unsupported');
  });
});
