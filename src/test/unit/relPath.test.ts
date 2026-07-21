import { strict as assert } from "node:assert";
import * as path from "node:path";
import { toRepoRelPath } from "../../git/relPath";

describe("toRepoRelPath", () => {
  it("keeps every segment under the git root when the workspace folder is a nested package", () => {
    const repoRoot = "/repo";
    const fileFsPath = "/repo/scripts/pkg/pkg/module.py";

    // Reproduce the product bug: asRelativePath(workspace=.../scripts/pkg)
    // yields "pkg/module.py", then path.join(gitRoot, that) is wrong.
    const nestedWorkspace = "/repo/scripts/pkg";
    const workspaceRel = path.relative(nestedWorkspace, fileFsPath);
    assert.equal(workspaceRel, "pkg/module.py");
    assert.equal(path.join(repoRoot, workspaceRel), "/repo/pkg/module.py");

    assert.equal(toRepoRelPath({ repoRoot, fileFsPath }), "scripts/pkg/pkg/module.py");
  });

  it("returns a single-segment path for a file at the repo root", () => {
    assert.equal(
      toRepoRelPath({
        repoRoot: "/repo",
        fileFsPath: "/repo/README.md",
      }),
      "README.md"
    );
  });

  it("preserves nested directories under the repo root", () => {
    assert.equal(
      toRepoRelPath({
        repoRoot: "/repo",
        fileFsPath: "/repo/dir/c.txt",
      }),
      "dir/c.txt"
    );
  });
});
