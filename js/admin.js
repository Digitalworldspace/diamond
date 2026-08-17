// ============================================
// ADMIN PANEL
// ============================================

let companyData = {
    name: 'Luminary Diamonds',
    tax: 'BE 0123.456.789',
    country: 'Belgium',
    email: 'info@luminary.be',
    phone: '+32 499 12 34 56',
    address: 'Antwerp, Hoveniersstraat 22'
};

let diamonds = [];

// ===== RENDER FUNCTIONS =====
function renderCompanySettings() {
    document.getElementById('compName').value = companyData.name || '';
    document.getElementById('compTax').value = companyData.tax || '';
    document.getElementById('compCountry').value = companyData.country || '';
    document.getElementById('compEmail').value = companyData.email || '';
    document.getElementById('compPhone').value = companyData.phone || '';
    document.getElementById('compAddress').value = companyData.address || '';
}

function updateStats() {
    const total = diamonds.length;
    const available = diamonds.filter(d => d.status === 'available').length;
    const hold = diamonds.filter(d => d.status === 'hold').length;
    const confirmed = diamonds.filter(d => d.status === 'confirmed').length;
    
    document.getElementById('totalDiamonds').textContent = total;
    document.getElementById('availableDiamonds').textContent = available;
    document.getElementById('holdDiamonds').textContent = hold;
    document.getElementById('confirmedDiamonds').textContent = confirmed;
}

// ===== SUPABASE OPERATIONS =====
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
    showFeedback(feedback, 'Company updated locally.');
    
    if (window.SUPABASE && window.SUPABASE.enabled) {
        try {
            const { error } = await window.SUPABASE.client
                .from('company_settings')
                .upsert({ id: 1, ...newData }, { onConflict: 'id' });
            if (error) throw error;
            showFeedback(feedback, 'Synced with Supabase.');
        } catch (error) {
            showFeedback(feedback, `Error: ${error.message}`, true);
        }
    }
}

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
    showFeedback(document.getElementById('companyFeedback'), 'Reset to default.');
}

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
        console.warn('Failed to load company:', error);
    }
}

async function loadDiamondsFromSupabase() {
    if (!window.SUPABASE || !window.SUPABASE.enabled) return;
    
    try {
        const { data, error } = await window.SUPABASE.client
            .from('diamonds')
            .select('*');
        
        if (!error && data) {
            diamonds = data;
            updateStats();
        }
    } catch (error) {
        console.warn('Failed to load diamonds:', error);
    }
}

// ===== INIT =====
function initAdmin() {
    renderCompanySettings();
    loadCompanyFromSupabase();
    loadDiamondsFromSupabase();
    
    document.getElementById('saveCompanyBtn').addEventListener('click', saveCompany);
    document.getElementById('resetCompanyBtn').addEventListener('click', resetCompany);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}
