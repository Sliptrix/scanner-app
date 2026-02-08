/**
 * HQ Workbook Parsing Test
 * Tests the parsing of Excel workbooks with various sheet structures
 * Works with both HQ workbooks (Ref_Strains, Active_Inventory) and legacy formats
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('HQ Workbook Parsing Tests');
console.log('========================================\n');

// Load the test workbook - use local sample file
const workbookPath = path.join(__dirname, '..', 'barcode test.xlsx');

let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

function runTest(name, testFn) {
    try {
        testFn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        if (error.message.startsWith('SKIP:')) {
            console.log(`⏭️  ${name} - ${error.message}`);
            testsSkipped++;
        } else {
            console.log(`❌ ${name}`);
            console.log(`   Error: ${error.message}`);
            testsFailed++;
        }
    }
}

// Helper function matching the code's getField with _1 suffix handling
const getField = (row, candidates) => {
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

// Check if workbook exists
if (!fs.existsSync(workbookPath)) {
    console.log(`❌ Workbook not found: ${workbookPath}`);
    process.exit(1);
}

// Read the workbook
const workbook = XLSX.readFile(workbookPath, { cellDates: true });
console.log(`📁 Loaded: ${path.basename(workbookPath)}`);
console.log(`📋 Sheets: ${workbook.SheetNames.join(', ')}\n`);

// Test 1: Sheet detection - flexible for different formats
runTest('Detects strain reference sheet (various naming patterns)', () => {
    const strainsSheetNames = ['strains', 'strain', 'ref_strains', 'strain_reference'];
    const found = workbook.SheetNames.find(name =>
        strainsSheetNames.includes(name.toLowerCase()) ||
        name.toLowerCase().includes('strain')
    );
    
    if (!found) {
        throw new Error(`No strain sheet found. Available: ${workbook.SheetNames.join(', ')}`);
    }
    console.log(`   Found: "${found}"`);
});

// Test 2: Detects owners sheet
runTest('Detects owners reference sheet', () => {
    const ownersSheetNames = ['owners', 'owner', 'ref_owners'];
    const found = workbook.SheetNames.find(name =>
        ownersSheetNames.includes(name.toLowerCase()) ||
        name.toLowerCase().includes('owner')
    );
    
    if (!found) {
        throw new Error(`No owners sheet found. Available: ${workbook.SheetNames.join(', ')}`);
    }
    console.log(`   Found: "${found}"`);
});

// Test 3: Detects stages sheet
runTest('Detects stages reference sheet', () => {
    const stagesSheetNames = ['stages', 'stage', 'ref_stages'];
    const found = workbook.SheetNames.find(name =>
        stagesSheetNames.includes(name.toLowerCase()) ||
        name.toLowerCase().includes('stage') ||
        name.toLowerCase().includes('propogation') ||
        name.toLowerCase().includes('propagation')
    );
    
    if (!found) {
        throw new Error(`No stages sheet found. Available: ${workbook.SheetNames.join(', ')}`);
    }
    console.log(`   Found: "${found}"`);
});

// Test 4: Parse strains with duplicate column handling
runTest('Parses strains correctly with duplicate column handling', () => {
    const strainsSheetName = workbook.SheetNames.find(name =>
        name.toLowerCase().includes('strain')
    );
    
    if (!strainsSheetName) throw new Error('SKIP: No strains sheet');
    
    const sheet = workbook.Sheets[strainsSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    if (rows.length === 0) throw new Error('No rows in strains sheet');
    
    console.log(`   Columns: ${Object.keys(rows[0]).join(', ')}`);
    
    let parsed = 0;
    rows.slice(0, 5).forEach(row => {
        const id = getField(row, ['strain_id', 'strainid', 'strain id', 'id', '#']);
        const name = getField(row, ['strain_name', 'strain name', 'strainname', 'strain', 'name']);
        
        if (id !== undefined) {
            parsed++;
            console.log(`   Row: ID=${id}, Name="${name}"`);
        }
    });
    
    if (parsed === 0) throw new Error('No strains parsed - check column matching');
    console.log(`   Parsed ${parsed} sample strains`);
});

// Test 5: Parse owners correctly
runTest('Parses owners correctly', () => {
    const ownersSheetName = workbook.SheetNames.find(name =>
        name.toLowerCase().includes('owner')
    );
    
    if (!ownersSheetName) throw new Error('SKIP: No owners sheet');
    
    const sheet = workbook.Sheets[ownersSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    if (rows.length === 0) throw new Error('No rows in owners sheet');
    
    console.log(`   Columns: ${Object.keys(rows[0]).join(', ')}`);
    
    const ownersTable = {};
    rows.forEach(row => {
        const id = getField(row, ['owner_id', 'ownerid', 'owner id', 'owner_code', 'id', '#']);
        const name = getField(row, ['owner_name', 'owner name', 'ownername', 'owner', 'name']);
        
        if (id !== undefined && id !== null && id !== '') {
            ownersTable[String(id).trim()] = name ? String(name).trim() : String(id).trim();
        }
    });
    
    console.log(`   Parsed ${Object.keys(ownersTable).length} owners:`, Object.keys(ownersTable).slice(0, 5).join(', '));
    
    if (Object.keys(ownersTable).length === 0) {
        throw new Error('No owners parsed - check column matching');
    }
});

// Test 6: Parse stages with "Propogation" misspelling support
runTest('Parses stages correctly (handles Propogation misspelling)', () => {
    const stagesSheetName = workbook.SheetNames.find(name =>
        name.toLowerCase().includes('stage') ||
        name.toLowerCase().includes('propogation') ||
        name.toLowerCase().includes('propagation')
    );
    
    if (!stagesSheetName) throw new Error('SKIP: No stages sheet');
    
    const sheet = workbook.Sheets[stagesSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    if (rows.length === 0) throw new Error('No rows in stages sheet');
    
    console.log(`   Columns: ${Object.keys(rows[0]).join(', ')}`);
    
    const stagesTable = {};
    rows.forEach(row => {
        // Handle "Propogation Stages ID" misspelling
        const id = getField(row, [
            'stage_id', 'stageid', 'stage id', 'id', '#',
            'propogation stages id', 'propagation stages id'
        ]);
        const name = getField(row, [
            'stage_name', 'stage name', 'stagename', 'stage', 'name',
            'propogation stages', 'propagation stages'
        ]);
        
        if (id !== undefined && id !== null && id !== '') {
            stagesTable[String(id).trim()] = name ? String(name).trim() : String(id).trim();
        }
    });
    
    console.log(`   Parsed ${Object.keys(stagesTable).length} stages:`, Object.keys(stagesTable).map(k => `${k}="${stagesTable[k]}"`).join(', '));
    
    if (Object.keys(stagesTable).length === 0) {
        throw new Error('No stages parsed - check column matching');
    }
});

// Test 7: Test _1 suffix stripping for duplicate columns
runTest('Handles XLSX _1 suffix for duplicate columns', () => {
    // Simulate a row with duplicate column names (XLSX renames to _1, _2, etc.)
    const mockRow = {
        'Strain ID': 1,
        'Strain': 'Animal Cookies',
        'Strain ID_1': '*00001*',     // Duplicate renamed by XLSX
        'Strain Name': '*Animal Cookies*'
    };
    
    // Our getField should find "Strain ID" (ignoring _1 suffix)
    const id = getField(mockRow, ['strain id']);
    if (id !== 1) {
        throw new Error(`Expected ID=1, got ${id}`);
    }
    
    // It should find the first matching column
    const name = getField(mockRow, ['strain', 'strain name']);
    if (name !== 'Animal Cookies') {
        throw new Error(`Expected name="Animal Cookies", got ${name}`);
    }
    
    console.log(`   Correctly handles duplicate columns with _1 suffix`);
});

// Test 8: Check media types parsing
runTest('Parses media types if available', () => {
    const mediaSheetName = workbook.SheetNames.find(name =>
        name.toLowerCase().includes('media')
    );
    
    if (!mediaSheetName) {
        throw new Error('SKIP: No media types sheet');
    }
    
    const sheet = workbook.Sheets[mediaSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    if (rows.length === 0) throw new Error('No rows in media sheet');
    
    console.log(`   Columns: ${Object.keys(rows[0]).join(', ')}`);
    
    const mediaTable = {};
    rows.forEach(row => {
        const code = getField(row, ['media_id', 'mediaid', 'media id', 'code', 'id', '#']);
        const name = getField(row, ['media_type', 'mediatype', 'media type', 'media', 'name', 'type']);
        
        if (code !== undefined && code !== null && code !== '') {
            mediaTable[String(code).trim()] = name ? String(name).trim() : String(code).trim();
        }
    });
    
    console.log(`   Parsed ${Object.keys(mediaTable).length} media types`);
});

// Test 9: Check locations parsing
runTest('Parses locations if available', () => {
    const locationsSheetName = workbook.SheetNames.find(name =>
        name.toLowerCase().includes('location')
    );
    
    if (!locationsSheetName) {
        throw new Error('SKIP: No locations sheet');
    }
    
    const sheet = workbook.Sheets[locationsSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    if (rows.length === 0) throw new Error('No rows in locations sheet');
    
    console.log(`   Columns: ${Object.keys(rows[0]).join(', ')}`);
    
    const locationsTable = [];
    rows.forEach(row => {
        const name = getField(row, ['location_name', 'location', 'locations', 'name', 'room', 'rack']);
        if (name && !locationsTable.includes(String(name).trim())) {
            locationsTable.push(String(name).trim());
        }
    });
    
    console.log(`   Parsed ${locationsTable.length} locations`);
});

// Print summary
console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Total: ${testsPassed + testsFailed + testsSkipped}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
if (testsSkipped > 0) {
    console.log(`⏭️  Skipped: ${testsSkipped}`);
}
console.log('========================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
