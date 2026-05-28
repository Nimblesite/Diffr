#!/usr/bin/env node
// Shipwright SWR-REL-VERSION-VERIFY for Diffr.
//
// After scripts/stamp-release-version.mjs runs, assert that every deployed
// version carrier in the runner working tree agrees with the expected version.
// Exits non-zero on the first mismatch so publish jobs cannot run with a
// half-stamped tree.
//
// Usage:
//   node scripts/verify-versions.mjs <version>     # bare semver or v-prefixed
//
// Checks:
//   - package.json                 .version
//   - package-lock.json            .version and .packages[""].version
//   - shipwright.json              .product.version
//                                  every literal .components[].expectedVersion
//   - build-info.json              .version
//
// ${PRODUCT_VERSION} placeholders are accepted in expectedVersion fields.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const PRODUCT_VERSION_TEMPLATE = '${PRODUCT_VERSION}';

const normalizeTag = (tag) => {
  const candidate = tag.startsWith('v') ? tag.slice(1) : tag;
  if (!SEMVER.test(candidate)) {
    throw new Error(`invalid tag '${tag}'; expected semver like v1.2.3 or 1.2.3`);
  }
  return candidate;
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const checks = [];

const expect = ({ label, actual, expected }) => {
  checks.push({ label, actual, expected, ok: actual === expected });
};

const verifyPackageJson = (version) => {
  const path = resolve(repoRoot, 'package.json');
  if (!existsSync(path)) return;
  const pkg = readJson(path);
  expect({ label: 'package.json :: version', actual: pkg.version, expected: version });
};

const verifyPackageLock = (version) => {
  const path = resolve(repoRoot, 'package-lock.json');
  if (!existsSync(path)) return;
  const lock = readJson(path);
  expect({ label: 'package-lock.json :: version', actual: lock.version, expected: version });
  const rootPkg = lock.packages?.[''];
  if (rootPkg) {
    expect({
      label: 'package-lock.json :: packages[""].version',
      actual: rootPkg.version,
      expected: version,
    });
  }
};

const verifyShipwright = (version) => {
  const path = resolve(repoRoot, 'shipwright.json');
  if (!existsSync(path)) return;
  const manifest = readJson(path);
  expect({
    label: 'shipwright.json :: product.version',
    actual: manifest.product?.version,
    expected: version,
  });
  for (const component of manifest.components ?? []) {
    if (typeof component.expectedVersion !== 'string') continue;
    if (component.expectedVersion === PRODUCT_VERSION_TEMPLATE) continue;
    expect({
      label: `shipwright.json :: components.${component.id}.expectedVersion`,
      actual: component.expectedVersion,
      expected: version,
    });
  }
};

const verifyBuildInfo = (version) => {
  const path = resolve(repoRoot, 'build-info.json');
  if (!existsSync(path)) {
    checks.push({
      label: 'build-info.json',
      actual: 'missing',
      expected: 'present',
      ok: false,
    });
    return;
  }
  const info = readJson(path);
  expect({
    label: 'build-info.json :: version',
    actual: info.version,
    expected: version,
  });
};

const main = () => {
  const [tag] = process.argv.slice(2);
  if (!tag) throw new Error('expected version argument');
  const version = normalizeTag(tag);

  verifyPackageJson(version);
  verifyPackageLock(version);
  verifyShipwright(version);
  verifyBuildInfo(version);

  let failed = 0;
  for (const c of checks) {
    const tag = c.ok ? 'OK  ' : 'FAIL';
    process.stdout.write(`${tag} ${c.label} = ${c.actual}\n`);
    if (!c.ok) failed += 1;
  }
  if (failed > 0) {
    process.stderr.write(`\nverify-versions: ${failed} mismatch(es) against ${version}\n`);
    process.exit(1);
  }
  process.stdout.write(`\nAll ${checks.length} carriers match ${version}.\n`);
};

try {
  main();
} catch (error) {
  process.stderr.write(`verify-versions: ${error.message}\n`);
  process.exit(2);
}
