# Recipe UI Improvements - Code to Edit

## 1. Reduce Height of Recipe Options Container

**File:** `src/styles/components/builder.css`
**Lines:** 151-160

**Current Code:**
```css
.builder-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
    max-height: 500px; /* Increased from 200px */
    overflow-y: auto;
}

/* Special styling for recipe creation mode */
.builder-options:has(.recipe-form-container) {
    max-height: 70vh; /* Use 70% of viewport height for recipe */
    overflow-y: auto;
    grid-template-columns: 1fr; /* Single column for recipe form */
}
```

**Improved Code:**
```css
.builder-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
    max-height: 400px; /* Reduced height */
    overflow-y: auto;
}

/* Special styling for recipe creation mode */
.builder-options:has(.recipe-wizard) {
    max-height: 85vh; /* Use more available space */
    overflow-y: auto;
    grid-template-columns: 1fr;
    padding: 0; /* Remove padding to maximize space */
}
```

## 2. Compact Recipe Wizard Styling

**File:** `src/styles/components/builder.css`  
**Lines:** 463-469

**Current Code:**
```css
.recipe-wizard {
    background: #fff;
    border: 2px solid #e3f2fd;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
```

**Improved Code:**
```css
.recipe-wizard {
    background: #fff;
    border: 2px solid #e3f2fd;
    border-radius: 8px; /* Smaller radius */
    padding: 15px; /* Reduced padding */
    box-shadow: 0 2px 6px rgba(0,0,0,0.1); /* Smaller shadow */
    margin: 0; /* Remove margins */
}
```

## 3. Reduce Wizard Header Spacing

**File:** `src/styles/components/builder.css`  
**Lines:** 472-476

**Current Code:**
```css
.wizard-header {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid #f0f0f0;
}
```

**Improved Code:**
```css
.wizard-header {
    margin-bottom: 12px; /* Reduced margin */
    padding-bottom: 10px; /* Reduced padding */
    border-bottom: 1px solid #f0f0f0; /* Thinner border */
}
```

## 4. Compact Ingredient Grid

**File:** `src/styles/components/builder.css`  
**Lines:** 525-531

**Current Code:**
```css
.ingredient-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}
```

**Improved Code:**
```css
.ingredient-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px; /* Reduced gap */
}
```

## 5. Smaller Ingredient Cards

**File:** `src/styles/components/builder.css`  
**Lines:** 532-539

**Current Code:**
```css
.ingredient-card {
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
    transition: all 0.2s ease;
}
```

**Improved Code:**
```css
.ingredient-card {
    background: white;
    border: 1px solid #e9ecef; /* Thinner border */
    border-radius: 6px; /* Smaller radius */
    padding: 8px; /* Reduced padding */
    text-align: center;
    transition: all 0.2s ease;
}
```

## 6. Compact Panel Spacing

**File:** `src/styles/components/builder.css**  
**Lines:** 477-484

**Current Code:**
```css
.quick-setup-panel {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;
    border: 1px solid #dee2e6;
}
```

**Improved Code:**
```css
.quick-setup-panel {
    background: #f8f9fa;
    border-radius: 6px; /* Smaller radius */
    padding: 12px; /* Reduced padding */
    margin-bottom: 12px; /* Reduced margin */
    border: 1px solid #dee2e6;
}
```

## 7. Alternative: Horizontal Layout for Larger Screens

**Add this new CSS rule:**
```css
/* Horizontal layout for wide screens to reduce scrolling */
@media (min-width: 1400px) {
    .recipe-wizard {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        max-height: none;
    }
    
    .wizard-header {
        grid-column: 1 / -1; /* Header spans both columns */
    }
    
    .recipe-actions {
        grid-column: 1 / -1; /* Actions span both columns */
    }
}
```

## 8. Even More Compact Version (Optional)

**Add this CSS class for ultra-compact mode:**
```css
.recipe-wizard-compact {
    padding: 10px;
    margin: 0;
}

.recipe-wizard-compact .wizard-header {
    margin-bottom: 8px;
    padding-bottom: 8px;
}

.recipe-wizard-compact .quick-setup-panel,
.recipe-wizard-compact .ingredients-summary {
    padding: 8px;
    margin-bottom: 8px;
}

.recipe-wizard-compact .ingredient-card {
    padding: 6px;
}

.recipe-wizard-compact .ingredient-name {
    font-size: 0.7rem;
    margin-bottom: 3px;
}

.recipe-wizard-compact .ingredient-amount {
    font-size: 0.9rem;
}
```

## How to Apply These Changes:

1. **For Basic Improvements:** Apply changes 1-6 above to make the interface more compact
2. **For Horizontal Layout:** Add change 7 for wider screens
3. **For Ultra-Compact:** Add change 8 and modify the stepManager.js to use class `recipe-wizard-compact` instead of `recipe-wizard`

## Quick Implementation:
The easiest way is to modify the CSS values in `src/styles/components/builder.css` with the reduced padding, margin, and height values shown above.

Would you like me to apply any of these specific changes for you?
