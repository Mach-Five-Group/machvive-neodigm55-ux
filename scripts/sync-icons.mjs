#!/usr/bin/env node
/**
 * Copies the icon set from machvive-chat-syncopation into src/conductor/icons.js.
 *
 * The two packages draw the same icons, and syncopation is where icons are
 * added: drop the Material Symbols files into its design/icons/ and run its
 * build-icons.mjs, then run this here.
 *
 *   npm run sync-icons                       # from ../machvive-chat-syncopation-ai
 *   npm run sync-icons -- path/to/icons.js   # from somewhere else
 *   npm run sync-icons -- --check            # exit 1 if out of date, change nothing
 *
 * The source is read as text and never imported, so nothing in the other
 * repository runs. Only the ICONS block is rewritten; the rest of the module is
 * this package's own.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_SOURCE = new URL(
  '../../machvive-chat-syncopation-ai/src/wc/machvive-chat-syncopation-services/icons.js',
  import.meta.url);
const TARGET = new URL('../src/conductor/icons.js', import.meta.url);

const OPEN = 'export const ICONS = Object.freeze({\n';
const CLOSE = '\n});';

/**
 * Reads `--mcs-icon-<name>: url("…");` declarations from syncopation's module.
 * Refuses anything that could not be a plain data-URI SVG, since it ends up
 * inside a JavaScript string and a CSS value.
 *
 * @param {string} source
 * @returns {Array<[string, string]>} sorted by name
 */
export function readIcons(source) {
  const icons = [...source.matchAll(/--mcs-icon-([a-z0-9-]+): (url\("[^"\n]*"\));/g)]
    .map(([, name, url]) => [name, url]);
  if (icons.length === 0) throw new Error('no --mcs-icon-* declarations found');
  for (const [name, url] of icons) {
    if (!/^url\("data:image\/svg\+xml,[^"#`$\\]+"\)$/.test(url)) {
      throw new Error(`${name}: not a data-URI SVG this script can copy safely`);
    }
  }
  const names = icons.map(([name]) => name);
  if (new Set(names).size !== names.length) throw new Error('an icon is declared twice');
  return icons.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The target module with its ICONS block replaced.
 *
 * @param {string} target
 * @param {Array<[string, string]>} icons
 */
export function writeIcons(target, icons) {
  const start = target.indexOf(OPEN);
  const end = target.indexOf(CLOSE, start);
  if (start === -1 || end === -1) throw new Error('no ICONS block in the target');
  const body = icons.map(([name, url]) => `  '${name}': ${JSON.stringify(url)}`).join(',\n');
  return target.slice(0, start + OPEN.length) + body + target.slice(end);
}

/** Names in one list and not the other. */
export function difference(before, after) {
  const was = new Set(before);
  const now = new Set(after);
  return {
    added: after.filter((n) => !was.has(n)),
    removed: before.filter((n) => !now.has(n))
  };
}

function main(args) {
  const check = args.includes('--check');
  const path = args.find((a) => !a.startsWith('--'));
  const source = path ? new URL(path, pathToFileURL(`${process.cwd()}/`)) : DEFAULT_SOURCE;

  const icons = readIcons(readFileSync(source, 'utf8'));
  const before = readFileSync(TARGET, 'utf8');
  const after = writeIcons(before, icons);
  const oldNames = [...before.matchAll(/^ {2}'([a-z0-9-]+)': /gm)].map(([, n]) => n);
  const { added, removed } = difference(oldNames, icons.map(([n]) => n));

  console.log(`${icons.length} icons in ${fileURLToPath(source)}`);
  if (added.length) console.log(`  added:   ${added.join(', ')}`);
  if (removed.length) console.log(`  removed: ${removed.join(', ')}`);
  if (after === before) { console.log('  already in step'); return 0; }
  if (check) { console.log('  out of date: run npm run sync-icons'); return 1; }
  writeFileSync(TARGET, after);
  console.log(`  wrote ${fileURLToPath(TARGET)}`);
  if (removed.length) console.log('  removed icons break pages that name them: that is a breaking change');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (err) {
    console.error(`sync-icons: ${err.message}`);
    process.exitCode = 2;
  }
}
