import { REV_KINDS } from "../constants";
import type { RefType } from "../git/types";
import type { MementoStore } from "../state";
import type { CommandDeps } from "./shared";
import { drillIntoFiles, pickRefAsSha, startFromArgsOrPick } from "./flow";

const handler = async ({
  deps,
  args,
  filter,
}: {
  deps: CommandDeps & { readonly state: MementoStore };
  args: readonly unknown[];
  filter: RefType;
}): Promise<void> => {
  const start = await startFromArgsOrPick({
    args,
    runner: deps.runner,
    gitApi: deps.gitApi,
    output: deps.output,
  });
  if (start === undefined) {
    return;
  }
  const target = await pickRefAsSha({ repo: start.repo, output: deps.output, filter });
  if (!target.ok) {
    return;
  }
  await drillIntoFiles({
    repo: start.repo,
    repoRoot: start.vsRepoRoot,
    revA: start.revA,
    revB: { kind: REV_KINDS.commit, sha: target.value },
    state: deps.state,
    output: deps.output,
  });
};

export const makeCompareWithRef =
  ({ deps, filter }: { deps: CommandDeps & { readonly state: MementoStore }; filter: RefType }) =>
  async (...args: unknown[]): Promise<void> => {
    await handler({ deps, args, filter });
  };
