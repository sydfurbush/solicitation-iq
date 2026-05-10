// Typed Supabase client. Re-exports the Lovable Cloud-generated client.
// The underlying client uses VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
// (the publishable/anon key) injected automatically by Lovable Cloud.
export { supabase } from "@/integrations/supabase/client";
export type { Database } from "@/integrations/supabase/types";
