import { REV_KINDS, SCHEME, URI_AUTHORITIES, URI_PARSE_ERROR_KINDS } from "../constants";
import { type Result, ok, err } from "../result";
import type { DiffrAddressableRev, Sha } from "../git/types";

export type DiffrUriParseError =
  | {
      readonly kind: typeof URI_PARSE_ERROR_KINDS.invalidScheme;
      readonly got: string;
    }
  | {
      readonly kind: typeof URI_PARSE_ERROR_KINDS.invalidAuthority;
      readonly got: string;
    }
  | { readonly kind: typeof URI_PARSE_ERROR_KINDS.missingSha }
  | { readonly kind: typeof URI_PARSE_ERROR_KINDS.emptyPath }
  | {
      readonly kind: typeof URI_PARSE_ERROR_KINDS.badEncoding;
      readonly raw: string;
    }
  | {
      readonly kind: typeof URI_PARSE_ERROR_KINDS.malformed;
      readonly reason: string;
    };

export interface DiffrUriComponents {
  readonly rev: DiffrAddressableRev;
  readonly path: string;
}

const SCHEME_SEP = "://";
const PATH_SEP = "/";

const encodePath = (path: string): string => path.split(PATH_SEP).map(encodeURIComponent).join(PATH_SEP);

const decodePath = (encoded: string): Result<string, DiffrUriParseError> => {
  try {
    return ok(encoded.split(PATH_SEP).map(decodeURIComponent).join(PATH_SEP));
  } catch {
    return err({ kind: URI_PARSE_ERROR_KINDS.badEncoding, raw: encoded });
  }
};

export const buildDiffrUri = (rev: DiffrAddressableRev, path: string): string => {
  const encoded = encodePath(path);
  if (rev.kind === REV_KINDS.commit) {
    return `${SCHEME}${SCHEME_SEP}${URI_AUTHORITIES.commit}/${rev.sha}/${encoded}`;
  }
  return `${SCHEME}${SCHEME_SEP}${URI_AUTHORITIES.index}/${encoded}`;
};

const parseCommitUri = (rest: string): Result<DiffrUriComponents, DiffrUriParseError> => {
  const slash = rest.indexOf(PATH_SEP);
  if (slash <= 0) {
    return err({ kind: URI_PARSE_ERROR_KINDS.missingSha });
  }
  const sha: Sha = rest.slice(0, slash);
  const encodedPath = rest.slice(slash + 1);
  if (encodedPath === "") {
    return err({ kind: URI_PARSE_ERROR_KINDS.emptyPath });
  }
  const decoded = decodePath(encodedPath);
  if (!decoded.ok) {
    return decoded;
  }
  return ok({ rev: { kind: REV_KINDS.commit, sha }, path: decoded.value });
};

const parseIndexUri = (rest: string): Result<DiffrUriComponents, DiffrUriParseError> => {
  if (rest === "") {
    return err({ kind: URI_PARSE_ERROR_KINDS.emptyPath });
  }
  const decoded = decodePath(rest);
  if (!decoded.ok) {
    return decoded;
  }
  return ok({ rev: { kind: REV_KINDS.index }, path: decoded.value });
};

interface UriSplit {
  readonly scheme: string;
  readonly authority: string;
  readonly rest: string;
}

const splitUri = (uri: string): Result<UriSplit, DiffrUriParseError> => {
  const sep = uri.indexOf(SCHEME_SEP);
  if (sep < 0) {
    return err({
      kind: URI_PARSE_ERROR_KINDS.malformed,
      reason: "no scheme separator",
    });
  }
  const scheme = uri.slice(0, sep);
  const afterScheme = uri.slice(sep + SCHEME_SEP.length);
  const firstSlash = afterScheme.indexOf(PATH_SEP);
  if (firstSlash < 0) {
    return err({
      kind: URI_PARSE_ERROR_KINDS.malformed,
      reason: "no authority/path separator",
    });
  }
  return ok({
    scheme,
    authority: afterScheme.slice(0, firstSlash),
    rest: afterScheme.slice(firstSlash + 1),
  });
};

export const parseDiffrUri = (uri: string): Result<DiffrUriComponents, DiffrUriParseError> => {
  const split = splitUri(uri);
  if (!split.ok) {
    return split;
  }
  if (split.value.scheme !== SCHEME) {
    return err({
      kind: URI_PARSE_ERROR_KINDS.invalidScheme,
      got: split.value.scheme,
    });
  }
  if (split.value.authority === URI_AUTHORITIES.commit) {
    return parseCommitUri(split.value.rest);
  }
  if (split.value.authority === URI_AUTHORITIES.index) {
    return parseIndexUri(split.value.rest);
  }
  return err({
    kind: URI_PARSE_ERROR_KINDS.invalidAuthority,
    got: split.value.authority,
  });
};
