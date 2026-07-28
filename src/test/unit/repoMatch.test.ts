import { strict as assert } from "node:assert";
import { findRepoForUri, matchRepoByFsPath } from "../../git/repoMatch";

interface UriLike {
  readonly fsPath: string;
}
interface RepoLike {
  readonly rootUri: UriLike;
}

const repoAt = (fsPath: string): RepoLike => ({ rootUri: { fsPath } });

describe("matchRepoByFsPath", () => {
  it("returns undefined for an empty repository list", () => {
    const result = matchRepoByFsPath<RepoLike>([], "/anywhere");
    assert.equal(result, undefined);
  });

  it("returns the only repository when the target is inside its root", () => {
    const r = repoAt("/Users/me/repo");
    assert.strictEqual(matchRepoByFsPath([r], "/Users/me/repo/file.txt"), r);
  });

  it("returns undefined when the target is outside every repository", () => {
    const r = repoAt("/Users/me/repo");
    assert.equal(matchRepoByFsPath([r], "/Users/elsewhere/file.txt"), undefined);
  });

  it("prefers the longest matching root for nested repositories", () => {
    const outer = repoAt("/Users/me/repo");
    const inner = repoAt("/Users/me/repo/sub/inner");
    const result = matchRepoByFsPath([outer, inner], "/Users/me/repo/sub/inner/file.txt");
    assert.strictEqual(result, inner);
  });

  it("order of the list does not affect the longest-match result", () => {
    const outer = repoAt("/Users/me/repo");
    const inner = repoAt("/Users/me/repo/sub/inner");
    const result = matchRepoByFsPath([inner, outer], "/Users/me/repo/sub/inner/file.txt");
    assert.strictEqual(result, inner);
  });
});

describe("findRepoForUri", () => {
  it("delegates to api.getRepository when available", () => {
    const repo = repoAt("/Users/me/repo");
    const uri = { fsPath: "/Users/me/repo/file.txt" };
    const api = {
      repositories: [] as readonly RepoLike[],
      getRepository: (_u: UriLike): RepoLike => repo,
    };
    const result = findRepoForUri(api, uri);
    assert.strictEqual(result, repo);
  });

  it("falls back to fsPath matching when getRepository is absent", () => {
    const repo = repoAt("/Users/me/repo");
    const uri = { fsPath: "/Users/me/repo/file.txt" };
    const api = { repositories: [repo] };
    const result = findRepoForUri(api, uri);
    assert.strictEqual(result, repo);
  });

  it("returns undefined when getRepository returns null", () => {
    const uri = { fsPath: "/Users/me/repo/file.txt" };
    const api = {
      repositories: [] as readonly RepoLike[],
      getRepository: (_u: UriLike): RepoLike | null => null,
    };
    const result = findRepoForUri(api, uri);
    assert.equal(result, undefined);
  });

  it("falls back to longest-prefix matching across multiple roots", () => {
    const a = repoAt("/Users/me/repo-a");
    const b = repoAt("/Users/me/repo-b");
    const api = { repositories: [a, b] };
    assert.strictEqual(findRepoForUri(api, { fsPath: "/Users/me/repo-b/x" }), b);
    assert.strictEqual(findRepoForUri(api, { fsPath: "/Users/me/repo-a/y" }), a);
    assert.equal(findRepoForUri(api, { fsPath: "/Users/me/somewhere-else" }), undefined);
  });
});
