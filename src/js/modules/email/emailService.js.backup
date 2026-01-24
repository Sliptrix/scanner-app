/**
 * Email Service
 * Handles sending intake form PDFs via backend API
 */

window.EmailService = {
    backendUrl: 'http://localhost:3001', // Backend server URL
    
    /**
     * Send intake form PDF via email
     * @param {Object} formData - Intake form data
     * @param {Array} recipients - Array of email addresses
     * @returns {Promise<Object>} - Response from backend
     */
    async sendIntakeForm(formData, recipients) {
        try {
            // Validate inputs
            if (!formData) {
                throw new Error('Form data is required');
            }
            
            if (!recipients || recipients.length === 0) {
                throw new Error('At least one recipient is required');
            }
            
            // Check if user is authenticated
            if (!AuthManager.isSignedIn()) {
                throw new Error('You must be signed in to send emails');
            }
            
            // Get access token
            const accessToken = await AuthManager.getAccessToken();
            
            // Generate PDF as base64
            const pdfData = await this.generatePDFBase64(formData);
            
            // Prepare email subject and body
            const subject = `LoneWolf Biotech - Intake Form: ${formData.strainName}`;
            const body = this.generateEmailBody(formData);
            const filename = `intake_${formData.strainID}_${new Date().toISOString().split('T')[0]}.pdf`;
            
            // Send request to backend
            const response = await fetch(`${this.backendUrl}/api/email/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accessToken: accessToken,
                    recipients: recipients,
                    subject: subject,
                    body: body,
                    pdfData: pdfData,
                    pdfFilename: filename
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to send email');
            }
            
            const result = await response.json();
            console.log('Email sent successfully:', result);
            
            return result;
            
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    },
    
    /**
     * Generate PDF as base64 string
     * @param {Object} formData - Intake form data
     * @returns {Promise<string>} - Base64 encoded PDF
     */
    async generatePDFBase64(formData) {
        try {
            // Use existing PDF generator
            if (!window.IntakePDFGenerator) {
                throw new Error('PDF generator not available');
            }
            
            // Generate PDF and get as base64
            const pdfBase64 = await IntakePDFGenerator.generateBase64(formData);
            return pdfBase64;
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw error;
        }
    },
    
    /**
     * Generate email body HTML
     * @param {Object} formData - Intake form data
     * @returns {string} - HTML email body
     */
    generateEmailBody(formData) {
        const user = AuthManager.getCurrentUser();
        const userName = user ? user.name : 'User';
        
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                    LoneWolf Biotech - Intake Form Submission
                </h2>
                
                <p>Hello,</p>
                
                <p>${userName} has submitted a new intake form. Please find the details attached.</p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #495057;">Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #6c757d;"><strong>Customer:</strong></td>
                            <td style="padding: 8px 0;">${formData.customerName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6c757d;"><strong>Strain Name:</strong></td>
                            <td style="padding: 8px 0;">${formData.strainName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6c757d;"><strong>Strain ID:</strong></td>
                            <td style="padding: 8px 0;">${formData.strainID}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6c757d;"><strong>Owner ID:</strong></td>
                            <td style="padding: 8px 0;">${formData.ownerID}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6c757d;"><strong>Services:</strong></td>
                            <td style="padding: 8px 0;">${formData.services.join(', ')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6c757d;"><strong>Genetics:</strong></td>
                            <td style="padding: 8px 0;">${formData.genetics}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6c757d;"><strong>Submitted:</strong></td>
                            <td style="padding: 8px 0;">${new Date(formData.timestamp).toLocaleString()}</td>
                        </tr>
                    </table>
                </div>
                
                <p>The complete intake form is attached as a PDF.</p>
                
                <p style="color: #6c757d; font-size: 0.9rem; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 15px;">
                    This email was sent via the LoneWolf Biotech Scanner System<br>
                    Submitted by: ${user ? user.email : 'Unknown'}
                </p>
            </div>
        `;
    },
    
    /**
     * Validate email addresses
     * @param {Array} emails - Array of email addresses to validate
     * @returns {Promise<Object>} - Validation results
     */
    async validateEmails(emails) {
        try {
            const response = await fetch(`${this.backendUrl}/api/email/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ emails })
            });
            
            if (!response.ok) {
                throw new Error('Failed to validate emails');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Error validating emails:', error);
            throw error;
        }
    },
    
    /**
     * Get default recipients
     * @returns {Promise<Object>} - Default and suggested recipients
     */
    async getDefaultRecipients() {
        try {
            const response = await fetch(`${this.backendUrl}/api/email/recipients`);
            
            if (!response.ok) {
                // Return fallback if backend is not available
                return {
                    default: ['pozersky@lonewolfgenetics.com'],
                    suggestions: ['pozersky@lonewolfgenetics.com']
                };
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Error fetching recipients:', error);
            // Return fallback
            return {
                default: ['pozersky@lonewolfgenetics.com'],
                suggestions: ['pozersky@lonewolfgenetics.com']
            };
        }
    }
};
