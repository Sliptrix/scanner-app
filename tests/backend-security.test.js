/**
 * Backend Security Tests
 * Tests input validation, rate limiting config, and security headers
 */

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

// Test generateShortCode uses crypto and has retry limit
test('generateShortCode should use crypto.randomBytes', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(serverCode.includes('crypto.randomBytes'), 'Should use crypto.randomBytes');
    assert(serverCode.includes('maxRetries'), 'Should have retry limit');
    assert(!serverCode.includes('return generateShortCode()'), 'Should not have recursive call');
});

// Test CORS is not wildcard
test('CORS should not use wildcard origin', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(!serverCode.includes("origin: '*'"), 'Should not have wildcard CORS');
    assert(serverCode.includes('CORS_ORIGINS'), 'Should use env-based CORS');
});

// Test helmet is used
test('Should use helmet for security headers', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(serverCode.includes("require('helmet')"), 'Should require helmet');
    assert(serverCode.includes('app.use(helmet('), 'Should use helmet middleware');
});

// Test rate limiting exists
test('Should have rate limiting on API endpoints', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(serverCode.includes('rateLimit'), 'Should use rate limiting');
    assert(serverCode.includes('emailLimiter'), 'Should have email rate limiter');
    assert(serverCode.includes('printLimiter'), 'Should have print rate limiter');
});

// Test error messages don't leak in production
test('Error responses should not leak details in production', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(serverCode.includes("NODE_ENV !== 'production'"), 'Should check NODE_ENV before exposing errors');
});

// Test QR debug endpoint is disabled in production
test('QR mappings list endpoint should be disabled in production', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(serverCode.includes("'This endpoint is disabled in production'"), 'Should block GET /api/qrcodes in production');
});

// Test shortCode param validation
test('Short code lookup should validate format', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(serverCode.includes('/^[A-Za-z0-9]{6}$/'), 'Should validate shortCode format');
});

// Test printer IP validation (SSRF prevention)
test('Printer IP should be validated to prevent SSRF', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(serverCode.includes('Invalid printer IP format'), 'Should validate printer IP');
});

// Test email recipient validation
test('Email recipients should be validated', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(serverCode.includes('Invalid email addresses'), 'Should validate email addresses');
    assert(serverCode.includes('Maximum 10 recipients'), 'Should limit recipients');
});

// Test subject sanitization (header injection prevention)
test('Email subject should be sanitized against header injection', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(serverCode.includes('.replace(/[\\r\\n]/g'), 'Should strip newlines from subject');
});

// Test input length limits on QR endpoints
test('QR code endpoints should validate input lengths', () => {
    const serverCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'backend', 'server.js'), 'utf8'
    );
    assert(serverCode.includes('containerId must be a string under 200'), 'Should limit containerId length');
    assert(serverCode.includes('barcodeData must be a string under 500'), 'Should limit barcodeData length');
});

console.log(`\n📊 Backend Security Tests: ${passed}/${passed + failed} passed`);
if (failed > 0) {
    process.exit(1);
}
