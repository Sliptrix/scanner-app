# Phase 4 Manual Functional Test

## Barcode Builder Feature Testing

### Prerequisites
1. Start the server: `python3 -m http.server 8000`
2. Open browser: `http://localhost:8000/`
3. Ensure application loads without errors

### Test 1: Builder Initialization
**Expected:** Builder is in initial state

- [ ] Builder section is visible and active
- [ ] Progress indicators show step 1 (Container) as active
- [ ] Input field is focused and ready for input
- [ ] Prompt shows "Enter or scan the Container ID:"
- [ ] No errors in browser console

### Test 2: Step Navigation (Without Excel Data)
**Expected:** Basic navigation works even without data

1. **Container Step:**
   - [ ] Enter "1234" in input field
   - [ ] Press Enter or click "Next Step"
   - [ ] Step 1 marked as completed, Step 2 becomes active
   - [ ] Prompt changes to "Select or scan the Owner ID:"

2. **Owner Step:**
   - [ ] Enter "LW" in input field
   - [ ] Press Enter or click "Next Step"
   - [ ] Step 2 marked as completed, Step 3 becomes active
   - [ ] Prompt changes to "Select or scan the Strain:"

3. **Continue Through All Steps:**
   - [ ] Strain: Enter "00001"
   - [ ] Media: Enter "IA" 
   - [ ] Stage: Enter "1"
   - [ ] Tissue: Enter "15"
   - [ ] Date: Enter "20250622"
   - [ ] All steps should progress correctly

### Test 3: Barcode Generation
**Expected:** Complete barcode generation workflow

1. **After completing all steps:**
   - [ ] Button text changes to "Generate Barcode"
   - [ ] Click "Generate Barcode"
   - [ ] Barcode section appears with generated code
   - [ ] Barcode should be: "LW00001IA11520250622"
   - [ ] Container ID shown separately: "1234"
   - [ ] Breakdown shows all components correctly

### Test 4: Inventory Integration
**Expected:** Barcode saves to inventory

1. **Save to Inventory:**
   - [ ] Click "Save to Inventory" button
   - [ ] Success notification appears
   - [ ] Inventory table updates with new entry
   - [ ] Statistics update (Processed: 1, Session: 1)
   - [ ] Builder automatically resets for next entry

### Test 5: Reset Functionality
**Expected:** Reset works at any step

1. **Mid-process Reset:**
   - [ ] Start entering data (e.g., container "5678")
   - [ ] Click "Start Over" button
   - [ ] Builder returns to step 1
   - [ ] All progress indicators reset
   - [ ] Input field cleared and focused

### Test 6: Validation Testing
**Expected:** Input validation works correctly

1. **Invalid Inputs:**
   - [ ] Container: Enter "abc" → Should show error
   - [ ] Owner: Enter "123" → Should show error  
   - [ ] Strain: Enter "abcde" → Should show error
   - [ ] Stage: Enter "0" → Should show error
   - [ ] Tissue: Enter "0" → Should show error
   - [ ] Date: Enter "2025-06-22" → Should show error

2. **Valid Inputs:**
   - [ ] All validation passes with correct formats
   - [ ] Success feedback shown for valid entries

### Test 7: Excel Data Integration (If Available)
**Expected:** Excel data enhances the experience

1. **Load Excel File:**
   - [ ] Click file upload area
   - [ ] Select valid .xlsx file
   - [ ] Data loads successfully
   - [ ] Status shows "Excel data loaded"

2. **Enhanced Builder Experience:**
   - [ ] Owner step shows option buttons
   - [ ] Strain step shows option buttons  
   - [ ] Media step shows option buttons
   - [ ] Stage step shows option buttons
   - [ ] Clicking option buttons auto-fills input

### Test 8: Error Handling
**Expected:** Graceful error handling

1. **Missing Steps:**
   - [ ] Try clicking "Next Step" without input → Error shown
   - [ ] Try generating barcode with missing data → Error shown

2. **Invalid State:**
   - [ ] All error messages are user-friendly
   - [ ] No JavaScript errors in console
   - [ ] Application remains functional after errors

### Test 9: UI/UX Verification
**Expected:** Smooth user experience

- [ ] All animations work smoothly
- [ ] Progress indicators update correctly
- [ ] Input field stays focused appropriately
- [ ] Keyboard navigation (Enter key) works
- [ ] Visual feedback is clear and immediate
- [ ] Mobile/responsive design works

### Test 10: Console Monitoring
**Expected:** Clean console output

- [ ] Open browser developer tools
- [ ] Monitor console during all operations
- [ ] No JavaScript errors should appear
- [ ] Only expected log messages should show

---

## Test Results Summary

**Date:** ___________  
**Tester:** ___________  
**Browser:** ___________  

**Overall Result:** 
- [ ] ✅ All tests passed - Ready for Phase 5
- [ ] ⚠️ Minor issues found - Fix before Phase 5  
- [ ] ❌ Major issues found - Phase 4 incomplete

**Issues Found:**
_________________________________
_________________________________
_________________________________

**Notes:**
_________________________________
_________________________________
_________________________________
