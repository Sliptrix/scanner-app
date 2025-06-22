// Data Export Manager - Phase 6: Inventory Management
// Handles Excel export functionality with filtering, formatting, and multiple export options

window.DataExportManager = (function() {
    'use strict';

    // Configuration
    const config = {
        defaultFileName: 'lab_inventory_export',
        dateFormat: 'YYYY-MM-DD_HH-mm-ss',
        exportFormats: ['xlsx', 'csv'],
        worksheetNames: {
            inventory: 'Inventory',
            transfers: 'Transfer History',
            lineage: 'Container Lineage',
            summary: 'Summary'
        }
    };

    // Initialize the export manager
    function initialize() {
        console.log('DataExportManager initialized');
        setupExportUI();
    }

    // Setup export UI enhancements
    function setupExportUI() {
        // Find the export button and enhance it
        const existingExportBtn = document.querySelector('button[onclick="exportInventory()"]');
        if (existingExportBtn) {
            existingExportBtn.onclick = () => showExportDialog();
            existingExportBtn.innerHTML = '📊 Export Data';
        }
    }

    // Show export options dialog
    function showExportDialog() {
        const inventory = StateManager.getState('inventory') || [];
        const transferHistory = StateManager.getState('transferHistory') || [];
        
        const dialogContent = `
            <div style="max-width: 600px; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.3);">
                <h3 style="margin-top: 0; color: #2c3e50; text-align: center;">📊 Export Laboratory Data</h3>
                
                <div style="margin: 20px 0;">
                    <h4 style="color: #34495e; margin-bottom: 10px;">📋 Export Options:</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
                        <label style="display: flex; align-items: center; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px; cursor: pointer; background: #f8f9fa;">
                            <input type="checkbox" id="exportInventory" checked style="margin-right: 8px;">
                            <div>
                                <strong>Inventory Data</strong><br>
                                <small style="color: #6c757d;">${inventory.length} entries</small>
                            </div>
                        </label>
                        
                        <label style="display: flex; align-items: center; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px; cursor: pointer; background: #f8f9fa;">
                            <input type="checkbox" id="exportTransfers" checked style="margin-right: 8px;">
                            <div>
                                <strong>Transfer History</strong><br>
                                <small style="color: #6c757d;">${transferHistory.length} transfers</small>
                            </div>
                        </label>
                        
                        <label style="display: flex; align-items: center; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px; cursor: pointer; background: #f8f9fa;">
                            <input type="checkbox" id="exportLineage" checked style="margin-right: 8px;">
                            <div>
                                <strong>Container Lineage</strong><br>
                                <small style="color: #6c757d;">Relationship data</small>
                            </div>
                        </label>
                        
                        <label style="display: flex; align-items: center; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px; cursor: pointer; background: #f8f9fa;">
                            <input type="checkbox" id="exportSummary" checked style="margin-right: 8px;">
                            <div>
                                <strong>Summary Report</strong><br>
                                <small style="color: #6c757d;">Statistics & overview</small>
                            </div>
                        </label>
                    </div>
                </div>

                <div style="margin: 20px 0;">
                    <h4 style="color: #34495e; margin-bottom: 10px;">📁 Export Format:</h4>
                    <div style="display: flex; gap: 15px;">
                        <label style="display: flex; align-items: center;">
                            <input type="radio" name="exportFormat" value="xlsx" checked style="margin-right: 8px;">
                            <strong>Excel (.xlsx)</strong> <small style="color: #6c757d; margin-left: 5px;">- Multiple worksheets</small>
                        </label>
                        <label style="display: flex; align-items: center;">
                            <input type="radio" name="exportFormat" value="csv" style="margin-right: 8px;">
                            <strong>CSV (.csv)</strong> <small style="color: #6c757d; margin-left: 5px;">- Inventory only</small>
                        </label>
                    </div>
                </div>

                <div style="margin: 20px 0;">
                    <h4 style="color: #34495e; margin-bottom: 10px;">🏷️ File Name:</h4>
                    <input type="text" id="exportFileName" value="${generateDefaultFileName()}" 
                           style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px;">
                </div>

                <div style="margin: 20px 0;">
                    <h4 style="color: #34495e; margin-bottom: 10px;">🔍 Data Scope:</h4>
                    <label style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input type="radio" name="dataScope" value="all" checked style="margin-right: 8px;">
                        <strong>All Data</strong> <small style="color: #6c757d; margin-left: 5px;">- Complete inventory</small>
                    </label>
                    <label style="display: flex; align-items: center;">
                        <input type="radio" name="dataScope" value="filtered" style="margin-right: 8px;">
                        <strong>Current View</strong> <small style="color: #6c757d; margin-left: 5px;">- Filtered/searched results</small>
                    </label>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px;">
                    <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" 
                            style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                    <button onclick="DataExportManager.processExport(this)" 
                            style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        📥 Export Data
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
        modal.innerHTML = dialogContent;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
    }

    // Process the export based on user selections
    function processExport(button) {
        button.disabled = true;
        button.innerHTML = '⏳ Exporting...';

        try {
            const options = getExportOptions();
            
            if (options.format === 'xlsx') {
                exportToExcel(options);
            } else {
                exportToCSV(options);
            }

            // Close dialog after brief delay
            setTimeout(() => {
                button.closest('[style*="position: fixed"]').remove();
                NotificationSystem.success('Export completed successfully!');
            }, 1000);

        } catch (error) {
            console.error('Export error:', error);
            NotificationSystem.error('Export failed: ' + error.message);
            button.disabled = false;
            button.innerHTML = '📥 Export Data';
        }
    }

    // Get export options from dialog
    function getExportOptions() {
        return {
            inventory: document.getElementById('exportInventory').checked,
            transfers: document.getElementById('exportTransfers').checked,
            lineage: document.getElementById('exportLineage').checked,
            summary: document.getElementById('exportSummary').checked,
            format: document.querySelector('input[name="exportFormat"]:checked').value,
            fileName: document.getElementById('exportFileName').value.trim(),
            scope: document.querySelector('input[name="dataScope"]:checked').value
        };
    }

    // Export to Excel format
    function exportToExcel(options) {
        const workbook = XLSX.utils.book_new();

        if (options.inventory) {
            const inventoryData = getInventoryData(options.scope);
            const inventoryWS = createInventoryWorksheet(inventoryData);
            XLSX.utils.book_append_sheet(workbook, inventoryWS, config.worksheetNames.inventory);
        }

        if (options.transfers) {
            const transferData = getTransferHistoryData();
            const transferWS = createTransferWorksheet(transferData);
            XLSX.utils.book_append_sheet(workbook, transferWS, config.worksheetNames.transfers);
        }

        if (options.lineage) {
            const lineageData = getLineageData();
            const lineageWS = createLineageWorksheet(lineageData);
            XLSX.utils.book_append_sheet(workbook, lineageWS, config.worksheetNames.lineage);
        }

        if (options.summary) {
            const summaryData = generateSummaryData();
            const summaryWS = createSummaryWorksheet(summaryData);
            XLSX.utils.book_append_sheet(workbook, summaryWS, config.worksheetNames.summary);
        }

        // Save file
        const fileName = options.fileName + '.xlsx';
        XLSX.writeFile(workbook, fileName);
    }

    // Export to CSV format
    function exportToCSV(options) {
        const inventoryData = getInventoryData(options.scope);
        const csvData = convertToCSV(inventoryData);
        downloadCSV(csvData, options.fileName + '.csv');
    }

    // Get inventory data based on scope
    function getInventoryData(scope) {
        if (scope === 'filtered' && window.InventoryTableManager) {
            return window.InventoryTableManager.getCurrentTableData();
        } else {
            return StateManager.getState('inventory') || [];
        }
    }

    // Get transfer history data
    function getTransferHistoryData() {
        return StateManager.getState('transferHistory') || [];
    }

    // Get lineage data
    function getLineageData() {
        const lineage = StateManager.getState('containerLineage') || {};
        const data = [];
        
        Object.keys(lineage).forEach(containerId => {
            lineage[containerId].forEach(entry => {
                data.push({
                    'Container ID': containerId,
                    'Source Container': entry.sourceContainer,
                    'Transfer Date': entry.transferDate,
                    'Transfer Type': entry.transferType,
                    'Samples Received': entry.samplesReceived
                });
            });
        });
        
        return data;
    }

    // Generate summary data
    function generateSummaryData() {
        const inventory = StateManager.getState('inventory') || [];
        const transferHistory = StateManager.getState('transferHistory') || [];
        
        // Basic statistics
        const totalContainers = new Set(inventory.map(item => item.containerId)).size;
        const totalSamples = inventory.length;
        const uniqueStrains = new Set(inventory.map(item => item.strain).filter(Boolean)).size;
        const uniqueOwners = new Set(inventory.map(item => item.owner).filter(Boolean)).size;
        
        // Transfer statistics
        const totalTransfers = transferHistory.length;
        const splitTransfers = transferHistory.filter(t => t.type === 'split').length;
        const singleTransfers = transferHistory.filter(t => t.type === 'single').length;
        
        // Date range
        const dates = inventory.map(item => new Date(item.date)).filter(d => !isNaN(d));
        const earliestDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
        const latestDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;
        
        // Strain distribution
        const strainCounts = {};
        inventory.forEach(item => {
            const strain = item.strain || 'Unknown';
            strainCounts[strain] = (strainCounts[strain] || 0) + 1;
        });
        
        // Owner distribution
        const ownerCounts = {};
        inventory.forEach(item => {
            const owner = item.owner || 'Unknown';
            ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
        });

        return {
            basic: {
                'Total Containers': totalContainers,
                'Total Samples': totalSamples,
                'Unique Strains': uniqueStrains,
                'Unique Owners': uniqueOwners,
                'Total Transfers': totalTransfers,
                'Split Transfers': splitTransfers,
                'Single Transfers': singleTransfers,
                'Date Range': earliestDate && latestDate ? 
                    `${earliestDate.toLocaleDateString()} - ${latestDate.toLocaleDateString()}` : 'N/A'
            },
            strains: strainCounts,
            owners: ownerCounts
        };
    }

    // Create inventory worksheet
    function createInventoryWorksheet(data) {
        const headers = [
            'Container ID', 'Barcode', 'Strain', 'Owner', 'Stage', 'Media', 
            'Tissue Count', 'Date Created', 'Transfer Source', 'Transfer Type', 'Status'
        ];
        
        const wsData = [headers];
        
        data.forEach(item => {
            wsData.push([
                item.containerId,
                item.barcode || '',
                item.strain || '',
                item.owner || '',
                item.stage || '',
                item.media || '',
                item.tissueCount || 1,
                item.date,
                item.transferSource || '',
                item.transferType || '',
                item.transferType === 'split' ? 'Split' : 
                item.transferSource ? 'Transferred' : 'Original'
            ]);
        });

        return XLSX.utils.aoa_to_sheet(wsData);
    }

    // Create transfer worksheet
    function createTransferWorksheet(data) {
        const headers = [
            'Transfer ID', 'Date', 'Type', 'Source Container', 
            'Destination Containers', 'Samples Transferred', 'Split Count'
        ];
        
        const wsData = [headers];
        
        data.forEach(transfer => {
            wsData.push([
                transfer.id,
                transfer.timestamp,
                transfer.type,
                transfer.sourceContainer,
                transfer.destinationContainers.join(', '),
                transfer.samplesTransferred,
                transfer.splitCount || 1
            ]);
        });

        return XLSX.utils.aoa_to_sheet(wsData);
    }

    // Create lineage worksheet
    function createLineageWorksheet(data) {
        if (data.length === 0) {
            return XLSX.utils.aoa_to_sheet([['No lineage data available']]);
        }
        
        const headers = Object.keys(data[0]);
        const wsData = [headers];
        
        data.forEach(item => {
            wsData.push(headers.map(header => item[header]));
        });

        return XLSX.utils.aoa_to_sheet(wsData);
    }

    // Create summary worksheet
    function createSummaryWorksheet(summaryData) {
        const wsData = [
            ['Laboratory Inventory Summary Report'],
            ['Generated on:', new Date().toLocaleString()],
            [''],
            ['Basic Statistics'],
        ];

        // Add basic statistics
        Object.entries(summaryData.basic).forEach(([key, value]) => {
            wsData.push([key, value]);
        });

        wsData.push([''], ['Strain Distribution']);
        Object.entries(summaryData.strains).forEach(([strain, count]) => {
            wsData.push([strain, count]);
        });

        wsData.push([''], ['Owner Distribution']);
        Object.entries(summaryData.owners).forEach(([owner, count]) => {
            wsData.push([owner, count]);
        });

        return XLSX.utils.aoa_to_sheet(wsData);
    }

    // Convert data to CSV format
    function convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = [
            'Container ID', 'Barcode', 'Strain', 'Owner', 'Stage', 'Media', 
            'Tissue Count', 'Date Created', 'Transfer Source', 'Transfer Type'
        ];
        
        const csvRows = [headers.join(',')];
        
        data.forEach(item => {
            const row = [
                item.containerId,
                `"${item.barcode || ''}"`,
                `"${item.strain || ''}"`,
                `"${item.owner || ''}"`,
                `"${item.stage || ''}"`,
                `"${item.media || ''}"`,
                item.tissueCount || 1,
                `"${item.date}"`,
                item.transferSource || '',
                item.transferType || ''
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    // Download CSV file
    function downloadCSV(csvData, fileName) {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Generate default file name
    function generateDefaultFileName() {
        const now = new Date();
        const timestamp = now.getFullYear() + '-' + 
            String(now.getMonth() + 1).padStart(2, '0') + '-' + 
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') + '-' + 
            String(now.getMinutes()).padStart(2, '0') + '-' + 
            String(now.getSeconds()).padStart(2, '0');
        
        return `${config.defaultFileName}_${timestamp}`;
    }

    // Quick export for current inventory view
    function quickExport() {
        try {
            const inventoryData = getInventoryData('all');
            const workbook = XLSX.utils.book_new();
            const worksheet = createInventoryWorksheet(inventoryData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
            
            const fileName = generateDefaultFileName() + '.xlsx';
            XLSX.writeFile(workbook, fileName);
            
            NotificationSystem.success('Quick export completed!');
        } catch (error) {
            console.error('Quick export error:', error);
            NotificationSystem.error('Quick export failed: ' + error.message);
        }
    }

    // Public API
    return {
        initialize,
        showExportDialog,
        processExport,
        quickExport
    };

})();
