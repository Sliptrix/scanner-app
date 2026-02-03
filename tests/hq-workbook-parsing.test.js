/**
 * HQ Workbook Parsing Test
 * Tests the parsing of the actual Enhanced_Plant_Inventory_System workbook
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Load the test workbook
const workbookPath = '/sessions/eloquent-busy-fermi/mnt/uploads/Enhanced_Plant_Inventory_System-7.xlsx';

console.log('\n========================================');
console.log('HQ Workbook Parsing Tests');
console.log('========================================\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
    try {
        testFn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
    }
}

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

// Read the workbook
const workbook = XLSX.readFile(workbookPath, { cellDates: true });

// Test 1: Sheet detection
runTest('Detects all required sheets in HQ workbook', () => {
    const requiredSheets = ['Active_Inventory', 'Ref_Strains', 'Ref_Owners', 'Ref_Stages'];
    requiredSheets.forEach(sheet => {
        if (!workbook.SheetNames.includes(sheet)) {
            throw new Error(`Missing required sheet: ${sheet}`);
        }
    });
});

// Test 2: Active_Inventory header detection
runTest('Correctly detects Active_Inventory header row at row 2', () => {
    const sheet = workbook.Sheets['Active_Inventory'];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    
    // Find header row
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
        const rowArr = aoa[i];
        if (!Array.isArray(rowArr)) continue;
        const hasContainerId = rowArr.some(cell =>
            cell && String(cell).toLowerCase().trim() === 'container_id'
        );
        if (hasContainerId) {
            headerRowIndex = i;
            break;
        }
    }
    
    if (headerRowIndex !== 1) {
        throw new Error(`Header row detected at index ${headerRowIndex}, expected 1 (row 2 in Excel)`);
    }
});

// Test 3: Active_Inventory data parsing
runTest('Parses Active_Inventory data rows correctly', () => {
    const sheet = workbook.Sheets['Active_Inventory'];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    
    const headerRow = aoa[1]; // Row 2 (0-indexed: 1)
    const dataRows = aoa.slice(2);
    
    // Build row objects
    const rows = dataRows.slice(0, 5).map(rowArr => {
        const obj = {};
        headerRow.forEach((headerCell, colIdx) => {
            if (!headerCell) return;
            const key = String(headerCell).trim();
            if (!key) return;
            obj[key] = rowArr[colIdx];
        });
        return obj;
    });
    
    // Check first data row
    const firstRow = rows[0];
    const containerId = getField(firstRow, ['container_id', 'containerid', 'container id']);
    const strainName = getField(firstRow, ['strain_name', 'strain name', 'strainname', 'strain']);
    const owner = getField(firstRow, ['owner', 'owner_name', 'owner name']);
    
    if (containerId !== 1) {
        throw new Error(`Expected containerId 1, got ${containerId}`);
    }
    if (!strainName || strainName !== 'Melted Strawberry') {
        throw new Error(`Expected strain 'Melted Strawberry', got '${strainName}'`);
    }
    if (!owner || owner !== 'Vibe') {
        throw new Error(`Expected owner 'Vibe', got '${owner}'`);
    }
});

// Test 4: Ref_Strains parsing (skip title row)
runTest('Parses Ref_Strains with title row skipped', () => {
    const sheet = workbook.Sheets['Ref_Strains'];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    range.s.r = 1; // Skip title row
    const newRange = XLSX.utils.encode_range(range);
    const rows = XLSX.utils.sheet_to_json(sheet, { range: newRange });
    
    if (rows.length < 100) {
        throw new Error(`Expected at least 100 strains, got ${rows.length}`);
    }
    
    // Check column names match expected format
    const firstRow = rows[0];
    const strainId = getField(firstRow, ['strain_id', 'strainid', 'strain id', 'id']);
    const strainName = getField(firstRow, ['strain_name', 'strain name', 'strainname', 'strain', 'name']);
    const abbr = getField(firstRow, ['abr', 'abbr', 'abbreviation']);
    
    if (strainId === undefined) {
        throw new Error(`Strain_ID column not found. Keys: ${Object.keys(firstRow)}`);
    }
    if (strainName === undefined) {
        throw new Error(`Strain_Name column not found. Keys: ${Object.keys(firstRow)}`);
    }
    if (abbr === undefined) {
        throw new Error(`ABR column not found. Keys: ${Object.keys(firstRow)}`);
    }
    
    console.log(`   Found ${rows.length} strains (first: ID=${strainId}, Name="${strainName}", ABR="${abbr}")`);
});

// Test 5: Ref_Owners parsing
runTest('Parses Ref_Owners with title row skipped', () => {
    const sheet = workbook.Sheets['Ref_Owners'];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    range.s.r = 1; // Skip title row
    const newRange = XLSX.utils.encode_range(range);
    const rows = XLSX.utils.sheet_to_json(sheet, { range: newRange });
    
    if (rows.length < 5) {
        throw new Error(`Expected at least 5 owners, got ${rows.length}`);
    }
    
    // Check column names
    const firstRow = rows[0];
    const ownerId = getField(firstRow, ['owner_id', 'ownerid', 'owner id', 'owner_code', 'ownercode', 'owner code', 'id']);
    const ownerName = getField(firstRow, ['owner_name', 'owner name', 'ownername', 'owner', 'name']);
    
    if (ownerId === undefined) {
        throw new Error(`Owner_Code column not found. Keys: ${Object.keys(firstRow)}`);
    }
    if (ownerName === undefined) {
        throw new Error(`Owner_Name column not found. Keys: ${Object.keys(firstRow)}`);
    }
    
    console.log(`   Found ${rows.length} owners (first: Code="${ownerId}", Name="${ownerName}")`);
});

// Test 6: Date parsing
runTest('Correctly parses Excel dates from Active_Inventory', () => {
    const sheet = workbook.Sheets['Active_Inventory'];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    
    const headerRow = aoa[1];
    const dateColIndex = headerRow.findIndex(h => h && h.toLowerCase().includes('date'));
    
    if (dateColIndex === -1) {
        throw new Error('Date column not found');
    }
    
    const firstDataRow = aoa[2];
    const dateValue = firstDataRow[dateColIndex];
    
    if (dateValue instanceof Date) {
        console.log(`   Date parsed as Date object: ${dateValue.toLocaleDateString()}`);
    } else if (typeof dateValue === 'number') {
        console.log(`   Date is Excel serial number: ${dateValue}`);
    } else {
        console.log(`   Date type: ${typeof dateValue}, value: ${dateValue}`);
    }
});

// Test 7: Check all expected column names are matchable
runTest('All HQ workbook column names are matchable', () => {
    const sheet = workbook.Sheets['Active_Inventory'];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    const headerRow = aoa[1];
    
    const expectedMatches = {
        'Container_ID': ['container_id', 'containerid', 'container id'],
        'Strain_Name': ['strain_name', 'strain name', 'strainname', 'strain'],
        'Owner': ['owner', 'owner_name', 'owner name'],
        'Stage': ['stage'],
        'Location': ['location', 'room', 'rack'],
        'Media_Type': ['media', 'media_type', 'media type'],
        'Quantity': ['quantity', 'tissuecount', 'tissue_count', 'tissue count'],
        'Date_Created': ['datecreated', 'date_created', 'date created', 'date']
    };
    
    const failures = [];
    for (const [colName, candidates] of Object.entries(expectedMatches)) {
        const normalized = colName.toLowerCase().trim();
        const matched = candidates.some(c => c === normalized);
        if (!matched) {
            failures.push(`Column "${colName}" (normalized: "${normalized}") not matchable by candidates: ${candidates}`);
        }
    }
    
    if (failures.length > 0) {
        throw new Error(failures.join('; '));
    }
});

// Print summary
console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Total: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log('========================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
