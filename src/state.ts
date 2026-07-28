import type * as vscode from "vscode";
import { MEMENTO_KEYS } from "./constants";
import type { REV_KINDS } from "./constants";
import type { RevSpec, Sha } from "./git/types";

export interface LastComparison {
  readonly revA: { readonly kind: typeof REV_KINDS.commit; readonly sha: Sha };
  readonly revB: RevSpec;
  readonly repoRoot: string;
}

export interface MementoStore {
  getLastComparison: () => LastComparison | undefined;
  setLastComparison: (value: LastComparison) => Promise<void>;
  clearLastComparison: () => Promise<void>;
}

export const isLastComparison = (raw: unknown): raw is LastComparison => {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }
  if (!("repoRoot" in raw) || typeof raw.repoRoot !== "string") {
    return false;
  }
  if (!("revA" in raw) || typeof raw.revA !== "object" || raw.revA === null) {
    return false;
  }
  if (!("revB" in raw) || typeof raw.revB !== "object" || raw.revB === null) {
    return false;
  }
  return true;
};

export const createMementoStore = (memento: vscode.Memento): MementoStore => ({
  getLastComparison: (): LastComparison | undefined => {
    const raw = memento.get<unknown>(MEMENTO_KEYS.lastComparison);
    return isLastComparison(raw) ? raw : undefined;
  },
  setLastComparison: async (value): Promise<void> => {
    await memento.update(MEMENTO_KEYS.lastComparison, value);
  },
  clearLastComparison: async (): Promise<void> => {
    await memento.update(MEMENTO_KEYS.lastComparison, undefined);
  },
});
