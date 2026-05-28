import { strict as assert } from "node:assert";
import { REV_KINDS, URI_PARSE_ERROR_KINDS } from "../../constants";
import { buildDiffrUri, parseDiffrUri } from "../../ui/uri";
import { expectErr, expectOk } from "../../result";
import type { DiffrAddressableRev } from "../../git/types";

const SHA = "abc1234def567890fedcba0987654321aaaaaaaa";

const commit = (sha: string): DiffrAddressableRev => ({
  kind: REV_KINDS.commit,
  sha,
});
const index = (): DiffrAddressableRev => ({ kind: REV_KINDS.index });

const roundTrip = (rev: DiffrAddressableRev, path: string): void => {
  const uri = buildDiffrUri(rev, path);
  const parsed = parseDiffrUri(uri);
  expectOk(parsed);
  assert.deepEqual(parsed.value.rev, rev);
  assert.equal(parsed.value.path, path);
};

describe("buildDiffrUri", () => {
  it("builds a commit URI with sha and path", () => {
    const uri = buildDiffrUri(commit(SHA), "src/file.ts");
    assert.equal(uri, `diffr://commit/${SHA}/src/file.ts`);
  });

  it("builds an index URI without sha", () => {
    const uri = buildDiffrUri(index(), "src/file.ts");
    assert.equal(uri, "diffr://index/src/file.ts");
  });

  it("percent-encodes spaces in path segments", () => {
    const uri = buildDiffrUri(commit(SHA), "a folder/b file.ts");
    assert.equal(uri, `diffr://commit/${SHA}/a%20folder/b%20file.ts`);
  });

  it("percent-encodes ? and # so they are not parsed as query/fragment", () => {
    const uri = buildDiffrUri(commit(SHA), "weird?name#here.ts");
    assert.equal(uri, `diffr://commit/${SHA}/weird%3Fname%23here.ts`);
  });

  it("preserves forward slashes as segment separators", () => {
    const uri = buildDiffrUri(commit(SHA), "a/b/c/d.ts");
    assert.equal(uri, `diffr://commit/${SHA}/a/b/c/d.ts`);
  });

  it("encodes unicode characters in path segments", () => {
    const uri = buildDiffrUri(commit(SHA), "src/日本語.ts");
    const encoded = encodeURIComponent("日本語");
    assert.equal(uri, `diffr://commit/${SHA}/src/${encoded}.ts`);
  });
});

describe("parseDiffrUri", () => {
  it("parses a commit URI and decodes the path", () => {
    const r = parseDiffrUri(`diffr://commit/${SHA}/src/file.ts`);
    expectOk(r);
    assert.deepEqual(r.value.rev, { kind: REV_KINDS.commit, sha: SHA });
    assert.equal(r.value.path, "src/file.ts");
  });

  it("parses an index URI and decodes the path", () => {
    const r = parseDiffrUri("diffr://index/src/file.ts");
    expectOk(r);
    assert.deepEqual(r.value.rev, { kind: REV_KINDS.index });
    assert.equal(r.value.path, "src/file.ts");
  });

  it("rejects a non-diffr scheme", () => {
    const r = parseDiffrUri("file:///some/path.ts");
    expectErr(r);
    assert.equal(r.error.kind, URI_PARSE_ERROR_KINDS.invalidScheme);
  });

  it("rejects an unknown authority", () => {
    const r = parseDiffrUri(`diffr://stash/${SHA}/x.ts`);
    expectErr(r);
    assert.equal(r.error.kind, URI_PARSE_ERROR_KINDS.invalidAuthority);
  });

  it("rejects a commit URI with no path after the sha", () => {
    const r = parseDiffrUri(`diffr://commit/${SHA}/`);
    expectErr(r);
    assert.equal(r.error.kind, URI_PARSE_ERROR_KINDS.emptyPath);
  });

  it("rejects a commit URI with no sha", () => {
    const r = parseDiffrUri("diffr://commit//file.ts");
    expectErr(r);
    assert.equal(r.error.kind, URI_PARSE_ERROR_KINDS.missingSha);
  });

  it("rejects an index URI with no path", () => {
    const r = parseDiffrUri("diffr://index/");
    expectErr(r);
    assert.equal(r.error.kind, URI_PARSE_ERROR_KINDS.emptyPath);
  });

  it("rejects a malformed URI with no scheme separator", () => {
    const r = parseDiffrUri("not-a-uri");
    expectErr(r);
    assert.equal(r.error.kind, URI_PARSE_ERROR_KINDS.malformed);
  });

  it("rejects a URI missing the authority/path slash", () => {
    const r = parseDiffrUri("diffr://commit");
    expectErr(r);
    assert.equal(r.error.kind, URI_PARSE_ERROR_KINDS.malformed);
  });

  it("rejects a URI with malformed percent encoding", () => {
    const r = parseDiffrUri(`diffr://commit/${SHA}/bad%ZZpath.ts`);
    expectErr(r);
    assert.equal(r.error.kind, URI_PARSE_ERROR_KINDS.badEncoding);
  });

  it("rejects an index URI with malformed percent encoding", () => {
    const r = parseDiffrUri("diffr://index/bad%ZZpath.ts");
    expectErr(r);
    assert.equal(r.error.kind, URI_PARSE_ERROR_KINDS.badEncoding);
  });
});

describe("buildDiffrUri ↔ parseDiffrUri round-trip", () => {
  it("round-trips a simple commit URI", () => {
    roundTrip(commit(SHA), "src/file.ts");
  });

  it("round-trips a simple index URI", () => {
    roundTrip(index(), "src/file.ts");
  });

  it("round-trips paths with spaces", () => {
    roundTrip(commit(SHA), "a folder/b file.ts");
    roundTrip(index(), "a folder/b file.ts");
  });

  it("round-trips paths with unicode", () => {
    roundTrip(commit(SHA), "src/日本語/файл.ts");
    roundTrip(index(), "src/日本語/файл.ts");
  });

  it("round-trips paths containing # and ?", () => {
    roundTrip(commit(SHA), "weird?name#here.ts");
    roundTrip(index(), "q=1&r=2#frag.ts");
  });

  it("round-trips paths with quotes and brackets", () => {
    roundTrip(commit(SHA), 'a "b" [c] (d).ts');
  });

  it("round-trips deeply nested paths", () => {
    roundTrip(commit(SHA), "a/b/c/d/e/f/g/h/i/j.ts");
  });
});
