/**
 * Intake Form Manager
 * Handles form UI interactions and validation
 */

window.IntakeFormManager = {
    currentIntakeData: null,
    
    /**
     * Initialize the intake form
     */
    async init() {
        console.log('Initializing intake form...');
        
        // Load strain owner data
        await IntakeDataManager.loadStrainOwnerMapping();
        
        // Populate existing customers dropdown
        this.populateExistingCustomers();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Auto-generate initial IDs
        this.updateIDs();
        
        console.log('Intake form initialized');
    },
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Customer type toggle
        const newCustomerRadio = document.getElementById('newCustomerRadio');
        const existingCustomerRadio = document.getElementById('existingCustomerRadio');
        
        if (newCustomerRadio) {
            newCustomerRadio.addEventListener('change', () => this.toggleCustomerFields('new'));
        }
        if (existingCustomerRadio) {
            existingCustomerRadio.addEventListener('change', () => this.toggleCustomerFields('existing'));
        }
        
        // Customer name input - auto-generate owner ID
        const newCustomerName = document.getElementById('newCustomerName');
        const existingCustomerSelect = document.getElementById('existingCustomerSelect');
        
        if (newCustomerName) {
            newCustomerName.addEventListener('input', () => this.updateIDs());
        }
        if (existingCustomerSelect) {
            existingCustomerSelect.addEventListener('change', () => this.updateIDs());
        }
        
        // Service "Other" checkbox - show/hide text input
        const serviceOther = document.getElementById('serviceOther');
        if (serviceOther) {
            serviceOther.addEventListener('change', (e) => {
                const otherField = document.getElementById('serviceOtherField');
                if (otherField) {
                    otherField.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        }
        
        // VernBio testing checkbox - show/hide options
        const serviceVernBio = document.getElementById('serviceVernBio');
        if (serviceVernBio) {
            serviceVernBio.addEventListener('change', (e) => {
                const vernBioOptions = document.getElementById('vernBioOptions');
                if (vernBioOptions) {
                    vernBioOptions.style.display = e.target.checked ? 'block' : 'none';
                    // Uncheck radio buttons if unchecking VernBio
                    if (!e.target.checked) {
                        const hplv = document.getElementById('vernBioHpLv');
                        const fullSpectrum = document.getElementById('vernBioFullSpectrum');
                        if (hplv) hplv.checked = false;
                        if (fullSpectrum) fullSpectrum.checked = false;
                    }
                }
            });
        }
    },
    
    /**
     * Toggle between new and existing customer fields
     */
    toggleCustomerFields(type) {
        const newFields = document.getElementById('newCustomerFields');
        const existingFields = document.getElementById('existingCustomerFields');
        
        if (type === 'new') {
            if (newFields) newFields.style.display = 'block';
            if (existingFields) existingFields.style.display = 'none';
        } else {
            if (newFields) newFields.style.display = 'none';
            if (existingFields) existingFields.style.display = 'block';
        }
        
        this.updateIDs();
    },
    
    /**
     * Populate existing customers dropdown
     */
    populateExistingCustomers() {
        const select = document.getElementById('existingCustomerSelect');
        if (!select) return;
        
        const owners = IntakeDataManager.getUniqueOwners();
        
        // Clear existing options (except the first placeholder)
        select.innerHTML = '<option value="">-- Select Customer --</option>';
        
        // Add owner options
        owners.forEach(owner => {
            const option = document.createElement('option');
            option.value = owner;
            option.textContent = owner;
            select.appendChild(option);
        });
        
        console.log(`Populated ${owners.length} existing customers`);
    },
    
    /**
     * Update owner ID and strain ID fields
     */
    updateIDs() {
        const isNewCustomer = document.getElementById('newCustomerRadio')?.checked;
        const customerName = isNewCustomer 
            ? document.getElementById('newCustomerName')?.value 
            : document.getElementById('existingCustomerSelect')?.value;
        
        const ownerIDField = document.getElementById('ownerID');
        const strainIDField = document.getElementById('strainID');
        
        if (customerName) {
            // Generate owner ID
            const ownerID = IntakeDataManager.generateOwnerID(customerName, !isNewCustomer);
            if (ownerIDField) ownerIDField.value = ownerID;
            
            // Generate strain ID
            const strainID = IntakeDataManager.getNextStrainID();
            if (strainIDField) strainIDField.value = strainID;
        } else {
            if (ownerIDField) ownerIDField.value = '';
            if (strainIDField) strainIDField.value = '';
        }
    },
    
    /**
     * Update timestamp display
     */
    updateTimestamp() {
        const timestampEl = document.getElementById('intakeTimestamp');
        if (timestampEl) {
            const now = new Date();
            timestampEl.textContent = now.toLocaleString();
        }
    },
    
    /**
     * Validate form data
     */
    validateForm() {
        const errors = [];
        
        // Customer validation
        const isNewCustomer = document.getElementById('newCustomerRadio')?.checked;
        const customerName = isNewCustomer 
            ? document.getElementById('newCustomerName')?.value?.trim()
            : document.getElementById('existingCustomerSelect')?.value;
        
        if (!customerName) {
            errors.push('Customer name is required');
        }
        
        // Strain name validation
        const strainName = document.getElementById('strainName')?.value?.trim();
        if (!strainName) {
            errors.push('Strain name is required');
        }
        
        // Services validation (at least one)
        const services = this.getSelectedServices();
        if (services.length === 0) {
            errors.push('Please select at least one service');
        }
        
        return errors;
    },
    
    /**
     * Get selected services
     */
    getSelectedServices() {
        const services = [];
        const checkboxes = [
            'serviceMeristem',
            'serviceNodal',
            'serviceSexTesting',
            'serviceSequencing'
        ];
        
        checkboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox && checkbox.checked) {
                services.push(checkbox.value);
            }
        });
        
        // Handle VernBio testing with sub-options
        const vernBioCheckbox = document.getElementById('serviceVernBio');
        if (vernBioCheckbox && vernBioCheckbox.checked) {
            const hplv = document.getElementById('vernBioHpLv');
            const fullSpectrum = document.getElementById('vernBioFullSpectrum');
            
            if (hplv && hplv.checked) {
                services.push('VernBio testing - HpLv');
            } else if (fullSpectrum && fullSpectrum.checked) {
                services.push('VernBio testing - Full Spectrum');
            } else {
                services.push('VernBio testing');
            }
        }
        
        // Check "Other" service
        const otherCheckbox = document.getElementById('serviceOther');
        if (otherCheckbox && otherCheckbox.checked) {
            const otherText = document.getElementById('serviceOtherText')?.value?.trim();
            if (otherText) {
                services.push(`Other: ${otherText}`);
            } else {
                services.push('Other');
            }
        }
        
        return services;
    },
    
    /**
     * Get selected genetics type
     */
    getSelectedGenetics() {
        const radios = document.querySelectorAll('input[name="genetics"]');
        for (const radio of radios) {
            if (radio.checked) {
                return radio.value;
            }
        }
        return 'Proprietary'; // default
    },
    
    /**
     * Collect form data
     */
    collectFormData() {
        const isNewCustomer = document.getElementById('newCustomerRadio')?.checked;
        
        const data = {
            timestamp: new Date().toISOString(),
            customerType: isNewCustomer ? 'New' : 'Existing',
            customerName: isNewCustomer 
                ? document.getElementById('newCustomerName')?.value?.trim()
                : document.getElementById('existingCustomerSelect')?.value,
            address: isNewCustomer
                ? document.getElementById('customerAddress')?.value?.trim()
                : document.getElementById('existingCustomerAddress')?.value?.trim(),
            poNumber: isNewCustomer
                ? document.getElementById('customerPO')?.value?.trim()
                : document.getElementById('existingCustomerPO')?.value?.trim(),
            services: this.getSelectedServices(),
            genetics: this.getSelectedGenetics(),
            strainName: document.getElementById('strainName')?.value?.trim(),
            ownerID: document.getElementById('ownerID')?.value,
            strainID: document.getElementById('strainID')?.value
        };
        
        return data;
    },
    
    /**
     * Clear the form
     */
    clearForm() {
        // Reset to new customer
        const newCustomerRadio = document.getElementById('newCustomerRadio');
        if (newCustomerRadio) newCustomerRadio.checked = true;
        this.toggleCustomerFields('new');
        
        // Clear text inputs
        const textInputs = document.querySelectorAll('.intake-section input[type="text"]');
        textInputs.forEach(input => {
            if (!input.readOnly) {
                input.value = '';
            }
        });
        
        // Clear checkboxes
        const checkboxes = document.querySelectorAll('.intake-section input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = false);
        
        // Reset genetics radio to Proprietary
        const proprietaryRadio = document.getElementById('geneticsProprietary');
        if (proprietaryRadio) proprietaryRadio.checked = true;
        
        // Hide summary
        const summary = document.getElementById('intakeSummary');
        if (summary) summary.style.display = 'none';
        
        // Update IDs
        this.updateIDs();
        
        // Hide "Other" service field
        const otherField = document.getElementById('serviceOtherField');
        if (otherField) otherField.style.display = 'none';
        
        // Hide VernBio options
        const vernBioOptions = document.getElementById('vernBioOptions');
        if (vernBioOptions) vernBioOptions.style.display = 'none';
        
        console.log('Form cleared');
    },
    
    /**
     * Display intake summary
     */
    displaySummary(data) {
        const summaryContent = document.getElementById('intakeSummaryContent');
        const summarySection = document.getElementById('intakeSummary');
        
        if (!summaryContent || !summarySection) return;
        
        const html = `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
                <div style="margin-bottom: 15px;">
                    <strong>Customer Type:</strong> ${data.customerType}
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>Customer Name:</strong> ${data.customerName}
                </div>
                ${data.address ? `<div style="margin-bottom: 15px;"><strong>Address:</strong> ${data.address}</div>` : ''}
                ${data.poNumber ? `<div style="margin-bottom: 15px;"><strong>PO#:</strong> ${data.poNumber}</div>` : ''}
                <div style="margin-bottom: 15px;">
                    <strong>Services:</strong> ${data.services.join(', ')}
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>Genetics:</strong> ${data.genetics}
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>Strain Name:</strong> ${data.strainName}
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>Owner ID:</strong> ${data.ownerID}
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>Strain ID:</strong> ${data.strainID}
                </div>
            </div>
        `;
        
        summaryContent.innerHTML = html;
        summarySection.style.display = 'block';
        
        // Scroll to summary
        summarySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};
