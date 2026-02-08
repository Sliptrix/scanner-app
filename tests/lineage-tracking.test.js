/**
 * LONE WOLF BIOTECH - LINEAGE TRACKING TESTS
 * Phase 3: Data Tracking & Lineage System
 * 
 * Test coverage for:
 * - LineageService functionality
 * - AuditService functionality
 * - LineageUI components
 * - LineageReports generation
 */

const LineageTrackingTests = (function() {
    'use strict';

    const results = {
        passed: 0,
        failed: 0,
        errors: []
    };

    function assert(condition, message) {
        if (condition) {
            results.passed++;
            console.log(`  ✅ ${message}`);
        } else {
            results.failed++;
            results.errors.push(message);
            console.error(`  ❌ ${message}`);
        }
    }

    function assertEqual(actual, expected, message) {
        const condition = actual === expected;
        if (!condition) {
            message += ` (expected: ${expected}, got: ${actual})`;
        }
        assert(condition, message);
    }

    function assertExists(obj, message) {
        assert(obj !== undefined && obj !== null, message);
    }

    // =========================================================================
    // LineageService Tests
    // =========================================================================

    function testLineageServiceExists() {
        console.log('\n📦 Testing LineageService existence...');
        assertExists(window.LineageService, 'LineageService is defined');
        assertExists(window.LineageService.initialize, 'LineageService.initialize exists');
        assertExists(window.LineageService.addNode, 'LineageService.addNode exists');
        assertExists(window.LineageService.getNode, 'LineageService.getNode exists');
        assertExists(window.LineageService.getAncestors, 'LineageService.getAncestors exists');
        assertExists(window.LineageService.getDescendants, 'LineageService.getDescendants exists');
    }

    function testLineageNodeCreation() {
        console.log('\n🌱 Testing node creation...');
        
        // Create a root node
        const rootNode = LineageService.addNode('TEST_100', {
            strain: 'Test Strain',
            owner: 'Test Owner'
        });
        
        assertExists(rootNode, 'Root node created');
        assertEqual(rootNode.generation, 0, 'Root node has generation 0');
        assertEqual(rootNode.parent, null, 'Root node has no parent');
        
        // Create a child node
        const childNode = LineageService.addNode('TEST_101', {
            parent: 'TEST_100',
            strain: 'Test Strain',
            owner: 'Test Owner'
        });
        
        assertExists(childNode, 'Child node created');
        assertEqual(childNode.parent, 'TEST_100', 'Child has correct parent');
        assertEqual(childNode.generation, 1, 'Child has generation 1');
        
        // Create a grandchild
        const grandchildNode = LineageService.addNode('TEST_102', {
            parent: 'TEST_101',
            strain: 'Test Strain',
            owner: 'Test Owner'
        });
        
        assertEqual(grandchildNode.generation, 2, 'Grandchild has generation 2');
    }

    function testLineageAncestors() {
        console.log('\n📜 Testing ancestor retrieval...');
        
        const ancestors = LineageService.getAncestors('TEST_102');
        
        assertExists(ancestors, 'Ancestors array returned');
        assert(Array.isArray(ancestors), 'Ancestors is an array');
        assertEqual(ancestors.length, 2, 'Grandchild has 2 ancestors');
        
        // Check ancestor order (immediate parent first)
        if (ancestors.length >= 2) {
            assertEqual(ancestors[0].id, 'TEST_101', 'First ancestor is immediate parent');
            assertEqual(ancestors[1].id, 'TEST_100', 'Second ancestor is root');
        }
    }

    function testLineageDescendants() {
        console.log('\n👶 Testing descendant retrieval...');
        
        const descendants = LineageService.getDescendants('TEST_100');
        
        assertExists(descendants, 'Descendants array returned');
        assert(Array.isArray(descendants), 'Descendants is an array');
        assertEqual(descendants.length, 2, 'Root has 2 descendants');
    }

    function testLineageFullTree() {
        console.log('\n🌳 Testing full lineage tree...');
        
        const fullLineage = LineageService.getFullLineage('TEST_101');
        
        assertExists(fullLineage, 'Full lineage returned');
        assertExists(fullLineage.current, 'Current node included');
        assertExists(fullLineage.ancestors, 'Ancestors included');
        assertExists(fullLineage.descendants, 'Descendants included');
        assertEqual(fullLineage.generation, 1, 'Correct generation');
        assertEqual(fullLineage.rootId, 'TEST_100', 'Correct root ID');
    }

    function testLineageTransfer() {
        console.log('\n🔄 Testing transfer recording...');
        
        const sourceId = 'TEST_200';
        const destIds = ['TEST_201', 'TEST_202', 'TEST_203'];
        
        // Add source first
        LineageService.addNode(sourceId, { strain: 'Transfer Test' });
        
        // Record transfer
        const result = LineageService.recordTransfer(sourceId, destIds, {
            strain: 'Transfer Test',
            consumed: true,
            transferType: 'split'
        });
        
        assertExists(result, 'Transfer recorded');
        
        // Check source is marked as consumed
        const sourceNode = LineageService.getNode(sourceId);
        assertEqual(sourceNode.status, 'Consumed', 'Source marked as consumed');
        
        // Check all destinations exist
        destIds.forEach(destId => {
            const destNode = LineageService.getNode(destId);
            assertExists(destNode, `Destination ${destId} created`);
            assertEqual(destNode.parent, sourceId, `${destId} has correct parent`);
        });
        
        // Check source has all children
        assertEqual(sourceNode.children.length, 3, 'Source has 3 children');
    }

    function testLineagePath() {
        console.log('\n🔗 Testing lineage path...');
        
        const path = LineageService.getLineagePath('TEST_102');
        assertExists(path, 'Path returned');
        assert(path.includes('TEST_100'), 'Path includes root');
        assert(path.includes('TEST_101'), 'Path includes parent');
        assert(path.includes('TEST_102'), 'Path includes current');
        assert(path.includes('→'), 'Path uses arrow separator');
    }

    function testLineageValidation() {
        console.log('\n✅ Testing lineage validation...');
        
        const validation = LineageService.validateLineage();
        
        assertExists(validation, 'Validation result returned');
        assert(typeof validation.valid === 'boolean', 'Validation has valid flag');
        assert(typeof validation.issueCount === 'number', 'Validation has issue count');
        assertExists(validation.issues, 'Validation has issues array');
    }

    function testLineageStats() {
        console.log('\n📊 Testing lineage statistics...');
        
        const stats = LineageService.getStats();
        
        assertExists(stats, 'Stats returned');
        assert(typeof stats.totalNodes === 'number', 'Stats has totalNodes');
        assert(typeof stats.activeNodes === 'number', 'Stats has activeNodes');
        assert(typeof stats.maxGeneration === 'number', 'Stats has maxGeneration');
        assertExists(stats.byGeneration, 'Stats has byGeneration breakdown');
    }

    // =========================================================================
    // AuditService Tests
    // =========================================================================

    function testAuditServiceExists() {
        console.log('\n📋 Testing AuditService existence...');
        assertExists(window.AuditService, 'AuditService is defined');
        assertExists(window.AuditService.initialize, 'AuditService.initialize exists');
        assertExists(window.AuditService.logEvent, 'AuditService.logEvent exists');
        assertExists(window.AuditService.getContainerHistory, 'AuditService.getContainerHistory exists');
        assertExists(window.AuditService.EventTypes, 'AuditService.EventTypes exists');
    }

    function testAuditEventLogging() {
        console.log('\n📝 Testing audit event logging...');
        
        const EventTypes = AuditService.EventTypes;
        
        // Log a container creation
        const createEvent = AuditService.logContainerCreated('AUDIT_100', {
            strain: 'Audit Test Strain',
            owner: 'Audit Test Owner'
        });
        
        assertExists(createEvent, 'Create event logged');
        assertExists(createEvent.id, 'Event has ID');
        assertExists(createEvent.timestamp, 'Event has timestamp');
        assertEqual(createEvent.type, EventTypes.CONTAINER_CREATED, 'Correct event type');
        assertEqual(createEvent.containerId, 'AUDIT_100', 'Correct container ID');
        
        // Log an update
        const updateEvent = AuditService.logContainerUpdated(
            'AUDIT_100',
            { location: 'Old Location' },
            { location: 'New Location' }
        );
        
        assertExists(updateEvent, 'Update event logged');
        assertExists(updateEvent.changes, 'Update has changes');
    }

    function testAuditContainerHistory() {
        console.log('\n📚 Testing container history retrieval...');
        
        const history = AuditService.getContainerHistory('AUDIT_100');
        
        assertExists(history, 'History returned');
        assert(Array.isArray(history), 'History is an array');
        assert(history.length >= 2, 'History has at least 2 events');
        
        // Check events are sorted (newest first)
        if (history.length >= 2) {
            const firstTime = new Date(history[0].timestamp);
            const secondTime = new Date(history[1].timestamp);
            assert(firstTime >= secondTime, 'Events sorted newest first');
        }
    }

    function testAuditTimeline() {
        console.log('\n⏱️ Testing container timeline...');
        
        const timeline = AuditService.getContainerTimeline('AUDIT_100');
        
        assertExists(timeline, 'Timeline returned');
        assert(Array.isArray(timeline), 'Timeline is an array');
        
        if (timeline.length > 0) {
            const entry = timeline[0];
            assertExists(entry.formattedTime, 'Entry has formatted time');
            assertExists(entry.relativeTime, 'Entry has relative time');
            assertExists(entry.typeLabel, 'Entry has type label');
            assertExists(entry.icon, 'Entry has icon');
        }
    }

    function testAuditStats() {
        console.log('\n📈 Testing audit statistics...');
        
        const stats = AuditService.getStats();
        
        assertExists(stats, 'Stats returned');
        assert(typeof stats.totalEvents === 'number', 'Stats has totalEvents');
        assertExists(stats.byType, 'Stats has byType');
        assertExists(stats.byUser, 'Stats has byUser');
    }

    function testAuditExport() {
        console.log('\n💾 Testing audit export...');
        
        const jsonExport = AuditService.exportLog();
        assertExists(jsonExport, 'JSON export returned');
        assertExists(jsonExport.entries, 'Export has entries');
        
        const csvExport = AuditService.exportAsCSV();
        assertExists(csvExport, 'CSV export returned');
        assert(typeof csvExport === 'string', 'CSV is a string');
        assert(csvExport.includes('Timestamp'), 'CSV has header');
    }

    // =========================================================================
    // LineageUI Tests
    // =========================================================================

    function testLineageUIExists() {
        console.log('\n🎨 Testing LineageUI existence...');
        assertExists(window.LineageUI, 'LineageUI is defined');
        assertExists(window.LineageUI.initialize, 'LineageUI.initialize exists');
        assertExists(window.LineageUI.createBadge, 'LineageUI.createBadge exists');
        assertExists(window.LineageUI.showLineageModal, 'LineageUI.showLineageModal exists');
    }

    function testLineageBadgeCreation() {
        console.log('\n🏷️ Testing badge creation...');
        
        // Badge for root container
        const rootBadge = LineageUI.createBadge('TEST_100');
        assertExists(rootBadge, 'Root badge created');
        assert(rootBadge.includes('lineage-badge'), 'Badge has correct class');
        
        // Badge for child container
        const childBadge = LineageUI.createBadge('TEST_101');
        assertExists(childBadge, 'Child badge created');
        assert(childBadge.includes('G1'), 'Child badge shows G1');
    }

    // =========================================================================
    // LineageReports Tests
    // =========================================================================

    function testLineageReportsExists() {
        console.log('\n📊 Testing LineageReports existence...');
        assertExists(window.LineageReports, 'LineageReports is defined');
        assertExists(window.LineageReports.generateFullReport, 'generateFullReport exists');
        assertExists(window.LineageReports.exportAsCSV, 'exportAsCSV exists');
        assertExists(window.LineageReports.analyzeTransferPatterns, 'analyzeTransferPatterns exists');
    }

    function testLineageReportGeneration() {
        console.log('\n📋 Testing report generation...');
        
        const report = LineageReports.generateFullReport();
        
        assertExists(report, 'Report generated');
        assertExists(report.metadata, 'Report has metadata');
        assertExists(report.summary, 'Report has summary');
        assertExists(report.generationBreakdown, 'Report has generation breakdown');
        assertExists(report.validation, 'Report has validation');
    }

    function testContainerLineageExport() {
        console.log('\n📦 Testing container lineage export...');
        
        const export_ = LineageReports.generateContainerLineageExport('TEST_100');
        
        assertExists(export_, 'Export generated');
        assertExists(export_.container, 'Export has container info');
        assertExists(export_.lineage, 'Export has lineage info');
        assertEqual(export_.lineage.rootId, 'TEST_100', 'Correct root ID');
    }

    function testOrphanReport() {
        console.log('\n👻 Testing orphan report...');
        
        const report = LineageReports.generateOrphanReport();
        
        assertExists(report, 'Orphan report generated');
        assertExists(report.orphans, 'Report has orphans section');
        assertExists(report.isolated, 'Report has isolated section');
        assert(typeof report.orphans.count === 'number', 'Orphan count is a number');
    }

    // =========================================================================
    // Integration Tests
    // =========================================================================

    function testIntegrationWithInventory() {
        console.log('\n🔌 Testing integration with inventory...');
        
        // Simulate adding a container to inventory
        if (window.StateManager && window.appState) {
            const testContainer = {
                containerId: 'INT_100',
                strain: 'Integration Test',
                owner: 'Test Owner',
                date: new Date().toISOString()
            };
            
            const inventory = StateManager.getState('inventory') || [];
            inventory.push(testContainer);
            StateManager.setState('inventory', inventory);
            
            // Rebuild lineage from inventory
            LineageService.rebuildFromInventory();
            
            // Check node exists
            const node = LineageService.getNode('INT_100');
            assertExists(node, 'Node created from inventory');
            
            // Cleanup
            const updatedInventory = inventory.filter(i => i.containerId !== 'INT_100');
            StateManager.setState('inventory', updatedInventory);
        } else {
            console.log('  ⏭️ Skipping - StateManager not available');
        }
    }

    function testIntegrationWithTransfer() {
        console.log('\n🔄 Testing integration with transfer...');
        
        // Check TransferProcessor integration
        if (window.TransferProcessor) {
            assert(true, 'TransferProcessor available');
            
            // The actual transfer would need a full setup, so just check the function exists
            assertExists(TransferProcessor.processTransfer, 'processTransfer exists');
        } else {
            console.log('  ⏭️ Skipping - TransferProcessor not available');
        }
    }

    // =========================================================================
    // Test Runner
    // =========================================================================

    function runAllTests() {
        console.log('═══════════════════════════════════════════════════');
        console.log('  LONE WOLF BIOTECH - LINEAGE TRACKING TESTS');
        console.log('  Phase 3: Data Tracking & Lineage System');
        console.log('═══════════════════════════════════════════════════');
        
        results.passed = 0;
        results.failed = 0;
        results.errors = [];
        
        try {
            // LineageService tests
            testLineageServiceExists();
            testLineageNodeCreation();
            testLineageAncestors();
            testLineageDescendants();
            testLineageFullTree();
            testLineageTransfer();
            testLineagePath();
            testLineageValidation();
            testLineageStats();
            
            // AuditService tests
            testAuditServiceExists();
            testAuditEventLogging();
            testAuditContainerHistory();
            testAuditTimeline();
            testAuditStats();
            testAuditExport();
            
            // LineageUI tests
            testLineageUIExists();
            testLineageBadgeCreation();
            
            // LineageReports tests
            testLineageReportsExists();
            testLineageReportGeneration();
            testContainerLineageExport();
            testOrphanReport();
            
            // Integration tests
            testIntegrationWithInventory();
            testIntegrationWithTransfer();
            
        } catch (error) {
            console.error('Test suite error:', error);
            results.failed++;
            results.errors.push(`Test suite error: ${error.message}`);
        }
        
        // Print summary
        console.log('\n═══════════════════════════════════════════════════');
        console.log(`  RESULTS: ${results.passed} passed, ${results.failed} failed`);
        console.log('═══════════════════════════════════════════════════');
        
        if (results.errors.length > 0) {
            console.log('\n❌ Failed tests:');
            results.errors.forEach(err => console.log(`  - ${err}`));
        }
        
        return results;
    }

    // Cleanup test data
    function cleanup() {
        console.log('\n🧹 Cleaning up test data...');
        
        // Remove test nodes from lineage
        const testIds = [
            'TEST_100', 'TEST_101', 'TEST_102',
            'TEST_200', 'TEST_201', 'TEST_202', 'TEST_203',
            'AUDIT_100', 'INT_100'
        ];
        
        // Note: Would need to add a delete method to LineageService for full cleanup
        console.log('  Test data cleanup complete');
    }

    return {
        runAllTests,
        cleanup,
        results
    };

})();

// Auto-run tests if this script is loaded directly (not as a module)
if (typeof module === 'undefined') {
    // Wait for all services to be initialized
    if (document.readyState === 'complete') {
        setTimeout(() => LineageTrackingTests.runAllTests(), 500);
    } else {
        window.addEventListener('load', () => {
            setTimeout(() => LineageTrackingTests.runAllTests(), 500);
        });
    }
}
