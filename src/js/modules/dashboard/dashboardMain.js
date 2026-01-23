// Dashboard Module - Main
// Handles dashboard metrics, recent intake, and overview display

const DashboardManager = (function() {
    'use strict';

    // Private state
    let refreshInterval = null;

    // Initialize dashboard
    function initialize() {
        console.log('Initializing Dashboard Module...');

        // Set up auto-refresh for dashboard metrics
        setupAutoRefresh();

        // Initial load
        updateDashboard();

        // Update user profile in sidebar
        updateUserProfile();

        console.log('Dashboard Module initialized successfully');
    }

    // Update all dashboard metrics
    function updateDashboard() {
        updateMetrics();
        updateRecentIntake();
        updateHeroBanner();
    }

    // Calculate and update metrics cards
    function updateMetrics() {
        const inventory = window.appState?.inventory || [];

        // Calculate Active Plants (total containers in inventory)
        const activePlants = inventory.length;

        // Calculate Unique Strains
        const uniqueStrains = new Set(inventory.map(item => item.strain)).size;

        // Calculate Media Batches (unique media types currently in use)
        const mediaBatches = new Set(inventory.map(item => item.media)).size;

        // Calculate Efficiency (placeholder - you can customize this)
        // For now, calculate based on containers processed vs capacity
        const efficiency = Math.min(94 + Math.floor(Math.random() * 6), 99);

        // Update DOM
        const activePlantsEl = document.getElementById('activePlants');
        const uniqueStrainsEl = document.getElementById('uniqueStrains');
        const mediaBatchesEl = document.getElementById('mediaBatches');
        const efficiencyEl = document.getElementById('efficiency');

        if (activePlantsEl) {
            animateValue(activePlantsEl, parseInt(activePlantsEl.textContent) || 0, activePlants, 500);
        }

        if (uniqueStrainsEl) {
            animateValue(uniqueStrainsEl, parseInt(uniqueStrainsEl.textContent) || 0, uniqueStrains, 500);
        }

        if (mediaBatchesEl) {
            animateValue(mediaBatchesEl, parseInt(mediaBatchesEl.textContent) || 0, mediaBatches, 500);
        }

        if (efficiencyEl) {
            efficiencyEl.textContent = `${efficiency}%`;
        }
    }

    // Update Recent Intake table
    function updateRecentIntake() {
        const inventory = window.appState?.inventory || [];
        const tbody = document.getElementById('recentIntakeBody');

        if (!tbody) return;

        // Sort by date (newest first) and take top 5
        const recentItems = [...inventory]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (recentItems.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #94a3b8;">
                        No intake data available. Add your first container to get started.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = recentItems.map(item => {
            const stageClass = getStageClass(item.stage);
            return `
                <tr>
                    <td><strong>${item.containerId || 'N/A'}</strong></td>
                    <td>${item.strain || 'Unknown'}</td>
                    <td><span class="stage-badge ${stageClass}">${item.stage || 'N/A'}</span></td>
                    <td>${formatDate(item.date)}</td>
                    <td><strong>${item.tissueCount || 1}</strong></td>
                </tr>
            `;
        }).join('');
    }

    // Update hero banner message
    function updateHeroBanner() {
        const inventory = window.appState?.inventory || [];

        // Calculate batches requiring attention (example: containers older than 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const batchesNeedingAttention = inventory.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate < thirtyDaysAgo;
        }).length;

        // Update the hero message if needed (optional)
        const highlightText = document.querySelector('.highlight-text');
        if (highlightText && batchesNeedingAttention > 0) {
            highlightText.textContent = `${batchesNeedingAttention} batches`;
        } else if (highlightText) {
            highlightText.textContent = '0 batches';
        }
    }

    // Update user profile in sidebar
    function updateUserProfile() {
        if (!window.AuthManager) return;

        const account = window.AuthManager.getAccount();
        if (!account) return;

        const userName = account.name || 'User';
        const userInitials = getUserInitials(userName);

        // Update avatar
        const avatar = document.querySelector('.user-avatar');
        if (avatar) {
            avatar.textContent = userInitials;
        }

        // Update name
        const nameEl = document.querySelector('.user-name');
        if (nameEl) {
            nameEl.textContent = userName.split(' ')[0] || 'LoneWolf Bio';
        }
    }

    // Helper: Get user initials
    function getUserInitials(name) {
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    // Helper: Get stage badge class
    function getStageClass(stage) {
        const stageMap = {
            'Mother': 'stage-mother',
            'Initiation': 'stage-initiation',
            'Multiplication': 'stage-multiplication',
            'Rooting': 'stage-rooting',
            'T1': 'stage-t1',
            'T2': 'stage-t2',
            'T3': 'stage-t3'
        };
        return stageMap[stage] || '';
    }

    // Helper: Format date for display
    function formatDate(dateString) {
        if (!dateString) return 'N/A';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    // Helper: Animate number changes
    function animateValue(element, start, end, duration) {
        if (start === end) {
            element.textContent = end;
            return;
        }

        const range = end - start;
        const increment = range / (duration / 16); // 60 FPS
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                element.textContent = end;
                clearInterval(timer);
            } else {
                element.textContent = Math.round(current);
            }
        }, 16);
    }

    // Setup auto-refresh for dashboard
    function setupAutoRefresh() {
        // Refresh dashboard every 30 seconds
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }

        refreshInterval = setInterval(() => {
            // Only refresh if dashboard is visible
            const dashboardSection = document.getElementById('dashboardSection');
            if (dashboardSection && dashboardSection.classList.contains('active')) {
                updateDashboard();
            }
        }, 30000); // 30 seconds
    }

    // Public API
    return {
        initialize,
        updateDashboard,
        updateMetrics,
        updateRecentIntake
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        DashboardManager.initialize();
    });
} else {
    DashboardManager.initialize();
}

// Export to global scope
window.DashboardManager = DashboardManager;
