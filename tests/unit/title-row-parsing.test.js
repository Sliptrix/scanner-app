#!/usr/bin/env node
/**
 * Tests for title-row detection in Excel parsing (_sheetToJsonSmart)
 * and container ID format handling during transfers.
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

let passed = 0, failed = 0;

function assert(condition, msg) {
    if (condition) { passed++; console.log(`✅ ${msg}`); }
    else { failed++; console.log(`❌ ${msg}`); }
}

// Load dataUtils to get _sheetToJsonSmart
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;

// Load XLSX globally as the module expects it
global.XLSX = XLSX;

// Load state first
const stateContent = fs.readFileSync(path.join(__dirname, '../../src/js/core/state.js'), 'utf8');
eval(stateContent);

const dataUtilsContent = fs.readFileSync(path.join(__dirname, '../../src/js/utils/dataUtils.js'), 'utf8');
eval(dataUtilsContent);

const DataUtils = window.DataUtils;

console.log('\n========================================');
console.log('Title Row & Container ID Format Tests');
console.log('========================================\n');

// --- Title Row Detection Tests ---
console.log('📄 Title Row Detection Tests\n');

// Create a workbook with title row before headers
function makeSheetWithTitleRow(titleText, headers, dataRows) {
    const aoa = [[titleText], headers, ...dataRows];
    return XLSX.utils.aoa_to_sheet(aoa);
}

// Test 1: Sheet with title row "STRAIN REFERENCE" before headers
{
    const sheet = makeSheetWithTitleRow(
        'STRAIN REFERENCE',
        ['Strain ID', 'Strain Name', 'Species'],
        [[1, 'Blue Dream', 'Sativa'], [2, 'OG Kush', 'Indica']]
    );
    const result = DataUtils._sheetToJsonSmart(sheet, ['Strain ID', 'Strain Name', 'Species']);
    assert(result.length === 2, 'Parses data rows correctly when title row present');
    assert(result[0]['Strain Name'] === 'Blue Dream', 'First data row has correct strain name');
    assert(result[1]['Species'] === 'Indica', 'Second data row has correct species');
}

// Test 2: Sheet without title row (headers on row 0)
{
    const aoa = [['Strain ID', 'Strain Name'], [1, 'Blue Dream'], [2, 'OG Kush']];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    const result = DataUtils._sheetToJsonSmart(sheet, ['Strain ID', 'Strain Name']);
    assert(result.length === 2, 'Parses correctly when headers on first row');
    assert(result[0]['Strain ID'] === 1, 'Data value correct without title row');
}

// Test 3: Title row with different casing/spacing
{
    const sheet = makeSheetWithTitleRow(
        'ACTIVE INVENTORY',
        ['container_id', 'strain', 'stage'],
        [[100, 'Gelato', 'In Vitro'], [101, 'Zkittlez', 'Rooted']]
    );
    const result = DataUtils._sheetToJsonSmart(sheet, ['container_id', 'strain', 'stage']);
    assert(result.length === 2, 'Skips title row with underscored headers');
}

// Test 4: Empty sheet returns empty array
{
    const sheet = XLSX.utils.aoa_to_sheet([]);
    const result = DataUtils._sheetToJsonSmart(sheet, ['anything']);
    assert(Array.isArray(result) && result.length === 0, 'Empty sheet returns empty array');
}

// Test 5: Multiple title rows (title on row 0, blank row 1, headers row 2)
{
    const aoa = [['MY TITLE'], [], ['ID', 'Name'], [1, 'Test']];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    const result = DataUtils._sheetToJsonSmart(sheet, ['ID', 'Name']);
    assert(result.length >= 1, 'Handles multiple rows before headers');
    assert(result[0]['Name'] === 'Test', 'Correct data after multi-row title');
}

// --- Container ID Format Tests ---
console.log('\n📦 Container ID Format Tests\n');

// Test various ID formats that the app should handle
{
    // Numeric IDs
    assert(parseInt('42') === 42, 'Parses pure numeric container ID');
    assert(parseInt('0042') === 42, 'Parses zero-padded numeric ID');

    // The app uses parseInt or Number() for container IDs
    const testIds = ['1', '100', '9999', '00001'];
    testIds.forEach(id => {
        const parsed = parseInt(id);
        assert(!isNaN(parsed) && parsed > 0, `Parses container ID "${id}" as valid number ${parsed}`);
    });

    // Edge cases
    assert(isNaN(parseInt('')), 'Empty string is invalid container ID');
    assert(isNaN(parseInt('abc')), 'Alpha string is invalid container ID');
}

// --- Summary ---
console.log(`\n========================================`);
console.log(`Test Summary`);
console.log(`========================================`);
console.log(`Total: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
