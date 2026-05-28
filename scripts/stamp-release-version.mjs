#!/usr/bin/env node
// Shipwright SWR-VERSION-BUILD-STAMPING for Diffr.
//
// Stamps the release version into every deployed carrier in the runner working
// tree, then writes build-info.json. Source-controlled values are not committed
// by this script — the release workflow runs it on the tagged checkout and
// builds from the stamped tree.
//
// Carriers stamped:
//   - package.json              .version
//   - package-lock.json         .version + .packages[""].version
//   - shipwright.json           .product.version
//                               .components[].expectedVersion  (literal values only)
//   - build-info.json (created) { manifestVersion, version, buildTime }
//
// Usage:
//   node scripts/stamp-release-version.mjs <version>          # apply
//   node scripts/stamp-release-version.mjs <version> --dry    # report only
//
// Accepts a bare semver (1.2.3) or a v-prefixed tag (v1.2.3). Rejects anything
// else so a bad CI input fails the workflow before publish.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const PRODUCT_VERSION_TEMPLATE = '${PRODUCT_VERSION}';

const parseArgs = (argv) => {
  const positional = [];
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry' || arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown argument: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 1) {
    throw new Error('expected exactly one version argument');
  }
  return { rawTag: positional[0], dryRun };
};

const normalizeTag = (tag) => {
  const candidate = tag.startsWith('v') ? tag.slice(1) : tag;
  if (!SEMVER.test(candidate)) {
    throw new Error(`invalid tag '${tag}'; expected semver like v1.2.3 or 1.2.3`);
  }
  return candidate;
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const writeJson = (path, value, dryRun) => {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (!dryRun) writeFileSync(path, body);
};

const stampPackageJson = ({ path, version, dryRun, report }) => {
  if (!existsSync(path)) return;
  const pkg = readJson(path);
  const before = pkg.version;
  pkg.version = version;
  writeJson(path, pkg, dryRun);
  report.push({ path, field: 'version', before, after: version });
};

const stampPackageLock = ({ path, version, dryRun, report }) => {
  if (!existsSync(path)) return;
  const lock = readJson(path);
  const before = lock.version;
  lock.version = version;
  const rootPkg = lock.packages?.[''];
  if (rootPkg) rootPkg.version = version;
  writeJson(path, lock, dryRun);
  report.push({ path, field: 'version', before, after: version });
};

const stampShipwright = ({ path, version, dryRun, report }) => {
  if (!existsSync(path)) return;
  const manifest = readJson(path);
  const before = manifest.product?.version;
  if (!manifest.product) {
    throw new Error(`${path} missing product object`);
  }
  manifest.product.version = version;
  for (const component of manifest.components ?? []) {
    if (
      typeof component.expectedVersion === 'string' &&
      component.expectedVersion !== PRODUCT_VERSION_TEMPLATE
    ) {
      const previous = component.expectedVersion;
      component.expectedVersion = version;
      report.push({
        path,
        field: `components.${component.id}.expectedVersion`,
        before: previous,
        after: version,
      });
    }
  }
  writeJson(path, manifest, dryRun);
  report.push({ path, field: 'product.version', before, after: version });
};

const writeBuildInfo = ({ path, version, dryRun, report }) => {
  const info = {
    manifestVersion: 1,
    version,
    buildTime: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  writeJson(path, info, dryRun);
  report.push({ path, field: 'created', before: '-', after: version });
};

const main = () => {
  const { rawTag, dryRun } = parseArgs(process.argv.slice(2));
  const version = normalizeTag(rawTag);
  const report = [];

  stampPackageJson({
    path: resolve(repoRoot, 'package.json'),
    version,
    dryRun,
    report,
  });
  stampPackageLock({
    path: resolve(repoRoot, 'package-lock.json'),
    version,
    dryRun,
    report,
  });
  stampShipwright({
    path: resolve(repoRoot, 'shipwright.json'),
    version,
    dryRun,
    report,
  });
  writeBuildInfo({
    path: resolve(repoRoot, 'build-info.json'),
    version,
    dryRun,
    report,
  });

  const mode = dryRun ? 'dry-run' : 'applied';
  process.stdout.write(`stamp-release-version (${mode}) → ${version}\n`);
  for (const row of report) {
    process.stdout.write(`  ${row.path} :: ${row.field} : ${row.before} → ${row.after}\n`);
  }
};

try {
  main();
} catch (error) {
  process.stderr.write(`stamp-release-version: ${error.message}\n`);
  process.exit(1);
}
