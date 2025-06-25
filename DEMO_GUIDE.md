# 🚀 Lab Scanner System - Complete Demo Guide

## Quick Start

### 1. Start the Server
```bash
npm start
```
This starts the development server on http://localhost:8000

### 2. Access the Application
Open your browser and go to: **http://localhost:8000**

## 🎯 Complete Feature Demonstration

### Phase 1: Initial Setup
1. **Load the application** - You'll see the main Lab Scanner interface
2. **Load demo data** - The system will work with simulated lab data
3. **Explore the interface** - Two main modes: Barcode Builder and Container Transfer

### Phase 2: Barcode Builder with Recipe Integration (MAIN FEATURE)

#### Step-by-Step Workflow:
1. **Switch to Barcode Builder mode** (should be active by default)
2. **Follow the 8-step process:**
   - Step 1: Container ID (e.g., "1001")
   - Step 2: Owner (e.g., "LW" for Lone Wolf Labs)  
   - Step 3: Strain (e.g., "00001" for Purple Kush)
   - Step 4: Media (e.g., "IA" for Initiation Agar)
   - **Step 5: Recipe (NEW MANDATORY STEP)** 🧪
     - Choose "Create New Recipe" or "Use Existing Recipe"
     - Full Media Maker interface with ingredient calculations
     - Volume scaling (500mL, 1L, 2L)
     - Pre and post-autoclave ingredients
     - Recipe saving and reuse
   - Step 6: Stage (e.g., "1" for Initial Culture)
   - Step 7: Tissue Count (e.g., "15")
   - Step 8: Date (e.g., today's date)

3. **Generate Barcode** - Creates complete barcode with recipe information
4. **Save to Inventory** - Stores all data including recipe details

### Phase 3: Recipe Management Features

#### Creating New Recipes:
- **Media Type Selection**: Initiation, Multiplication, Rooting
- **Volume Selection**: 500mL, 1L, 2L with automatic scaling
- **Ingredient Calculator**: 
  - Basal salts (M&S or DKW)
  - Gelling agents (Phytogel or Agar)
  - Pre-autoclave ingredients (Gamborg, Sucrose, PPM)
  - Post-autoclave additions (AgNO3, Meta-Topolin, etc.)
- **pH and Autoclave Settings**: Standard tissue culture parameters
- **Recipe Naming and Notes**: Full documentation

#### Using Existing Recipes:
- **Recipe Library**: Browse all saved recipes
- **Search and Filter**: Find recipes by name, media type, or ingredients
- **Recent and Popular**: Quick access to frequently used recipes
- **Recipe Preview**: Full ingredient breakdown before selection

#### Recipe Import/Export:
- **Import Recipes**: Load recipes from JSON files (try importing from Media Maker)
- **Export Recipes**: Save recipe collections for sharing
- **Backup System**: Automatic backups every 100 entries

### Phase 4: Container Transfer System

#### Single Container Transfer:
1. **Scan source container** - Enter container ID to transfer from
2. **Scan destination** - Enter target container ID
3. **Process transfer** - Move all samples to destination

#### Tissue Splitting:
1. **Scan source container** - Container with multiple tissue samples
2. **Select split mode** - Choose "Split Tissues"
3. **Set split count** - Number of new containers (2-10)
4. **Preview split** - See how tissues will be distributed
5. **Process split** - Creates new containers with even distribution
6. **Automatic lineage tracking** - Maintains parent-child relationships

### Phase 5: Inventory Management

#### Advanced Features:
- **Real-time inventory table** with recipe information
- **Search and filtering** by container, strain, owner, recipe
- **Container lineage visualization** showing transfer history
- **Recipe traceability** - See which recipe was used for each container
- **Excel export** with complete recipe details
- **Auto-save and backup** every 30 seconds

## 🎮 Demo Scenarios

### Scenario 1: New Lab Setup
1. Create your first recipe for tissue culture initiation
2. Generate barcodes for initial containers
3. Track containers through multiplication phases
4. Export data for record keeping

### Scenario 2: Tissue Splitting Workflow  
1. Create a container with multiple tissue samples
2. Use tissue splitting to distribute across new containers
3. Track lineage and recipe information
4. Monitor container relationships

### Scenario 3: Recipe Library Management
1. Import existing recipes from Media Maker
2. Create variations for different strains
3. Share recipes between lab technicians
4. Maintain recipe version control

### Scenario 4: Full Lab Operation
1. Multiple technicians using different owners
2. Various strains in different growth stages
3. Recipe variations for optimization
4. Complete audit trail and traceability

## 🔧 Advanced Features

### Data Persistence:
- **LocalStorage**: All data saved automatically
- **Auto-backup**: Protects against data loss
- **Import/Export**: Share data between systems
- **Recipe versioning**: Track recipe modifications

### Integration Features:
- **Recipe-Container linking**: Every container has recipe traceability
- **Barcode generation**: Includes recipe identifiers
- **Excel export**: Complete lab records with recipe details
- **Search capabilities**: Find containers by recipe or ingredients

### User Experience:
- **Progressive workflow**: Guided step-by-step process
- **Visual feedback**: Real-time validation and hints
- **Error prevention**: Input validation and sanity checks
- **Mobile responsive**: Works on tablets and phones

## 🎯 Key Benefits Demonstrated

1. **Complete Traceability**: From recipe creation to final product
2. **Mandatory Documentation**: No containers without recipe information
3. **Standardization**: Consistent recipe application across lab
4. **Efficiency**: Reuse proven recipes, avoid recreation
5. **Quality Control**: Recipe validation and ingredient tracking
6. **Audit Trail**: Complete history of all operations
7. **Scalability**: Handles small labs to large operations
8. **Integration**: Seamless workflow from media prep to inventory

## 🚨 Demo Tips

### For Best Demo Experience:
1. **Start with recipe creation** - Show the Media Maker integration
2. **Create multiple containers** - Demonstrate the workflow
3. **Use tissue splitting** - Show advanced functionality  
4. **Export data** - Demonstrate reporting capabilities
5. **Import recipes** - Show recipe sharing features

### Sample Data to Use:
- **Container IDs**: 1001, 1002, 1003, etc.
- **Owners**: LW (Lone Wolf Labs), J (Johnson Research)
- **Strains**: 00001 (Purple Kush), 00002 (White Widow)
- **Media**: IA (Initiation Agar), MA (Multiplication Agar)
- **Tissue Counts**: 10, 15, 20, 25

### What to Highlight:
- **Recipe step is mandatory** - System won't proceed without it
- **Full Media Maker integration** - Complete ingredient calculations
- **Recipe reuse** - Efficiency and standardization
- **Traceability** - Every container links to its recipe
- **Professional lab workflow** - Ready for production use

## 🌟 Success Metrics

A successful demo should show:
1. ✅ Recipe creation and selection working smoothly
2. ✅ Complete barcode generation including recipe data
3. ✅ Inventory tracking with recipe information
4. ✅ Container transfers maintaining recipe lineage
5. ✅ Recipe import/export functionality
6. ✅ Search and filtering by recipe criteria
7. ✅ Professional lab-ready interface and workflow

**The system is now a complete lab management solution combining container tracking with comprehensive recipe documentation!**
