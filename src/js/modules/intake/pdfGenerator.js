/**
 * PDF Generator for Intake Forms
 * Creates PDFs matching the LoneWolf Biotech Intake mockup
 */

window.IntakePDFGenerator = {
    /**
     * Generate PDF from intake data
     */
    generatePDF(data) {
        if (typeof jsPDF === 'undefined') {
            throw new Error('jsPDF library not loaded');
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Page setup
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        let yPos = margin;
        
        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('LoneWolf Biotech Intake Form', pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;
        
        // Add line
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;
        
        // Customer Type
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Customer Type:', margin, yPos);
        doc.setFont('helvetica', 'normal');
        
        // Checkboxes for customer type
        const boxSize = 4;
        const boxY = yPos - 3;
        
        // New checkbox
        doc.rect(margin + 80, boxY, boxSize, boxSize);
        if (data.customerType === 'New') {
            doc.text('X', margin + 81, yPos);
        }
        doc.text('New', margin + 88, yPos);
        
        // Existing checkbox
        doc.rect(margin + 110, boxY, boxSize, boxSize);
        if (data.customerType === 'Existing') {
            doc.text('X', margin + 111, yPos);
        }
        doc.text('Existing', margin + 118, yPos);
        yPos += 10;
        
        // Customer Information
        doc.setFont('helvetica', 'bold');
        doc.text('Customer:', margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(data.customerName || '', margin + 35, yPos);
        
        // PO Number on same line
        doc.setFont('helvetica', 'bold');
        doc.text('PO#:', pageWidth - margin - 60, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(data.poNumber || '', pageWidth - margin - 45, yPos);
        yPos += 8;
        
        // Address
        if (data.address) {
            doc.setFont('helvetica', 'bold');
            doc.text('Address:', margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(data.address, margin + 35, yPos);
            yPos += 8;
        }
        
        yPos += 5;
        
        // Strain Information
        doc.setFont('helvetica', 'bold');
        doc.text('Strain Name:', margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(data.strainName || '', margin + 40, yPos);
        yPos += 8;
        
        doc.setFont('helvetica', 'bold');
        doc.text('Owner ID:', margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(data.ownerID || '', margin + 35, yPos);
        
        doc.setFont('helvetica', 'bold');
        doc.text('Strain ID:', margin + 80, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(data.strainID || '', margin + 100, yPos);
        yPos += 15;
        
        // LoneWolf Services
        doc.setFont('helvetica', 'bold');
        doc.text('LoneWolf Services', margin, yPos);
        yPos += 8;
        
        doc.setFont('helvetica', 'normal');
        const services = ['Meristem', 'Nodal', 'VernBio testing', 'Sex testing', 'Sequencing', 'Other'];
        const servicesPerRow = 2;
        const colWidth = (pageWidth - 2 * margin) / servicesPerRow;
        
        services.forEach((service, index) => {
            const col = index % servicesPerRow;
            const row = Math.floor(index / servicesPerRow);
            const x = margin + col * colWidth;
            const y = yPos + row * 8;
            
            // Checkbox
            doc.rect(x, y - 3, boxSize, boxSize);
            
            // Check if this service is selected
            const isSelected = data.services.some(s => s.includes(service) || s === service);
            if (isSelected) {
                doc.text('X', x + 1, y);
            }
            
            // Service name
            doc.text(service, x + 8, y);
            
            // If VernBio and selected, show sub-options
            if (service === 'VernBio testing' && isSelected) {
                const vernBioService = data.services.find(s => s.includes('VernBio'));
                if (vernBioService) {
                    doc.setFontSize(10);
                    doc.text(`(${vernBioService.replace('VernBio testing - ', '')})`, x + 48, y);
                    doc.setFontSize(12);
                }
            }
            
            // If Other and selected, show description
            if (service === 'Other' && isSelected) {
                const otherService = data.services.find(s => s.startsWith('Other:'));
                if (otherService) {
                    doc.setFontSize(10);
                    doc.text(otherService.replace('Other:', '').trim(), x + 8, y + 5);
                    doc.setFontSize(12);
                }
            }
        });
        
        yPos += Math.ceil(services.length / servicesPerRow) * 8 + 10;
        
        // Genetics
        doc.setFont('helvetica', 'bold');
        doc.text('Genetics', margin, yPos);
        yPos += 8;
        
        doc.setFont('helvetica', 'normal');
        const geneticsOptions = ['Proprietary', 'LWB', 'House available'];
        geneticsOptions.forEach((option, index) => {
            const x = margin;
            const y = yPos + index * 8;
            
            // Checkbox
            doc.rect(x, y - 3, boxSize, boxSize);
            if (data.genetics === option) {
                doc.text('X', x + 1, y);
            }
            
            doc.text(option, x + 8, y);
        });
        
        yPos += geneticsOptions.length * 8 + 10;
        
        // Timestamp
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text(`Timestamp: ${new Date(data.timestamp).toLocaleString()}`, margin, pageHeight - margin);
        
        return doc;
    },
    
    /**
     * Download PDF
     */
    downloadPDF(data, filename) {
        try {
            const doc = this.generatePDF(data);
            doc.save(filename || `intake_${data.strainID}_${new Date().toISOString().split('T')[0]}.pdf`);
            return true;
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw error;
        }
    }
};
