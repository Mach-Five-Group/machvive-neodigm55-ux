/**
 * jsdom globals, installed before any module loads.
 *
 * Required, not optional: the component modules self-register and evaluate
 * `class extends HTMLElement` at import time, so the DOM has to exist first.
 * The runner gives each test file its own process, so every file starts from a
 * clean document.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head><title>Neodigm</title></head><body></body></html>', {
  url: 'https://localhost',
  pretendToBeVisual: true
});

globalThis.window = dom.window;
for (const key of [
  'document', 'HTMLElement', 'customElements', 'Event', 'CustomEvent', 'EventTarget',
  'Node', 'DOMException', 'getComputedStyle', 'MutationObserver', 'AbortController'
]) {
  globalThis[key] = dom.window[key];
}
// Node's own `navigator` is getter-only, so it has to be redefined rather than assigned.
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.isSecureContext = true;

// jsdom ships matchMedia only behind a flag. The motion gate has to work
// whether or not it exists, so the default here is "no media query available"
// and the tests that care install their own stub.
