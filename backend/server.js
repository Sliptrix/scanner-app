/**
 * Scanner Backend Server
 * Handles email sending via Microsoft Graph API, QR code generation,
 * and label printing for LoneWolf Biotech Lab Tracker System.
 * 
 * @module server
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const multer = require('multer');
const { Client } = require('@microsoft/microsoft-graph-client');
const QRCode = require('qrcode');
require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory QR code mappings (short code -> barcode data)
// Starts clean every boot — HQ workbook is the source of truth for next ID
const qrMappings = new Map();

// No-op: mappings are ephemeral (session-only)
function saveQRMappings() {}

console.log('🧹 Starting with clean QR mappings (HQ workbook is source of truth)');

// SECURITY: Configure CORS with specific origins in production
const corsOptions = {
    origin: process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',') 
        : ['http://localhost:8000', 'http://localhost:3000', 'http://127.0.0.1:8000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// SECURITY: Helmet sets comprehensive security headers (replaces manual header setting)
app.use(helmet({
    frameguard: { action: 'deny' },
    contentSecurityPolicy: false, // CSP managed by frontend/nginx in production
    crossOriginEmbedderPolicy: false // Allow cross-origin resources (QR images, etc.)
}));

// REQUEST LOGGING
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// RATE LIMITING: Prevent abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Stricter rate limit for email sending
const emailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Email rate limit exceeded. Try again later.' }
});
app.use('/api/email/send', emailLimiter);

// Stricter rate limit for printing
const printLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Print rate limit exceeded. Try again later.' }
});
app.use('/api/print/', printLimiter);

// Configure multer for file uploads (in-memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Scanner backend is running' });
});

/**
 * Generate a short code (6 characters, alphanumeric, similar to qrco.de style).
 * Uses crypto.randomBytes for better randomness and limits retries to prevent
 * infinite recursion if the keyspace becomes saturated.
 * @param {number} [maxRetries=10] - Maximum collision retries
 * @returns {string} Unique 6-character alphanumeric code
 * @throws {Error} If unable to generate a unique code within maxRetries
 */
function generateShortCode(maxRetries = 10) {
    const crypto = require('crypto');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const bytes = crypto.randomBytes(6);
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[bytes[i] % chars.length];
        }
        if (!qrMappings.has(code)) {
            return code;
        }
    }
    throw new Error('Failed to generate unique short code after maximum retries');
}

/**
 * Generate QR code for a container
 * POST /api/qrcodes
 *
 * Body:
 * - containerId: Container ID
 * - barcodeData: Barcode data to encode
 * - appUrl: Optional app URL (defaults to http://localhost:8000)
 *
 * Returns:
 * - dataUrl: Data URL of the QR code image (PNG base64)
 * - destinationUrl: The URL the QR code points to
 * - shortCode: The short code used
 * - imageFormat: Image format (PNG)
 */
app.post('/api/qrcodes', async (req, res) => {
    try {
        const { containerId, barcodeData, appUrl, destinationUrl: customDestUrl } = req.body;
        // Use PUBLIC_URL env var for QR codes (so they work when scanned from phones)
        const baseUrl = appUrl || process.env.PUBLIC_URL || `http://localhost:${PORT}`;

        if (!containerId || !barcodeData) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['containerId', 'barcodeData']
            });
        }

        // SECURITY: Validate input lengths to prevent abuse
        if (typeof containerId !== 'string' || containerId.length > 200) {
            return res.status(400).json({ error: 'containerId must be a string under 200 characters' });
        }
        if (typeof barcodeData !== 'string' || barcodeData.length > 500) {
            return res.status(400).json({ error: 'barcodeData must be a string under 500 characters' });
        }

        // Generate a short code
        const shortCode = generateShortCode();

        // Store the mapping and persist to disk
        qrMappings.set(shortCode, {
            containerId,
            barcodeData,
            createdAt: new Date().toISOString()
        });
        saveQRMappings();

        // Build destination URL priority:
        // 1. Custom destination URL passed by client
        // 2. SharePoint HQ workbook deep link (if SHAREPOINT_WORKBOOK_URL is set)
        // 3. Scan page fallback
        let destinationUrl;
        if (customDestUrl) {
            destinationUrl = customDestUrl;
        } else if (process.env.SHAREPOINT_WORKBOOK_URL) {
            // Deep link into SharePoint Excel with the container ID as a search hint
            // The workbook opens and user can Ctrl+F to find the container
            const spUrl = process.env.SHAREPOINT_WORKBOOK_URL;
            // Append activeCell or wdFindString param to help locate the row
            const separator = spUrl.includes('?') ? '&' : '?';
            destinationUrl = `${spUrl}${separator}wdFindString=${encodeURIComponent(containerId)}`;
        } else {
            destinationUrl = `${baseUrl}/s/${shortCode}`;
        }

        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(destinationUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 300,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        res.json({
            success: true,
            dataUrl: qrDataUrl,
            destinationUrl: destinationUrl,
            shortCode: shortCode,
            imageFormat: 'PNG'
        });

    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({
            error: 'Failed to generate QR code',
            message: error.message
        });
    }
});

/**
 * Proxy endpoint for qr-code-generator.com API (avoids CORS issues)
 * POST /api/qr-generate
 *
 * Body: { qr_code_text, image_format, image_width, foreground_color, background_color }
 * Returns: PNG image as base64 data URL
 * 
 * SECURITY: API key must be provided via QR_API_KEY environment variable
 */
app.post('/api/qr-generate', async (req, res) => {
    try {
        // SECURITY: Validate request body has expected fields
        const { qr_code_text } = req.body;
        if (!qr_code_text || typeof qr_code_text !== 'string' || qr_code_text.length > 2000) {
            return res.status(400).json({ error: 'Invalid or missing qr_code_text (max 2000 chars)' });
        }

        // SECURITY: Load API key from environment variable only
        const qrApiKey = process.env.QR_API_KEY;
        if (!qrApiKey) {
            return res.status(500).json({ 
                error: 'QR API not configured',
                message: 'QR_API_KEY environment variable not set'
            });
        }
        const apiUrl = `https://api.qr-code-generator.com/v1/create?access-token=${qrApiKey}`;
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        if (!apiResponse.ok) {
            const text = await apiResponse.text();
            return res.status(apiResponse.status).json({ error: `QR API error: ${apiResponse.status}`, details: text });
        }

        // Convert the PNG response to a base64 data URL
        const buffer = await apiResponse.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;

        res.json({ success: true, dataUrl });
    } catch (error) {
        console.error('QR proxy error:', error);
        res.status(500).json({ error: 'Failed to generate QR code', message: error.message });
    }
});

// ============================================================
// QR Code Pool Management Endpoints
// ============================================================

/**
 * Create a single pool code on-the-fly (for type-in assignment workflow).
 * If the code already exists, returns it as-is. Otherwise creates it without
 * calling the QR image API (the label is already physically printed).
 * POST /api/qrcodes/pool/create-single
 * Body: { shortCode: "305" }
 */
app.post('/api/qrcodes/pool/create-single', (req, res) => {
    const { shortCode } = req.body;
    if (!shortCode) {
        return res.status(400).json({ error: 'shortCode is required' });
    }

    // If it already exists, return it
    if (qrMappings.has(shortCode)) {
        const existing = qrMappings.get(shortCode);
        return res.json({ success: true, created: false, shortCode, ...existing });
    }

    // Create a new unassigned pool entry (no QR image needed — label already printed)
    const data = {
        status: 'unassigned',
        createdAt: new Date().toISOString(),
        qrImageDataUrl: null // Physical label exists; no digital image needed
    };
    qrMappings.set(shortCode, data);
    saveQRMappings();

    res.json({ success: true, created: true, shortCode, ...data });
});

/**
 * Generate a pool of unassigned QR codes with pre-generated images
 * POST /api/qrcodes/pool/generate
 * Body: { count: 50, prefix: "LW" }
 */
app.post('/api/qrcodes/pool/generate', async (req, res) => {
    try {
        let { count, prefix, startId } = req.body;
        count = parseInt(count) || 10;
        prefix = (prefix || '').replace(/[^A-Za-z0-9]/g, '').substring(0, 4);

        if (count < 1 || count > 100) {
            return res.status(400).json({ error: 'Count must be between 1 and 100' });
        }

        const qrApiKey = process.env.QR_API_KEY;
        if (!qrApiKey) {
            return res.status(500).json({ error: 'QR_API_KEY not configured' });
        }

        const baseUrl = process.env.PUBLIC_URL || 'https://scanner.lonewolfgenetics.com';
        const results = [];
        const errors = [];

        // Determine next numeric ID
        // If caller provided startId (pre-queried from /next-id), use it
        let nextId = startId ? parseInt(startId) : 1;
        
        if (!startId) {
            // Check HQ workbook for highest Container_ID (use caller's token if available)
            const token = extractBearerToken(req);
            if (token) {
                try {
                    const hqMax = await queryHQMaxContainerId(token);
                    if (hqMax >= nextId) nextId = hqMax + 1;
                    console.log(`📊 HQ workbook max Container_ID: ${hqMax}, next pool ID: ${nextId}`);
                } catch (err) {
                    console.warn('⚠️ Could not query HQ workbook for max ID, using local state:', err.message);
                }
            }
        } else {
            console.log(`📊 Using caller-provided startId: ${nextId}`);
        }
        
        // Also check any in-memory codes from this session
        for (const [code] of qrMappings) {
            const num = parseInt(code, 10);
            if (!isNaN(num) && num >= nextId) {
                nextId = num + 1;
            }
        }

        for (let i = 0; i < count; i++) {
            try {
                const shortCode = String(nextId + i);
                const scanUrl = `${baseUrl}/s/${shortCode}`;

                // Call QR code generator API
                const apiUrl = `https://api.qr-code-generator.com/v1/create?access-token=${qrApiKey}`;
                const apiResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        frame_name: 'no-frame',
                        qr_code_text: scanUrl,
                        image_format: 'PNG',
                        image_width: 300,
                        foreground_color: '#000000',
                        background_color: '#FFFFFF'
                    })
                });

                if (!apiResponse.ok) {
                    throw new Error(`QR API returned ${apiResponse.status}`);
                }

                const buffer = await apiResponse.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                const qrImageDataUrl = `data:image/png;base64,${base64}`;

                qrMappings.set(shortCode, {
                    status: 'unassigned',
                    createdAt: new Date().toISOString(),
                    qrImageDataUrl
                });

                results.push({ shortCode, qrImageDataUrl });
            } catch (err) {
                console.error(`Pool generate error for code ${i + 1}:`, err.message);
                errors.push({ index: i, error: err.message });
            }
        }

        saveQRMappings();

        res.json({
            success: true,
            generated: results.length,
            errors: errors.length,
            codes: results,
            errorDetails: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Pool generate error:', error);
        res.status(500).json({ error: 'Failed to generate pool codes', message: error.message });
    }
});

/**
 * Get all pool codes with optional status filter
 * GET /api/qrcodes/pool?status=unassigned
 */
app.get('/api/qrcodes/pool', (req, res) => {
    const { status } = req.query;
    const codes = [];

    for (const [shortCode, data] of qrMappings.entries()) {
        // Only include pool entries (those with a status field)
        if (!data.status) continue;
        if (status && data.status !== status) continue;
        codes.push({ shortCode, ...data });
    }

    // Sort by createdAt descending
    codes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.json({ success: true, count: codes.length, codes });
});

/**
 * Assign a pool code to a container
 * POST /api/qrcodes/pool/:shortCode/assign
 * Body: { containerId, barcodeData }
 */
app.post('/api/qrcodes/pool/:shortCode/assign', (req, res) => {
    const { shortCode } = req.params;
    const { containerId, barcodeData } = req.body;

    if (!containerId || !barcodeData) {
        return res.status(400).json({ error: 'containerId and barcodeData are required' });
    }

    if (!qrMappings.has(shortCode)) {
        return res.status(404).json({ error: 'Short code not found' });
    }

    const data = qrMappings.get(shortCode);
    if (data.status === 'assigned') {
        return res.status(409).json({ error: 'Code already assigned', containerId: data.containerId });
    }

    data.status = 'assigned';
    data.containerId = containerId;
    data.barcodeData = barcodeData;
    data.assignedAt = new Date().toISOString();

    qrMappings.set(shortCode, data);
    saveQRMappings();

    res.json({ success: true, shortCode, ...data });
});

/**
 * Unassign a pool code (reset to unassigned)
 * POST /api/qrcodes/pool/:shortCode/unassign
 */
app.post('/api/qrcodes/pool/:shortCode/unassign', (req, res) => {
    const { shortCode } = req.params;

    if (!qrMappings.has(shortCode)) {
        return res.status(404).json({ error: 'Short code not found' });
    }

    const data = qrMappings.get(shortCode);
    data.status = 'unassigned';
    delete data.containerId;
    delete data.barcodeData;
    delete data.assignedAt;

    qrMappings.set(shortCode, data);
    saveQRMappings();

    res.json({ success: true, shortCode, ...data });
});

/**
 * Printable label sheet for QR codes
 * GET /api/qrcodes/pool/print?codes=X7kP2m,Y8lQ3n or ?status=unassigned&limit=50
 */
app.get('/api/qrcodes/pool/print', (req, res) => {
    let codesToPrint = [];

    if (req.query.codes) {
        const requestedCodes = req.query.codes.split(',').map(c => c.trim()).filter(Boolean);
        for (const code of requestedCodes) {
            if (qrMappings.has(code)) {
                const data = qrMappings.get(code);
                if (data.qrImageDataUrl) {
                    codesToPrint.push({ shortCode: code, ...data });
                }
            }
        }
    } else {
        const status = req.query.status || 'unassigned';
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        for (const [shortCode, data] of qrMappings.entries()) {
            if (data.status === status && data.qrImageDataUrl) {
                codesToPrint.push({ shortCode, ...data });
                if (codesToPrint.length >= limit) break;
            }
        }
    }

    if (codesToPrint.length === 0) {
        return res.status(404).send('<html><body><h1>No codes found to print</h1></body></html>');
    }

    const labelHtml = codesToPrint.map(c => `
        <div class="label">
            <img src="${c.qrImageDataUrl}" alt="QR ${c.shortCode}" />
            <div class="code">${escapeHtml(c.shortCode)}</div>
            ${c.containerId ? `<div class="cid">${escapeHtml(c.containerId)}</div>` : ''}
        </div>
    `).join('');

    res.send(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>QR Label Sheet — LoneWolf Biotech</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:10px}
  .no-print{text-align:center;padding:16px;margin-bottom:16px}
  .no-print button{background:#2563eb;color:#fff;border:none;padding:12px 32px;font-size:1rem;border-radius:8px;cursor:pointer;margin:0 8px}
  .no-print button:hover{background:#1d4ed8}
  .no-print .secondary{background:#6b7280}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
  .label{text-align:center;border:1px dashed #ccc;padding:8px;break-inside:avoid;page-break-inside:avoid}
  .label img{width:100%;max-width:150px;height:auto}
  .label .code{font-family:monospace;font-size:14px;font-weight:700;margin-top:4px}
  .label .cid{font-size:11px;color:#666;margin-top:2px}
  @media print{
    .no-print{display:none}
    .grid{grid-template-columns:repeat(5,1fr);gap:4px}
    .label{border:1px solid #eee;padding:4px}
    .label img{max-width:120px}
    body{padding:0}
  }
</style>
</head><body>
<div class="no-print">
  <button onclick="window.print()">🖨️ Print Labels</button>
  <button class="secondary" onclick="window.close()">Close</button>
  <p style="margin-top:8px;color:#666;font-size:0.9rem">${codesToPrint.length} labels ready to print</p>
</div>
<div class="grid">${labelHtml}</div>
</body></html>`);
});

/**
 * Generate a short code with a human-readable prefix
 * @param {string} prefix - 1-4 character prefix
 * @returns {string} Prefixed short code (e.g., "LW4k2m")
 */
function generatePrefixedShortCode(prefix, maxRetries = 10) {
    const crypto = require('crypto');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const suffixLen = 6 - prefix.length;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const bytes = crypto.randomBytes(suffixLen);
        let code = prefix;
        for (let i = 0; i < suffixLen; i++) {
            code += chars[bytes[i] % chars.length];
        }
        if (!qrMappings.has(code)) {
            return code;
        }
    }
    throw new Error('Failed to generate unique prefixed short code');
}

/**
 * Scan page — renders container metadata as a nice HTML page
 * This is the URL encoded in pre-printed QR codes on physical containers.
 * GET /s/:shortCode
 */
app.get('/s/:shortCode', (req, res) => {
    const { shortCode } = req.params;

    if (!/^[A-Za-z0-9]{1,8}$/.test(shortCode)) {
        return res.status(400).send(renderScanPage(null, 'Invalid QR code'));
    }

    if (!qrMappings.has(shortCode)) {
        return res.status(404).send(renderScanPage(null, 'Container not found. This QR code may not be registered yet.'));
    }

    const data = qrMappings.get(shortCode);

    // Handle unassigned pool codes
    if (data.status === 'unassigned') {
        return res.send(renderUnassignedPage(shortCode));
    }

    res.send(renderScanPage(data));
});

/**
 * Render enhanced mobile-friendly scan page with 3-tier auth (no-auth, authenticated, admin)
 */
function renderScanPage(data, error) {
    if (error) {
        return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Container Not Found — LoneWolf Biotech</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;border-radius:16px;padding:32px;max-width:420px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center}
  .icon{font-size:3rem;margin-bottom:16px}
  h1{font-size:1.3rem;color:#1e293b;margin-bottom:8px}
  p{color:#64748b;font-size:0.95rem;line-height:1.6}
  .brand{margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:0.8rem;color:#94a3b8}
</style>
</head><body>
<div class="card">
  <div class="icon">⚠️</div>
  <h1>Container Not Found</h1>
  <p>${escapeHtml(error)}</p>
  <div class="brand">🐺 LoneWolf Biotech Lab Tracker</div>
</div>
</body></html>`;
    }

    const fields = parseBarcodeData(data.barcodeData);
    const containerId = escapeHtml(data.containerId);
    const spUrl = process.env.SHAREPOINT_WORKBOOK_URL || '';
    const workbookLink = spUrl ? `${spUrl}${spUrl.includes('?') ? '&' : '?'}wdFindString=${encodeURIComponent(data.containerId)}` : '';

    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Container ${containerId} — LoneWolf Biotech</title>
<script src="https://alcdn.msauth.net/browser/2.32.2/js/msal-browser.min.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 50%,#f0f9ff 100%);min-height:100vh;padding:16px}
  .wrap{max-width:480px;margin:0 auto}
  .header{text-align:center;padding:20px 0 16px}
  .header .logo{font-size:2.2rem;margin-bottom:4px}
  .header h1{font-size:1.2rem;color:#166534;font-weight:700}
  .header .cid{font-size:1.8rem;color:#059669;font-weight:800;letter-spacing:1px;margin-top:2px}
  .user-bar{display:flex;align-items:center;justify-content:space-between;background:#fff;border-radius:12px;padding:10px 16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);font-size:0.85rem}
  .user-bar .name{color:#1e293b;font-weight:600}
  .user-bar .admin-badge{background:#7c3aed;color:#fff;font-size:0.7rem;padding:2px 8px;border-radius:10px;margin-left:8px}
  .user-bar button{background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.85rem;font-weight:500}
  .card{background:#fff;border-radius:16px;padding:20px;margin-bottom:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #e2e8f0}
  .card h2{font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:14px;font-weight:600}
  .field{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9}
  .field:last-child{border-bottom:none}
  .field-label{font-size:0.85rem;color:#64748b;font-weight:500;min-width:35%}
  .field-value{font-size:0.9rem;color:#1e293b;font-weight:600;text-align:right;max-width:60%;word-break:break-word}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:600}
  .b-initiation{background:#dbeafe;color:#1e40af}
  .b-multiplication{background:#dcfce7;color:#166534}
  .b-rooting{background:#fef3c7;color:#92400e}
  .b-hardening{background:#fce7f3;color:#9d174d}
  .b-stock{background:#e0e7ff;color:#3730a3}
  .btn{display:block;width:100%;padding:14px;border:none;border-radius:12px;font-size:0.95rem;font-weight:600;cursor:pointer;text-align:center;margin-bottom:10px;transition:all 0.2s}
  .btn-ms{background:#2563eb;color:#fff}.btn-ms:hover{background:#1d4ed8}
  .btn-link{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}.btn-link:hover{background:#dcfce7}
  .btn-edit{background:#7c3aed;color:#fff}.btn-edit:hover{background:#6d28d9}
  .btn-save{background:#059669;color:#fff}.btn-save:hover{background:#047857}
  .btn-cancel{background:#f1f5f9;color:#64748b}.btn-cancel:hover{background:#e2e8f0}
  .btn-row{display:flex;gap:8px}.btn-row .btn{flex:1}
  .edit-field{width:100%;padding:8px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:0.9rem;font-family:inherit;transition:border-color 0.2s}
  .edit-field:focus{outline:none;border-color:#7c3aed}
  select.edit-field{background:#fff}
  textarea.edit-field{resize:vertical;min-height:60px}
  .loading{text-align:center;padding:40px;color:#94a3b8}
  .loading .spinner{display:inline-block;width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#059669;border-radius:50%;animation:spin 0.8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .error-msg{background:#fef2f2;color:#dc2626;padding:12px 16px;border-radius:10px;font-size:0.85rem;margin-bottom:12px;text-align:center}
  .success-msg{background:#f0fdf4;color:#059669;padding:12px 16px;border-radius:10px;font-size:0.85rem;margin-bottom:12px;text-align:center}
  .raw{background:#f8fafc;border-radius:10px;padding:14px;margin-top:6px}
  .raw-label{font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .raw-value{font-family:'SF Mono',Monaco,Consolas,monospace;font-size:0.75rem;color:#475569;word-break:break-all;line-height:1.5}
  .brand{text-align:center;margin-top:20px;padding:12px 0;font-size:0.8rem;color:#94a3b8}
  .brand strong{color:#166534}
  .fade-in{animation:fadeIn 0.3s ease}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .hidden{display:none}
  a.btn{text-decoration:none}
</style>
</head><body>
<div class="wrap">
  <div class="header">
    <div class="logo">🐺</div>
    <h1>LoneWolf Biotech</h1>
    <div class="cid">#${containerId}</div>
  </div>

  <!-- User bar (shown when authenticated) -->
  <div id="userBar" class="user-bar hidden">
    <div><span class="name" id="userName"></span><span id="adminBadge" class="admin-badge hidden">Admin</span></div>
    <button onclick="signOut()">Sign out</button>
  </div>

  <!-- Status messages -->
  <div id="errorMsg" class="error-msg hidden"></div>
  <div id="successMsg" class="success-msg hidden"></div>

  <!-- Tier 1: Basic info (always shown) -->
  <div id="basicCard" class="card">
    <h2>Specimen Details</h2>
    ${fields.map(f => `<div class="field">
      <span class="field-label">${escapeHtml(f.label)}</span>
      <span class="field-value${f.badgeClass ? ' badge ' + f.badgeClass.replace('stage-', 'b-') : ''}">${escapeHtml(f.value)}</span>
    </div>`).join('\n    ')}
  </div>

  <!-- Tier 2: Full details (shown after auth) -->
  <div id="fullCard" class="card hidden fade-in">
    <h2>Full Container Record</h2>
    <div id="fullFields"></div>
  </div>

  <!-- Edit panel (Tier 3 - admin only) -->
  <div id="editCard" class="card hidden fade-in">
    <h2>Edit Container</h2>
    <div id="editFields"></div>
    <div class="btn-row" style="margin-top:16px">
      <button class="btn btn-cancel" onclick="cancelEdit()">Cancel</button>
      <button class="btn btn-save" id="saveBtn" onclick="saveChanges()">Save Changes</button>
    </div>
  </div>

  <!-- Loading state -->
  <div id="loadingState" class="loading hidden">
    <div class="spinner"></div>
    <p style="margin-top:12px">Loading container data…</p>
  </div>

  <!-- Actions -->
  <div id="actions">
    <button class="btn btn-ms" id="signInBtn" onclick="signIn()">🔐 Sign in with Microsoft</button>
    <button class="btn btn-edit hidden" id="editBtn" onclick="startEdit()">✏️ Edit Container</button>
    ${workbookLink ? `<a class="btn btn-link" href="${escapeHtml(workbookLink)}" target="_blank">📊 Open in HQ Workbook</a>` : ''}
  </div>

  <div class="card">
    <div class="raw">
      <div class="raw-label">Barcode Data</div>
      <div class="raw-value">${escapeHtml(data.barcodeData)}</div>
    </div>
  </div>

  <div class="brand">🐺 <strong>LoneWolf Biotech</strong> Lab Tracker</div>
</div>

<script>
(function() {
  const CONTAINER_ID = ${JSON.stringify(data.containerId)};
  const API_BASE = window.location.origin;

  // MSAL config
  const msalConfig = {
    auth: {
      clientId: 'c5fd0c6d-55ab-46ac-aa66-af2befec9560',
      authority: 'https://login.microsoftonline.com/a1b92892-5ecd-4f98-ae48-e552b6767726',
      redirectUri: window.location.origin + window.location.pathname
    },
    cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false }
  };

  const msalApp = new msal.PublicClientApplication(msalConfig);
  const loginRequest = { scopes: ['User.Read', 'Files.Read.All', 'Files.ReadWrite.All'] };

  let currentAccount = null;
  let currentToken = null;
  let fullData = null;
  let isAdmin = false;

  // Check if already logged in
  const accounts = msalApp.getAllAccounts();
  if (accounts.length > 0) {
    currentAccount = accounts[0];
    acquireTokenSilent();
  }

  function show(id) { document.getElementById(id).classList.remove('hidden'); }
  function hide(id) { document.getElementById(id).classList.add('hidden'); }
  function showError(msg) { const el = document.getElementById('errorMsg'); el.textContent = msg; show('errorMsg'); setTimeout(() => hide('errorMsg'), 6000); }
  function showSuccess(msg) { const el = document.getElementById('successMsg'); el.textContent = msg; show('successMsg'); setTimeout(() => hide('successMsg'), 4000); }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function stageBadgeClass(stage) {
    const s = (stage || '').toLowerCase();
    if (s.includes('multi')) return 'b-multiplication';
    if (s.includes('init')) return 'b-initiation';
    if (s.includes('root')) return 'b-rooting';
    if (s.includes('hard')) return 'b-hardening';
    if (s.includes('stock')) return 'b-stock';
    return '';
  }

  async function acquireTokenSilent() {
    try {
      const resp = await msalApp.acquireTokenSilent({ ...loginRequest, account: currentAccount });
      currentToken = resp.accessToken;
      onAuthenticated(currentAccount);
    } catch (e) {
      // Silent failed, user needs to sign in interactively
      console.log('Silent token failed:', e);
    }
  }

  window.signIn = async function() {
    try {
      const resp = await msalApp.loginPopup(loginRequest);
      currentAccount = resp.account;
      currentToken = resp.accessToken;
      onAuthenticated(currentAccount);
    } catch (e) {
      if (e.errorCode !== 'user_cancelled') showError('Sign-in failed: ' + (e.message || e));
    }
  };

  window.signOut = function() {
    msalApp.logoutPopup({ account: currentAccount }).catch(() => {});
    currentAccount = null; currentToken = null; fullData = null; isAdmin = false;
    hide('userBar'); hide('fullCard'); hide('editCard'); hide('editBtn'); hide('adminBadge');
    show('signInBtn');
  };

  async function onAuthenticated(account) {
    hide('signInBtn');
    document.getElementById('userName').textContent = account.name || account.username;
    show('userBar');

    // Fetch full details
    show('loadingState');
    try {
      const res = await fetch(API_BASE + '/api/container/' + encodeURIComponent(CONTAINER_ID) + '/details', {
        headers: { 'Authorization': 'Bearer ' + currentToken }
      });
      hide('loadingState');

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showError(err.error || 'Failed to load details (HTTP ' + res.status + ')');
        return;
      }

      const json = await res.json();
      fullData = json.data;
      renderFullDetails(fullData);
      show('fullCard');

      // Check admin via /me (backend does the real check, this is just for UI)
      checkAdmin(account);
    } catch (e) {
      hide('loadingState');
      showError('Network error: ' + e.message);
    }
  }

  function checkAdmin(account) {
    // Simple UI hint: check email pattern. Real admin check happens on backend.
    fetch('https://graph.microsoft.com/v1.0/me', { headers: { 'Authorization': 'Bearer ' + currentToken } })
      .then(r => r.json())
      .then(me => {
        const email = (me.mail || me.userPrincipalName || '').toLowerCase();
        // We can't know ADMIN_EMAILS client-side, so show edit for all authenticated users
        // The backend will reject non-admins. But we optimistically show the button.
        // A smarter approach: try a preflight or add an /api/me/role endpoint
        isAdmin = true; // optimistic — backend enforces
        show('editBtn');
        show('adminBadge');
      }).catch(() => {});
  }

  const DISPLAY_ORDER = ['Container_ID','Strain','Owner','Stage','Location','Media_Type','Date_Created','Date_Modified','Notes','Contamination_Status','Transfer_Count','Parent_Container'];

  function renderFullDetails(data) {
    const container = document.getElementById('fullFields');
    // Order: known fields first, then any extras
    const shown = new Set();
    let html = '';
    for (const key of DISPLAY_ORDER) {
      if (data[key] !== undefined) {
        shown.add(key);
        html += renderField(key, data[key]);
      }
    }
    for (const [key, val] of Object.entries(data)) {
      if (!shown.has(key) && val) {
        html += renderField(key, val);
      }
    }
    container.innerHTML = html;
  }

  function renderField(key, val) {
    const label = key.replace(/_/g, ' ');
    const isStage = key === 'Stage';
    const bc = isStage ? stageBadgeClass(val) : '';
    return '<div class="field"><span class="field-label">' + esc(label) + '</span><span class="field-value' + (bc ? ' badge ' + bc : '') + '">' + esc(val) + '</span></div>';
  }

  const EDITABLE = {
    'Location': 'text',
    'Stage': 'select',
    'Notes': 'textarea',
    'Contamination_Status': 'select'
  };
  const STAGE_OPTIONS = ['Initiation','Multiplication','Rooting','Hardening','Stock'];
  const CONTAM_OPTIONS = ['Clean','Suspected','Confirmed','Treated','Discarded'];

  window.startEdit = function() {
    if (!fullData) return;
    let html = '';
    for (const [field, type] of Object.entries(EDITABLE)) {
      const val = fullData[field] || '';
      const label = field.replace(/_/g, ' ');
      html += '<div style="margin-bottom:14px"><label style="display:block;font-size:0.8rem;color:#64748b;margin-bottom:4px;font-weight:500">' + esc(label) + '</label>';
      if (type === 'select') {
        const opts = field === 'Stage' ? STAGE_OPTIONS : CONTAM_OPTIONS;
        html += '<select class="edit-field" data-field="' + field + '">' + opts.map(o => '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
      } else if (type === 'textarea') {
        html += '<textarea class="edit-field" data-field="' + field + '">' + esc(val) + '</textarea>';
      } else {
        html += '<input class="edit-field" data-field="' + field + '" value="' + esc(val) + '">';
      }
      html += '</div>';
    }
    document.getElementById('editFields').innerHTML = html;
    show('editCard');
    hide('editBtn');
  };

  window.cancelEdit = function() {
    hide('editCard');
    show('editBtn');
  };

  window.saveChanges = async function() {
    const updates = {};
    document.querySelectorAll('.edit-field').forEach(el => {
      const field = el.dataset.field;
      const newVal = el.value.trim();
      if (fullData[field] !== newVal) updates[field] = newVal;
    });
    if (Object.keys(updates).length === 0) { showError('No changes to save'); return; }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';

    try {
      const res = await fetch(API_BASE + '/api/container/' + encodeURIComponent(CONTAINER_ID), {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + currentToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'Save failed'); return; }

      fullData = json.data;
      renderFullDetails(fullData);
      hide('editCard');
      show('editBtn');
      showSuccess('Container updated successfully ✓');
    } catch (e) {
      showError('Network error: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Save Changes';
    }
  };
})();
</script>
</body></html>`;
}

/**
 * Render page for unassigned QR pool codes
 */
function renderUnassignedPage(shortCode) {
    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Unassigned Label — LoneWolf Biotech</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;border-radius:16px;padding:32px;max-width:420px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center}
  .icon{font-size:3rem;margin-bottom:16px}
  h1{font-size:1.3rem;color:#1e293b;margin-bottom:8px}
  .code{font-family:monospace;font-size:1.5rem;color:#7c3aed;font-weight:700;margin:12px 0}
  p{color:#64748b;font-size:0.95rem;line-height:1.6}
  .brand{margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:0.8rem;color:#94a3b8}
</style>
</head><body>
<div class="card">
  <div class="icon">🏷️</div>
  <h1>Unassigned Label</h1>
  <div class="code">${escapeHtml(shortCode)}</div>
  <p>This label hasn't been assigned to a container yet. Use the Scanner App to assign it.</p>
  <div class="brand">🐺 LoneWolf Biotech Lab Tracker</div>
</div>
</body></html>`;
}

/**
 * Parse barcode data string into labeled fields
 * Supports formats like "STAGE-STRAIN-OWNER-DATE-ID" or delimited data
 */
function parseBarcodeData(barcodeData) {
    if (!barcodeData) return [{ label: 'Data', value: 'N/A' }];

    // Try splitting by common delimiters
    const parts = barcodeData.split(/[-|/]/);

    // Common cannabis TC barcode format: STAGE-STRAIN-OWNER-DATE-CONTAINERID
    const stageMap = {
        'I': 'Initiation', 'IN': 'Initiation', 'INIT': 'Initiation',
        'M': 'Multiplication', 'MU': 'Multiplication', 'MULT': 'Multiplication',
        'R': 'Rooting', 'RO': 'Rooting', 'ROOT': 'Rooting',
        'H': 'Hardening', 'HA': 'Hardening', 'HARD': 'Hardening',
        'S': 'Stock', 'ST': 'Stock', 'STOCK': 'Stock'
    };

    const stageClassMap = {
        'Initiation': 'stage-initiation',
        'Multiplication': 'stage-multiplication',
        'Rooting': 'stage-rooting',
        'Hardening': 'stage-hardening',
        'Stock': 'stage-stock'
    };

    if (parts.length >= 3) {
        const fields = [];
        const stageCode = parts[0].toUpperCase().trim();
        const stageName = stageMap[stageCode] || parts[0];
        
        fields.push({ label: 'Stage', value: stageName, badgeClass: stageClassMap[stageName] || '' });
        if (parts[1]) fields.push({ label: 'Strain', value: parts[1].trim() });
        if (parts[2]) fields.push({ label: 'Owner', value: parts[2].trim() });
        if (parts[3]) fields.push({ label: 'Date', value: parts[3].trim() });
        if (parts[4]) fields.push({ label: 'Container', value: parts[4].trim() });
        // Any extra fields
        for (let i = 5; i < parts.length; i++) {
            if (parts[i].trim()) fields.push({ label: `Field ${i + 1}`, value: parts[i].trim() });
        }
        return fields;
    }

    // Fallback: just show the raw data
    return [{ label: 'Barcode', value: barcodeData }];
}

/**
 * HTML-escape a string to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

/**
 * Lookup a short code to get container information (JSON API)
 * GET /api/qrcodes/:shortCode
 */
app.get('/api/qrcodes/:shortCode', (req, res) => {
    const { shortCode } = req.params;

    // SECURITY: Validate shortCode format (alphanumeric, 2-8 chars to support prefixed codes)
    if (!/^[A-Za-z0-9]{1,8}$/.test(shortCode)) {
        return res.status(400).json({ error: 'Invalid short code format' });
    }

    if (!qrMappings.has(shortCode)) {
        return res.status(404).json({
            error: 'Short code not found',
            shortCode
        });
    }

    const data = qrMappings.get(shortCode);
    res.json({
        success: true,
        shortCode,
        status: data.status || 'assigned',
        containerId: data.containerId,
        barcodeData: data.barcodeData,
        createdAt: data.createdAt,
        assignedAt: data.assignedAt,
        qrImageDataUrl: data.qrImageDataUrl
    });
});

/**
 * Get all QR code mappings (development only — disabled in production)
 * GET /api/qrcodes
 */
app.get('/api/qrcodes', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'This endpoint is disabled in production' });
    }
    const mappings = Array.from(qrMappings.entries()).map(([shortCode, data]) => ({
        shortCode,
        ...data
    }));
    res.json({
        count: mappings.length,
        mappings
    });
});

/**
 * Send email with PDF attachment via Microsoft Graph API
 * POST /api/email/send
 * 
 * Body:
 * - accessToken: Microsoft Graph access token from frontend
 * - recipients: Array of email addresses
 * - subject: Email subject
 * - body: Email body (HTML)
 * - pdfData: Base64 encoded PDF data
 * - pdfFilename: Name for the PDF attachment
 * 
 * SECURITY: Validates all inputs to prevent injection attacks
 */
app.post('/api/email/send', async (req, res) => {
    try {
        const { accessToken, recipients, subject, body, pdfData, pdfFilename } = req.body;

        // Validate required fields
        if (!accessToken || !recipients || !recipients.length || !pdfData) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['accessToken', 'recipients', 'pdfData']
            });
        }
        
        // SECURITY: Validate email addresses format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = recipients.filter(email => !emailRegex.test(email.trim()));
        if (invalidEmails.length > 0) {
            return res.status(400).json({
                error: 'Invalid email addresses',
                invalid: invalidEmails
            });
        }
        
        // SECURITY: Limit number of recipients to prevent abuse
        if (recipients.length > 10) {
            return res.status(400).json({
                error: 'Too many recipients',
                message: 'Maximum 10 recipients allowed per email'
            });
        }
        
        // SECURITY: Sanitize subject line (prevent header injection)
        const sanitizedSubject = (subject || 'LoneWolf Biotech - Intake Form Submission')
            .replace(/[\r\n]/g, '') // Remove newlines
            .substring(0, 200); // Limit length
        
        // SECURITY: Validate filename to prevent path traversal
        const sanitizedFilename = (pdfFilename || 'intake_form.pdf')
            .replace(/[^a-zA-Z0-9._-]/g, '_') // Only allow safe characters
            .substring(0, 100); // Limit length

        // Initialize Graph client with access token
        const client = Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            }
        });

        // Prepare email message with sanitized inputs
        const message = {
            subject: sanitizedSubject,
            body: {
                contentType: 'HTML',
                // SECURITY: Body content is passed as-is since Graph API handles HTML safely
                // Additional sanitization could be added here if needed
                content: body || '<p>Please find the intake form attached.</p>'
            },
            toRecipients: recipients.map(email => ({
                emailAddress: { address: email.trim() }
            })),
            attachments: [
                {
                    '@odata.type': '#microsoft.graph.fileAttachment',
                    name: sanitizedFilename,
                    contentType: 'application/pdf',
                    contentBytes: pdfData.split(',')[1] || pdfData // Remove data:application/pdf;base64, if present
                }
            ]
        };

        // Send email via Microsoft Graph
        await client.api('/me/sendMail').post({
            message: message,
            saveToSentItems: true
        });

        res.json({ 
            success: true, 
            message: 'Email sent successfully',
            recipientCount: recipients.length
        });

    } catch (error) {
        console.error('Error sending email:', error);
        const emailError = { error: 'Failed to send email' };
        if (process.env.NODE_ENV !== 'production') {
            emailError.message = error.message;
        }
        res.status(500).json(emailError);
    }
});

/**
 * Validate email addresses
 * POST /api/email/validate
 */
app.post('/api/email/validate', (req, res) => {
    const { emails } = req.body;
    
    if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const results = emails.map(email => ({
        email: email.trim(),
        valid: emailRegex.test(email.trim())
    }));

    res.json({ results });
});

/**
 * Get default email recipients
 * GET /api/email/recipients
 */
app.get('/api/email/recipients', (req, res) => {
    res.json({
        default: ['pozersky@lonewolfgenetics.com'],
        suggestions: [
            'pozersky@lonewolfgenetics.com',
            // Add more team members as needed
        ]
    });
});

/**
 * Print ZPL to Zebra printer
 * POST /api/print/zpl
 *
 * Body:
 * - zpl: ZPL string to send to printer
 * - copies: Number of copies (default 1)
 * - printerIp: Optional printer IP (default from env ZEBRA_PRINTER_IP)
 * - printerPort: Optional port (default 9100)
 *
 * The printer can be configured via environment variables:
 *   ZEBRA_PRINTER_IP=192.168.1.100
 *   ZEBRA_PRINTER_PORT=9100
 */
const net = require('net');

app.post('/api/print/zpl', async (req, res) => {
    try {
        const {
            zpl,
            copies = 1,
            printerIp = process.env.ZEBRA_PRINTER_IP,
            printerPort = parseInt(process.env.ZEBRA_PRINTER_PORT) || 9100
        } = req.body;

        if (!zpl || typeof zpl !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid ZPL data' });
        }

        // Validate ZPL size (prevent abuse - 1MB max)
        if (zpl.length > 1024 * 1024) {
            return res.status(400).json({ error: 'ZPL data too large (max 1MB)' });
        }

        // Validate copies
        const numCopies = Math.min(Math.max(1, parseInt(copies) || 1), 50);

        if (!printerIp) {
            return res.status(400).json({
                error: 'Printer IP not configured',
                message: 'Set ZEBRA_PRINTER_IP environment variable or pass printerIp in request body'
            });
        }

        // SECURITY: Validate printer IP format to prevent SSRF
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(printerIp)) {
            return res.status(400).json({ error: 'Invalid printer IP format' });
        }

        // Repeat ZPL for copies
        let fullZPL = zpl;
        if (numCopies > 1) {
            fullZPL = zpl.repeat(numCopies);
        }

        // Send ZPL to printer via raw TCP socket
        await new Promise((resolve, reject) => {
            const client = new net.Socket();
            client.setTimeout(5000);

            client.connect(printerPort, printerIp, () => {
                client.write(fullZPL, () => {
                    client.end();
                });
            });

            client.on('close', () => resolve());
            client.on('error', (err) => reject(err));
            client.on('timeout', () => {
                client.destroy();
                reject(new Error('Connection to printer timed out'));
            });
        });

        res.json({
            success: true,
            message: `Sent ${numCopies} label(s) to printer at ${printerIp}:${printerPort}`
        });

    } catch (error) {
        console.error('Print error:', error);
        res.status(500).json({
            error: 'Failed to print',
            message: error.message
        });
    }
});

// ============================================================
// Container Details API (Graph API proxy for scan page)
// ============================================================

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
}

/**
 * Query HQ workbook for the highest numeric Container_ID.
 * Requires a valid Azure AD Bearer token with Graph API permissions.
 * Returns 0 if workbook is empty/inaccessible.
 */
async function queryHQMaxContainerId(token) {
    const spUrl = process.env.SHAREPOINT_WORKBOOK_URL || '';
    if (!spUrl || !token) return 0;

    const sourcedocMatch = spUrl.match(/sourcedoc=%7B([^%}]+)%7D/i) || spUrl.match(/sourcedoc=\{([^}]+)\}/i);
    const personalMatch = spUrl.match(/personal\/([^/]+)/);
    if (!sourcedocMatch || !personalMatch) return 0;

    const itemId = sourcedocMatch[1];
    const driveUser = personalMatch[1].replace(/_/g, '.').replace(/\.lonewolfgenetics\.com$/, '@lonewolfgenetics.com');
    const graphBase = 'https://graph.microsoft.com/v1.0';
    const sheetName = 'Active_Inventory';
    const rangeUrl = `${graphBase}/users/${encodeURIComponent(driveUser)}/drive/items/${itemId}/workbook/worksheets('${sheetName}')/usedRange(valuesOnly=true)`;

    const graphRes = await fetch(rangeUrl, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    if (!graphRes.ok) {
        console.warn(`⚠️ Graph API returned ${graphRes.status} querying Active_Inventory`);
        return 0;
    }

    const rangeData = await graphRes.json();
    const rows = rangeData.values || [];
    if (rows.length < 2) return 0;

    const headers = rows[0].map(h => String(h || '').trim().toLowerCase().replace(/[_\s]/g, ''));
    const cidCol = headers.findIndex(h => h === 'containerid');
    if (cidCol === -1) return 0;

    let max = 0;
    for (let i = 1; i < rows.length; i++) {
        const val = parseInt(String(rows[i][cidCol] || ''), 10);
        if (!isNaN(val) && val > max) max = val;
    }
    return max;
}

/**
 * Get highest numeric Container_ID from in-memory mappings (session-local fallback)
 */
function getMaxContainerIdLocal() {
    let max = 0;
    for (const [code, data] of qrMappings) {
        // Check assigned container IDs
        if (data.containerId) {
            const num = parseInt(data.containerId, 10);
            if (!isNaN(num) && num > max) max = num;
        }
        // Check numeric short codes
        const codeNum = parseInt(code, 10);
        if (!isNaN(codeNum) && codeNum > max) max = codeNum;
    }
    return max;
}

/**
 * GET /api/qrcodes/next-id
 * Returns the next available container ID based on HQ workbook data.
 * Requires Bearer token for Graph API access.
 */
app.get('/api/qrcodes/next-id', async (req, res) => {
    try {
        const token = extractBearerToken(req);
        let hqMax = 0;
        
        if (token) {
            try {
                hqMax = await queryHQMaxContainerId(token);
            } catch (err) {
                console.warn('⚠️ HQ workbook query failed:', err.message);
            }
        }
        
        const localMax = getMaxContainerIdLocal();
        const nextId = Math.max(hqMax, localMax) + 1;
        
        res.json({ success: true, nextId, hqMax, localMax });
    } catch (error) {
        console.error('Next ID error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/container/:containerId/details
 * Proxy: uses caller's access token to read Active_Inventory from HQ workbook
 */
app.get('/api/container/:containerId/details', async (req, res) => {
    try {
        const token = extractBearerToken(req);
        if (!token) return res.status(401).json({ error: 'Bearer token required' });

        const { containerId } = req.params;
        if (!containerId || containerId.length > 200) {
            return res.status(400).json({ error: 'Invalid containerId' });
        }

        // Parse workbook info from SHAREPOINT_WORKBOOK_URL
        // We need the driveItem id from the sourcedoc param
        const spUrl = process.env.SHAREPOINT_WORKBOOK_URL || '';
        const sourcedocMatch = spUrl.match(/sourcedoc=%7B([^%}]+)%7D/i) || spUrl.match(/sourcedoc=\{([^}]+)\}/i);
        if (!sourcedocMatch) {
            return res.status(500).json({ error: 'SHAREPOINT_WORKBOOK_URL not configured properly' });
        }
        const itemId = sourcedocMatch[1];

        // Determine drive path — the URL contains the user's OneDrive path
        const personalMatch = spUrl.match(/personal\/([^/]+)/);
        if (!personalMatch) {
            return res.status(500).json({ error: 'Cannot parse SharePoint user from URL' });
        }
        const driveUser = personalMatch[1].replace(/_/g, '.').replace(/\.lonewolfgenetics\.com$/, '@lonewolfgenetics.com');

        // Use Graph API to read the worksheet
        const graphBase = `https://graph.microsoft.com/v1.0`;
        // Try using the shared item approach via driveItem id
        // First get the used range of Active_Inventory sheet
        const sheetName = 'Active_Inventory';
        
        // Use sites/drives approach - call with user's token
        // For personal OneDrive files, use /users/{email}/drive/items/{id}
        const rangeUrl = `${graphBase}/users/${encodeURIComponent(driveUser)}/drive/items/${itemId}/workbook/worksheets('${sheetName}')/usedRange`;

        const graphRes = await fetch(rangeUrl, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        if (!graphRes.ok) {
            const errText = await graphRes.text();
            console.error('Graph API error:', graphRes.status, errText);
            return res.status(graphRes.status === 401 ? 401 : 502).json({
                error: graphRes.status === 401 ? 'Token expired or insufficient permissions' : 'Failed to read workbook',
                details: process.env.NODE_ENV !== 'production' ? errText : undefined
            });
        }

        const rangeData = await graphRes.json();
        const rows = rangeData.values || [];
        if (rows.length < 2) {
            return res.status(404).json({ error: 'No data in worksheet' });
        }

        // First row is headers
        const headers = rows[0].map(h => String(h || '').trim());
        const containerIdCol = headers.findIndex(h => h.toLowerCase().replace(/[_\s]/g, '') === 'containerid');
        if (containerIdCol === -1) {
            return res.status(500).json({ error: 'Container_ID column not found in worksheet' });
        }

        // Find matching row
        const matchIdx = rows.findIndex((row, i) => i > 0 && String(row[containerIdCol] || '').trim() === containerId);
        if (matchIdx === -1) {
            return res.status(404).json({ error: 'Container not found in workbook' });
        }

        // Build object from headers + row
        const rowData = {};
        headers.forEach((h, i) => {
            if (h) rowData[h] = rows[matchIdx][i] != null ? String(rows[matchIdx][i]) : '';
        });

        res.json({ success: true, data: rowData, rowIndex: matchIdx });
    } catch (error) {
        console.error('Container details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/container/:containerId
 * Admin-only: update fields in the HQ workbook
 */
app.put('/api/container/:containerId', async (req, res) => {
    try {
        const token = extractBearerToken(req);
        if (!token) return res.status(401).json({ error: 'Bearer token required' });

        const { containerId } = req.params;
        const updates = req.body;
        if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        // Allowed editable fields
        const editableFields = ['Location', 'Stage', 'Notes', 'Contamination_Status'];
        const invalidFields = Object.keys(updates).filter(k => !editableFields.includes(k));
        if (invalidFields.length > 0) {
            return res.status(400).json({ error: `Non-editable fields: ${invalidFields.join(', ')}` });
        }

        // Check admin status via /me
        const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!meRes.ok) return res.status(401).json({ error: 'Invalid token' });
        const meData = await meRes.json();
        const userEmail = (meData.mail || meData.userPrincipalName || '').toLowerCase();

        const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        if (!adminEmails.includes(userEmail)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Parse workbook info
        const spUrl = process.env.SHAREPOINT_WORKBOOK_URL || '';
        const sourcedocMatch = spUrl.match(/sourcedoc=%7B([^%}]+)%7D/i) || spUrl.match(/sourcedoc=\{([^}]+)\}/i);
        const personalMatch = spUrl.match(/personal\/([^/]+)/);
        if (!sourcedocMatch || !personalMatch) {
            return res.status(500).json({ error: 'SHAREPOINT_WORKBOOK_URL not configured' });
        }
        const itemId = sourcedocMatch[1];
        const driveUser = personalMatch[1].replace(/_/g, '.').replace(/\.lonewolfgenetics\.com$/, '@lonewolfgenetics.com');

        const graphBase = 'https://graph.microsoft.com/v1.0';
        const sheetName = 'Active_Inventory';

        // Read current data to find row and column indices
        const rangeUrl = `${graphBase}/users/${encodeURIComponent(driveUser)}/drive/items/${itemId}/workbook/worksheets('${sheetName}')/usedRange`;
        const rangeRes = await fetch(rangeUrl, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (!rangeRes.ok) {
            return res.status(502).json({ error: 'Failed to read workbook' });
        }

        const rangeData = await rangeRes.json();
        const rows = rangeData.values || [];
        const headers = rows[0].map(h => String(h || '').trim());
        const containerIdCol = headers.findIndex(h => h.toLowerCase().replace(/[_\s]/g, '') === 'containerid');
        if (containerIdCol === -1) return res.status(500).json({ error: 'Container_ID column not found' });

        const matchIdx = rows.findIndex((row, i) => i > 0 && String(row[containerIdCol] || '').trim() === containerId);
        if (matchIdx === -1) return res.status(404).json({ error: 'Container not found' });

        // Update each field individually via cell address
        const startAddress = rangeData.address || '';
        // address is like 'Active_Inventory!A1:Z100' — extract the sheet reference
        for (const [field, value] of Object.entries(updates)) {
            const colIdx = headers.indexOf(field);
            if (colIdx === -1) continue;

            // Convert column index to letter (A, B, ..., Z, AA, ...)
            const colLetter = colIdx < 26 ? String.fromCharCode(65 + colIdx) : 'A' + String.fromCharCode(65 + colIdx - 26);
            const cellAddress = `${colLetter}${matchIdx + 1}`; // +1 because Excel is 1-indexed

            const cellUrl = `${graphBase}/users/${encodeURIComponent(driveUser)}/drive/items/${itemId}/workbook/worksheets('${sheetName}')/range(address='${cellAddress}')`;
            const cellRes = await fetch(cellUrl, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [[String(value)]] })
            });
            if (!cellRes.ok) {
                const errText = await cellRes.text();
                console.error(`Failed to update ${field} at ${cellAddress}:`, errText);
            }
        }

        // Also update Date_Modified if it exists
        const dateModCol = headers.findIndex(h => h.toLowerCase().replace(/[_\s]/g, '') === 'datemodified');
        if (dateModCol !== -1) {
            const colLetter = dateModCol < 26 ? String.fromCharCode(65 + dateModCol) : 'A' + String.fromCharCode(65 + dateModCol - 26);
            const cellUrl = `${graphBase}/users/${encodeURIComponent(driveUser)}/drive/items/${itemId}/workbook/worksheets('${sheetName}')/range(address='${colLetter}${matchIdx + 1}')`;
            await fetch(cellUrl, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [[new Date().toISOString().split('T')[0]]] })
            }).catch(() => {});
        }

        // Return updated data
        const rowData = {};
        headers.forEach((h, i) => {
            if (h) rowData[h] = rows[matchIdx][i] != null ? String(rows[matchIdx][i]) : '';
        });
        // Apply the updates to the response
        Object.assign(rowData, updates);
        if (dateModCol !== -1) rowData[headers[dateModCol]] = new Date().toISOString().split('T')[0];

        res.json({ success: true, data: rowData, updatedBy: userEmail });
    } catch (error) {
        console.error('Container update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    const response = { error: 'Internal server error' };
    // SECURITY: Only expose error details in development
    if (process.env.NODE_ENV !== 'production') {
        response.message = err.message;
    }
    res.status(500).json(response);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Scanner Backend running on http://localhost:${PORT}`);
    console.log(`📧 Email API available at http://localhost:${PORT}/api/email/send`);
    console.log(`📱 QR Code API available at http://localhost:${PORT}/api/qrcodes`);
    console.log(`💚 Health check at http://localhost:${PORT}/health`);
});

module.exports = app;
