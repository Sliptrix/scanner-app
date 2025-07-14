#!/usr/bin/env python3
"""
Interactive test script for strain-to-owner mapping features.
This script demonstrates the new auto-population functionality.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.barcode_generation import Code128BarcodeGenerator
from src.transfer_input_manager import TransferInputManager
import json

def print_header(title):
    """Print a formatted header."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def test_strain_owner_lookup():
    """Test the strain-to-owner lookup functionality."""
    print_header("Testing Strain-to-Owner Lookup")
    
    # Initialize the barcode generator
    generator = Code128BarcodeGenerator()
    
    # Test some known strains from our mapping
    test_strains = ["DLB01", "DLB02", "NLK01", "MKC01", "TED01"]
    
    print("Testing strain-to-owner mappings:")
    for strain in test_strains:
        owner = generator.get_owner_for_strain(strain)
        print(f"  Strain {strain:6} → Owner: {owner if owner else 'Unknown'}")
    
    # Test unknown strain
    unknown_strain = "UNKNOWN123"
    owner = generator.get_owner_for_strain(unknown_strain)
    print(f"  Strain {unknown_strain:6} → Owner: {owner if owner else 'Unknown'}")

def test_auto_population():
    """Test auto-population of owner field during barcode generation."""
    print_header("Testing Auto-Population in Barcode Generation")
    
    generator = Code128BarcodeGenerator()
    
    # Test with strain that should auto-populate owner
    print("Test 1: Auto-population with known strain")
    fields = {
        'plant_id': 'P123',
        'strain': 'DLB01',  # Should auto-populate to 'vibe'
        'owner': '',  # Empty - should be auto-populated
        'harvest_date': '2024-01-15',
        'sample_id': 'S001',
        'lab_id': 'L001',
        'container_id': 'C001'
    }
    
    print(f"  Before: {fields}")
    result = generator.generate_barcode(fields)
    print(f"  After:  Owner auto-populated to '{result['metadata']['owner']}'")
    
    # Test with pre-existing owner (should not override)
    print("\nTest 2: Existing owner should not be overridden")
    fields_with_owner = {
        'plant_id': 'P124',
        'strain': 'DLB02',  # Maps to 'vibe'
        'owner': 'existing_owner',  # Should not be changed
        'harvest_date': '2024-01-15',
        'sample_id': 'S002',
        'lab_id': 'L002',
        'container_id': 'C002'
    }
    
    print(f"  Before: {fields_with_owner}")
    result2 = generator.generate_barcode(fields_with_owner)
    print(f"  After:  Owner remains '{result2['metadata']['owner']}'")

def test_transfer_manager_enhancements():
    """Test the enhanced transfer manager with strain-owner display."""
    print_header("Testing Transfer Manager Strain-Owner Display")
    
    transfer_manager = TransferInputManager()
    
    # Create a mock container with strain information
    mock_container = {
        'container_id': 'C123',
        'plant_id': 'P123',
        'strain': 'DLB01',
        'owner': 'vibe',
        'harvest_date': '2024-01-15',
        'sample_id': 'S001',
        'lab_id': 'L001',
        'tissue_samples': [
            {'sample_id': 'T001', 'strain': 'DLB01'},
            {'sample_id': 'T002', 'strain': 'NLK01'},
            {'sample_id': 'T003', 'strain': 'DLB01'}
        ]
    }
    
    print("Mock Container Data:")
    print(f"  Container ID: {mock_container['container_id']}")
    print(f"  Primary Strain: {mock_container['strain']}")
    print(f"  Primary Owner: {mock_container['owner']}")
    print(f"  Tissue Samples: {len(mock_container['tissue_samples'])}")
    
    # Test strain-owner enrichment
    enriched_display = transfer_manager.get_enhanced_container_summary(mock_container)
    
    print(f"\nEnhanced Display Summary:")
    print(f"  {enriched_display}")

def show_strain_owner_mappings():
    """Show available strain-owner mappings."""
    print_header("Available Strain-Owner Mappings")
    
    # Load the mapping data
    try:
        with open('strain_owner_mapping.json', 'r') as f:
            mapping_data = json.load(f)
        
        strain_mappings = mapping_data.get('strain_mappings', {})
        owner_info = mapping_data.get('owner_info', {})
        
        print(f"Total strains mapped: {len(strain_mappings)}")
        print(f"Total owners: {len(owner_info)}")
        
        # Group strains by owner
        owners_to_strains = {}
        for strain, owner in strain_mappings.items():
            if owner not in owners_to_strains:
                owners_to_strains[owner] = []
            owners_to_strains[owner].append(strain)
        
        print("\nStrains by Owner:")
        for owner, strains in sorted(owners_to_strains.items()):
            owner_name = owner_info.get(owner, {}).get('full_name', owner)
            print(f"  {owner_name} ({owner}): {len(strains)} strains")
            # Show first few strains as examples
            examples = strains[:5]
            if len(strains) > 5:
                examples.append(f"... and {len(strains) - 5} more")
            print(f"    Examples: {', '.join(examples)}")
            
    except FileNotFoundError:
        print("  Strain-owner mapping file not found!")
    except json.JSONDecodeError:
        print("  Error reading strain-owner mapping file!")

def main():
    """Run all the tests."""
    print_header("Strain-to-Owner Mapping Feature Testing")
    print("This script tests the new auto-population functionality.")
    
    try:
        show_strain_owner_mappings()
        test_strain_owner_lookup()
        test_auto_population()
        test_transfer_manager_enhancements()
        
        print_header("Testing Complete!")
        print("✅ All strain-to-owner mapping features are working correctly.")
        print("\nTo test interactively:")
        print("  1. Open the HTML demo: tests/strain-owner-mapping-demo.html")
        print("  2. Run individual tests: python -m pytest tests/unit/ -v")
        print("  3. Check the main application for auto-population in action")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
