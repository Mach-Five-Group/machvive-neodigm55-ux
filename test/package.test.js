import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

/**
 * Manifest guards.
 *
 * Every one of these is here because it broke a previous release of a sibling
 * package, and each fails in a way that looks like something else: a tag that
 * never upgrades, declarations TypeScript cannot find, a self-dependency that
 * reached npm. Attention does not catch them; a test does.
 */
describe('the manifest', () => {
  test('declares no runtime dependencies', () => {
    // `npm install <own-package>` with this repo as cwd adds a self-dependency,
    // and `git add -A` ships it. A sibling package published exactly that.
    assert.equal(pkg.dependencies, undefined, `unexpected: ${JSON.stringify(pkg.dependencies)}`);
    assert.equal(pkg.peerDependencies, undefined);
    assert.equal(pkg.optionalDependencies, undefined);
  });

  test('the lock file agrees that there are no runtime dependencies', () => {
    // The manifest and the lock drift independently, and a background tool on
    // this machine has re-added a dependency to sibling repos more than once.
    const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));
    const own = lock.packages?.[''] ?? {};
    assert.equal(own.dependencies, undefined, 'the lock file carries a runtime dependency');
  });

  test('sideEffects is never false', () => {
    // Components self-register via customElements.define() on import. A `false`
    // lets a bundler drop `import "pkg/toast"` and the tag silently never upgrades.
    assert.notEqual(pkg.sideEffects, false);
  });

  test('types is the first condition in every exports subpath', () => {
    // TypeScript resolves conditions in order and misses declarations placed
    // after `default`.
    for (const [subpath, conditions] of Object.entries(pkg.exports)) {
      if (typeof conditions === 'string') continue;   // e.g. ./package.json
      assert.equal(Object.keys(conditions)[0], 'types', `${subpath} does not list types first`);
    }
  });

  test('every exported entry point has a sibling .d.ts that exists', () => {
    for (const [subpath, conditions] of Object.entries(pkg.exports)) {
      if (typeof conditions === 'string') continue;
      const types = conditions.types;
      assert.ok(types, `${subpath} declares no types`);
      assert.doesNotThrow(() => readFileSync(new URL(types, root)), `${types} is missing`);
    }
  });

  test('the declared licence ships', () => {
    const license = readFileSync(new URL('LICENSE', root), 'utf8');
    assert.match(license, /Apache License/);
    assert.equal(pkg.license, 'Apache-2.0');
  });

  test('publishes publicly, which a scoped package needs', () => {
    assert.equal(pkg.publishConfig?.access, 'public');
  });
});

describe('the published tarball', () => {
  // Asserts the real `npm pack` output rather than the `files` allowlist, so
  // drift surfaces here instead of after a release.
  const packed = () => {
    const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: new URL('.', root), encoding: 'utf8'
    });
    const parsed = JSON.parse(out);
    // npm 12 changed this from an array to an object keyed by package name.
    // A test that assumes one shape passes locally and fails in CI.
    const entry = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
    return entry.files.map((f) => f.path);
  };

  test('ships the entry points, declarations and licence', () => {
    const files = packed();
    for (const required of [
      'index.js', 'index.d.ts', 'LICENSE', 'package.json',
      'src/conductor/index.js', 'src/conductor/theme.js',
      'src/wc/neodigm-toast/neodigm-toast.js',
      'src/wc/neodigm-toast/neodigm-toast.d.ts'
    ]) {
      assert.ok(files.includes(required), `${required} is not in the tarball`);
    }
  });

  test('does not ship tests or design assets', () => {
    const files = packed();
    assert.ok(!files.some((f) => f.startsWith('test/')), 'tests must not ship');
    assert.ok(!files.some((f) => f.startsWith('design/')), 'design assets must not ship');
  });
});

describe('the headless boundary', () => {
  // The conductor's whole value is that a build step, a CI check or a theme
  // builder can import it with no DOM. Both halves are pinned: if the component
  // subpath ever stops throwing in Node, the separation is no longer needed —
  // and if the conductor starts throwing, it has been quietly broken.
  const runInBareNode = (specifier) => {
    try {
      execFileSync(process.execPath, ['-e', `import(${JSON.stringify(specifier)}).catch(e => { console.error(e.message); process.exit(3); })`], {
        cwd: new URL('.', root), encoding: 'utf8', stdio: 'pipe'
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: String(err.stderr ?? err.message) };
    }
  };

  test('the conductor imports with no DOM at all', () => {
    const result = runInBareNode('./src/conductor/index.js');
    assert.ok(result.ok, `the conductor must stay headless: ${result.message}`);
  });

  test('the component subpath still needs a DOM, which is why the split exists', () => {
    const result = runInBareNode('./src/wc/neodigm-toast/neodigm-toast.js');
    assert.equal(result.ok, false, 'if this now loads, the headless split may be unnecessary');
    assert.match(result.message, /HTMLElement is not defined/);
  });
});

describe('what ships', () => {
  test('no source file carries an invisible control character', () => {
    // This package documents and replaces a colour mechanism built from
    // zero-width and bidi control characters, so those characters turn up in
    // comments and tests constantly. Two of them reached a shipped source file
    // while this very component was being written: U+2028 LINE SEPARATOR is a
    // line terminator in JavaScript and broke the file outright, and U+202A
    // LEFT-TO-RIGHT EMBEDDING reorders whatever follows it. Name them, never
    // paste them.
    const INVISIBLE = new RegExp(
      '[\\u200B-\\u200F\\u2028\\u2029\\u202A-\\u202E\\u2060-\\u2064\\u206A-\\u206F\\uFEFF]');
    const sources = [
      'index.js',
      'src/conductor/theme.js', 'src/conductor/motion.js',
      'src/conductor/choreography.js', 'src/conductor/index.js',
      'src/wc/neodigm-toast/neodigm-toast.js',
      'src/wc/neodigm-marquee/neodigm-marquee.js'
    ];
    for (const file of sources) {
      const text = readFileSync(new URL(file, root), 'utf8');
      const hit = text.match(INVISIBLE);
      assert.equal(hit, null,
        `${file} contains U+${hit ? hit[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0') : ''}`);
    }
  });
});

describe('the theme contract', () => {
  test('every component stylesheet themes from the host attribute, not a hardcoded hex', async () => {
    // The sweep sets `data-n55-theme` on a host; a component that painted a
    // literal colour would ignore both the sweep and any page override.
    const source = readFileSync(
      new URL('src/wc/neodigm-toast/neodigm-toast.js', root), 'utf8');
    const styles = source.slice(source.indexOf('const STYLES'), source.indexOf('let delegatedListener'));

    const literals = styles.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    // Deliberate exceptions, all neutral ink or the unthemed default — none of
    // them a palette value, which is the thing that would drift.
    const allowed = new Set(['#fff', '#1a1a1a', '#2b2b2b']);
    const unexpected = literals.filter((hex) => !allowed.has(hex.toLowerCase()));
    assert.deepEqual(unexpected, [],
      `hardcoded colours bypass the palette: ${unexpected.join(', ')}`);
  });
});
