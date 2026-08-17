// ============================================
// SUPABASE CONFIGURATION
// ============================================

const SUPABASE_CONFIG = {
    url: 'https://your-project-id.supabase.co',     // Replace with your URL
    anonKey: 'your-anon-key-here'                    // Replace with your key
};

let supabase = null;
let useSupabase = false;

if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.url.includes('your-project') === false) {
    try {
        supabase = window.supabase.createClient(
            SUPABASE_CONFIG.url, 
            SUPABASE_CONFIG.anonKey
        );
        useSupabase = true;
        console.log('✅ Supabase initialized');
    } catch (e) {
        console.warn('⚠️ Supabase init failed:', e);
    }
}

window.SUPABASE = { client: supabase, enabled: useSupabase };
