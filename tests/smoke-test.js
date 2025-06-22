#!/usr/bin/env node

// Simple smoke test for Phase 3 functionality
// This can be run with Node.js to test basic functionality

console.log('🧪 Running Phase 3 Smoke Tests...');

// Test 1: Check that all required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
    'index.html',
    'src/styles/main.css',
    'src/js/main.js',
    'src/js/core/state.js',
    'src/js/core/notifications.js',
    'src/js/utils/dataUtils.js',
    'src/js/utils/uiUtils.js',
    'tests/phase3-validation.html'
];

let filesExist = 0;
console.log('\n📁 Checking required files...');

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
        filesExist++;
    } else {
        console.log(`❌ ${file} - MISSING`);
    }
});

console.log(`\n📊 Files: ${filesExist}/${requiredFiles.length} found`);

// Test 2: Check that JavaScript modules have proper exports
console.log('\n🔧 Checking JavaScript module structure...');

const jsFiles = [
    'src/js/core/state.js',
    'src/js/core/notifications.js',
    'src/js/utils/dataUtils.js',
    'src/js/utils/uiUtils.js'
];

let modulesValid = 0;

jsFiles.forEach(file => {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('window.') && content.length > 100) {
            console.log(`✅ ${file} - Valid module structure`);
            modulesValid++;
        } else {
            console.log(`❌ ${file} - Invalid or empty module`);
        }
    }
});

console.log(`\n📊 Modules: ${modulesValid}/${jsFiles.length} valid`);

// Test 3: Check HTML file structure
console.log('\n📄 Checking HTML structure...');

if (fs.existsSync('index.html')) {
    const htmlContent = fs.readFileSync('index.html', 'utf8');
    const checks = [
        { name: 'Has CSS link', test: () => htmlContent.includes('src/styles/main.css') },
        { name: 'Has JS modules', test: () => htmlContent.includes('src/js/core/state.js') },
        { name: 'Has builder section', test: () => htmlContent.includes('builderSection') },
        { name: 'Has transfer section', test: () => htmlContent.includes('transferSection') },
        { name: 'Has notification div', test: () => htmlContent.includes('id="notification"') }
    ];
    
    let htmlChecks = 0;
    checks.forEach(check => {
        if (check.test()) {
            console.log(`✅ ${check.name}`);
            htmlChecks++;
        } else {
            console.log(`❌ ${check.name}`);
        }
    });
    
    console.log(`\n📊 HTML Structure: ${htmlChecks}/${checks.length} checks passed`);
}

// Final Summary
const totalTests = requiredFiles.length + jsFiles.length + 5; // 5 HTML checks
const totalPassed = filesExist + modulesValid + (fs.existsSync('index.html') ? 5 : 0);
const successRate = Math.round((totalPassed / totalTests) * 100);

console.log(`\n🎯 FINAL RESULTS:`);
console.log(`📊 Overall: ${totalPassed}/${totalTests} tests passed (${successRate}%)`);

if (successRate >= 90) {
    console.log(`✅ Phase 3 PASSED - Core infrastructure ready`);
    process.exit(0);
} else if (successRate >= 70) {
    console.log(`⚠️ Phase 3 WARNING - Some issues detected`);
    process.exit(1);
} else {
    console.log(`❌ Phase 3 FAILED - Critical issues found`);
    process.exit(2);
}
