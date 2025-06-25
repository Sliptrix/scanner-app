// Browser-based test without external dependencies
function expect(value) {
    return {
        to: {
            be: {
                closeTo: function(target, tolerance) {
                    const diff = Math.abs(value - target);
                    if (diff > tolerance) {
                        throw new Error(`Expected ${value} to be close to ${target} within ${tolerance}, but difference was ${diff}`);
                    }
                }
            }
        }
    };
}

// Mock environment for browser test
function setupRecipeTestEnvironment() {
    if (typeof document === 'undefined') {
        // Node.js environment - create jsdom
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        global.Event = dom.window.Event;
    }
    
    // Create required DOM elements
    document.body.innerHTML = `
        <div id="builderSection">
            <div id="builderPrompt"></div>
            <div id="builderHint"></div>
            <input id="builderInput" />
            <div id="builderOptions"></div>
            <div id="builderFeedback"></div>
            <button id="builderNextBtn"></button>
        </div>
        <div id="recipeSection" style="display: none;">
            <select id="recipeMode">
                <option value="new">Create New Recipe</option>
                <option value="existing">Use Existing Recipe</option>
            </select>
            <div id="newRecipeForm">
                <select id="mediaType">
                    <option value="Initiation">Initiation</option>
                    <option value="Multiplication">Multiplication</option>
                    <option value="Rooting">Rooting</option>
                </select>
                <select id="volume">
                    <option value="500mL">500mL</option>
                    <option value="1L">1L</option>
                    <option value="2L">2L</option>
                </select>
                <select id="basalSalt">
                    <option value="M&S">M&S</option>
                    <option value="DKW">DKW</option>
                </select>
                <input id="basalSaltAmount" type="number" />
                <select id="gellingAgent">
                    <option value="Phytogel">Phytogel</option>
                    <option value="Agar">Agar</option>
                </select>
                <input id="gellingAgentAmount" type="number" />
                <input id="gamborgVitamin" type="number" />
                <input id="sucrose" type="number" />
                <input id="ppm" type="number" />
                <input id="phValue" type="number" value="5.8" />
                <div id="postAutoclaveList"></div>
            </div>
            <div id="existingRecipeForm">
                <select id="savedRecipeSelect"></select>
                <div id="recipePreview"></div>
            </div>
            <input id="recipeName" placeholder="Recipe Name" />
            <textarea id="recipeNotes" placeholder="Recipe Notes"></textarea>
        </div>
        <div id="inventoryTableBody"></div>
        <div id="notification"></div>
    `;
    
    // Mock global objects if they don't exist
    if (!global.StateManager) {
        global.StateManager = {
            state: {
                inventory: [],
                recipes: [],
                currentStep: 'container',
                builderData: {}
            },
            getState: function(path) {
                return this.state[path];
            },
            setState: function(path, value) {
                this.state[path] = value;
            }
        };
    }
    
    if (!global.UIUtils) {
        global.UIUtils = {
            showNotification: function(message, type = 'info') {
                console.log(`Notification (${type}): ${message}`);
            },
            updateStats: function() {
                console.log('Stats updated');
            }
        };
    }
}

// Helper function to set media type and verify values
function setMediaTypeAndVerify(mediaType) {
    console.log(`Testing recommended values for ${mediaType}...`);
    
    const mediaTypeSelect = document.getElementById('mediaType');
    const volumeSelect = document.getElementById('volume');

    if (!mediaTypeSelect || !volumeSelect) {
        throw new Error('Required elements not found for setting media type.');
    }

    // Set the media type
    mediaTypeSelect.value = mediaType;
    volumeSelect.value = '1L';
    mediaTypeSelect.dispatchEvent(new Event('change'));
    
    const basalSaltAmount = parseFloat(document.getElementById('basalSaltAmount').value);
    const gellingAgentAmount = parseFloat(document.getElementById('gellingAgentAmount').value);
    const gamborgVitamin = parseFloat(document.getElementById('gamborgVitamin').value);
    const sucrose = parseFloat(document.getElementById('sucrose').value);
    const ppm = parseFloat(document.getElementById('ppm').value);
    const phValue = parseFloat(document.getElementById('phValue').value);

    expect(basalSaltAmount).to.be.closeTo(4.4, 0.01);
    expect(gellingAgentAmount).to.be.closeTo(2.3, 0.01);
    expect(gamborgVitamin).to.be.closeTo(1.0, 0.01);
    expect(sucrose).to.be.closeTo(30.0, 0.1);
    expect(ppm).to.be.closeTo(1.0, 0.01);
    expect(phValue).to.be.closeTo(5.8, 0.1);

    console.log(`✅ ${mediaType} values verified.`);
}

// Run additional tests
function runRecommendedValuesTest() {
    console.log('🚀 Starting Recommended Values Test...');

    try {
        setupTestEnvironment();

        ['Initiation', 'Multiplication', 'Rooting'].forEach(setMediaTypeAndVerify);

        console.log('🎉 All Recommended Values Tests Passed!');
        return true;
    } catch (error) {
        console.error('❌ Recommended Values Test Failed:', error.message);
        return false;
    }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runRecommendedValuesTest
    };
}

// If the file is executed directly, run the test
if (typeof require !== 'undefined' && require.main === module) {
    runRecommendedValuesTest();
}

