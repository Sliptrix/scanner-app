/**
 * Bulk Upload Parser
 * Handles parsing of .txt, .csv, and .xlsx files for bulk intake
 */

window.BulkUploadParser = {
    parsedData: [],
    
    /**
     * Parse uploaded file based on type
     */
    async parseFile(file) {
        const fileType = file.name.split('.').pop().toLowerCase();
        
        try {
            switch (fileType) {
                case 'txt':
                    return await this.parseTxtFile(file);
                case 'csv':
                    return await this.parseCsvFile(file);
                case 'xlsx':
                case 'xls':
                    return await this.parseExcelFile(file);
                default:
                    throw new Error('Unsupported file type');
            }
        } catch (error) {
            console.error('Error parsing file:', error);
            throw error;
        }
    },
    
    /**
     * Parse TXT file
     * Expected format: CustomerName | StrainName
     * Or simple list: one strain per line (uses "Unknown Customer")
     */
    async parseTxtFile(file) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        const entries = [];
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            
            let customerName, strainName;
            
            if (trimmed.includes('|')) {
                // Format: CustomerName | StrainName
                const parts = trimmed.split('|').map(p => p.trim());
                customerName = parts[0] || '';
                strainName = parts[1] || '';
            } else {
                // Simple list: just strain names
                customerName = 'Unknown Customer';
                strainName = trimmed;
            }
            
            if (strainName) {
                entries.push({
                    rowNumber: index + 1,
                    customerName,
                    strainName,
                    address: '',
                    poNumber: '',
                    services: [],
                    genetics: 'Proprietary',
                    errors: []
                });
            }
        });
        
        return entries;
    },
    
    /**
     * Parse CSV file
     * Expected columns: Customer Name, Strain Name, Address, PO#, Services, Genetics
     */
    async parseCsvFile(file) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
            throw new Error('File is empty');
        }
        
        // Parse header
        const header = this.parseCsvLine(lines[0]);
        const entries = [];
        
        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCsvLine(lines[i]);
            if (values.length === 0 || !values.some(v => v.trim())) continue;
            
            const entry = {
                rowNumber: i + 1,
                customerName: values[0] || '',
                strainName: values[1] || '',
                address: values[2] || '',
                poNumber: values[3] || '',
                services: values[4] ? values[4].split(';').map(s => s.trim()) : [],
                genetics: values[5] || 'Proprietary',
                errors: []
            };
            
            // Validate
            if (!entry.customerName) entry.errors.push('Missing customer name');
            if (!entry.strainName) entry.errors.push('Missing strain name');
            
            entries.push(entry);
        }
        
        return entries;
    },
    
    /**
     * Parse Excel file
     * Expected columns: Customer Name, Strain Name, Address, PO#, Services, Genetics
     */
    async parseExcelFile(file) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Read first sheet
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    
                    if (jsonData.length === 0) {
                        reject(new Error('Sheet is empty'));
                        return;
                    }
                    
                    const entries = [];
                    
                    // Skip header row, parse data rows
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || row.length === 0) continue;
                        
                        const entry = {
                            rowNumber: i + 1,
                            customerName: row[0] ? String(row[0]).trim() : '',
                            strainName: row[1] ? String(row[1]).trim() : '',
                            address: row[2] ? String(row[2]).trim() : '',
                            poNumber: row[3] ? String(row[3]).trim() : '',
                            services: row[4] ? String(row[4]).split(';').map(s => s.trim()) : [],
                            genetics: row[5] ? String(row[5]).trim() : 'Proprietary',
                            errors: []
                        };
                        
                        // Validate
                        if (!entry.customerName) entry.errors.push('Missing customer name');
                        if (!entry.strainName) entry.errors.push('Missing strain name');
                        
                        entries.push(entry);
                    }
                    
                    resolve(entries);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    },
    
    /**
     * Parse CSV line handling quoted values
     */
    parseCsvLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values;
    },
    
    /**
     * Generate preview table HTML
     */
    generatePreviewTable(entries) {
        if (entries.length === 0) {
            return '<p style="padding: 20px; text-align: center; color: #6c757d;">No valid entries found</p>';
        }
        
        let html = '<table class="inventory-table" style="width: 100%;">';
        html += '<thead><tr>';
        html += '<th>Row</th>';
        html += '<th>Customer</th>';
        html += '<th>Strain</th>';
        html += '<th>Address</th>';
        html += '<th>PO#</th>';
        html += '<th>Services</th>';
        html += '<th>Genetics</th>';
        html += '<th>Status</th>';
        html += '</tr></thead>';
        html += '<tbody>';
        
        entries.forEach(entry => {
            const hasErrors = entry.errors.length > 0;
            const rowClass = hasErrors ? 'style="background: #ffebee;"' : '';
            
            html += `<tr ${rowClass}>`;
            html += `<td>${entry.rowNumber}</td>`;
            html += `<td>${entry.customerName || '<em>Missing</em>'}</td>`;
            html += `<td>${entry.strainName || '<em>Missing</em>'}</td>`;
            html += `<td>${entry.address || '-'}</td>`;
            html += `<td>${entry.poNumber || '-'}</td>`;
            html += `<td>${entry.services.length > 0 ? entry.services.join(', ') : '-'}</td>`;
            html += `<td>${entry.genetics}</td>`;
            html += `<td>${hasErrors ? '❌ ' + entry.errors.join(', ') : '✅ Valid'}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        
        // Add summary
        const validCount = entries.filter(e => e.errors.length === 0).length;
        const errorCount = entries.length - validCount;
        
        html += `<div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 6px;">`;
        html += `<strong>Summary:</strong> ${entries.length} total entries | `;
        html += `<span style="color: #28a745;">${validCount} valid</span>`;
        if (errorCount > 0) {
            html += ` | <span style="color: #dc3545;">${errorCount} with errors</span>`;
        }
        html += `</div>`;
        
        return html;
    }
};
