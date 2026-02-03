const XLSX = require('xlsx');

const workbook = XLSX.readFile('/sessions/nice-exciting-ride/mnt/uploads/Enhanced_Plant_Inventory_System-6.xlsx');

console.log('=== TESTING PARSING LOGIC ===');

const getField = (row, candidates) => {
    for (const key of Object.keys(row)) {
        const normalizedKey = key.toLowerCase().trim();
        if (candidates.includes(normalizedKey)) {
            return row[key];
        }
    }
    return undefined;
};

const sheet = workbook.Sheets['Ref_Owners'];
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
range.s.r = 1;
const newRange = XLSX.utils.encode_range(range);
const rows = XLSX.utils.sheet_to_json(sheet, { range: newRange });

console.log('Rows parsed:', rows.length);
console.log('First row keys:', Object.keys(rows[0]));

// WITH THE FIX - owner_code is now included
const idCandidates = ['owner_id', 'ownerid', 'owner id', 'owner_code', 'ownercode', 'owner code', 'id', 'owner-id', '#'];
const nameCandidates = ['owner_name', 'owner name', 'ownername', 'owner', 'name'];

const ownersTable = {};
let count = 0;

rows.forEach(row => {
    const id = getField(row, idCandidates);
    const name = getField(row, nameCandidates);

    if (id !== undefined && id !== null && id !== '') {
        const ownerId = String(id).trim();
        const ownerName = name ? String(name).trim() : ownerId;
        if (!ownersTable[ownerId]) {
            ownersTable[ownerId] = ownerName;
            count++;
        }
    }
});

console.log('');
console.log('=== PARSED OWNERS (' + count + ' total) ===');
Object.entries(ownersTable).forEach(function(entry) {
    console.log('  ' + entry[0] + ': ' + entry[1]);
});
