/**
 * LONE WOLF BIOTECH - LINEAGE REPORTS
 * Phase 3: Enhanced Data Tracking & Lineage System
 * 
 * Reporting and analytics for lineage data including:
 * - Lineage tree exports (JSON, CSV, Excel)
 * - Transfer statistics and patterns
 * - Orphan container detection
 * - Lineage validation reports
 * - Container history exports
 */

window.LineageReports = (function() {
    'use strict';

    /**
     * Generate a comprehensive lineage report for all containers
     * @returns {Object} Complete lineage report
     */
    function generateFullReport() {
        if (!window.LineageService) {
            console.error('LineageService not available');
            return null;
        }
        
        const stats = LineageService.getStats();
        const orphans = LineageService.findOrphans();
        const isolated = LineageService.findIsolatedNodes();
        const validation = LineageService.validateLineage();
        
        // Get transfer statistics from audit log
        const transferStats = getTransferStatistics();
        
        // Build report
        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                version: '1.0',
                generator: 'LoneWolf Biotech Lab Tracker'
            },
            summary: {
                totalContainers: stats.totalNodes,
                activeContainers: stats.activeNodes,
                consumedContainers: stats.consumedNodes,
                rootContainers: stats.rootNodes,
                leafContainers: stats.leafNodes,
                maxGenerationDepth: stats.maxGeneration,
                orphanCount: orphans.length,
                isolatedCount: isolated.length,
                validationIssues: validation.issueCount
            },
            generationBreakdown: stats.byGeneration,
            orphans: orphans,
            isolatedNodes: isolated,
            validation: validation,
            transfers: transferStats,
            lineageData: LineageService.exportLineage()
        };
        
        return report;
    }

    /**
     * Get transfer statistics from audit log
     */
    function getTransferStatistics() {
        if (!window.AuditService) {
            return { available: false };
        }
        
        const stats = AuditService.getStats();
        const eventTypes = AuditService.EventTypes;
        
        // Get last 30 days of transfers
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentTransfers = AuditService.getEventsByDateRange(thirtyDaysAgo, new Date())
            .filter(e => e.type === eventTypes.CONTAINER_SPLIT || e.type === eventTypes.CONTAINER_TRANSFERRED);
        
        // Group by day
        const byDay = {};
        recentTransfers.forEach(t => {
            const day = t.timestamp.split('T')[0];
            byDay[day] = (byDay[day] || 0) + 1;
        });
        
        return {
            available: true,
            totalTransfers: (stats.byType[eventTypes.CONTAINER_SPLIT] || 0) + 
                           (stats.byType[eventTypes.CONTAINER_TRANSFERRED] || 0),
            splits: stats.byType[eventTypes.CONTAINER_SPLIT] || 0,
            singleTransfers: stats.byType[eventTypes.CONTAINER_TRANSFERRED] || 0,
            discards: stats.byType[eventTypes.CONTAINER_DISCARDED] || 0,
            last30Days: recentTransfers.length,
            byDay: byDay,
            byUser: stats.byUser
        };
    }

    /**
     * Generate lineage tree for a specific container as exportable data
     */
    function generateContainerLineageExport(containerId) {
        if (!window.LineageService) return null;
        
        const lineage = LineageService.getFullLineage(containerId);
        if (!lineage) return null;
        
        const inventory = StateManager.getState('inventory') || [];
        const containerData = inventory.find(i => String(i.containerId) === String(containerId));
        
        // Get timeline if available
        let timeline = [];
        if (window.AuditService) {
            timeline = AuditService.getContainerTimeline(containerId);
        }
        
        return {
            metadata: {
                generatedAt: new Date().toISOString(),
                containerId: containerId
            },
            container: {
                id: containerId,
                strain: containerData?.strain,
                owner: containerData?.owner,
                stage: containerData?.stage,
                media: containerData?.media,
                location: containerData?.location,
                tissueCount: containerData?.tissueCount,
                date: containerData?.date,
                status: lineage.current.status
            },
            lineage: {
                generation: lineage.generation,
                rootId: lineage.rootId,
                path: LineageService.getLineagePath(containerId),
                ancestorCount: lineage.ancestors.length,
                descendantCount: lineage.descendants.length,
                ancestors: lineage.ancestors.map(a => ({
                    id: a.id,
                    generation: a.generation,
                    strain: a.strain,
                    status: a.status
                })),
                descendants: lineage.descendants.map(d => ({
                    id: d.id,
                    generation: d.generation,
                    strain: d.strain,
                    status: d.status
                }))
            },
            history: timeline
        };
    }

    /**
     * Export lineage data as CSV
     */
    function exportAsCSV() {
        if (!window.LineageService) return '';
        
        const data = LineageService.exportLineage();
        const nodes = Object.values(data.nodes);
        
        const headers = [
            'Container ID',
            'Parent ID',
            'Generation',
            'Children Count',
            'Strain',
            'Owner',
            'Status',
            'Created At'
        ];
        
        const rows = nodes.map(node => [
            node.id,
            node.parent || '',
            node.generation,
            node.children ? node.children.length : 0,
            node.strain || '',
            node.owner || '',
            node.status || 'Active',
            node.createdAt || ''
        ]);
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        return csvContent;
    }

    /**
     * Export lineage data to Excel workbook
     */
    function exportAsExcel() {
        if (!window.XLSX) {
            console.error('XLSX library not available');
            return null;
        }
        
        if (!window.LineageService) return null;
        
        const data = LineageService.exportLineage();
        const nodes = Object.values(data.nodes);
        const stats = LineageService.getStats();
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        
        // Lineage sheet
        const lineageData = [
            ['Container ID', 'Parent ID', 'Generation', 'Children', 'Strain', 'Owner', 'Status', 'Created At'],
            ...nodes.map(node => [
                node.id,
                node.parent || '',
                node.generation,
                node.children ? node.children.join(', ') : '',
                node.strain || '',
                node.owner || '',
                node.status || 'Active',
                node.createdAt || ''
            ])
        ];
        const lineageSheet = XLSX.utils.aoa_to_sheet(lineageData);
        XLSX.utils.book_append_sheet(workbook, lineageSheet, 'Lineage');
        
        // Stats sheet
        const statsData = [
            ['Metric', 'Value'],
            ['Total Containers', stats.totalNodes],
            ['Active Containers', stats.activeNodes],
            ['Consumed Containers', stats.consumedNodes],
            ['Root Containers (Original)', stats.rootNodes],
            ['Leaf Containers (No Children)', stats.leafNodes],
            ['Maximum Generation', stats.maxGeneration],
            ['', ''],
            ['Generation', 'Count'],
            ...Object.entries(stats.byGeneration).map(([gen, count]) => [gen, count])
        ];
        const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
        XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');
        
        // Orphans sheet if any
        const orphans = LineageService.findOrphans();
        if (orphans.length > 0) {
            const orphanData = [
                ['Container ID', 'Missing Parent', 'Reason'],
                ...orphans.map(o => [o.id, o.missingParent, o.reason])
            ];
            const orphanSheet = XLSX.utils.aoa_to_sheet(orphanData);
            XLSX.utils.book_append_sheet(workbook, orphanSheet, 'Orphans');
        }
        
        // Audit log if available
        if (window.AuditService) {
            const auditLog = AuditService.getRecentEvents(500);
            const auditData = [
                ['Timestamp', 'Type', 'Container ID', 'User', 'Message'],
                ...auditLog.map(entry => [
                    entry.timestamp,
                    entry.type,
                    entry.containerId || '',
                    entry.user?.name || '',
                    entry.message || ''
                ])
            ];
            const auditSheet = XLSX.utils.aoa_to_sheet(auditData);
            XLSX.utils.book_append_sheet(workbook, auditSheet, 'Audit Log');
        }
        
        return workbook;
    }

    /**
     * Download lineage report as JSON
     */
    function downloadJSONReport() {
        const report = generateFullReport();
        if (!report) {
            NotificationSystem.error('Failed to generate report');
            return;
        }
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lineage-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        NotificationSystem.success('Lineage report downloaded');
    }

    /**
     * Download lineage data as CSV
     */
    function downloadCSV() {
        const csv = exportAsCSV();
        if (!csv) {
            NotificationSystem.error('Failed to generate CSV');
            return;
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lineage-data-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        NotificationSystem.success('Lineage CSV downloaded');
    }

    /**
     * Download lineage data as Excel
     */
    function downloadExcel() {
        const workbook = exportAsExcel();
        if (!workbook) {
            NotificationSystem.error('Failed to generate Excel file');
            return;
        }
        
        const filename = `lineage-report-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, filename);
        
        NotificationSystem.success('Lineage Excel report downloaded');
    }

    /**
     * Generate orphan report
     */
    function generateOrphanReport() {
        if (!window.LineageService) return null;
        
        const orphans = LineageService.findOrphans();
        const isolated = LineageService.findIsolatedNodes();
        
        return {
            generatedAt: new Date().toISOString(),
            orphans: {
                count: orphans.length,
                containers: orphans
            },
            isolated: {
                count: isolated.length,
                containerIds: isolated
            },
            recommendations: generateRecommendations(orphans, isolated)
        };
    }

    /**
     * Generate recommendations based on orphans and isolated nodes
     */
    function generateRecommendations(orphans, isolated) {
        const recommendations = [];
        
        if (orphans.length > 0) {
            recommendations.push({
                type: 'orphan_repair',
                priority: 'high',
                message: `${orphans.length} containers have missing parent references. Run lineage repair to fix.`,
                action: 'LineageService.repairLineage()'
            });
        }
        
        if (isolated.length > 10) {
            recommendations.push({
                type: 'many_isolated',
                priority: 'medium',
                message: `${isolated.length} containers have no lineage connections. Consider reviewing recent intakes.`,
                action: 'Review intake process'
            });
        }
        
        return recommendations;
    }

    /**
     * Generate transfer pattern analysis
     */
    function analyzeTransferPatterns() {
        if (!window.AuditService) {
            return { available: false };
        }
        
        const events = AuditService.getRecentEvents(1000, { type: 'CONTAINER_SPLIT' })
            .concat(AuditService.getRecentEvents(1000, { type: 'CONTAINER_TRANSFERRED' }));
        
        // Analyze by hour of day
        const byHour = {};
        const byDayOfWeek = {};
        const byUser = {};
        
        events.forEach(event => {
            const date = new Date(event.timestamp);
            const hour = date.getHours();
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
            const user = event.user?.name || 'Unknown';
            
            byHour[hour] = (byHour[hour] || 0) + 1;
            byDayOfWeek[dayOfWeek] = (byDayOfWeek[dayOfWeek] || 0) + 1;
            byUser[user] = (byUser[user] || 0) + 1;
        });
        
        // Find peak times
        const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
        const peakDay = Object.entries(byDayOfWeek).sort((a, b) => b[1] - a[1])[0];
        const topUser = Object.entries(byUser).sort((a, b) => b[1] - a[1])[0];
        
        return {
            available: true,
            totalEvents: events.length,
            peakHour: peakHour ? { hour: peakHour[0], count: peakHour[1] } : null,
            peakDay: peakDay ? { day: peakDay[0], count: peakDay[1] } : null,
            topUser: topUser ? { name: topUser[0], count: topUser[1] } : null,
            byHour,
            byDayOfWeek,
            byUser
        };
    }

    /**
     * Show reports modal
     */
    function showReportsModal() {
        const report = generateFullReport();
        const patterns = analyzeTransferPatterns();
        const orphanReport = generateOrphanReport();
        
        const modalHTML = `
            <div class="lineage-modal" id="reportsModal" onclick="if(event.target === this) this.remove()">
                <div class="lineage-modal-content" style="min-width: 700px; max-height: 90vh;">
                    <div class="lineage-modal-header">
                        <h2 style="margin: 0;">📊 Lineage Reports & Analytics</h2>
                        <button class="lineage-modal-close" onclick="this.closest('.lineage-modal').remove()">&times;</button>
                    </div>
                    <div class="lineage-modal-body" style="overflow-y: auto; max-height: calc(90vh - 120px);">
                        <!-- Summary Stats -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 24px;">
                            <div style="background: #ecfdf5; padding: 16px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 1.8rem; font-weight: 700; color: #059669;">${report?.summary?.totalContainers || 0}</div>
                                <div style="font-size: 0.8rem; color: #6b7280;">Total Containers</div>
                            </div>
                            <div style="background: #eff6ff; padding: 16px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 1.8rem; font-weight: 700; color: #3b82f6;">${report?.summary?.activeContainers || 0}</div>
                                <div style="font-size: 0.8rem; color: #6b7280;">Active</div>
                            </div>
                            <div style="background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 1.8rem; font-weight: 700; color: #d97706;">${report?.summary?.maxGenerationDepth || 0}</div>
                                <div style="font-size: 0.8rem; color: #6b7280;">Max Generation</div>
                            </div>
                            <div style="background: #fee2e2; padding: 16px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 1.8rem; font-weight: 700; color: #dc2626;">${report?.summary?.orphanCount || 0}</div>
                                <div style="font-size: 0.8rem; color: #6b7280;">Orphans</div>
                            </div>
                        </div>
                        
                        <!-- Generation Breakdown -->
                        <div style="margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;">
                            <h4 style="margin: 0 0 12px;">Generation Distribution</h4>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                ${Object.entries(report?.generationBreakdown || {}).map(([gen, count]) => `
                                    <div style="background: white; padding: 8px 16px; border-radius: 20px; border: 1px solid #e2e8f0;">
                                        <span style="font-weight: 600;">G${gen}:</span> ${count}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Transfer Stats -->
                        ${patterns.available ? `
                            <div style="margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;">
                                <h4 style="margin: 0 0 12px;">Transfer Activity</h4>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                                    <div>
                                        <div style="font-size: 0.9rem; color: #6b7280;">Total Transfers</div>
                                        <div style="font-size: 1.4rem; font-weight: 600;">${report?.transfers?.totalTransfers || 0}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.9rem; color: #6b7280;">Peak Hour</div>
                                        <div style="font-size: 1.4rem; font-weight: 600;">${patterns.peakHour ? patterns.peakHour.hour + ':00' : 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.9rem; color: #6b7280;">Peak Day</div>
                                        <div style="font-size: 1.4rem; font-weight: 600;">${patterns.peakDay?.day || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        <!-- Validation Status -->
                        <div style="margin-bottom: 24px; padding: 16px; background: ${report?.validation?.valid ? '#ecfdf5' : '#fee2e2'}; border-radius: 8px;">
                            <h4 style="margin: 0 0 8px; color: ${report?.validation?.valid ? '#059669' : '#dc2626'};">
                                ${report?.validation?.valid ? '✅ Lineage Valid' : '⚠️ Validation Issues Found'}
                            </h4>
                            ${!report?.validation?.valid ? `
                                <p style="margin: 0 0 8px; font-size: 0.9rem;">${report?.validation?.issueCount} issue(s) detected</p>
                                <button onclick="LineageReports.repairAndRefresh()" 
                                        style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                    🔧 Repair Lineage
                                </button>
                            ` : '<p style="margin: 0; font-size: 0.9rem;">All container relationships are consistent.</p>'}
                        </div>
                        
                        <!-- Export Options -->
                        <div style="padding: 16px; background: #f8fafc; border-radius: 8px;">
                            <h4 style="margin: 0 0 12px;">Export Reports</h4>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <button onclick="LineageReports.downloadJSONReport()" 
                                        style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                    📄 JSON Report
                                </button>
                                <button onclick="LineageReports.downloadCSV()" 
                                        style="padding: 10px 20px; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                    📊 CSV Data
                                </button>
                                <button onclick="LineageReports.downloadExcel()" 
                                        style="padding: 10px 20px; background: #0891b2; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                    📑 Excel Workbook
                                </button>
                                ${window.AuditService ? `
                                    <button onclick="LineageReports.downloadAuditLog()" 
                                            style="padding: 10px 20px; background: #7c3aed; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                        📜 Audit Log
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);
    }

    /**
     * Repair lineage and refresh modal
     */
    function repairAndRefresh() {
        if (!window.LineageService) return;
        
        const report = LineageService.repairLineage();
        
        NotificationSystem.success(
            `Lineage repaired: ${report.circularBroken} circular refs broken, ` +
            `${report.missingChildrenRemoved} missing child refs removed`
        );
        
        // Close and reopen modal to show updated state
        document.getElementById('reportsModal')?.remove();
        showReportsModal();
    }

    /**
     * Download audit log
     */
    function downloadAuditLog() {
        if (!window.AuditService) {
            NotificationSystem.error('AuditService not available');
            return;
        }
        
        const csv = AuditService.exportAsCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        NotificationSystem.success('Audit log downloaded');
    }

    // Public API
    return {
        // Report generation
        generateFullReport,
        generateContainerLineageExport,
        generateOrphanReport,
        analyzeTransferPatterns,
        getTransferStatistics,
        
        // Export functions
        exportAsCSV,
        exportAsExcel,
        downloadJSONReport,
        downloadCSV,
        downloadExcel,
        downloadAuditLog,
        
        // UI
        showReportsModal,
        repairAndRefresh
    };

})();
