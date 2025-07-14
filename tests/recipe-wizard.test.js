/**
 * Recipe Wizard Test Suite
 * Tests for the enhanced recipe creation and management functionality
 */

describe('Recipe Wizard', () => {
    let originalRecipeManager;
    let mockRecipeStorage;
    let testContainer;

    beforeEach(() => {
        // Setup test environment
        originalRecipeManager = window.RecipeManager;
        
        // Create test container
        testContainer = document.createElement('div');
        testContainer.id = 'testContainer';
        document.body.appendChild(testContainer);
        
        // Mock RecipeStorage
        mockRecipeStorage = {
            getAllRecipes: jest.fn().mockReturnValue([]),
            saveRecipe: jest.fn().mockReturnValue('test-recipe-id'),
            loadRecipe: jest.fn().mockReturnValue(null),
            searchRecipes: jest.fn().mockReturnValue([]),
            getRecipesByMediaType: jest.fn().mockReturnValue([])
        };
        
        window.RecipeStorage = mockRecipeStorage;
        
        // Mock BASE_AMOUNTS and other data
        window.BASE_AMOUNTS = {
            '1L': {
                'M&S': 4.48,
                'DKW': 5.32,
                'gamborgVitamin': 1,
                'sucrose': 30,
                'ppm': 1,
                'phytogel': 3,
                'agar': 8
            }
        };
        
        window.POST_AUTOCLAVE_DEFAULTS = {
            'Initiation': [
                { name: 'AgNO3', amount: 40, key: 'agno3', unit: 'μL' },
                { name: 'Meta-Topolin', amount: 500, key: 'metaTopolin', unit: 'μL' }
            ]
        };
    });

    afterEach(() => {
        // Cleanup
        document.body.removeChild(testContainer);
        window.RecipeManager = originalRecipeManager;
    });

    describe('Recipe Wizard UI', () => {
        test('should create recipe wizard interface', () => {
            // Test that the wizard UI is created properly
            window.RecipeManager.showRecipeWizard();
            
            expect(document.getElementById('recipeWizard')).toBeTruthy();
            expect(document.querySelector('.wizard-header')).toBeTruthy();
            expect(document.querySelector('.quick-setup-panel')).toBeTruthy();
        });

        test('should show quick setup templates', () => {
            window.RecipeManager.showRecipeWizard();
            
            const initiationBtn = document.querySelector('button[onclick*="Initiation"]');
            const multiplicationBtn = document.querySelector('button[onclick*="Multiplication"]');
            const rootingBtn = document.querySelector('button[onclick*="Rooting"]');
            
            expect(initiationBtn).toBeTruthy();
            expect(multiplicationBtn).toBeTruthy();
            expect(rootingBtn).toBeTruthy();
        });

        test('should have all required form fields', () => {
            window.RecipeManager.showRecipeWizard();
            
            // Check basic information fields
            expect(document.getElementById('recipeName')).toBeTruthy();
            expect(document.getElementById('recipeVolume')).toBeTruthy();
            
            // Check base components
            expect(document.getElementById('basalSaltType')).toBeTruthy();
            expect(document.getElementById('basalSaltAmount')).toBeTruthy();
            expect(document.getElementById('gellingAgentType')).toBeTruthy();
            expect(document.getElementById('gellingAgentAmount')).toBeTruthy();
            
            // Check pre-autoclave additions
            expect(document.getElementById('gamborgVitamin')).toBeTruthy();
            expect(document.getElementById('sucrose')).toBeTruthy();
            expect(document.getElementById('ppm')).toBeTruthy();
            expect(document.getElementById('pH')).toBeTruthy();
        });
    });

    describe('Template Loading', () => {
        test('should load template values when template is selected', () => {
            window.RecipeManager.showRecipeWizard();
            
            // Load Initiation template
            window.RecipeManager.loadTemplate('Initiation');
            
            expect(document.getElementById('basalSaltType').value).toBe('M&S');
            expect(document.getElementById('basalSaltAmount').value).toBe('4.4');
            expect(document.getElementById('gellingAgentType').value).toBe('Phytogel');
            expect(document.getElementById('gellingAgentAmount').value).toBe('2.3');
            expect(document.getElementById('pH').value).toBe('5.8');
        });

        test('should update post-autoclave list when template is loaded', () => {
            window.RecipeManager.showRecipeWizard();
            
            window.RecipeManager.loadTemplate('Initiation');
            
            const postAutoclaveList = document.getElementById('postAutoclaveList');
            expect(postAutoclaveList.innerHTML).toContain('AgNO3');
            expect(postAutoclaveList.innerHTML).toContain('Meta-Topolin');
            expect(postAutoclaveList.innerHTML).toContain('40 μL');
            expect(postAutoclaveList.innerHTML).toContain('500 μL');
        });
    });

    describe('Volume Scaling', () => {
        test('should scale amounts when volume changes', () => {
            window.RecipeManager.showRecipeWizard();
            
            // Load template for 1L
            window.RecipeManager.loadTemplate('Initiation');
            
            // Change volume to 2L
            document.getElementById('recipeVolume').value = '2L';
            window.RecipeManager.updateVolume();
            
            expect(document.getElementById('basalSaltAmount').value).toBe('8.8'); // 4.4 * 2
            expect(document.getElementById('gellingAgentAmount').value).toBe('4.6'); // 2.3 * 2
        });

        test('should update post-autoclave amounts when volume changes', () => {
            window.RecipeManager.showRecipeWizard();
            
            window.RecipeManager.loadTemplate('Initiation');
            
            // Change to 500mL
            document.getElementById('recipeVolume').value = '500mL';
            window.RecipeManager.updateVolume();
            
            const postAutoclaveList = document.getElementById('postAutoclaveList');
            expect(postAutoclaveList.innerHTML).toContain('20 μL'); // 40 * 0.5
            expect(postAutoclaveList.innerHTML).toContain('250 μL'); // 500 * 0.5
        });
    });

    describe('Change Detection', () => {
        test('should detect when values differ from template', () => {
            window.RecipeManager.showRecipeWizard();
            
            window.RecipeManager.loadTemplate('Initiation');
            
            // Change a value
            document.getElementById('basalSaltAmount').value = '5.0';
            window.RecipeManager.detectChanges();
            
            const changeIndicator = document.getElementById('changeIndicator');
            expect(changeIndicator.classList.contains('show')).toBe(true);
        });

        test('should not show change indicator when values match template', () => {
            window.RecipeManager.showRecipeWizard();
            
            window.RecipeManager.loadTemplate('Initiation');
            window.RecipeManager.detectChanges();
            
            const changeIndicator = document.getElementById('changeIndicator');
            expect(changeIndicator.classList.contains('show')).toBe(false);
        });
    });

    describe('Recipe Creation', () => {
        test('should create new recipe with wizard data', () => {
            window.RecipeManager.showRecipeWizard();
            
            // Fill in form data
            document.getElementById('recipeName').value = 'Test Recipe';
            document.getElementById('recipeVolume').value = '1L';
            document.getElementById('basalSaltType').value = 'M&S';
            document.getElementById('basalSaltAmount').value = '4.48';
            document.getElementById('pH').value = '5.8';
            
            const recipe = window.RecipeManager.createRecipeFromWizard();
            
            expect(recipe.name).toBe('Test Recipe');
            expect(recipe.volume).toBe('1L');
            expect(recipe.basalSalt.type).toBe('M&S');
            expect(recipe.basalSalt.amount).toBe(4.48);
            expect(recipe.pH).toBe(5.8);
        });

        test('should save recipe through RecipeStorage', () => {
            window.RecipeManager.showRecipeWizard();
            
            document.getElementById('recipeName').value = 'Test Recipe';
            window.RecipeManager.saveRecipe();
            
            expect(mockRecipeStorage.saveRecipe).toHaveBeenCalled();
        });
    });

    describe('Recipe Preview', () => {
        test('should generate recipe preview', () => {
            window.RecipeManager.showRecipeWizard();
            
            document.getElementById('recipeName').value = 'Test Recipe';
            document.getElementById('recipeVolume').value = '1L';
            
            window.RecipeManager.previewRecipe();
            
            const preview = document.getElementById('recipePreview');
            expect(preview.classList.contains('show')).toBe(true);
            expect(preview.innerHTML).toContain('Test Recipe');
        });
    });

    describe('Recipe Selection Integration', () => {
        test('should allow selecting existing recipes', () => {
            const existingRecipes = [
                { id: 'recipe1', name: 'Existing Recipe 1', mediaType: 'Initiation' },
                { id: 'recipe2', name: 'Existing Recipe 2', mediaType: 'Multiplication' }
            ];
            
            mockRecipeStorage.getAllRecipes.mockReturnValue(existingRecipes);
            
            window.RecipeManager.showRecipeSelection();
            
            expect(document.getElementById('existingRecipesList')).toBeTruthy();
            expect(document.querySelector('[data-recipe-id="recipe1"]')).toBeTruthy();
            expect(document.querySelector('[data-recipe-id="recipe2"]')).toBeTruthy();
        });

        test('should filter recipes by media type', () => {
            const existingRecipes = [
                { id: 'recipe1', name: 'Initiation Recipe', mediaType: 'Initiation' },
                { id: 'recipe2', name: 'Multiplication Recipe', mediaType: 'Multiplication' }
            ];
            
            mockRecipeStorage.getRecipesByMediaType.mockReturnValue([existingRecipes[0]]);
            
            window.RecipeManager.filterRecipesByMediaType('Initiation');
            
            expect(mockRecipeStorage.getRecipesByMediaType).toHaveBeenCalledWith('Initiation');
        });
    });

    describe('Culture-Recipe Linking', () => {
        test('should link recipe to culture during barcode generation', () => {
            const recipeId = 'test-recipe-id';
            const cultureData = {
                strain: 'Test Strain',
                owner: 'Test Owner',
                stage: 'Initiation'
            };
            
            const result = window.RecipeManager.linkRecipeToculture(recipeId, cultureData);
            
            expect(result.recipeId).toBe(recipeId);
            expect(result.strain).toBe('Test Strain');
        });

        test('should retrieve recipe for culture lookup', () => {
            const recipeId = 'test-recipe-id';
            const mockRecipe = {
                id: recipeId,
                name: 'Test Recipe',
                mediaType: 'Initiation'
            };
            
            mockRecipeStorage.loadRecipe.mockReturnValue(mockRecipe);
            
            const recipe = window.RecipeManager.getRecipeForCulture(recipeId);
            
            expect(mockRecipeStorage.loadRecipe).toHaveBeenCalledWith(recipeId);
            expect(recipe).toEqual(mockRecipe);
        });
    });

    describe('Workflow Integration', () => {
        test('should integrate with barcode generation workflow', () => {
            // Mock builder step manager
            window.StepManager = {
                getCurrentStep: jest.fn().mockReturnValue('recipe'),
                completeStep: jest.fn(),
                getStepData: jest.fn().mockReturnValue({})
            };
            
            window.RecipeManager.showRecipeWizard();
            
            // Complete recipe selection
            document.getElementById('recipeName').value = 'Test Recipe';
            window.RecipeManager.confirmRecipeSelection();
            
            expect(window.StepManager.completeStep).toHaveBeenCalledWith('recipe');
        });
    });
});
