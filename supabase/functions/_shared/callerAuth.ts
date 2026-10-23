// Verifies who is calling an edge function. See AGENTS.md "Edge function rules".
//
// Usage:
//   const { user, userClient } = await requireUser(req);
//   // read the requested record with userClient so row-level security applies;
//   // only then use a service-role client for the work.
import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { parseBearerToken } from "./authHeader.ts";

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(req: Request): Promise<{ user: User; userClient: SupabaseClient; token: string }> {
  const token = parseBearerToken(req.headers.get("Authorization"));
  if (!token) throw new AuthError(401, "Sign in required");
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user) throw new AuthError(401, "Sign in required");
  return { user: data.user, userClient, token };
}

export function authErrorResponse(err: unknown, corsHeaders: Record<string, string>): Response | null {
  if (!(err instanceof AuthError)) return null;
  return new Response(JSON.stringify({ error: err.message }), {
    status: err.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
