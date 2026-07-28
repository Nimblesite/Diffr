import type { CommandDeps } from "./shared";
import type { FileRevCommand } from "./compareFileWithRev";
import { FILE_REV_SOURCES, makeCompareFileWithRev } from "./compareFileWithRev";

export const makeCompareFileWithCommit = (deps: CommandDeps): FileRevCommand =>
  makeCompareFileWithRev({ deps, source: FILE_REV_SOURCES.commits });
