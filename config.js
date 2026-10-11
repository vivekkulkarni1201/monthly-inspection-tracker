// Online mode configuration.
// Leave blank for local demo mode. You can also paste these values from the Admin screen.
window.APP_CONFIG = {
  SUPABASE_URL: localStorage.getItem("inspection_supabase_url") || "",
  SUPABASE_ANON_KEY: localStorage.getItem("inspection_supabase_key") || ""
};
