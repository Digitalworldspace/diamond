/* =========================================================
   Supabase connection settings
   Get these from: Supabase Dashboard > Project Settings > API
   ========================================================= */
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL"; // e.g. https://xxxxxxxx.supabase.co
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// `supabase` global comes from the CDN script tag loaded in each HTML page.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fixed row id used for the single company-settings record (see README SQL).
const COMPANY_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
