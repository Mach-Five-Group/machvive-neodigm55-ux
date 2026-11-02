import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { onExitIntent, EXIT_KEY } from '../src/conductor/index.js';

const leave = (clientY, relatedTarget = null) =>
  document.dispatchEvent(new window.MouseEvent('mouseout', { clientY, relatedTarget, bubbles: true }));

beforeEach(() => window.sessionStorage.clear());

test('fires when the pointer leaves through the top edge', () => {
  let calls = 0;
  onExitIntent(() => calls++);
  leave(0);
  assert.equal(calls, 1);
});

test('ignores leaving through another edge, and moving between elements', () => {
  // The original fired on any edge: a second monitor counted as leaving.
  let calls = 0;
  onExitIntent(() => calls++, { once: 'page' });
  leave(400);
  leave(-5, document.body);
  assert.equal(calls, 0);
  leave(-5);
  assert.equal(calls, 1, 'above the viewport counts too');
});

test('fires once, and not again this session, even from a new subscription', () => {
  let calls = 0;
  onExitIntent(() => calls++);
  leave(0);
  leave(0);
  assert.equal(calls, 1);
  assert.ok(window.sessionStorage.getItem(EXIT_KEY), 'the original key, so migrated sites agree');
  onExitIntent(() => calls++);       // another page in the same session
  leave(0);
  assert.equal(calls, 1);
});

test('several subscribers all fire, which a single callback slot could not do', () => {
  const seen = [];
  onExitIntent(() => seen.push('a'));
  onExitIntent(() => seen.push('b'));
  leave(0);
  assert.deepEqual(seen, ['a', 'b']);
});

test('once: page ignores the session and fires once per load', () => {
  window.sessionStorage.setItem(EXIT_KEY, '1');
  let calls = 0;
  onExitIntent(() => calls++, { once: 'page' });
  leave(0);
  leave(0);
  assert.equal(calls, 1);
});

test('unsubscribing stops it', () => {
  let calls = 0;
  const off = onExitIntent(() => calls++);
  off();
  leave(0);
  assert.equal(calls, 0);
  assert.equal(window.sessionStorage.getItem(EXIT_KEY), null, 'and nothing was recorded');
});

test('storage that throws degrades to once per page rather than failing', () => {
  const view = { get sessionStorage() { throw new Error('sandboxed'); } };
  const doc = Object.assign(new window.EventTarget(), { defaultView: view });
  let calls = 0;
  onExitIntent(() => calls++, { doc });
  doc.dispatchEvent(new window.MouseEvent('mouseout', { clientY: 0 }));
  doc.dispatchEvent(new window.MouseEvent('mouseout', { clientY: 0 }));
  assert.equal(calls, 1);
});

test('with no document it is a no-op', () => {
  assert.equal(typeof onExitIntent(() => {}, { doc: null }), 'function');
});
