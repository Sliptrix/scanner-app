/**
 * Frontend Security Tests
 * Verifies XSS sanitization is applied in critical code paths
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

const srcDir = path.join(__dirname, '..', 'src', 'js');

// Test UIUtils.sanitize exists
test('UIUtils.sanitize function should exist', () => {
    const code = fs.readFileSync(path.join(srcDir, 'utils', 'uiUtils.js'), 'utf8');
    assert(code.includes('sanitize: function(str)'), 'Should have sanitize function');
    assert(code.includes('textContent'), 'Should use textContent for escaping');
});

// Test tableManager sanitizes user data
test('InventoryTableManager should sanitize user data in rows', () => {
    const code = fs.readFileSync(path.join(srcDir, 'modules', 'inventory', 'tableManager.js'), 'utf8');
    assert(code.includes('UIUtils.sanitize'), 'Should use UIUtils.sanitize');
    assert(code.includes('const s = UIUtils.sanitize'), 'Should alias sanitize for table rows');
});

// Test dashboardMain sanitizes recent intake table
test('DashboardManager should sanitize recent intake data', () => {
    const code = fs.readFileSync(path.join(srcDir, 'modules', 'dashboard', 'dashboardMain.js'), 'utf8');
    assert(code.includes('UIUtils.sanitize') || code.includes('UIUtils ? UIUtils.sanitize'), 
        'Should use UIUtils.sanitize in dashboard');
});

// Test global search sanitizes results
test('Global search should sanitize strain names in dropdown', () => {
    const code = fs.readFileSync(path.join(srcDir, 'main.js'), 'utf8');
    assert(code.includes("const s = UIUtils.sanitize"), 'Should alias sanitize for search');
    assert(code.includes("s(strain.name"), 'Should sanitize strain names');
});

// Test inline edit sanitizes values
test('Container inline edit should sanitize field values', () => {
    const code = fs.readFileSync(path.join(srcDir, 'main.js'), 'utf8');
    assert(code.includes('safeValue') && code.includes('safeField'), 
        'Should sanitize inline edit field values');
});

// Test no test files in production HTML
test('Production HTML should not include test scripts', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert(!html.includes('ml-engine-tests.js'), 'Should not include ml-engine-tests.js');
    assert(!html.includes('import-export.test.js'), 'Should not include import-export.test.js');
});

// Test auth config uses sessionStorage (not localStorage)
test('Auth should use sessionStorage for token cache', () => {
    const code = fs.readFileSync(path.join(srcDir, 'modules', 'auth', 'authManager.js'), 'utf8');
    assert(code.includes("cacheLocation: 'sessionStorage'"), 'Should use sessionStorage for MSAL cache');
});

// Test auth validates MSAL config before use
test('Auth should validate config is not placeholder', () => {
    const code = fs.readFileSync(path.join(srcDir, 'modules', 'auth', 'authManager.js'), 'utf8');
    assert(code.includes("includes('YOUR_')"), 'Should check for placeholder values');
});

console.log(`\n📊 Frontend Security Tests: ${passed}/${passed + failed} passed`);
if (failed > 0) {
    process.exit(1);
}
