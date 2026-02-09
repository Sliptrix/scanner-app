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

// Persistent QR code mappings (short code -> barcode data)
const QR_DATA_DIR = path.join(__dirname, 'data');
const QR_DATA_FILE = path.join(QR_DATA_DIR, 'qr-mappings.json');
const qrMappings = new Map();

// Load QR mappings from disk on startup
function loadQRMappings() {
    try {
        if (!fs.existsSync(QR_DATA_DIR)) {
            fs.mkdirSync(QR_DATA_DIR, { recursive: true });
        }
        if (fs.existsSync(QR_DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(QR_DATA_FILE, 'utf8'));
            for (const [key, value] of Object.entries(data)) {
                qrMappings.set(key, value);
            }
            console.log(`📂 Loaded ${qrMappings.size} QR mappings from disk`);
        }
    } catch (err) {
        console.error('Failed to load QR mappings:', err.message);
    }
}

// Save QR mappings to disk
function saveQRMappings() {
    try {
        if (!fs.existsSync(QR_DATA_DIR)) {
            fs.mkdirSync(QR_DATA_DIR, { recursive: true });
        }
        const obj = Object.fromEntries(qrMappings);
        fs.writeFileSync(QR_DATA_FILE, JSON.stringify(obj, null, 2));
    } catch (err) {
        console.error('Failed to save QR mappings:', err.message);
    }
}

loadQRMappings();

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

        // Use custom destination URL (e.g. Excel deep link) if provided,
        // otherwise fall back to scan page URL
        const destinationUrl = customDestUrl || `${baseUrl}/s/${shortCode}`;

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

/**
 * Scan page — renders container metadata as a nice HTML page
 * This is the URL encoded in pre-printed QR codes on physical containers.
 * GET /s/:shortCode
 */
app.get('/s/:shortCode', (req, res) => {
    const { shortCode } = req.params;

    if (!/^[A-Za-z0-9]{6}$/.test(shortCode)) {
        return res.status(400).send(renderScanPage(null, 'Invalid QR code'));
    }

    if (!qrMappings.has(shortCode)) {
        return res.status(404).send(renderScanPage(null, 'Container not found. This QR code may not be registered yet.'));
    }

    const data = qrMappings.get(shortCode);
    res.send(renderScanPage(data));
});

/**
 * Render a mobile-friendly HTML page for scanned containers
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
  <p>${error}</p>
  <div class="brand">🐺 LoneWolf Biotech Lab Tracker</div>
</div>
</body></html>`;
    }

    // Parse barcode data to extract fields
    const fields = parseBarcodeData(data.barcodeData);

    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Container ${data.containerId} — LoneWolf Biotech</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 50%,#f0f9ff 100%);min-height:100vh;padding:20px}
  .container{max-width:480px;margin:0 auto}
  .header{text-align:center;margin-bottom:20px;padding:24px 0}
  .header .icon{font-size:2.5rem;margin-bottom:8px}
  .header h1{font-size:1.4rem;color:#166534;font-weight:700}
  .header .id{font-size:2rem;color:#059669;font-weight:800;letter-spacing:1px;margin-top:4px}
  .card{background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #e2e8f0}
  .card h2{font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:16px;font-weight:600}
  .field{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9}
  .field:last-child{border-bottom:none}
  .field-label{font-size:0.9rem;color:#64748b;font-weight:500}
  .field-value{font-size:0.95rem;color:#1e293b;font-weight:600;text-align:right;max-width:60%}
  .stage-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:0.85rem;font-weight:600}
  .stage-initiation{background:#dbeafe;color:#1e40af}
  .stage-multiplication{background:#dcfce7;color:#166534}
  .stage-rooting{background:#fef3c7;color:#92400e}
  .stage-hardening{background:#fce7f3;color:#9d174d}
  .stage-stock{background:#e0e7ff;color:#3730a3}
  .raw{background:#f8fafc;border-radius:12px;padding:16px;margin-top:8px}
  .raw-label{font-size:0.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .raw-value{font-family:'SF Mono',Monaco,Consolas,monospace;font-size:0.8rem;color:#475569;word-break:break-all;line-height:1.5}
  .brand{text-align:center;margin-top:24px;padding:16px 0;font-size:0.8rem;color:#94a3b8}
  .brand strong{color:#166534}
  .timestamp{text-align:center;font-size:0.75rem;color:#cbd5e1;margin-top:8px}
</style>
</head><body>
<div class="container">
  <div class="header">
    <div class="icon">🧬</div>
    <h1>Container Specimen</h1>
    <div class="id">#${escapeHtml(data.containerId)}</div>
  </div>

  <div class="card">
    <h2>Specimen Details</h2>
    ${fields.map(f => `<div class="field">
      <span class="field-label">${f.label}</span>
      <span class="field-value${f.badgeClass ? ' stage-badge ' + f.badgeClass : ''}">${escapeHtml(f.value)}</span>
    </div>`).join('\n    ')}
  </div>

  <div class="card">
    <div class="raw">
      <div class="raw-label">Barcode Data</div>
      <div class="raw-value">${escapeHtml(data.barcodeData)}</div>
    </div>
  </div>

  <div class="brand">🐺 <strong>LoneWolf Biotech</strong> Lab Tracker</div>
  <div class="timestamp">Registered ${data.createdAt ? new Date(data.createdAt).toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'}) : 'N/A'}</div>
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

    // SECURITY: Validate shortCode format (alphanumeric, 6 chars)
    if (!/^[A-Za-z0-9]{6}$/.test(shortCode)) {
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
        containerId: data.containerId,
        barcodeData: data.barcodeData,
        createdAt: data.createdAt
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
