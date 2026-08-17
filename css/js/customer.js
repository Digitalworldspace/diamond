// ============================================
// CUSTOMER PANEL - Diamond Inventory
// ============================================

// Local diamond data (fallback)
let diamonds = [
    { id: 'd1', name: 'Radiant 1.2ct', shape: 'Round', status: 'available', image: '' },
    { id: 'd2', name: 'Cushion 2.0ct', shape: 'Cushion', status: 'confirmed', image: '' },
    { id: 'd3', name: 'Princess 0.9ct', shape: 'Princess', status: 'hold', image: '' },
    { id: 'd4', name: 'Emerald 1.5ct', shape: 'Emerald', status: 'available', image: '' },
    { id: 'd5', name: 'Asscher 1.8ct', shape: 'Asscher', status: 'available', image: '' },
    { id: 'd6', name: 'Oval 2.2ct', shape: 'Oval', status: 'hold', image: '' },
    { id: 'd7', name: 'Pear 1.1ct', shape: 'Pear', status: 'confirmed', image: '' },
    { id: 'd8', name: 'Marquise 1.3ct', shape: 'Marquise', status: 'available', image: '' },
];

// ===== HELPERS =====
function getDiamondImage(id) {
    const seed = id.charCodeAt(1) || 5;
    return `https://picsum.photos/seed/${id}${seed}/200/200`;
}

function updateSelectedCounter() {
    const count = diamonds.filter(d => d._checked === true).length;
    document.getElementById('selectedCounter').innerText = `${count} selected`;
}

function getSelectedIds() {
    return diamonds.filter(d => d._checked === true).map(d => d.id);
}

// ===== RENDER DIAMONDS =====
function renderDiamonds() {
    const grid = document.getElementById('diamondGrid');
    if (!grid) return;
    
    if (diamonds.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:2rem; color:#6b7280;">
                <i class="fas fa-gem" style="font-size:2rem; display:block; margin-bottom:0.5rem;"></i>
                No diamonds available
            </div>
        `;
        return;
    }

    let html = '';
    diamonds.forEach((d) => {
        const imgSrc = d.image || getDiamondImage(d.id);
        const statusClass = d.status === 'confirmed' ? 'status-confirmed' : 
                           (d.status === 'hold' ? 'status-hold' : '');
        const statusLabel = d.status.charAt(0).toUpperCase() + d.status.slice(1);
        const checked = d._checked ? 'checked' : '';

        html += `
            <div class="diamond-card" data-id="${d.id}">
                <div class="diamond-check">
                    <input type="checkbox" class="diamond-select" data-id="${d.id}" ${checked} />
                </div>
                <div class="diamond-image">
                    <img src="${imgSrc}" alt="${d.name}" 
                         onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'fas fa-gem\\'></i>';" />
                </div>
                <div class="diamond-name">${d.name}</div>
                <div class="diamond-sub">${d.shape}</div>
                <span class="diamond-status ${statusClass}">${statusLabel}</span>
                <div class="diamond-actions">
                    <button class="btn btn-sm action-confirm" data-id="${d.id}">
                        <i class="fas fa-check"></i> Confirm
                    </button>
                    <button class="btn btn-sm action-hold" data-id="${d.id}">
                        <i class="fas fa-pause"></i> Hold
                    </button>
                    <button class="btn btn-sm action-release" data-id="${d.id}">
                        <i class="fas fa-undo-alt"></i> Release
                    </button>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
    updateSelectedCounter();
    attachDiamondEvents();
}

// ===== ATTACH EVENTS =====
function attachDiamondEvents() {
    // Single action buttons
    document.querySelectorAll('.action-confirm').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            updateDiamondStatus(btn.dataset.id, 'confirmed');
        };
    });
    
    document.querySelectorAll('.action-hold').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            updateDiamondStatus(btn.dataset.id, 'hold');
        };
    });
    
    document.querySelectorAll('.action-release').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            updateDiamondStatus(btn.dataset.id, 'available');
        };
    });

    // Checkbox change
    document.querySelectorAll('.diamond-select').forEach(cb => {
        cb.onchange = (e) => {
            const diamond = diamonds.find(d => d.id === cb.dataset.id);
            if (diamond) diamond._checked = cb.checked;
            updateSelectedCounter();
        };
    });
}

// ===== UPDATE DIAMOND STATUS =====
function updateDiamondStatus(id, newStatus) {
    const diamond = diamonds.find(d => d.id === id);
    if (!diamond) return;
    
    diamond.status = newStatus;
    diamond._checked = diamond._checked || false;
    renderDiamonds();
    
    // Sync with Supabase
    if (window.SUPABASE && window.SUPABASE.enabled) {
        window.SUPABASE.client
            .from('diamonds')
            .update({ status: newStatus })
            .eq('id', id)
            .then(({ error }) => {
                if (error) console.warn('Supabase update error:', error);
            });
    }
}

// ===== BULK ACTIONS =====
function bulkAction(action) {
    const ids = getSelectedIds();
    if (ids.length === 0) {
        alert('Please select at least one diamond.');
        return;
    }
    
    let newStatus = '';
    if (action === 'confirm') newStatus = 'confirmed';
    else if (action === 'hold') newStatus = 'hold';
    else if (action === 'release') newStatus = 'available';
    else return;

    diamonds.forEach(d => {
        if (ids.includes(d.id)) d.status = newStatus;
    });
    
    renderDiamonds();
    
    // Bulk update in Supabase
    if (window.SUPABASE && window.SUPABASE.enabled && ids.length > 0) {
        window.SUPABASE.client
            .from('diamonds')
            .update({ status: newStatus })
            .in('id', ids)
            .then(({ error }) => {
                if (error) console.warn('Supabase bulk update error:', error);
            });
    }
}

function setAllCheckboxes(checked) {
    diamonds.forEach(d => d._checked = checked);
    renderDiamonds();
}

// ===== LOAD DIAMONDS FROM SUPABASE =====
async function loadDiamondsFromSupabase() {
    if (!window.SUPABASE || !window.SUPABASE.enabled) return;
    
    try {
        const { data, error } = await window.SUPABASE.client
            .from('diamonds')
            .select('*');
        
        if (!error && data && data.length > 0) {
            diamonds = data.map(d => ({ ...d, _checked: false }));
            renderDiamonds();
        }
    } catch (error) {
        console.warn('Failed to load diamonds:', error);
    }
}

// ===== INIT CUSTOMER =====
function initCustomer() {
    // Load from Supabase or use local data
    if (window.SUPABASE && window.SUPABASE.enabled) {
        loadDiamondsFromSupabase().then(() => {
            // If no data from Supabase, render local
            if (diamonds.length === 0) renderDiamonds();
        });
    } else {
        renderDiamonds();
    }
    
    // Event listeners for bulk actions
    document.getElementById('selectAllBtn').addEventListener('click', () => setAllCheckboxes(true));
    document.getElementById('deselectAllBtn').addEventListener('click', () => setAllCheckboxes(false));
    document.getElementById('bulkConfirmBtn').addEventListener('click', () => bulkAction('confirm'));
    document.getElementById('bulkHoldBtn').addEventListener('click', () => bulkAction('hold'));
    document.getElementById('bulkReleaseBtn').addEventListener('click', () => bulkAction('release'));
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomer);
} else {
    initCustomer();
}
