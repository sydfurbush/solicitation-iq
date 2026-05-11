import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * Returns a user-facing message for an error from supabase.functions.invoke.
 * Reads the response body so SAM_KEY_MISSING etc. surface the real message.
 */
export async function readEdgeError(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json();
      if (body?.message) return String(body.message);
      if (body?.error) return String(body.error);
    } catch { /* ignore */ }
  }
  return err instanceof Error ? err.message : String(err);
}
