/**
 * Scanner Backend Server
 * Handles email sending via Microsoft Graph API
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Client } = require('@microsoft/microsoft-graph-client');
const QRCode = require('qrcode');
require('isomorphic-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory storage for QR code mappings (short code -> barcode data)
// In production, this should be a database
const qrMappings = new Map();

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

// SECURITY: Add security headers
app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Enable XSS filter in older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

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
 * Generate a short code (6 characters, alphanumeric, similar to qrco.de style)
 */
function generateShortCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Check if code already exists, regenerate if it does
    if (qrMappings.has(code)) {
        return generateShortCode();
    }
    return code;
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
        const { containerId, barcodeData, appUrl = 'http://localhost:8000', destinationUrl: customDestUrl } = req.body;

        if (!containerId || !barcodeData) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['containerId', 'barcodeData']
            });
        }

        // Generate a short code
        const shortCode = generateShortCode();

        // Store the mapping
        qrMappings.set(shortCode, {
            containerId,
            barcodeData,
            createdAt: new Date().toISOString()
        });

        // Use custom destination URL (e.g. Excel deep link) if provided,
        // otherwise fall back to app URL with short code
        const destinationUrl = customDestUrl || `${appUrl}?c=${shortCode}`;

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
 * Lookup a short code to get container information
 * GET /api/qrcodes/:shortCode
 */
app.get('/api/qrcodes/:shortCode', (req, res) => {
    const { shortCode } = req.params;

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
 * Get all QR code mappings (for debugging)
 * GET /api/qrcodes
 */
app.get('/api/qrcodes', (req, res) => {
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
        res.status(500).json({ 
            error: 'Failed to send email',
            message: error.message,
            details: error.toString()
        });
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

        if (!zpl) {
            return res.status(400).json({ error: 'Missing ZPL data' });
        }

        if (!printerIp) {
            return res.status(400).json({
                error: 'Printer IP not configured',
                message: 'Set ZEBRA_PRINTER_IP environment variable or pass printerIp in request body'
            });
        }

        // Repeat ZPL for copies
        let fullZPL = zpl;
        if (copies > 1) {
            fullZPL = zpl.repeat(copies);
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
            message: `Sent ${copies} label(s) to printer at ${printerIp}:${printerPort}`
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
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Scanner Backend running on http://localhost:${PORT}`);
    console.log(`📧 Email API available at http://localhost:${PORT}/api/email/send`);
    console.log(`📱 QR Code API available at http://localhost:${PORT}/api/qrcodes`);
    console.log(`💚 Health check at http://localhost:${PORT}/health`);
});

module.exports = app;
