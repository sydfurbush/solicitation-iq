// Format unknown errors (Error, PostgrestError, FunctionsHttpError, plain objects)
// into a readable string. Supabase's PostgrestError is a plain object, not an
// Error instance, so `String(e)` produces "[object Object]". This helper unwraps
// the useful fields (message, details, hint, code) instead.
export function formatSupabaseError(e: unknown): string {
  if (e == null) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint, o.code]
      .filter((v) => v !== undefined && v !== null && v !== "")
      .map((v) => String(v));
    if (parts.length) return parts.join(" — ");
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
