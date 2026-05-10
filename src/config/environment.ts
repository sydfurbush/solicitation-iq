/**
 * Type-safe environment access. Vite injects VITE_* vars at build time.
 */

interface AppEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseProjectId: string;
  appUrl: string;
  isDev: boolean;
  isProd: boolean;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    // Don't throw at module load — log so the app can still mount and surface a friendly UI.
    // eslint-disable-next-line no-console
    console.warn(`[env] Missing required environment variable: ${name}`);
    return "";
  }
  return value;
}

export const env: AppEnv = {
  supabaseUrl: required("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL as string | undefined),
  supabasePublishableKey: required(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
  ),
  supabaseProjectId: (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ?? "",
  appUrl: (import.meta.env.VITE_APP_URL as string | undefined) ?? window.location.origin,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};

export default env;
