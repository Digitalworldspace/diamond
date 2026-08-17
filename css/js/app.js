// ============================================
// MAIN APPLICATION - Tab Switching
// ============================================

function initApp() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = {
        admin: document.getElementById('panel-admin'),
        customer: document.getElementById('panel-customer')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding panel
            const target = tab.dataset.tab;
            Object.keys(panels).forEach(key => {
                panels[key].classList.toggle('active', key === target);
            });
        });
    });

    console.log('✅ Diamond Portal initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
