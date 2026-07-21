import * as path from "node:path";

const GIT_PATH_SEP = "/";

/**
 * File path relative to the git repository root, with forward slashes.
 *
 * Must NOT use workspace-folder-relative paths: the VS Code workspace folder
 * can be a subdirectory of the git root (nested package / multi-root), and
 * joining that with the git root produces a wrong absolute path.
 */
export const toRepoRelPath = ({
  repoRoot,
  fileFsPath,
}: {
  repoRoot: string;
  fileFsPath: string;
}): string => path.relative(repoRoot, fileFsPath).split(path.sep).join(GIT_PATH_SEP);
