// Pure helper: pull the bearer token out of an Authorization header.
// No imports, so it can be unit-tested with Vitest.

/** Returns the JWT from "Bearer <token>", or null when absent or malformed. */
export function parseBearerToken(header: string | null | undefined): string | null {
  const m = /^\s*Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)\s*$/i.exec(header ?? "");
  return m ? m[1] : null;
}
