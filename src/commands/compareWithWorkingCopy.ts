import { REV_KINDS } from "../constants";
import type { MementoStore } from "../state";
import type { CommandDeps } from "./shared";
import { drillIntoFiles, startFromArgsOrPick } from "./flow";

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
  await drillIntoFiles({
    repo: start.repo,
    repoRoot: start.vsRepoRoot,
    revA: start.revA,
    revB: { kind: REV_KINDS.workingCopy },
    state: deps.state,
    output: deps.output,
  });
};

export const makeCompareWithWorkingCopy =
  (deps: CommandDeps & { readonly state: MementoStore }) =>
  async (...args: unknown[]): Promise<void> => {
    await handler(deps, args);
  };
