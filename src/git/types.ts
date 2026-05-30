import type { CHANGED_FILE_STATUSES, GIT_ERROR_KINDS, REF_TYPES, REV_KINDS } from "../constants";

export type Sha = string;

export type ChangedFileStatus = (typeof CHANGED_FILE_STATUSES)[keyof typeof CHANGED_FILE_STATUSES];

export interface ChangedFile {
  readonly status: ChangedFileStatus;
  readonly path: string;
  readonly oldPath?: string;
  readonly similarity?: number;
}

export interface Commit {
  readonly sha: Sha;
  readonly shortSha: string;
  readonly author: string;
  readonly authorTime: number;
  readonly subject: string;
}

export interface CommitRev {
  readonly kind: typeof REV_KINDS.commit;
  readonly sha: Sha;
}
export interface WorkingCopyRev {
  readonly kind: typeof REV_KINDS.workingCopy;
}
export interface IndexRev {
  readonly kind: typeof REV_KINDS.index;
}

export type RevSpec = CommitRev | WorkingCopyRev | IndexRev;

export type DiffrAddressableRev = CommitRev | IndexRev;

export type RefType = (typeof REF_TYPES)[keyof typeof REF_TYPES];

export interface Ref {
  readonly name: string;
  readonly fullName: string;
  readonly sha: Sha;
  readonly type: RefType;
}

export type GitErrorKind = (typeof GIT_ERROR_KINDS)[keyof typeof GIT_ERROR_KINDS];

export interface GitError {
  readonly kind: GitErrorKind;
  readonly message: string;
  readonly stderr?: string;
  readonly exitCode?: number;
}
