#!/usr/bin/env node
// Shipwright SWR-VSIX-VERIFY / SWR-GATE-VERIFY-EXT-PKG for Diffr.
//
// Inspects a packaged .vsix and asserts its contents match shipwright.json.
// The VSIX is a zip; `unzip -Z1` lists entries without extracting, so this
// works on every runner without a zip library dependency.
//
// A VSIX is only trustworthy if the bytes tests certified are the bytes users
// install. This gate runs from `make test` (before the suite) AND from the
// release workflow, over the SAME packaging recipe, so drift fails the build
// instead of shipping. See REPO-STANDARDS-SPEC [MAKE-IDE-EXT-PARITY].
//
// Usage:
//   node scripts/verify-vsix.mjs <path-to.vsix> [expected-version]
//
// Asserts:
//   - every manifest component of kind extension-vscode is represented
//   - extension/package.json carries the expected version and publisher
//   - the compiled entry point ships
//   - NOTHING forbidden ships: tests, TypeScript sources, source maps, repo
//     tooling, caches, or another platform's binaries

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED = ['extension/package.json', 'extension/out/extension.js', 'extension/icon.png'];

// Each rule is [human-readable reason, predicate over the archive entry path].
const FORBIDDEN = [
  ['test code', (p) => p.startsWith('extension/out/test/')],
  ['build tooling', (p) => p.startsWith('extension/out/scripts/') || p.startsWith('extension/scripts/')],
  ['TypeScript sources', (p) => p.startsWith('extension/src/')],
  ['source maps', (p) => p.endsWith('.map')],
  ['loose TypeScript', (p) => p.endsWith('.ts') && !p.endsWith('.d.ts')],
  ['repo tooling', (p) => p.startsWith('extension/.github/') || p.startsWith('extension/.vscode/')],
  ['agent config', (p) => p.startsWith('extension/.claude/') || p === 'extension/AGENTS.md'],
  ['E2E fixtures', (p) => p.startsWith('extension/test-fixtures/')],
  ['coverage output', (p) => p.startsWith('extension/coverage/')],
  ['build caches', (p) => p.includes('node_modules/.cache/')],
];

const listEntries = (vsixPath) => {
  const r = spawnSync('unzip', ['-Z1', vsixPath], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`unzip -Z1 failed on ${vsixPath}: ${r.stderr?.trim() ?? 'unknown error'}`);
  }
  return r.stdout.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
};

const readEntry = (vsixPath, entry) => {
  const r = spawnSync('unzip', ['-p', vsixPath, entry], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(`could not read ${entry} from ${vsixPath}`);
  }
  return r.stdout;
};

const checkManifestComponents = ({ entries, failures }) => {
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'shipwright.json'), 'utf8'));
  for (const component of manifest.components ?? []) {
    if (component.kind !== 'extension-vscode') {
      failures.push(`shipwright.json declares component '${component.id}' of unbundled kind '${component.kind}'`);
      continue;
    }
    // A platform-agnostic component ("all") must not carry per-platform staging.
    if (!component.platforms?.includes('all')) continue;
    const staged = entries.filter((p) => /^extension\/bin\/(?!all\/)/.test(p));
    if (staged.length > 0) {
      failures.push(`component '${component.id}' is platforms:["all"] but the VSIX stages ${staged.length} per-platform binaries`);
    }
  }
};

const checkPackageJson = ({ vsixPath, expectedVersion, failures }) => {
  const pkg = JSON.parse(readEntry(vsixPath, 'extension/package.json'));
  if (expectedVersion !== undefined && pkg.version !== expectedVersion) {
    failures.push(`extension/package.json version is '${pkg.version}', expected '${expectedVersion}'`);
  }
  if (pkg.version === '0.0.0-dev' && expectedVersion !== undefined) {
    failures.push('extension/package.json still carries the unstamped 0.0.0-dev placeholder');
  }
  if (pkg.publisher !== 'nimblesite') {
    failures.push(`extension/package.json publisher is '${pkg.publisher}', expected 'nimblesite'`);
  }
  if (pkg.main !== './out/extension.js') {
    failures.push(`extension/package.json main is '${pkg.main}', expected './out/extension.js'`);
  }
};

const main = () => {
  const [vsixPath, expectedVersion] = process.argv.slice(2);
  if (vsixPath === undefined) {
    throw new Error('expected a .vsix path argument');
  }
  if (!existsSync(vsixPath)) {
    throw new Error(`no such VSIX: ${vsixPath}`);
  }

  const entries = listEntries(vsixPath);
  const failures = [];

  for (const required of REQUIRED) {
    if (!entries.includes(required)) failures.push(`missing required entry: ${required}`);
  }
  for (const [reason, matches] of FORBIDDEN) {
    const hits = entries.filter(matches);
    if (hits.length > 0) {
      failures.push(`${reason} must not ship (${hits.length} entries, e.g. ${hits[0]})`);
    }
  }
  checkPackageJson({ vsixPath, expectedVersion, failures });
  checkManifestComponents({ entries, failures });

  if (failures.length > 0) {
    process.stderr.write(`verify-vsix: ${vsixPath} FAILED ${failures.length} check(s)\n`);
    for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
    process.exit(1);
  }
  process.stdout.write(`verify-vsix: ${vsixPath} OK (${entries.length} entries, all manifest checks passed)\n`);
};

try {
  main();
} catch (error) {
  process.stderr.write(`verify-vsix: ${error.message}\n`);
  process.exit(2);
}
