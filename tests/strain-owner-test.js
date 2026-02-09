/**
 * Quick test to verify strain-owner mapping functionality
 */
const XLSX = require('xlsx');
const path = require('path');

console.log('========================================');
console.log('Strain-Owner Mapping Test');
console.log('========================================\n');

// Load the HQ workbook - use local sample file
// Note: Original path pointed to uploads folder that may not exist
const workbookPath = path.join(__dirname, '..', 'barcode test.xlsx');
const workbook = XLSX.readFile(workbookPath);

// Get Ref_Strains sheet
const strainsSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'ref_strains');
if (!strainsSheetName) {
    console.log('⚠️ Ref_Strains sheet not found in workbook - skipping (available sheets: ' + workbook.SheetNames.join(', ') + ')');
    console.log('✅ Strain-Owner Mapping Test SKIPPED (no Ref_Strains data)');
    process.exit(0);
}

const sheet = workbook.Sheets[strainsSheetName];

// Skip title row (row 1), headers are in row 2
const range = XLSX.utils.decode_range(sheet['!ref']);
range.s.r = 1;
const rows = XLSX.utils.sheet_to_json(sheet, { range: XLSX.utils.encode_range(range) });

console.log(`Found ${rows.length} strains in Ref_Strains sheet\n`);

// Check for Owner_Code column
const firstRow = rows[0];
console.log('Sample row columns:', Object.keys(firstRow).join(', '));

// Helper to get field case-insensitively
const getField = (row, candidates) => {
    for (const key of Object.keys(row)) {
        if (candidates.includes(key.toLowerCase().trim())) {
            return row[key];
        }
    }
    return undefined;
};

// Count strains with owner mappings
let strainsWithOwners = 0;
let strainOwnerMap = {};
let ownerStrainCounts = {};

rows.forEach(row => {
    const id = getField(row, ['strain_id', 'id', '#']);
    const ownerCode = getField(row, ['owner_code', 'ownercode', 'owner', 'owner_id']);
    
    if (id && ownerCode) {
        const strainId = String(id).trim();
        const ownerStr = String(ownerCode).trim();
        
        // Split by comma to handle multiple owners
        const owners = ownerStr.split(',').map(o => o.trim()).filter(o => o.length > 0);
        
        if (owners.length > 0) {
            strainsWithOwners++;
            strainOwnerMap[strainId] = owners;
            
            // Count strains per owner
            owners.forEach(owner => {
                ownerStrainCounts[owner] = (ownerStrainCounts[owner] || 0) + 1;
            });
        }
    }
});

console.log(`\n✅ Strains with owner mappings: ${strainsWithOwners}/${rows.length}`);
console.log('\n📊 Strains per owner:');
Object.entries(ownerStrainCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([owner, count]) => {
        console.log(`   ${owner}: ${count} strains`);
    });

// Show some example strain-owner mappings
console.log('\n📋 Sample strain-owner mappings (first 10):');
Object.entries(strainOwnerMap).slice(0, 10).forEach(([strainId, owners]) => {
    console.log(`   Strain #${strainId} → [${owners.join(', ')}]`);
});

// Check for strains with multiple owners
const multiOwnerStrains = Object.entries(strainOwnerMap).filter(([_, owners]) => owners.length > 1);
console.log(`\n📌 Strains with multiple owners: ${multiOwnerStrains.length}`);
if (multiOwnerStrains.length > 0) {
    console.log('   Examples:');
    multiOwnerStrains.slice(0, 5).forEach(([strainId, owners]) => {
        console.log(`   - Strain #${strainId}: [${owners.join(', ')}]`);
    });
}

console.log('\n========================================');
console.log('Test Complete');
console.log('========================================');
