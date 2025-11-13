/**
 * Scanner Backend Server
 * Handles email sending via Microsoft Graph API
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

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
    console.log(`💚 Health check at http://localhost:${PORT}/health`);
});

module.exports = app;
