import * as vscode from "vscode";
import {
  LOG_EVENTS,
  OUTPUT_CHANNEL_NAME,
  REF_TYPES,
  REV_KINDS,
  SIDE_B_KINDS,
  TITLE_PREFIX,
  UI_TEXT,
} from "../constants";
import type { GitRepo } from "../git/GitRepo";
import type { GitRunner } from "../git/GitRunner";
import type { GitApi } from "../vscodeGitApi";
import type { GitError, CommitRev, RefType, RevSpec, Sha } from "../git/types";
import { logger } from "../logger";
import { type Result, err, ok } from "../result";
import { CANCELLED, type Cancelled } from "../ui/cancelled";
import { pickCommit } from "../ui/CommitPicker";
import { pickRef } from "../ui/RefPicker";
import { pickSideBChoice, type SideBChoice } from "../ui/SideBPicker";
import type { MementoStore } from "../state";
import { buildRepo, openMultiFileDiff, pickRepoFrom } from "./shared";

const GIT_OPS = {
  listRefs: "list refs",
  revParse: "rev-parse",
  log: "log",
  diffNameStatus: "diff --name-status",
  currentBranch: "current branch",
} as const;

export const reportGitError = ({ output, op, e }: { output: vscode.OutputChannel; op: string; e: GitError }): void => {
  logger.error({ op, kind: e.kind }, LOG_EVENTS.gitError);
  output.appendLine(`${TITLE_PREFIX} ${op} failed ${UI_TEXT.pathDash} ${e.message}`);
  if (e.stderr !== undefined && e.stderr !== "") {
    output.appendLine(e.stderr);
  }
  void vscode.window.showErrorMessage(`${TITLE_PREFIX} ${op} failed (see Output → ${OUTPUT_CHANNEL_NAME}).`);
};

export const resolveSideB = async ({
  choice,
  repo,
  output,
}: {
  choice: SideBChoice;
  repo: GitRepo;
  output: vscode.OutputChannel;
}): Promise<Result<RevSpec, Cancelled>> => {
  if (choice.kind === SIDE_B_KINDS.workingCopy) {
    return ok({ kind: REV_KINDS.workingCopy });
  }
  if (choice.kind === SIDE_B_KINDS.index) {
    return ok({ kind: REV_KINDS.index });
  }
  if (choice.kind === SIDE_B_KINDS.pickRef) {
    return await resolveRefAsRev({ repo, output });
  }
  return await resolveCommitAsRev({ repo, output });
};

const placeholderForRefFilter = (filter?: RefType): string => {
  if (filter === REF_TYPES.branch) {
    return UI_TEXT.pickBranchPlaceholder;
  }
  if (filter === REF_TYPES.tag) {
    return UI_TEXT.pickTagPlaceholder;
  }
  return UI_TEXT.pickRefPlaceholder;
};

const resolveExcludeBranchName = async ({
  repo,
  output,
}: {
  repo: GitRepo;
  output: vscode.OutputChannel;
}): Promise<string | undefined> => {
  const r = await repo.currentBranch();
  if (!r.ok) {
    // Best-effort: log and continue with no exclusion. A failed lookup must not
    // block ref picking — the worst case is the user sees their own branch.
    reportGitError({ output, op: GIT_OPS.currentBranch, e: r.error });
    return undefined;
  }
  return r.value;
};

export const pickRefAsSha = async ({
  repo,
  output,
  filter,
}: {
  repo: GitRepo;
  output: vscode.OutputChannel;
  filter?: RefType;
}): Promise<Result<Sha, Cancelled>> => {
  const refs = await repo.refs();
  if (!refs.ok) {
    reportGitError({ output, op: GIT_OPS.listRefs, e: refs.error });
    return err(CANCELLED);
  }
  const excludeBranchName = await resolveExcludeBranchName({ repo, output });
  const picked = await pickRef({
    refs: refs.value,
    placeholder: placeholderForRefFilter(filter),
    filter,
    excludeBranchName,
  });
  if (!picked.ok) {
    return err(CANCELLED);
  }
  const sha = await repo.revParse(picked.value.name);
  if (!sha.ok) {
    reportGitError({ output, op: GIT_OPS.revParse, e: sha.error });
    return err(CANCELLED);
  }
  return ok(sha.value);
};

const resolveRefAsRev = async ({
  repo,
  output,
}: {
  repo: GitRepo;
  output: vscode.OutputChannel;
}): Promise<Result<RevSpec, Cancelled>> => {
  const sha = await pickRefAsSha({ repo, output });
  if (!sha.ok) {
    return err(CANCELLED);
  }
  return ok({ kind: REV_KINDS.commit, sha: sha.value });
};

const resolveCommitAsRev = async ({
  repo,
  output,
}: {
  repo: GitRepo;
  output: vscode.OutputChannel;
}): Promise<Result<RevSpec, Cancelled>> => {
  const log = await repo.log({});
  if (!log.ok) {
    reportGitError({ output, op: GIT_OPS.log, e: log.error });
    return err(CANCELLED);
  }
  const picked = await pickCommit({ commits: log.value });
  if (!picked.ok) {
    return err(CANCELLED);
  }
  return ok({ kind: REV_KINDS.commit, sha: picked.value.sha });
};

export const pickSideBAndResolve = async ({
  repo,
  output,
}: {
  repo: GitRepo;
  output: vscode.OutputChannel;
}): Promise<Result<RevSpec, Cancelled>> => {
  const choice = await pickSideBChoice();
  if (!choice.ok) {
    return err(CANCELLED);
  }
  return await resolveSideB({ choice: choice.value, repo, output });
};

export const drillIntoFiles = async ({
  repo,
  repoRoot,
  revA,
  revB,
  state,
  output,
}: {
  repo: GitRepo;
  repoRoot: string;
  revA: CommitRev;
  revB: RevSpec;
  state: MementoStore;
  output: vscode.OutputChannel;
}): Promise<void> => {
  const ns = await repo.nameStatus({ from: revA, to: revB });
  if (!ns.ok) {
    reportGitError({ output, op: GIT_OPS.diffNameStatus, e: ns.error });
    return;
  }
  if (ns.value.length === 0) {
    void vscode.window.showInformationMessage(UI_TEXT.noChanges);
    return;
  }
  await state.setLastComparison({ revA, revB, repoRoot });
  await openMultiFileDiff({ revA, revB, repoRoot, relPaths: ns.value.map((f) => f.path) });
};

export const sideAFromSha = (sha: Sha): CommitRev => ({
  kind: REV_KINDS.commit,
  sha,
});

export interface StartingPoint {
  readonly vsRepoRoot: string;
  readonly repo: GitRepo;
  readonly revA: CommitRev;
}

export const pickRepoAndCommit = async ({
  runner,
  gitApi,
  output,
}: {
  runner: GitRunner;
  gitApi: GitApi;
  output: vscode.OutputChannel;
}): Promise<StartingPoint | undefined> => {
  const vs = await pickRepoFrom(gitApi);
  if (!vs.ok) {
    return undefined;
  }
  const repo = buildRepo(runner, vs.value);
  const log = await repo.log({});
  if (!log.ok) {
    reportGitError({ output, op: GIT_OPS.log, e: log.error });
    return undefined;
  }
  const commit = await pickCommit({ commits: log.value });
  if (!commit.ok) {
    return undefined;
  }
  return {
    vsRepoRoot: vs.value.rootUri.fsPath,
    repo,
    revA: sideAFromSha(commit.value.sha),
  };
};
