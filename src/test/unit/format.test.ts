import { strict as assert } from "node:assert";
import { formatRelative } from "../../ui/format/relativeTime";
import { refTypeLabel } from "../../ui/format/refLabel";
import type { Ref } from "../../git/types";

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

describe("formatRelative", () => {
  it('returns "just now" for < 1 minute', () => {
    assert.equal(formatRelative(100, 100), "just now");
    assert.equal(formatRelative(100, 130), "just now");
    assert.equal(formatRelative(100, 159), "just now");
  });

  it('clamps negative deltas (future timestamps) to "just now"', () => {
    assert.equal(formatRelative(200, 100), "just now");
  });

  it("formats minutes when < 60 min", () => {
    assert.equal(formatRelative(0, 60), "1m ago");
    assert.equal(formatRelative(0, 30 * 60), "30m ago");
    assert.equal(formatRelative(0, 59 * 60), "59m ago");
  });

  it("formats hours when < 24 h", () => {
    assert.equal(formatRelative(0, HOUR), "1h ago");
    assert.equal(formatRelative(0, 12 * HOUR), "12h ago");
    assert.equal(formatRelative(0, 23 * HOUR), "23h ago");
  });

  it("formats days for older timestamps", () => {
    assert.equal(formatRelative(0, DAY), "1d ago");
    assert.equal(formatRelative(0, 7 * DAY), "7d ago");
    assert.equal(formatRelative(0, 365 * DAY), "365d ago");
  });
});

describe("refTypeLabel", () => {
  it('returns "Branch" for branches', () => {
    const r: Ref = { name: "main", fullName: "refs/heads/main", sha: "a", type: "branch" };
    assert.equal(refTypeLabel(r), "Branch");
  });

  it('returns "Tag" for tags', () => {
    const r: Ref = { name: "v1", fullName: "refs/tags/v1", sha: "a", type: "tag" };
    assert.equal(refTypeLabel(r), "Tag");
  });

  it('returns "Ref" for other ref kinds', () => {
    const r: Ref = {
      name: "origin/main",
      fullName: "refs/remotes/origin/main",
      sha: "a",
      type: "other",
    };
    assert.equal(refTypeLabel(r), "Ref");
  });
});
