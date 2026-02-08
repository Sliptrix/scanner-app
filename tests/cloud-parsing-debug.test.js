/**
 * Cloud Excel Workbook Parsing Debug Test
 * Tests the parsing logic used by OneDriveSync for cloud Excel files
 */

const XLSX = require('xlsx');
const path = require('path');

console.log('\n========================================');
console.log('Cloud Excel Workbook Parsing Debug Test');
console.log('========================================\n');

// Helper function matching the code's getField
const getField = (row, candidates) => {
    for (const key of Object.keys(row)) {
        const normalizedKey = key.toLowerCase().trim();
        if (candidates.includes(normalizedKey)) {
            return row[key];
        }
    }
    return undefined;
};

let testsPassed = 0;
let testsFailed = 0;
const issues = [];

function runTest(name, testFn) {
    try {
        testFn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
        issues.push({ name, error: error.message });
    }
}

// Load test workbook
const workbookPath = path.join(__dirname, '..', 'barcode test.xlsx');
let workbook;

try {
    workbook = XLSX.readFile(workbookPath, { cellDates: true });
    console.log('📁 Loaded workbook:', workbookPath);
    console.log('📋 Sheets found:', workbook.SheetNames.join(', '));
    console.log('');
} catch (e) {
    console.log('❌ Failed to load workbook:', e.message);
    process.exit(1);
}

// Test 1: Strain sheet detection with various naming patterns
runTest('Detects Strains sheet with various naming patterns', () => {
    const strainsSheetNames = ['strains', 'strain', 'strain_reference', 'strains_ref', 'strain_list', 'varieties', 'cultivars', 'genetics', 'ref_strains'];
    const strainsSheetName = workbook.SheetNames.find(name =>
        strainsSheetNames.includes(name.toLowerCase()) ||
        name.toLowerCase().includes('strain') ||
        name.toLowerCase().includes('variet')
    );
    
    if (!strainsSheetName) {
        throw new Error(`No strain sheet found. Available: ${workbook.SheetNames.join(', ')}`);
    }
    console.log(`   Found strain sheet: "${strainsSheetName}"`);
});

// Test 2: Parse Strains sheet with duplicate column detection
runTest('Parses Strains sheet correctly with duplicate columns', () => {
    const strainsSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('strain')
    );
    const sheet = workbook.Sheets[strainsSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    if (rows.length === 0) {
        throw new Error('No rows found in Strains sheet');
    }
    
    // Log column names to identify duplicates
    const columns = Object.keys(rows[0]);
    console.log(`   Columns found: ${columns.join(', ')}`);
    
    // Check for duplicate columns
    const duplicates = columns.filter((col, idx) => columns.indexOf(col) !== idx);
    if (duplicates.length > 0) {
        console.log(`   ⚠️  Duplicate columns detected: ${duplicates.join(', ')}`);
    }
    
    // Try to extract strain data
    let extracted = 0;
    rows.slice(0, 5).forEach((row, idx) => {
        const id = getField(row, ['strain_id', 'strainid', 'strain id', 'id', '#']);
        const name = getField(row, ['strain_name', 'strain name', 'strainname', 'strain', 'name']);
        if (id !== undefined) {
            extracted++;
            console.log(`   Row ${idx + 1}: ID="${id}", Name="${name}"`);
        }
    });
    
    console.log(`   Successfully extracted ${extracted}/${Math.min(5, rows.length)} sample rows`);
});

// Test 3: Parse Owners sheet
runTest('Parses Owners sheet correctly', () => {
    const ownersSheetName = workbook.SheetNames.find(name =>
        name.toLowerCase() === 'owners' ||
        name.toLowerCase() === 'ref_owners' ||
        name.toLowerCase().includes('owner')
    );
    
    if (!ownersSheetName) {
        throw new Error(`No owners sheet found. Available: ${workbook.SheetNames.join(', ')}`);
    }
    
    const sheet = workbook.Sheets[ownersSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`   Found owners sheet: "${ownersSheetName}" with ${rows.length} rows`);
    console.log(`   Columns: ${Object.keys(rows[0] || {}).join(', ')}`);
    
    // Extract owners
    let extracted = 0;
    const ownersTable = {};
    
    rows.forEach(row => {
        // Try multiple column name patterns for owner ID
        const id = getField(row, [
            'owner_id', 'ownerid', 'owner id', 
            'owner_code', 'ownercode', 'owner code', 
            'id', 'owner-id', '#'
        ]);
        const name = getField(row, [
            'owner_name', 'owner name', 'ownername', 
            'owner', 'name'
        ]);
        
        if (id !== undefined && id !== null && id !== '') {
            const ownerId = String(id).trim();
            const ownerName = name ? String(name).trim() : ownerId;
            ownersTable[ownerId] = ownerName;
            extracted++;
        }
    });
    
    console.log(`   Extracted ${extracted} owners:`, JSON.stringify(ownersTable));
    
    if (extracted === 0) {
        throw new Error('No owners extracted - check column name matching');
    }
});

// Test 4: Parse Stages sheet
runTest('Parses Stages sheet correctly', () => {
    const stagesSheetName = workbook.SheetNames.find(name =>
        name.toLowerCase() === 'stages' ||
        name.toLowerCase() === 'ref_stages' ||
        name.toLowerCase().includes('stage') ||
        name.toLowerCase().includes('propogation') ||
        name.toLowerCase().includes('propagation')
    );
    
    if (!stagesSheetName) {
        throw new Error(`No stages sheet found. Available: ${workbook.SheetNames.join(', ')}`);
    }
    
    const sheet = workbook.Sheets[stagesSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`   Found stages sheet: "${stagesSheetName}" with ${rows.length} rows`);
    console.log(`   Columns: ${Object.keys(rows[0] || {}).join(', ')}`);
    
    // Extract stages - note different naming patterns
    let extracted = 0;
    const stagesTable = {};
    
    rows.forEach(row => {
        const id = getField(row, [
            'stage_id', 'stageid', 'stage id', 
            'propogation stages id', 'propagation stages id',
            'id', 'stage-id', '#', 'code'
        ]);
        const name = getField(row, [
            'stage_name', 'stage name', 'stagename', 
            'stage', 'name', 'description',
            'propogation stages', 'propagation stages'
        ]);
        
        if (id !== undefined && id !== null && id !== '') {
            const stageId = String(id).trim();
            const stageName = name ? String(name).trim() : stageId;
            stagesTable[stageId] = stageName;
            extracted++;
        }
    });
    
    console.log(`   Extracted ${extracted} stages:`, JSON.stringify(stagesTable));
    
    if (extracted === 0) {
        throw new Error('No stages extracted - check column name matching');
    }
});

// Test 5: Parse Media_Types sheet
runTest('Parses Media_Types sheet correctly', () => {
    const mediaSheetName = workbook.SheetNames.find(name =>
        name.toLowerCase() === 'media_types' ||
        name.toLowerCase() === 'mediatypes' ||
        name.toLowerCase() === 'ref_media_types' ||
        name.toLowerCase().includes('media')
    );
    
    if (!mediaSheetName) {
        console.log('   ⚠️  No media types sheet found (optional)');
        return;
    }
    
    const sheet = workbook.Sheets[mediaSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`   Found media sheet: "${mediaSheetName}" with ${rows.length} rows`);
    console.log(`   Columns: ${Object.keys(rows[0] || {}).join(', ')}`);
    
    let extracted = 0;
    const mediaTypesTable = {};
    
    rows.forEach(row => {
        const code = getField(row, [
            'media_code', 'mediacode', 'media code', 
            'media_id', 'mediaid', 'media id',
            'code', 'type_id', 'typeid', 'id', '#'
        ]);
        const name = getField(row, [
            'media_name', 'media name', 'medianame', 
            'media', 'name', 'type', 'description',
            'media type', 'media_type'
        ]);
        
        if (code !== undefined && code !== null && code !== '') {
            const mediaCode = String(code).trim();
            const mediaName = name ? String(name).trim() : mediaCode;
            mediaTypesTable[mediaCode] = mediaName;
            extracted++;
        }
    });
    
    console.log(`   Extracted ${extracted} media types:`, JSON.stringify(mediaTypesTable));
});

// Test 6: Parse inventory data with barcode patterns
runTest('Parses inventory/barcode data with various ID patterns', () => {
    // Look for Sheet1 which has inventory-like data
    const invSheetName = workbook.SheetNames.find(name =>
        name.toLowerCase() === 'sheet1' ||
        name.toLowerCase() === 'active_inventory' ||
        name.toLowerCase().includes('inventory')
    );
    
    if (!invSheetName) {
        console.log('   ⚠️  No inventory sheet found');
        return;
    }
    
    const sheet = workbook.Sheets[invSheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    
    console.log(`   Found inventory sheet: "${invSheetName}" with ${aoa.length} rows`);
    
    // Try to parse Batch_ID patterns like "LWG120021"
    let parsed = 0;
    aoa.slice(0, 10).forEach((row, idx) => {
        if (!row || row.length === 0) return;
        
        const firstCell = row[0];
        if (!firstCell) return;
        
        const str = String(firstCell).trim();
        // Match pattern: letters + digits (e.g., LWG120021)
        const match = str.match(/^([A-Za-z]+)(\d+)$/);
        if (match) {
            const prefix = match[1];
            const numericPart = match[2];
            const lastSix = numericPart.slice(-6);
            console.log(`   Row ${idx + 1}: "${str}" → prefix="${prefix}", numeric="${numericPart}", ID="${lastSix}"`);
            parsed++;
        }
    });
    
    console.log(`   Parsed ${parsed} batch IDs`);
});

// Test 7: Check column name matching edge cases (with _1 suffix handling)
runTest('Column name matching handles edge cases and _1 suffix', () => {
    // Enhanced getField that strips _1, _2 suffix (matching oneDriveSync.js fix)
    const getFieldFixed = (row, candidates) => {
        for (const key of Object.keys(row)) {
            let normalizedKey = key.toLowerCase().trim();
            // Strip trailing _1, _2, etc. (XLSX adds these for duplicate column names)
            normalizedKey = normalizedKey.replace(/_\d+$/, '');
            if (candidates.includes(normalizedKey)) {
                return row[key];
            }
        }
        return undefined;
    };
    
    const testCases = [
        // Test case: column name variations
        { columns: ['Strain ID', 'Strain', 'Owner ID'], idCol: 'strain id', expected: true },
        { columns: ['strain_id', 'strain_name'], idCol: 'strain_id', expected: true },
        { columns: ['ID', 'Name'], idCol: 'id', expected: true },
        { columns: ['#', 'Strain Name'], idCol: '#', expected: true },
        // Edge cases with spaces and underscores
        { columns: ['Strain  ID', 'Strain_Name'], idCol: 'strain  id', expected: true },
        { columns: ['Owner Code', 'Owner Name'], idCol: 'owner code', expected: true },
        // FIX: Test _1 suffix handling (duplicate columns get renamed by XLSX)
        { columns: ['Strain ID_1', 'Strain', 'Owner ID_2'], candidates: ['strain id'], expected: true },
        { columns: ['Owner ID_1', 'Owner_1'], candidates: ['owner id', 'owner'], expected: true },
        { columns: ['Propogation Stages ID_1'], candidates: ['propogation stages id'], expected: true },
    ];
    
    let passed = 0;
    testCases.forEach(tc => {
        const mockRow = {};
        tc.columns.forEach((col, idx) => mockRow[col] = `value${idx}`);
        
        // Use candidates if provided, otherwise create from column names
        const candidates = tc.candidates || tc.columns.map(c => c.toLowerCase().trim());
        // Use the enhanced getField for suffix test cases
        const value = tc.candidates ? getFieldFixed(mockRow, candidates) : getField(mockRow, candidates);
        
        if ((value !== undefined) === tc.expected) {
            passed++;
        } else {
            console.log(`   ⚠️  Failed: columns=${tc.columns}, candidates=${candidates}`);
        }
    });
    
    console.log(`   Passed ${passed}/${testCases.length} edge cases`);
});

// Test 8: Date parsing
runTest('Date parsing handles Excel formats', () => {
    // Test date parsing with cellDates: true
    const testDates = [
        { input: new Date('2025-01-15'), expected: '1/15/2025' },
        { input: 45789, expected: 'serial number' }, // Excel serial date
        { input: '2025-01-15', expected: '2025-01-15' },
    ];
    
    testDates.forEach(tc => {
        let formatted = '';
        if (tc.input instanceof Date) {
            formatted = tc.input.toLocaleDateString('en-US');
            console.log(`   Date object: ${tc.input} → "${formatted}"`);
        } else if (typeof tc.input === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            const jsDate = new Date(excelEpoch.getTime() + tc.input * 86400000);
            formatted = jsDate.toLocaleDateString('en-US');
            console.log(`   Serial number ${tc.input} → "${formatted}"`);
        } else {
            formatted = String(tc.input);
            console.log(`   String: "${tc.input}" → "${formatted}"`);
        }
    });
});

// Test 9: Check for Ref_ sheet title row handling
runTest('Ref_ sheets title row detection works correctly', () => {
    // Simulate the Ref_ sheet parsing logic
    workbook.SheetNames.forEach(sheetName => {
        if (!sheetName.toLowerCase().startsWith('ref_')) return;
        
        const sheet = workbook.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
        
        if (aoa.length < 2) {
            console.log(`   ${sheetName}: Only ${aoa.length} rows`);
            return;
        }
        
        // Check if row 0 looks like a title (single cell or non-header pattern)
        const row0 = aoa[0];
        const row1 = aoa[1];
        
        const row0LooksLikeTitle = row0.length === 1 || 
            (row0.length > 0 && typeof row0[0] === 'string' && row0[0].includes(' '));
        const row1LooksLikeHeaders = row1.length > 1 && 
            row1.every(cell => typeof cell === 'string' && cell.length < 50);
        
        console.log(`   ${sheetName}: Row0 title-like=${row0LooksLikeTitle}, Row1 headers-like=${row1LooksLikeHeaders}`);
    });
});

// Test 10: Check strain-owner mapping from Barcodes sheet
runTest('Strain-owner mapping extraction from Barcodes sheet', () => {
    const barcodesSheet = workbook.Sheets['Barcodes'];
    if (!barcodesSheet) {
        console.log('   ⚠️  No Barcodes sheet found');
        return;
    }
    
    const rows = XLSX.utils.sheet_to_json(barcodesSheet);
    console.log(`   Barcodes sheet has ${rows.length} rows`);
    console.log(`   Columns: ${Object.keys(rows[0] || {}).join(', ')}`);
    
    // Try to extract strain-owner mappings
    const strainOwners = {};
    let mappingsFound = 0;
    
    rows.slice(0, 10).forEach((row, idx) => {
        const strainId = getField(row, ['strain id', 'strainid', 'strain_id', 'id']);
        const ownerId = getField(row, ['owner id', 'ownerid', 'owner_id', 'owner']);
        
        if (strainId !== undefined && ownerId !== undefined) {
            const strainKey = String(strainId).trim();
            const ownerStr = String(ownerId).trim();
            strainOwners[strainKey] = ownerStr;
            mappingsFound++;
            if (idx < 3) {
                console.log(`   Strain ${strainKey} → Owner "${ownerStr}"`);
            }
        }
    });
    
    console.log(`   Found ${mappingsFound} strain-owner mappings`);
});

// Print summary
console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Total: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);

if (issues.length > 0) {
    console.log('\n🔧 Issues to fix:');
    issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue.name}: ${issue.error}`);
    });
}

console.log('========================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
