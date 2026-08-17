// ============================================
// SUPABASE CONFIGURATION
// ============================================

// Replace with your actual Supabase credentials
const SUPABASE_CONFIG = {
    url: 'https://your-project.supabase.co',     // Your Supabase URL
    anonKey: 'your-anon-key-here'                // Your Supabase Anon Key
};

// Initialize Supabase client
let supabase = null;
let useSupabase = false;

// Check if credentials are configured
if (SUPABASE_CONFIG.url && 
    SUPABASE_CONFIG.url.includes('your-project') === false &&
    SUPABASE_CONFIG.anonKey && 
    SUPABASE_CONFIG.anonKey.includes('your-anon') === false) {
    try {
        supabase = window.supabase.createClient(
            SUPABASE_CONFIG.url, 
            SUPABASE_CONFIG.anonKey
        );
        useSupabase = true;
        console.log('✅ Supabase client initialized successfully');
    } catch (error) {
        console.warn('⚠️ Supabase initialization failed:', error);
        useSupabase = false;
    }
} else {
    console.log('ℹ️ Using local demo data (Supabase not configured)');
}

// Export for other modules
window.SUPABASE = {
    client: supabase,
    enabled: useSupabase
};
