/**
 * Plant Care Algorithm for Tissue Culture
 * Based on scientific research for optimal plant growth cycles
 */
const plantCareData = {
    initiation: {
        stage: 'Initiation',
        pH: { optimal: 5.7, range: [5.5, 6.0] },
        sucrose: { optimal: 3.0, range: [2.5, 3.5] },
        duration: { weeks: 4, range: [3, 6] },
        lighting: { hours: 16, intensity: 'medium' },
        temperature: { day: 25, night: 22 },
        humidity: 70,
        notes: 'Critical establishment phase - sterile conditions essential'
    },
    vegetative: {
        stage: 'Vegetative',
        pH: { optimal: 5.8, range: [5.6, 6.2] },
        sucrose: { optimal: 2.0, range: [1.5, 2.5] },
        duration: { weeks: 6, range: [4, 8] },
        lighting: { hours: 16, intensity: 'high' },
        temperature: { day: 24, night: 20 },
        humidity: 65,
        notes: 'Active growth phase - monitor for contamination'
    },
    flowering: {
        stage: 'Flowering',
        pH: { optimal: 6.0, range: [5.8, 6.4] },
        sucrose: { optimal: 1.5, range: [1.0, 2.0] },
        duration: { weeks: 8, range: [6, 12] },
        lighting: { hours: 12, intensity: 'medium' },
        temperature: { day: 22, night: 18 },
        humidity: 60,
        notes: 'Reproductive phase - reduce nutrients, monitor photoperiod'
    },
    rooting: {
        stage: 'Rooting',
        pH: { optimal: 5.9, range: [5.7, 6.2] },
        sucrose: { optimal: 1.0, range: [0.5, 1.5] },
        duration: { weeks: 3, range: [2, 4] },
        lighting: { hours: 14, intensity: 'low' },
        temperature: { day: 23, night: 20 },
        humidity: 75,
        notes: 'Root development phase - high humidity critical'
    },
    acclimatization: {
        stage: 'Acclimatization',
        pH: { optimal: 6.1, range: [5.9, 6.5] },
        sucrose: { optimal: 0.5, range: [0, 1.0] },
        duration: { weeks: 2, range: [1, 3] },
        lighting: { hours: 14, intensity: 'variable' },
        temperature: { day: 22, night: 19 },
        humidity: 80,
        notes: 'Transition to soil - gradual adaptation required'
    }
};

/**
 * Media composition recommendations by stage
 */
const mediaRecommendations = {
    initiation: { base: 'MS', supplements: ['BAP', 'NAA'], strength: 'full' },
    vegetative: { base: 'MS', supplements: ['BAP'], strength: 'full' },
    flowering: { base: 'MS', supplements: ['NAA'], strength: 'half' },
    rooting: { base: 'MS', supplements: ['IBA', 'NAA'], strength: 'half' },
    acclimatization: { base: 'MS', supplements: [], strength: 'quarter' }
};

class BasicMLEngine {
    constructor() {
        this.initialized = false;
        this.patterns = {};
    }

    initializeFromInventory() {
        console.log('Initializing ML Engine with plant care data...');
        this.patterns = plantCareData;
        this.initialized = true;
    }

    getRecipeRecommendations(context) {
        // Example: Return suggestions based on the type of plant stage
        return this.patterns[context.stage];
    }

    predictTransferSuccess(context) {
        /**
         * Advanced Transfer Success Prediction Algorithm
         * Factors: container age, tissue count, media type, stage, environmental conditions
         */
        if (!context) return 0.7; // Default baseline
        
        let successProbability = 0.8; // Base success rate
        
        // Age factor (containers work best when 2-6 weeks old)
        if (context.sourceContainerAge) {
            const ageWeeks = context.sourceContainerAge / 7;
            if (ageWeeks >= 2 && ageWeeks <= 6) {
                successProbability += 0.1; // Optimal age range
            } else if (ageWeeks < 2) {
                successProbability -= 0.2; // Too young
            } else if (ageWeeks > 10) {
                successProbability -= 0.3; // Too old
            }
        }
        
        // Tissue count factor (optimal range varies by stage)
        if (context.tissueCount) {
            const optimalRange = this.getOptimalTissueCount(context.stage);
            if (context.tissueCount >= optimalRange.min && context.tissueCount <= optimalRange.max) {
                successProbability += 0.05;
            } else {
                successProbability -= 0.1;
            }
        }
        
        // Stage-specific success rates
        const stageMultipliers = {
            'initiation': 0.7,  // Most challenging
            'vegetative': 0.95, // Highest success
            'flowering': 0.8,   // Moderate success
            'rooting': 0.85,    // Good success
            'acclimatization': 0.6 // Requires careful handling
        };
        
        if (context.stage && stageMultipliers[context.stage]) {
            successProbability *= stageMultipliers[context.stage];
        }
        
        // Media type compatibility
        if (context.mediaType) {
            const mediaSuccess = {
                'MS': 0.9,
                'B5': 0.85,
                'WPM': 0.8,
                'DKW': 0.75
            };
            successProbability *= (mediaSuccess[context.mediaType] || 0.7);
        }
        
        // Environmental factors
        if (context.temperature) {
            const tempOptimal = this.getOptimalTemperature(context.stage);
            const tempDiff = Math.abs(context.temperature - tempOptimal);
            if (tempDiff <= 2) {
                successProbability += 0.05;
            } else if (tempDiff > 5) {
                successProbability -= 0.15;
            }
        }
        
        // Ensure probability stays within bounds
        return Math.max(0.1, Math.min(0.99, successProbability));
    }
    
    getOptimalTissueCount(stage) {
        const ranges = {
            'initiation': { min: 1, max: 3 },
            'vegetative': { min: 3, max: 8 },
            'flowering': { min: 2, max: 5 },
            'rooting': { min: 1, max: 4 },
            'acclimatization': { min: 1, max: 2 }
        };
        return ranges[stage] || { min: 1, max: 5 };
    }
    
    getOptimalTemperature(stage) {
        const temps = {
            'initiation': 25,
            'vegetative': 24,
            'flowering': 22,
            'rooting': 23,
            'acclimatization': 22
        };
        return temps[stage] || 24;
    }

    recordOperation(operation) {
        console.log('Recording operation:', operation);
        // Could update patterns based on new operation
    }
}

window.LabMLEngine = new BasicMLEngine();
window.LabMLEngine.initializeFromInventory();
