import { strict as assert } from "node:assert";
import { GIT_ERROR_KINDS, REF_TYPES } from "../../constants";
import { parseLog, parseNameStatus, parseRefs } from "../../git/parsers";
import { expectErr, expectOk } from "../../result";

const NUL = "\x00";

const logRecord = (sha: string, short: string, author: string, at: string, subject: string): string =>
  [sha, short, author, at, subject].join(NUL);

describe("parseLog", () => {
  it("returns empty array for empty input", () => {
    const r = parseLog("");
    expectOk(r);
    assert.deepEqual(r.value, []);
  });

  it("parses a single commit with trailing NUL", () => {
    const stdout = logRecord("abc123def456", "abc123d", "Alice", "1700000000", "init") + NUL;
    const r = parseLog(stdout);
    expectOk(r);
    assert.deepEqual(r.value, [
      {
        sha: "abc123def456",
        shortSha: "abc123d",
        author: "Alice",
        authorTime: 1700000000,
        subject: "init",
      },
    ]);
  });

  it("parses two commits separated by NUL", () => {
    const a = logRecord("aaaa1111", "aaaa111", "Alice", "1700000000", "first");
    const b = logRecord("bbbb2222", "bbbb222", "Bob", "1700000100", "second commit");
    const r = parseLog(`${a}${NUL}${b}${NUL}`);
    expectOk(r);
    assert.deepEqual(r.value, [
      {
        sha: "aaaa1111",
        shortSha: "aaaa111",
        author: "Alice",
        authorTime: 1700000000,
        subject: "first",
      },
      {
        sha: "bbbb2222",
        shortSha: "bbbb222",
        author: "Bob",
        authorTime: 1700000100,
        subject: "second commit",
      },
    ]);
  });

  it("parses without trailing NUL when field count matches", () => {
    const stdout = logRecord("abcd1234", "abcd123", "Alice", "1700000000", "init");
    const r = parseLog(stdout);
    expectOk(r);
    assert.equal(r.value.length, 1);
  });

  it("preserves an empty subject", () => {
    const stdout = logRecord("abcd1234", "abcd123", "Alice", "1700000000", "") + NUL;
    const r = parseLog(stdout);
    expectOk(r);
    assert.deepEqual(r.value, [
      {
        sha: "abcd1234",
        shortSha: "abcd123",
        author: "Alice",
        authorTime: 1700000000,
        subject: "",
      },
    ]);
  });

  it("preserves unicode and spaces in author/subject", () => {
    const stdout = logRecord("abcd1234", "abcd123", "Élise Müller", "1700000000", "feat: 日本語 fix ⚡") + NUL;
    const r = parseLog(stdout);
    expectOk(r);
    assert.deepEqual(r.value, [
      {
        sha: "abcd1234",
        shortSha: "abcd123",
        author: "Élise Müller",
        authorTime: 1700000000,
        subject: "feat: 日本語 fix ⚡",
      },
    ]);
  });

  it("errors when field count is not a multiple of 5", () => {
    const r = parseLog(`a${NUL}b${NUL}c${NUL}d${NUL}`);
    expectErr(r);
    assert.equal(r.error.kind, GIT_ERROR_KINDS.parseError);
    assert.match(r.error.message, /multiple of 5/);
  });

  it("errors when timestamp is not numeric", () => {
    const stdout = logRecord("a", "a", "Alice", "NOT_A_NUMBER", "x") + NUL;
    const r = parseLog(stdout);
    expectErr(r);
    assert.match(r.error.message, /timestamp/);
  });

  it("errors when timestamp is empty", () => {
    const stdout = logRecord("a", "a", "Alice", "", "x") + NUL;
    const r = parseLog(stdout);
    expectErr(r);
    assert.match(r.error.message, /timestamp/);
  });

  it("errors when timestamp has leading/trailing whitespace", () => {
    const stdout = logRecord("a", "a", "Alice", " 1700000000", "x") + NUL;
    const r = parseLog(stdout);
    expectErr(r);
  });
});

describe("parseNameStatus", () => {
  it("returns empty array for empty input", () => {
    const r = parseNameStatus("");
    expectOk(r);
    assert.deepEqual(r.value, []);
  });

  it("parses an Added file", () => {
    const r = parseNameStatus(`A${NUL}new.txt${NUL}`);
    expectOk(r);
    assert.deepEqual(r.value, [{ status: "A", path: "new.txt" }]);
  });

  it("parses a Modified file", () => {
    const r = parseNameStatus(`M${NUL}a.txt${NUL}`);
    expectOk(r);
    assert.deepEqual(r.value, [{ status: "M", path: "a.txt" }]);
  });

  it("parses a Deleted file", () => {
    const r = parseNameStatus(`D${NUL}gone.txt${NUL}`);
    expectOk(r);
    assert.deepEqual(r.value, [{ status: "D", path: "gone.txt" }]);
  });

  it("parses a Rename with similarity", () => {
    const r = parseNameStatus(`R100${NUL}old.txt${NUL}new.txt${NUL}`);
    expectOk(r);
    assert.deepEqual(r.value, [{ status: "R", path: "new.txt", oldPath: "old.txt", similarity: 100 }]);
  });

  it("parses a Copy with similarity", () => {
    const r = parseNameStatus(`C75${NUL}src.txt${NUL}dst.txt${NUL}`);
    expectOk(r);
    assert.deepEqual(r.value, [{ status: "C", path: "dst.txt", oldPath: "src.txt", similarity: 75 }]);
  });

  it("parses a mixed batch", () => {
    const stdout =
      `A${NUL}added.txt${NUL}` +
      `M${NUL}modified.txt${NUL}` +
      `D${NUL}deleted.txt${NUL}` +
      `R98${NUL}was.txt${NUL}now.txt${NUL}` +
      `C50${NUL}src.txt${NUL}dst.txt${NUL}`;
    const r = parseNameStatus(stdout);
    expectOk(r);
    assert.deepEqual(r.value, [
      { status: "A", path: "added.txt" },
      { status: "M", path: "modified.txt" },
      { status: "D", path: "deleted.txt" },
      { status: "R", path: "now.txt", oldPath: "was.txt", similarity: 98 },
      { status: "C", path: "dst.txt", oldPath: "src.txt", similarity: 50 },
    ]);
  });

  it("preserves spaces, unicode, and quotes in paths", () => {
    const stdout = `M${NUL}path with spaces/日本語 "name".txt${NUL}`;
    const r = parseNameStatus(stdout);
    expectOk(r);
    assert.deepEqual(r.value, [{ status: "M", path: 'path with spaces/日本語 "name".txt' }]);
  });

  it("errors on unknown status letter", () => {
    const r = parseNameStatus(`X${NUL}a.txt${NUL}`);
    expectErr(r);
    assert.match(r.error.message, /unknown status/);
  });

  it("errors when A/M/D has trailing chars", () => {
    const r = parseNameStatus(`A100${NUL}a.txt${NUL}`);
    expectErr(r);
    assert.match(r.error.message, /extra chars/);
  });

  it("errors on rename without similarity digits", () => {
    const r = parseNameStatus(`R${NUL}old${NUL}new${NUL}`);
    expectErr(r);
    assert.match(r.error.message, /similarity/);
  });

  it("errors on rename with non-digit similarity", () => {
    const r = parseNameStatus(`R1x0${NUL}old${NUL}new${NUL}`);
    expectErr(r);
    assert.match(r.error.message, /similarity/);
  });

  it("errors on truncated rename (missing new path)", () => {
    const r = parseNameStatus(`R100${NUL}old.txt${NUL}`);
    expectErr(r);
    assert.match(r.error.message, /missing paths/);
  });

  it("errors when simple status is missing its path", () => {
    const r = parseNameStatus(`M${NUL}`);
    expectErr(r);
  });
});

describe("parseRefs", () => {
  it("returns empty array for empty input", () => {
    const r = parseRefs("");
    expectOk(r);
    assert.deepEqual(r.value, []);
  });

  it("parses a branch ref (newline-terminated record)", () => {
    const r = parseRefs(`refs/heads/main${NUL}main${NUL}abc1234\n`);
    expectOk(r);
    assert.deepEqual(r.value, [
      {
        name: "main",
        fullName: "refs/heads/main",
        sha: "abc1234",
        type: REF_TYPES.branch,
      },
    ]);
  });

  it("parses a tag ref", () => {
    const r = parseRefs(`refs/tags/v1.0${NUL}v1.0${NUL}def5678\n`);
    expectOk(r);
    assert.deepEqual(r.value, [
      {
        name: "v1.0",
        fullName: "refs/tags/v1.0",
        sha: "def5678",
        type: REF_TYPES.tag,
      },
    ]);
  });

  it("classifies a non-branch, non-tag ref as other", () => {
    const r = parseRefs(`refs/remotes/origin/main${NUL}origin/main${NUL}abc1234\n`);
    expectOk(r);
    assert.deepEqual(r.value, [
      {
        name: "origin/main",
        fullName: "refs/remotes/origin/main",
        sha: "abc1234",
        type: REF_TYPES.other,
      },
    ]);
  });

  it("parses a mixed batch of branches and tags", () => {
    const stdout =
      `refs/heads/main${NUL}main${NUL}aaa\n` +
      `refs/heads/dev${NUL}dev${NUL}bbb\n` +
      `refs/tags/v1.0${NUL}v1.0${NUL}ccc\n`;
    const r = parseRefs(stdout);
    expectOk(r);
    assert.deepEqual(r.value, [
      {
        name: "main",
        fullName: "refs/heads/main",
        sha: "aaa",
        type: REF_TYPES.branch,
      },
      {
        name: "dev",
        fullName: "refs/heads/dev",
        sha: "bbb",
        type: REF_TYPES.branch,
      },
      {
        name: "v1.0",
        fullName: "refs/tags/v1.0",
        sha: "ccc",
        type: REF_TYPES.tag,
      },
    ]);
  });

  it("errors when a line has fewer than 3 NUL-separated fields", () => {
    const r = parseRefs(`refs/heads/main${NUL}main\n`);
    expectErr(r);
    assert.match(r.error.message, /3 NUL-separated/);
  });

  it("errors when a ref field is empty", () => {
    const r = parseRefs(`refs/heads/main${NUL}${NUL}abc\n`);
    expectErr(r);
    assert.match(r.error.message, /empty field/);
  });

  it("ignores trailing blank lines", () => {
    const r = parseRefs(`refs/heads/main${NUL}main${NUL}abc\n\n\n`);
    expectOk(r);
    assert.equal(r.value.length, 1);
  });
});
