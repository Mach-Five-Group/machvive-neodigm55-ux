import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

/**
 * The real `npm pack` output, not the `files` allowlist — so drift surfaces
 * here rather than after a release. Module-scoped because both the tarball
 * tests and the plugin tests need it.
 */
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

// Found on disk rather than listed by hand. A hand-kept list had already
// fallen behind: Tulip shipped outside both guards that use this.
const components = readdirSync(new URL('src/wc/', root))
  .map((dir) => `src/wc/${dir}/${dir}.js`);
const conductor = readdirSync(new URL('src/conductor/', root))
  .filter((f) => f.endsWith('.js')).map((f) => `src/conductor/${f}`);

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

  test('every component is wired into all four places it must appear', () => {
    // Missing any one breaks either the bulk import or the cherry-pick, and
    // nothing else fails when it happens.
    const exported = Object.values(pkg.exports).map((c) => c.default).filter(Boolean);
    const indexJs = readFileSync(new URL('index.js', root), 'utf8');
    const indexDts = readFileSync(new URL('index.d.ts', root), 'utf8');
    for (const file of components) {
      const dts = file.replace(/\.js$/, '.d.ts');
      assert.doesNotThrow(() => readFileSync(new URL(dts, root)), `${dts} is missing`);
      assert.ok(exported.includes(`./${file}`), `${file} has no exports subpath`);
      assert.ok(indexJs.includes(`./${file}`), `${file} is not imported by index.js`);
      assert.ok(indexDts.includes(`./${file}`), `${file} is not re-exported by index.d.ts`);
    }
  });

  test('index.js exports every runtime name the conductor does', async () => {
    // index.d.ts re-exports the whole conductor, so a name index.js leaves out
    // type-checks and then fails at runtime. place and rectOf shipped that way.
    const conductor = await import('../src/conductor/index.js');
    const bulk = await import('../index.js');
    const missing = Object.keys(conductor).filter((name) => !(name in bulk));
    assert.deepEqual(missing, [], `index.js does not export ${missing.join(', ')}`);
  });

  test('publishes publicly, which a scoped package needs', () => {
    assert.equal(pkg.publishConfig?.access, 'public');
  });
});

describe('the published tarball', () => {
  test('ships the entry points, declarations and licence', () => {
    const files = packed();
    for (const required of [
      'index.js', 'index.d.ts', 'LICENSE', 'package.json',
      'src/conductor/index.js', 'src/conductor/theme.js',
      'src/wc/neodigm-toast/neodigm-toast.js',
      ...components, ...components.map((f) => f.replace(/\.js$/, '.d.ts'))
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
    const sources = ['index.js', ...conductor, ...components];
    assert.ok(components.length >= 4, `found only ${components.join(', ')}`);
    for (const file of sources) {
      const text = readFileSync(new URL(file, root), 'utf8');
      const hit = text.match(INVISIBLE);
      assert.equal(hit, null,
        `${file} contains U+${hit ? hit[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0') : ''}`);
    }
  });
});

describe('the README\'s vendoring table', () => {
  // Single-file consumers vendor the source and use this table to know what
  // to carry and which ::part() names they can rely on.
  const rows = new Map(readFileSync(new URL('README.md', root), 'utf8')
    .split('\n')
    .map((line) => /^\| `(neodigm-[a-z-]+)` \| ([^|]*) \| ([^|]*) \|$/.exec(line))
    .filter(Boolean)
    .map(([, tag, mods, parts]) => [tag, {
      modules: mods.split(',').map((m) => m.trim()).sort(),
      parts: parts.split(',').map((p) => p.trim()).sort()
    }]));

  /** Conductor modules a file needs, following the conductor's own imports. */
  const conductorNeeds = (file, seen = new Set()) => {
    const text = readFileSync(new URL(file, root), 'utf8');
    for (const [, name] of text.matchAll(/^import [^;]*from '(?:\.\.\/\.\.\/conductor\/|\.\/)([a-z]+)\.js';/gm)) {
      if (seen.has(name)) continue;
      seen.add(name);
      conductorNeeds(`src/conductor/${name}.js`, seen);
    }
    return [...seen].sort();
  };

  test('lists every component', () => {
    for (const file of components) {
      const tag = file.split('/')[2];
      assert.ok(rows.has(tag), `${tag} has no row`);
    }
  });

  test('names exactly the conductor modules each component needs at runtime', () => {
    for (const file of components) {
      const tag = file.split('/')[2];
      assert.deepEqual(rows.get(tag)?.modules, conductorNeeds(file), tag);
    }
  });

  test('a component that renders another lists that one\'s modules too', () => {
    // A vendored ActIcon draws through <neodigm-icon>, so it needs the icon
    // module even if it stopped importing it directly.
    for (const file of components) {
      const tag = file.split('/')[2];
      const text = readFileSync(new URL(file, root), 'utf8');
      for (const [, inner] of text.matchAll(/^import '\.\.\/(neodigm-[a-z-]+)\/\1\.js';/gm)) {
        for (const mod of rows.get(inner)?.modules ?? []) {
          assert.ok(rows.get(tag)?.modules.includes(mod), `${tag} renders ${inner}, which needs ${mod}`);
        }
      }
    }
  });

  test('names exactly the parts each component exposes', () => {
    for (const file of components) {
      const tag = file.split('/')[2];
      const text = readFileSync(new URL(file, root), 'utf8');
      const parts = [...new Set([...text.matchAll(/part="([a-z-]+)"/g)].map((m) => m[1]))].sort();
      assert.deepEqual(rows.get(tag)?.parts, parts, `${tag}: a part was added or removed`);
    }
  });
});

describe('the theme contract', () => {
  test('every component stylesheet themes from the host attribute, not a hardcoded hex', async () => {
    // The sweep sets `data-n55-theme` on a host; a component that painted a
    // literal colour would ignore both the sweep and any page override.
    // The whole file, not just its stylesheet: Buffet builds part of its CSS
    // in a helper outside STYLES, and a slice would have missed it.
    // Deliberate exceptions, all neutral ink or the unthemed default — none of
    // them a palette value, which is the thing that would drift.
    const allowed = new Set(['#fff', '#1a1a1a', '#2b2b2b']);
    for (const file of components) {
      const literals = readFileSync(new URL(file, root), 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      const unexpected = literals.filter((hex) => !allowed.has(hex.toLowerCase()));
      assert.deepEqual(unexpected, [],
        `${file}: hardcoded colours bypass the palette: ${unexpected.join(', ')}`);
    }
  });
});

describe('the Claude Code plugin', () => {
  const root2 = root;
  const skill = readFileSync(new URL(
    'plugins/machvive-neodigm55/skills/machvive-neodigm55/SKILL.md', root2), 'utf8');
  const plugin = JSON.parse(readFileSync(new URL(
    'plugins/machvive-neodigm55/.claude-plugin/plugin.json', root2), 'utf8'));
  const market = JSON.parse(readFileSync(new URL('.claude-plugin/marketplace.json', root2), 'utf8'));

  test('the skill names every component tag', () => {
    // The skill drifts with no symptom: tests pass, publishes succeed, and the
    // only evidence is an agent confidently teaching something untrue. A
    // sibling package's skill sat four releases behind, missing a whole
    // component, which is why this is mechanical rather than a convention.
    const tags = readdirSync(new URL('src/wc/', root2), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const tag of tags) {
      assert.ok(skill.includes(`<${tag}>`), `SKILL.md never mentions <${tag}>`);
    }
  });

  test('the skill names every published subpath', () => {
    const subpaths = Object.keys(pkg.exports)
      .filter((k) => k.startsWith('./') && k !== './package.json')
      .map((k) => k.slice(1));
    for (const sub of subpaths) {
      assert.ok(skill.includes(sub), `SKILL.md never mentions the ${sub} subpath`);
    }
  });

  test('the skill triggers on the tags it documents', () => {
    // The description is the whole triggering mechanism; a tag absent from it
    // means the skill never loads for the person asking about that component.
    const description = skill.split('---')[1];
    for (const tag of ['neodigm-toast', 'neodigm-poptart', 'neodigm-buffet']) {
      assert.ok(description.includes(tag), `the description omits ${tag}`);
    }
  });

  test('plugin and marketplace versions agree', () => {
    // They version independently of the npm package but must move together,
    // or a user installs a plugin whose manifest disagrees with the listing.
    assert.equal(plugin.version, market.version);
    assert.equal(plugin.version, market.plugins[0].version);
    assert.equal(plugin.name, market.plugins[0].name);
  });

  test('the marketplace points at a plugin directory that exists', () => {
    const source = market.plugins[0].source;
    assert.doesNotThrow(
      () => readFileSync(new URL(`${source}/.claude-plugin/plugin.json`, root2)),
      `${source} has no plugin.json`);
  });

  test('the plugin does not ship in the npm tarball', () => {
    // Claude Code does not scan node_modules, so a bundled skill would reach
    // every consumer and be discovered by none. The plugin route is the only
    // one with real discovery, and the files allowlist is what keeps them apart.
    const files = packed();
    assert.ok(!files.some((f) => f.startsWith('plugins/')), 'plugins/ must stay out of the tarball');
    assert.ok(!files.some((f) => f.startsWith('.claude-plugin/')), 'the marketplace must stay out too');
  });
});
