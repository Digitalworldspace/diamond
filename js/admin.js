// ============================================
// ADMIN PANEL - Company Settings
// ============================================

// Local company data (fallback)
let companyData = {
    name: 'Luminary Diamonds',
    tax: 'BE 0123.456.789',
    country: 'Belgium',
    email: 'info@luminary.be',
    phone: '+32 499 12 34 56',
    address: 'Antwerp, Hoveniersstraat 22'
};

// ===== RENDER COMPANY SETTINGS =====
function renderCompanySettings() {
    document.getElementById('compName').value = companyData.name || '';
    document.getElementById('compTax').value = companyData.tax || '';
    document.getElementById('compCountry').value = companyData.country || '';
    document.getElementById('compEmail').value = companyData.email || '';
    document.getElementById('compPhone').value = companyData.phone || '';
    document.getElementById('compAddress').value = companyData.address || '';
}

// ===== SAVE COMPANY =====
async function saveCompany() {
    const newData = {
        name: document.getElementById('compName').value,
        tax: document.getElementById('compTax').value,
        country: document.getElementById('compCountry').value,
        email: document.getElementById('compEmail').value,
        phone: document.getElementById('compPhone').value,
        address: document.getElementById('compAddress').value,
    };
    
    companyData = newData;
    const feedback = document.getElementById('companyFeedback');
    feedback.innerHTML = '<i class="fas fa-check-circle" style="color: #2b6e4e;"></i> Company updated locally.';
    
    // Sync with Supabase if available
    if (window.SUPABASE && window.SUPABASE.enabled) {
        try {
            const { error } = await window.SUPABASE.client
                .from('company_settings')
                .upsert({ id: 1, ...newData }, { onConflict: 'id' });
            
            if (error) throw error;
            feedback.innerHTML = '<i class="fas fa-check-circle" style="color: #2b6e4e;"></i> Synced with Supabase.';
        } catch (error) {
            feedback.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:#b45309;"></i> Supabase error: ${error.message}`;
            console.warn('Supabase save error:', error);
        }
    }
}

// ===== RESET COMPANY =====
function resetCompany() {
    companyData = {
        name: 'Luminary Diamonds',
        tax: 'BE 0123.456.789',
        country: 'Belgium',
        email: 'info@luminary.be',
        phone: '+32 499 12 34 56',
        address: 'Antwerp, Hoveniersstraat 22'
    };
    renderCompanySettings();
    document.getElementById('companyFeedback').innerHTML = '<i class="fas fa-undo-alt"></i> Reset to default.';
    
    // Optionally sync reset to Supabase
    if (window.SUPABASE && window.SUPABASE.enabled) {
        window.SUPABASE.client
            .from('company_settings')
            .upsert({ id: 1, ...companyData }, { onConflict: 'id' })
            .then(({ error }) => {
                if (error) console.warn('Supabase reset error:', error);
            });
    }
}

// ===== LOAD COMPANY FROM SUPABASE =====
async function loadCompanyFromSupabase() {
    if (!window.SUPABASE || !window.SUPABASE.enabled) return;
    
    try {
        const { data, error } = await window.SUPABASE.client
            .from('company_settings')
            .select('*')
            .eq('id', 1)
            .single();
        
        if (!error && data) {
            companyData = { ...companyData, ...data };
            renderCompanySettings();
        }
    } catch (error) {
        console.warn('Failed to load company data:', error);
    }
}

// ===== INIT ADMIN =====
function initAdmin() {
    renderCompanySettings();
    
    // Load from Supabase
    loadCompanyFromSupabase();
    
    // Event listeners
    document.getElementById('saveCompanyBtn').addEventListener('click', saveCompany);
    document.getElementById('resetCompanyBtn').addEventListener('click', resetCompany);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}
