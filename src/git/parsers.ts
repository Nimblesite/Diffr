import { CHANGED_FILE_STATUSES, GIT_ERROR_KINDS, LF, NUL, REF_PREFIX_HEADS, REF_PREFIX_TAGS, REF_TYPES } from "../constants";
import { type Result, ok, err } from "../result";
import type { ChangedFile, ChangedFileStatus, Commit, GitError, Ref, RefType } from "./types";

const LOG_FIELDS_PER_RECORD = 5;
const REF_FIELDS_PER_RECORD = 3;
const CHAR_CODE_DIGIT_LO = 48;
const CHAR_CODE_DIGIT_HI = 57;

const errParse = (message: string): Result<never, GitError> => err({ kind: GIT_ERROR_KINDS.parseError, message });

const stripTrailingEmpty = (arr: readonly string[]): readonly string[] => {
  if (arr.length === 0) {
    return arr;
  }
  const last = arr[arr.length - 1];
  return last === "" ? arr.slice(0, -1) : arr;
};

const isAllDigits = (s: string): boolean => {
  if (s.length === 0) {
    return false;
  }
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < CHAR_CODE_DIGIT_LO || c > CHAR_CODE_DIGIT_HI) {
      return false;
    }
  }
  return true;
};

const refTypeFromName = (fullName: string): RefType => {
  if (fullName.startsWith(REF_PREFIX_HEADS)) {
    return REF_TYPES.branch;
  }
  if (fullName.startsWith(REF_PREFIX_TAGS)) {
    return REF_TYPES.tag;
  }
  return REF_TYPES.other;
};

const parseLogRecord = (fields: readonly string[]): Result<Commit, GitError> => {
  const [sha, shortSha, author, atStr, subject] = fields;
  if (
    sha === undefined ||
    shortSha === undefined ||
    author === undefined ||
    atStr === undefined ||
    subject === undefined
  ) {
    return errParse("parseLog: missing field");
  }
  if (!isAllDigits(atStr)) {
    return errParse("parseLog: invalid timestamp");
  }
  const authorTime = Number.parseInt(atStr, 10);
  return ok({ sha, shortSha, author, authorTime, subject });
};

export const parseLog = (stdout: string): Result<readonly Commit[], GitError> => {
  if (stdout.length === 0) {
    return ok([]);
  }
  const tokens = stripTrailingEmpty(stdout.split(NUL));
  if (tokens.length % LOG_FIELDS_PER_RECORD !== 0) {
    return errParse("parseLog: field count not multiple of 5");
  }
  const commits: Commit[] = [];
  for (let i = 0; i < tokens.length; i += LOG_FIELDS_PER_RECORD) {
    const slice = tokens.slice(i, i + LOG_FIELDS_PER_RECORD);
    const r = parseLogRecord(slice);
    if (!r.ok) {
      return r;
    }
    commits.push(r.value);
  }
  return ok(commits);
};

interface ParsedStatus {
  readonly status: ChangedFileStatus;
  readonly similarity?: number;
  readonly isRename: boolean;
}

const parseStatusToken = (raw: string): Result<ParsedStatus, GitError> => {
  if (raw.length === 0) {
    return errParse("parseNameStatus: empty status token");
  }
  const first = raw.charAt(0);
  if (
    first === CHANGED_FILE_STATUSES.added ||
    first === CHANGED_FILE_STATUSES.modified ||
    first === CHANGED_FILE_STATUSES.deleted
  ) {
    if (raw.length !== 1) {
      return errParse("parseNameStatus: extra chars on status");
    }
    return ok({ status: first, isRename: false });
  }
  if (first === CHANGED_FILE_STATUSES.renamed || first === CHANGED_FILE_STATUSES.copied) {
    const digits = raw.slice(1);
    if (!isAllDigits(digits)) {
      return errParse("parseNameStatus: bad similarity");
    }
    return ok({ status: first, similarity: Number.parseInt(digits, 10), isRename: true });
  }
  return errParse(`parseNameStatus: unknown status '${first}'`);
};

const buildSimple = (
  parsed: ParsedStatus,
  tokens: readonly string[],
  i: number
): Result<{ file: ChangedFile; next: number }, GitError> => {
  const path = tokens[i + 1];
  if (path === undefined) {
    return errParse("parseNameStatus: missing path");
  }
  return ok({ file: { status: parsed.status, path }, next: i + 2 });
};

const buildRenameOrCopy = (
  parsed: ParsedStatus,
  tokens: readonly string[],
  i: number
): Result<{ file: ChangedFile; next: number }, GitError> => {
  const oldPath = tokens[i + 1];
  const newPath = tokens[i + 2];
  if (oldPath === undefined || newPath === undefined) {
    return errParse("parseNameStatus: rename missing paths");
  }
  const similarity = parsed.similarity;
  if (similarity === undefined) {
    return errParse("parseNameStatus: rename missing similarity");
  }
  return ok({
    file: { status: parsed.status, path: newPath, oldPath, similarity },
    next: i + 3,
  });
};

const readOneNameStatus = (
  tokens: readonly string[],
  i: number
): Result<{ file: ChangedFile; next: number }, GitError> => {
  const head = tokens[i];
  if (head === undefined) {
    return errParse("parseNameStatus: missing status");
  }
  const parsed = parseStatusToken(head);
  if (!parsed.ok) {
    return parsed;
  }
  return parsed.value.isRename ? buildRenameOrCopy(parsed.value, tokens, i) : buildSimple(parsed.value, tokens, i);
};

export const parseNameStatus = (stdout: string): Result<readonly ChangedFile[], GitError> => {
  if (stdout.length === 0) {
    return ok([]);
  }
  const tokens = stripTrailingEmpty(stdout.split(NUL));
  const out: ChangedFile[] = [];
  let i = 0;
  while (i < tokens.length) {
    const r = readOneNameStatus(tokens, i);
    if (!r.ok) {
      return r;
    }
    out.push(r.value.file);
    i = r.value.next;
  }
  return ok(out);
};

const parseRefRecord = (fields: readonly string[]): Result<Ref, GitError> => {
  const [fullName, shortName, sha] = fields;
  if (fullName === undefined || shortName === undefined || sha === undefined) {
    return errParse("parseRefs: missing field");
  }
  if (fullName === "" || shortName === "" || sha === "") {
    return errParse("parseRefs: empty field");
  }
  return ok({ name: shortName, fullName, sha, type: refTypeFromName(fullName) });
};

export const parseRefs = (stdout: string): Result<readonly Ref[], GitError> => {
  if (stdout.length === 0) {
    return ok([]);
  }
  const lines = stdout.split(LF).filter((l) => l.length > 0);
  const refs: Ref[] = [];
  for (const line of lines) {
    const fields = line.split(NUL);
    if (fields.length !== REF_FIELDS_PER_RECORD) {
      return errParse("parseRefs: expected 3 NUL-separated fields per line");
    }
    const r = parseRefRecord(fields);
    if (!r.ok) {
      return r;
    }
    refs.push(r.value);
  }
  return ok(refs);
};
