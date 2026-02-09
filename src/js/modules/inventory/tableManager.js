// Inventory Table Manager - Phase 6: Inventory Management
// Handles dynamic inventory table display, sorting, filtering, and management

window.InventoryTableManager = (function() {
    'use strict';

    // Configuration
    const config = {
        tableId: 'inventoryTableBody',
        defaultSortColumn: 'date',
        defaultSortDirection: 'desc',
        maxRowsPerPage: 100,
        searchDebounceTime: 300
    };

    // State
    let currentSort = {
        column: config.defaultSortColumn,
        direction: config.defaultSortDirection
    };
    let currentFilter = '';
    // PERF: Removed searchTimeout variable - now using PerformanceMonitor.debounce
    
    // Track registered event listeners for cleanup
    const registeredListenerIds = [];

    // Initialize the table manager
    function initialize() {
        console.log('InventoryTableManager initialized');
        setupTableHeaders();
        setupSearchAndFilter();
        rebuildTable();
        populateLocationFilter();
        
        // Add lineage filter button if LineageUI is available (Phase 3)
        if (window.LineageUI) {
            setTimeout(() => {
                LineageUI.addLineageFilterToInventory();
            }, 100);
        }
    }

    // Setup table headers with sorting
    function setupTableHeaders() {
        const headerRow = document.querySelector('.inventory-table thead tr');
        if (!headerRow) return;

        const headers = headerRow.querySelectorAll('th');
        headers.forEach((header, index) => {
            header.style.cursor = 'pointer';
            header.style.userSelect = 'none';
            header.addEventListener('click', () => handleHeaderClick(header, index));
            
            // Add sort indicator
            const sortIndicator = document.createElement('span');
            sortIndicator.className = 'sort-indicator';
            sortIndicator.innerHTML = ' ↕️';
            header.appendChild(sortIndicator);
        });
    }

    // Setup search and filter functionality
    function setupSearchAndFilter() {
        // Add search input if it doesn't exist
        let searchContainer = document.getElementById('inventorySearchContainer');
        if (!searchContainer) {
            searchContainer = createSearchContainer();
            const inventorySection = document.querySelector('.inventory-section');
            const headerDiv = inventorySection.querySelector('div');
            headerDiv.parentNode.insertBefore(searchContainer, headerDiv.nextSibling);
        }

        const searchInput = document.getElementById('inventorySearch');
        if (searchInput) {
            searchInput.addEventListener('input', handleSearchInput);
        }
    }

    // Create search container
    function createSearchContainer() {
        const container = document.createElement('div');
        container.id = 'inventorySearchContainer';
        container.style.cssText = `
            margin: 15px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        `;
        
        container.innerHTML = `
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 300px;">
                    <label for="inventorySearch" style="display: block; margin-bottom: 5px; font-weight: 600;">
                        🔍 Search Inventory:
                    </label>
                    <input type="text" id="inventorySearch" placeholder="Search by container, barcode, strain, owner..." 
                           style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Quick Filters:</label>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="filter-btn" onclick="InventoryTableManager.quickFilter('today')">Today</button>
                        <button class="filter-btn" onclick="InventoryTableManager.quickFilter('week')">This Week</button>
                        <button class="filter-btn" onclick="InventoryTableManager.quickFilter('split')">Split Origins</button>
                        <button class="filter-btn" onclick="InventoryTableManager.quickFilter('noLocation')">📍 No Location</button>
                        <select id="locationFilterSelect" onchange="InventoryTableManager.quickFilter('location', this.value)" style="padding: 4px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 0.85rem; cursor: pointer;">
                            <option value="">📍 By Location</option>
                        </select>
                        <button class="filter-btn" onclick="InventoryTableManager.clearFilter()">Clear</button>
                    </div>
                </div>
            </div>
            <div id="inventoryStats" style="margin-top: 10px; font-size: 0.9rem; color: #6c757d;">
                <span id="filteredCount">0</span> of <span id="totalCount">0</span> entries shown
            </div>
        `;

        // Add CSS for filter buttons
        if (!document.getElementById('inventoryTableCSS')) {
            const style = document.createElement('style');
            style.id = 'inventoryTableCSS';
            style.textContent = `
                .filter-btn {
                    padding: 4px 12px;
                    border: 1px solid #ced4da;
                    background: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .filter-btn:hover {
                    background: #e9ecef;
                    border-color: #adb5bd;
                }
                .filter-btn.active {
                    background: #007bff;
                    border-color: #007bff;
                    color: white;
                }
                .sort-indicator {
                    font-size: 0.8rem;
                    opacity: 0.6;
                }
                .sort-indicator.active {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);
        }

        return container;
    }

    // Handle header click for sorting
    function handleHeaderClick(header, columnIndex) {
        const columns = ['containerId', 'lineage', 'barcode', 'strain', 'owner', 'stage', 'media', 'location', 'tissueCount', 'date', 'status', 'notes'];
        const column = columns[columnIndex];
        
        if (!column) return;

        // Update sort direction
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }

        // Update UI indicators
        updateSortIndicators();
        
        // Rebuild table with new sort
        rebuildTable();
    }

    // Update sort indicators in headers
    function updateSortIndicators() {
        const indicators = document.querySelectorAll('.sort-indicator');
        indicators.forEach(indicator => {
            indicator.innerHTML = ' ↕️';
            indicator.classList.remove('active');
        });

        const headers = document.querySelectorAll('.inventory-table thead th');
        const columns = ['containerId', 'lineage', 'barcode', 'strain', 'owner', 'stage', 'media', 'location', 'tissueCount', 'date', 'status', 'notes'];
        const columnIndex = columns.indexOf(currentSort.column);
        
        if (columnIndex !== -1 && headers[columnIndex]) {
            const indicator = headers[columnIndex].querySelector('.sort-indicator');
            if (indicator) {
                indicator.innerHTML = currentSort.direction === 'asc' ? ' ↗️' : ' ↘️';
                indicator.classList.add('active');
            }
        }
    }

    // Handle search input - PERF: Using PerformanceMonitor debounce for proper cleanup
    function handleSearchInput(e) {
        const searchValue = e.target.value.toLowerCase().trim();
        
        // Use PerformanceMonitor debounce if available, fallback to simple timeout
        if (window.PerformanceMonitor && window.PerformanceMonitor.debounce) {
            PerformanceMonitor.debounce('inventorySearch', () => {
                currentFilter = searchValue;
                rebuildTable();
            }, config.searchDebounceTime);
        } else {
            // Fallback for when PerformanceMonitor is not loaded
            currentFilter = searchValue;
            rebuildTable();
        }
    }

    // Quick filter functions
    function quickFilter(type, value) {
        // Clear previous filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));

        const inventory = StateManager.getState('inventory') || [];
        let filteredData;

        switch (type) {
            case 'today':
                const today = new Date().toDateString();
                filteredData = inventory.filter(item =>
                    new Date(item.date).toDateString() === today
                );
                document.querySelector('.filter-btn[onclick*="today"]')?.classList.add('active');
                break;

            case 'week':
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                filteredData = inventory.filter(item =>
                    new Date(item.date) >= weekAgo
                );
                document.querySelector('.filter-btn[onclick*="week"]')?.classList.add('active');
                break;

            case 'split':
                filteredData = inventory.filter(item =>
                    item.transferType === 'split' || item.transferSource
                );
                document.querySelector('.filter-btn[onclick*="split"]')?.classList.add('active');
                break;

            case 'noLocation':
                filteredData = inventory.filter(item =>
                    !item.location || item.location.trim() === ''
                );
                document.querySelector('.filter-btn[onclick*="noLocation"]')?.classList.add('active');
                break;

            case 'location':
                if (value) {
                    filteredData = inventory.filter(item =>
                        item.location && item.location.toLowerCase() === value.toLowerCase()
                    );
                } else {
                    filteredData = inventory;
                }
                break;

            default:
                filteredData = inventory;
        }

        buildTableFromData(filteredData);
        updateFilterStats(filteredData.length, inventory.length);
    }

    // Clear all filters
    function clearFilter() {
        currentFilter = '';
        document.getElementById('inventorySearch').value = '';
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));

        // Reset location filter dropdown
        const locationSelect = document.getElementById('locationFilterSelect');
        if (locationSelect) locationSelect.value = '';

        rebuildTable();
    }

    // Populate location filter dropdown with unique locations from inventory
    function populateLocationFilter() {
        const locationSelect = document.getElementById('locationFilterSelect');
        if (!locationSelect) return;

        const inventory = StateManager.getState('inventory') || [];

        // Get unique locations from inventory
        const uniqueLocations = new Set();
        inventory.forEach(item => {
            if (item.location && item.location.trim()) {
                uniqueLocations.add(item.location);
            }
        });

        // Also add locations from HQ workbook
        let hqLocations = [];
        if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
            hqLocations = window.InventoryLookupService.getAllLocations();
        } else if (window.appState.locationsTable && window.appState.locationsTable.length > 0) {
            hqLocations = window.appState.locationsTable;
        }
        hqLocations.forEach(loc => uniqueLocations.add(loc));

        // Build options
        let optionsHtml = '<option value="">📍 By Location</option>';
        const sortedLocations = Array.from(uniqueLocations).sort();
        sortedLocations.forEach(loc => {
            optionsHtml += `<option value="${UIUtils.sanitize(loc)}">${UIUtils.sanitize(loc)}</option>`;
        });

        locationSelect.innerHTML = optionsHtml;
    }

    // Rebuild the entire table
    function rebuildTable() {
        const inventory = StateManager.getState('inventory') || [];
        let processedData = [...inventory];

        // Apply search filter
        if (currentFilter) {
            processedData = processedData.filter(item => 
                Object.values(item).some(value => 
                    String(value).toLowerCase().includes(currentFilter)
                )
            );
        }

        // Apply sorting
        processedData.sort((a, b) => {
            let aVal = a[currentSort.column];
            let bVal = b[currentSort.column];

            // Handle different data types
            if (currentSort.column === 'date') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            } else if (currentSort.column === 'containerId') {
                aVal = parseInt(aVal) || 0;
                bVal = parseInt(bVal) || 0;
            } else if (currentSort.column === 'tissueCount') {
                // Handle 'Unknown' tissue count for sorting
                aVal = aVal === 'Unknown' ? -1 : (parseInt(aVal) || 0);
                bVal = bVal === 'Unknown' ? -1 : (parseInt(bVal) || 0);
            } else {
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();
            }

            if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        buildTableFromData(processedData);
        updateFilterStats(processedData.length, inventory.length);

        // Refresh location filter options when data changes
        populateLocationFilter();
    }

    // Build table from processed data
    function buildTableFromData(data) {
        const tableBody = document.getElementById(config.tableId);
        if (!tableBody) {
            console.error('Inventory table body not found');
            return;
        }

        // Clear existing content
        tableBody.innerHTML = '';

        if (data.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="12" style="text-align: center; padding: 30px; color: #6c757d; font-style: italic;">
                    ${currentFilter ? 'No entries match your search criteria' : 'No inventory data available'}
                </td>
            `;
            tableBody.appendChild(emptyRow);
            return;
        }

        // Build rows
        data.forEach(item => {
            const row = createTableRow(item);
            tableBody.appendChild(row);
        });
    }

    // Create a single table row
    function createTableRow(item) {
        const row = document.createElement('tr');
        
        // Add hover effect
        row.style.cursor = 'pointer';
        row.addEventListener('mouseenter', () => {
            row.style.backgroundColor = '#f8f9fa';
        });
        row.addEventListener('mouseleave', () => {
            row.style.backgroundColor = '';
        });

        // Click handler for row details
        row.addEventListener('click', () => showRowDetails(item));

        // Build lineage display
        const lineageDisplay = buildLineageDisplay(item);
        
        // Format date
        const date = new Date(item.date);
        const dateDisplay = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        // Status indicator
        const statusDisplay = buildStatusDisplay(item);

        // SECURITY FIX: Sanitize all user data before innerHTML
        const s = UIUtils.sanitize;

        // Build location display
        const locationDisplay = buildLocationDisplay(item);

        row.innerHTML = `
            <td style="font-weight: 600; color: #495057;">${s(item.containerId)}</td>
            <td>${lineageDisplay}</td>
            <td style="font-family: monospace; font-size: 0.9rem; background: #f8f9fa; padding: 4px 8px; border-radius: 3px;">
                ${s(item.barcode) || '-'}
            </td>
            <td><span style="background: #e3f2fd; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">
                ${s(item.strain) || 'Unknown'}
            </span></td>
            <td>${s(item.owner) || 'Unknown'}</td>
            <td>${s(item.stage) || 'Unknown'}</td>
            <td>${s(item.media) || 'Unknown'}</td>
            <td>${locationDisplay}</td>
            <td style="text-align: center; font-weight: 600;">${typeof item.tissueCount === 'number' ? item.tissueCount : (item.tissueCount === 'Unknown' ? 'Unknown' : (item.tissueCount || 1))}</td>
            <td style="font-size: 0.85rem; color: #6c757d;">${dateDisplay}</td>
            <td>${statusDisplay}</td>
            <td style="font-family: monospace; font-size: 0.8rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s(item.notes) || ''}">${s(item.notes) || '-'}</td>
        `;

        return row;
    }

    // Build lineage display for container relationships - Enhanced with LineageUI (Phase 3)
    function buildLineageDisplay(item) {
        // Use enhanced LineageUI if available (Phase 3)
        if (window.LineageUI) {
            return LineageUI.createTableLineageDisplay(item);
        }
        
        // Fallback to legacy display
        if (item.transferSource) {
            const transferType = item.transferType === 'split' ? '🌱' : '📦';
            // SECURITY FIX: Sanitize transferSource
            const safeSource = UIUtils.sanitize(item.transferSource);
            return `<span style="background: #fff3cd; padding: 2px 6px; border-radius: 8px; font-size: 0.8rem;">
                ${transferType} from ${safeSource}
            </span>`;
        }
        
        // Check if this container has been used as a source
        const inventory = StateManager.getState('inventory') || [];
        const hasChildren = inventory.some(inventoryItem => inventoryItem.transferSource === item.containerId);
        
        if (hasChildren) {
            return `<span style="background: #e8f5e8; padding: 2px 6px; border-radius: 8px; font-size: 0.8rem;">
                🔗 Source
            </span>`;
        }
        
        return '<span style="color: #adb5bd; font-size: 0.8rem;">Original</span>';
    }

    // Build status display
    function buildStatusDisplay(item) {
        if (item.transferType === 'split') {
            return '<span style="background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Split</span>';
        } else if (item.transferSource) {
            return '<span style="background: #cce5ff; color: #004085; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Transferred</span>';
        } else {
            return '<span style="background: #f8f9fa; color: #495057; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Original</span>';
        }
    }

    // Build location display
    function buildLocationDisplay(item) {
        const s = UIUtils.sanitize;
        if (item.location) {
            return `<span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                📍 ${s(item.location)}
            </span>`;
        }
        return '<span style="color: #adb5bd; font-size: 0.8rem;">Not set</span>';
    }

    // Show detailed information for a row
    function showRowDetails(item) {
        const lineage = StateManager.getState('containerLineage') || {};
        const itemLineage = lineage[item.containerId] || [];
        
        let lineageInfo = '';
        if (itemLineage.length > 0) {
            lineageInfo = itemLineage.map(entry => 
                `• From container ${entry.sourceContainer} on ${new Date(entry.transferDate).toLocaleString()} (${entry.transferType})`
            ).join('<br>');
        }

        const modalContent = `
            <div style="max-width: 500px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                <h3 style="margin-top: 0; color: #2c3e50;">Container ${item.containerId} Details</h3>
                <div style="margin: 15px 0;">
                    <strong>Barcode:</strong> <code>${item.barcode || 'Not assigned'}</code><br>
                    <strong>Strain:</strong> ${item.strain || 'Unknown'}<br>
                    <strong>Owner:</strong> ${item.owner || 'Unknown'}<br>
                    <strong>Stage:</strong> ${item.stage || 'Unknown'}<br>
                    <strong>Media:</strong> ${item.media || 'Unknown'}<br>
                    <strong>Location:</strong> ${item.location || 'Not set'}<br>
                    <strong>Tissue Count:</strong> ${item.tissueCount || 1}<br>
                    <strong>Date Created:</strong> ${new Date(item.date).toLocaleString()}<br>
                    <strong>Notes:</strong> <code style="font-size: 0.85rem; word-break: break-all;">${item.notes || 'None'}</code><br>
                    ${item.transferSource ? `<strong>Transfer Source:</strong> Container ${item.transferSource}<br>` : ''}
                    ${item.transferType ? `<strong>Transfer Type:</strong> ${item.transferType}<br>` : ''}
                </div>
                ${lineageInfo ? `<div style="margin: 15px 0;"><strong>Lineage History:</strong><br>${lineageInfo}</div>` : ''}
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button onclick="InventoryTableManager.showLocationEditor('${item.containerId}')"
                            style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        📍 Change Location
                    </button>
                    <button onclick="this.closest('[style*=\\"position: fixed\\"]').remove()"
                            style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Create modal overlay
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
            z-index: 1000;
        `;
        modal.innerHTML = modalContent;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
    }

    // Update filter statistics
    function updateFilterStats(filteredCount, totalCount) {
        const filteredElement = document.getElementById('filteredCount');
        const totalElement = document.getElementById('totalCount');

        if (filteredElement) filteredElement.textContent = filteredCount;
        if (totalElement) totalElement.textContent = totalCount;
    }

    // Show location editor modal for a container
    function showLocationEditor(containerId) {
        // Close the details modal first
        const existingModal = document.querySelector('[style*="position: fixed"][style*="z-index: 1000"]');
        if (existingModal) existingModal.remove();

        // Get current container data
        const inventory = StateManager.getState('inventory') || [];
        const container = inventory.find(item => item.containerId === containerId);

        if (!container) {
            if (window.NotificationSystem) {
                NotificationSystem.error(`Container ${containerId} not found`);
            }
            return;
        }

        // Get all available locations
        let locations = [];
        if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
            locations = window.InventoryLookupService.getAllLocations();
        } else if (window.appState.locationsTable && window.appState.locationsTable.length > 0) {
            locations = window.appState.locationsTable;
        }

        // Build location options
        const locationOptions = locations.map(loc => {
            const selected = container.location === loc ? 'selected' : '';
            return `<option value="${UIUtils.sanitize(loc)}" ${selected}>${UIUtils.sanitize(loc)}</option>`;
        }).join('');

        const modalContent = `
            <div style="max-width: 400px; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.3);">
                <h3 style="margin-top: 0; color: #2c3e50; text-align: center;">📍 Update Location</h3>
                <p style="color: #6b7280; text-align: center; margin-bottom: 20px;">
                    Container <strong>${containerId}</strong>
                </p>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        Current Location:
                    </label>
                    <p style="color: #92400e; background: #fef3c7; padding: 8px 12px; border-radius: 6px; margin: 0;">
                        ${container.location || 'Not set'}
                    </p>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        New Location:
                    </label>
                    ${locations.length > 0 ? `
                        <select id="newLocationSelect" style="width: 100%; padding: 10px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 1rem;">
                            <option value="">-- Select Location --</option>
                            ${locationOptions}
                        </select>
                        <p style="margin: 8px 0 0; font-size: 0.85rem; color: #6b7280;">
                            Or enter a custom location:
                        </p>
                    ` : ''}
                    <input type="text" id="newLocationInput"
                           placeholder="Enter location (e.g., Tent 1, 231 Top Shelf)"
                           value="${container.location || ''}"
                           style="width: 100%; padding: 10px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 1rem; margin-top: 8px; box-sizing: border-box;">
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.closest('[style*=\\"position: fixed\\"]').remove()"
                            style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                    <button onclick="InventoryTableManager.saveLocation('${containerId}')"
                            style="background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        💾 Save Location
                    </button>
                </div>
            </div>
        `;

        // Create modal overlay
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
            z-index: 1001;
        `;
        modal.innerHTML = modalContent;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.body.appendChild(modal);

        // Sync select and input
        const select = document.getElementById('newLocationSelect');
        const input = document.getElementById('newLocationInput');
        if (select && input) {
            select.addEventListener('change', () => {
                if (select.value) {
                    input.value = select.value;
                }
            });
        }
    }

    // Save location for a container
    async function saveLocation(containerId) {
        const selectEl = document.getElementById('newLocationSelect');
        const inputEl = document.getElementById('newLocationInput');

        // Prefer input field, fallback to select
        const newLocation = (inputEl?.value?.trim()) || (selectEl?.value?.trim()) || '';

        if (!newLocation) {
            if (window.NotificationSystem) {
                NotificationSystem.warning('Please enter or select a location');
            }
            return;
        }

        // Update the container in inventory
        const inventory = StateManager.getState('inventory') || [];
        let updated = false;

        // Update all entries for this container (in case of multiple samples)
        inventory.forEach(item => {
            if (item.containerId === containerId) {
                item.location = newLocation;
                item.locationUpdatedAt = new Date().toISOString();
                updated = true;
            }
        });

        if (updated) {
            StateManager.setState('inventory', inventory);

            // Rebuild table to show update
            rebuildTable();

            // Save to localStorage
            if (window.InventoryManager && typeof window.InventoryManager.saveToLocalStorage === 'function') {
                window.InventoryManager.saveToLocalStorage();
            }

            // Sync to cloud
            if (window.OneDriveSync && window.OneDriveSync.updateRowByContainerId) {
                try {
                    console.log(`InventoryTableManager: Syncing location update to cloud for ${containerId}`);
                    const result = await window.OneDriveSync.updateRowByContainerId(containerId, {
                        location: newLocation
                    });
                    if (result.success) {
                        console.log(`InventoryTableManager: Cloud sync successful for ${containerId} location`);
                    } else {
                        console.warn(`InventoryTableManager: Cloud sync failed for ${containerId} location`);
                    }
                } catch (err) {
                    console.error('InventoryTableManager: Error syncing location to cloud:', err);
                }
            }

            // Close modal
            const modal = document.querySelector('[style*="position: fixed"][style*="z-index: 1001"]');
            if (modal) modal.remove();

            if (window.NotificationSystem) {
                NotificationSystem.success(`Location updated for container ${containerId}: ${newLocation}`);
            }
        } else {
            if (window.NotificationSystem) {
                NotificationSystem.error(`Container ${containerId} not found in inventory`);
            }
        }
    }

    // Filter by location
    function filterByLocation(location) {
        const inventory = StateManager.getState('inventory') || [];
        const filteredData = inventory.filter(item =>
            item.location && item.location.toLowerCase().includes(location.toLowerCase())
        );

        buildTableFromData(filteredData);
        updateFilterStats(filteredData.length, inventory.length);
    }

    // Get current table data (for export)
    function getCurrentTableData() {
        const inventory = StateManager.getState('inventory') || [];
        let processedData = [...inventory];

        // Apply current filter
        if (currentFilter) {
            processedData = processedData.filter(item => 
                Object.values(item).some(value => 
                    String(value).toLowerCase().includes(currentFilter)
                )
            );
        }

        return processedData;
    }

    // PERF: Cleanup function to remove all registered event listeners
    function cleanup() {
        console.log('[InventoryTableManager] Cleaning up event listeners...');
        
        // Use PerformanceMonitor if available
        if (window.PerformanceMonitor) {
            registeredListenerIds.forEach(id => {
                PerformanceMonitor.removeEventListener(id);
            });
        }
        
        // Clear the registry
        registeredListenerIds.length = 0;
        
        // Clear any pending debounce timers
        if (window.PerformanceMonitor && window.PerformanceMonitor.clearAllDebounceTimers) {
            // Clear only inventory-related timers would be ideal, but clearing the search one is key
        }
        
        console.log('[InventoryTableManager] Cleanup complete');
    }

    // Public API
    return {
        initialize,
        rebuildTable,
        quickFilter,
        clearFilter,
        getCurrentTableData,
        buildTableFromData,
        showLocationEditor,
        saveLocation,
        filterByLocation,
        populateLocationFilter,
        cleanup  // PERF: Expose cleanup for memory management
    };

})();
