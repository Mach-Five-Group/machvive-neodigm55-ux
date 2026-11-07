import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readIcons, writeIcons, difference } from '../scripts/sync-icons.mjs';
import { ICONS } from '../src/conductor/icons.js';

const target = readFileSync(new URL('../src/conductor/icons.js', import.meta.url), 'utf8');
const svg = (d) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='${d}'/%3E%3C/svg%3E")`;
/** Syncopation's generated module, cut down to what the script reads. */
const source = (decls) => `export const ICON_ROOT_CSS = \`\n:root {\n${decls.join('\n')}\n}\n\`;\n` +
  'export const ICON_CSS = `.mcs-icon-a { --mcs-icon-img: var(--mcs-icon-a); }`;\n';

describe('sync-icons', () => {
  test('reads every declaration, sorted, and ignores the class rules', () => {
    const icons = readIcons(source([
      `  --mcs-icon-zoom: ${svg('M1z')};`,
      `  --mcs-icon-arrow-up: ${svg('M2z')};`
    ]));
    assert.deepEqual(icons.map(([n]) => n), ['arrow-up', 'zoom']);
    assert.equal(icons[1][1], svg('M1z'));
  });

  test('refuses anything that is not a plain data-URI SVG', () => {
    // It lands inside a JavaScript string and a CSS value.
    for (const bad of [
      'url("https://example.com/a.svg")',
      'url("data:image/svg+xml,%3Csvg fill=\'#000\'/%3E")',
      'url("data:image/svg+xml,`${alert(1)}`")'
    ]) {
      assert.throws(() => readIcons(source([`  --mcs-icon-x: ${bad};`])), /not a data-URI SVG/, bad);
    }
  });

  test('refuses an empty source or a name declared twice', () => {
    assert.throws(() => readIcons('nothing here'), /no --mcs-icon/);
    assert.throws(() => readIcons(source([`  --mcs-icon-a: ${svg('1')};`, `  --mcs-icon-a: ${svg('2')};`])),
      /twice/);
  });

  test('rewrites only the ICONS block, as a module that still loads', async () => {
    const out = writeIcons(target, [['new-icon', svg('M3z')], ['search', ICONS.search]]);
    const head = target.slice(0, target.indexOf('export const ICONS'));
    const tail = target.slice(target.indexOf('\n});'));
    assert.ok(out.startsWith(head) && out.endsWith(tail));
    const mod = await import(`data:text/javascript,${encodeURIComponent(out)}`);
    assert.deepEqual(mod.ICON_NAMES, ['new-icon', 'search']);
    assert.equal(mod.ICONS['new-icon'], svg('M3z'));
  });

  test('the shipped set round-trips unchanged', () => {
    const decls = Object.entries(ICONS).map(([n, u]) => `  --mcs-icon-${n}: ${u};`);
    assert.equal(writeIcons(target, readIcons(source(decls))), target);
  });

  test('reports what was added and removed', () => {
    assert.deepEqual(difference(['a', 'b'], ['b', 'c']), { added: ['c'], removed: ['a'] });
  });
});
