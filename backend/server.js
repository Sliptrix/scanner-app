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

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
        const { containerId, barcodeData, appUrl = 'http://localhost:8000' } = req.body;

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

        // Create the destination URL (qrco.de style: appUrl/?c=shortCode)
        const destinationUrl = `${appUrl}?c=${shortCode}`;

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

        // Initialize Graph client with access token
        const client = Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            }
        });

        // Prepare email message
        const message = {
            subject: subject || 'LoneWolf Biotech - Intake Form Submission',
            body: {
                contentType: 'HTML',
                content: body || '<p>Please find the intake form attached.</p>'
            },
            toRecipients: recipients.map(email => ({
                emailAddress: { address: email.trim() }
            })),
            attachments: [
                {
                    '@odata.type': '#microsoft.graph.fileAttachment',
                    name: pdfFilename || 'intake_form.pdf',
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
