import * as crypto from "crypto";
import * as path from "path";

export function getNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Validates that `resolvedPath` stays inside `allowedDir`.
 * Returns `true` if safe, `false` if the path escapes (path traversal).
 */
export function isInsideDirectory(resolvedPath: string, allowedDir: string): boolean {
  const normalizedResolved = path.resolve(resolvedPath);
  const normalizedAllowed = path.resolve(allowedDir);
  return normalizedResolved.startsWith(normalizedAllowed + path.sep) || normalizedResolved === normalizedAllowed;
}
