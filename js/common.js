// ============================================
// COMMON UTILITIES
// ============================================

function showFeedback(element, message, isError = false) {
    if (!element) return;
    const icon = isError ? 'exclamation-triangle' : 'check-circle';
    const color = isError ? '#b45309' : '#2b6e4e';
    element.innerHTML = `<i class="fas fa-${icon}" style="color:${color};"></i> ${message}`;
}

function getDiamondImage(id) {
    const seed = (id && id.charCodeAt(1)) || 5;
    return `https://picsum.photos/seed/${id}${seed}/200/200`;
}

function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusClass(status) {
    if (status === 'confirmed') return 'status-confirmed';
    if (status === 'hold') return 'status-hold';
    return '';
}
