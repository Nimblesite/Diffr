import { REV_KINDS } from "../constants";
import type { MementoStore } from "../state";
import type { CommandDeps } from "./shared";
import { drillIntoFiles, reportGitError, startFromArgsOrPick } from "./flow";

const REV_PARSE_PARENT_OP = "rev-parse parent";

const handler = async (
  deps: CommandDeps & { readonly state: MementoStore },
  args: readonly unknown[]
): Promise<void> => {
  const start = await startFromArgsOrPick({
    args,
    runner: deps.runner,
    gitApi: deps.gitApi,
    output: deps.output,
  });
  if (start === undefined) {
    return;
  }
  const parent = await start.repo.revParse(`${start.revA.sha}^1`);
  if (!parent.ok) {
    reportGitError({
      output: deps.output,
      op: REV_PARSE_PARENT_OP,
      e: parent.error,
    });
    return;
  }
  await drillIntoFiles({
    repo: start.repo,
    repoRoot: start.vsRepoRoot,
    revA: start.revA,
    revB: { kind: REV_KINDS.commit, sha: parent.value },
    state: deps.state,
    output: deps.output,
  });
};

export const makeCompareWithPrevious =
  (deps: CommandDeps & { readonly state: MementoStore }) =>
  async (...args: unknown[]): Promise<void> => {
    await handler(deps, args);
  };
