/* =========================================================
   Supabase connection settings
   Get these from: Supabase Dashboard > Project Settings > API
   ========================================================= */
const SUPABASE_URL = "https://dxpmzqrjxtvaemchezyx.supabase.co"; // e.g. https://xxxxxxxx.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4cG16cXJqeHR2YWVtY2hlenl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTkzOTQsImV4cCI6MjEwMjU3NTM5NH0.gColeCcY6D64v3vKY_kVSpFst-9xkoW01Q_99qbEHLo";

// `supabase` global comes from the CDN script tag loaded in each HTML page.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fixed row id used for the single company-settings record (see README SQL).
const COMPANY_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
