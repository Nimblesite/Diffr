import { COMMAND_IDS, MENU_GROUP_PREFIX, MENU_IDS, MENU_WHEN, TITLE_PREFIX, UI_TEXT } from "./constants";

export interface MenuEntry {
  readonly command: string;
  readonly when: string;
  readonly group: string;
}

export interface PaletteEntry {
  readonly command: string;
  readonly when: string;
}

export interface MenuManifest {
  readonly menus: Record<string, readonly MenuEntry[]>;
  readonly commandPalette: readonly PaletteEntry[];
}

const ENTRY_INDEX_OFFSET = 1;

const commitLevelCommands = [
  COMMAND_IDS.compareWith,
  COMMAND_IDS.compareWithWorkingCopy,
  COMMAND_IDS.compareWithPrevious,
  COMMAND_IDS.compareWithBranch,
  COMMAND_IDS.compareWithTag,
] as const;

const fileLevelCommands = [
  COMMAND_IDS.compareFileWithCommit,
  COMMAND_IDS.compareFileWithBranch,
  COMMAND_IDS.compareFileWithTag,
] as const;

const groupedEntries = (commands: readonly string[], when: string, groupPrefix: string): readonly MenuEntry[] =>
  commands.map((command, i) => ({
    command,
    when,
    group: `${groupPrefix}@${(i + ENTRY_INDEX_OFFSET).toString()}`,
  }));

const hideFromPalette = (commands: readonly string[]): readonly PaletteEntry[] =>
  commands.map((command) => ({ command, when: MENU_WHEN.never }));

export const buildMenuManifest = (): MenuManifest => ({
  menus: {
    [MENU_IDS.scmHistoryItem]: groupedEntries(commitLevelCommands, MENU_WHEN.scmGit, MENU_GROUP_PREFIX),
    [MENU_IDS.scmResourceState]: groupedEntries(fileLevelCommands, MENU_WHEN.scmGit, MENU_GROUP_PREFIX),
    [MENU_IDS.editorTitleContext]: groupedEntries(fileLevelCommands, MENU_WHEN.resourceFile, MENU_GROUP_PREFIX),
    [MENU_IDS.explorerContext]: groupedEntries(fileLevelCommands, MENU_WHEN.resourceFileNotFolder, MENU_GROUP_PREFIX),
  },
  commandPalette: hideFromPalette([
    COMMAND_IDS.compareWith,
    COMMAND_IDS.compareWithWorkingCopy,
    COMMAND_IDS.compareWithPrevious,
    COMMAND_IDS.compareWithBranch,
    COMMAND_IDS.compareWithTag,
    COMMAND_IDS.showLogs,
  ]),
});

export const COMMAND_TITLES: Record<string, string> = {
  [COMMAND_IDS.compareWith]: `${TITLE_PREFIX} Compare with…`,
  [COMMAND_IDS.compareWithWorkingCopy]: `${TITLE_PREFIX} Compare with ${UI_TEXT.workingCopy}`,
  [COMMAND_IDS.compareWithPrevious]: `${TITLE_PREFIX} Compare with Previous`,
  [COMMAND_IDS.compareWithBranch]: `${TITLE_PREFIX} Compare with ${UI_TEXT.branchLabel}…`,
  [COMMAND_IDS.compareWithTag]: `${TITLE_PREFIX} Compare with ${UI_TEXT.tagLabel}…`,
  [COMMAND_IDS.compareTwoCommits]: `${TITLE_PREFIX} Compare Two Commits`,
  [COMMAND_IDS.compareFileWithCommit]: `${TITLE_PREFIX} Compare with Commit…`,
  [COMMAND_IDS.compareFileWithBranch]: `${TITLE_PREFIX} Compare with ${UI_TEXT.branchLabel}…`,
  [COMMAND_IDS.compareFileWithTag]: `${TITLE_PREFIX} Compare with ${UI_TEXT.tagLabel}…`,
  [COMMAND_IDS.reopenLast]: `${TITLE_PREFIX} Reopen Last Comparison`,
  [COMMAND_IDS.showLogs]: `${TITLE_PREFIX} Show Logs`,
};
