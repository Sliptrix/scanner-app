#!/usr/bin/env python3
"""
Test script to demonstrate strain-to-owner mapping functionality
This simulates the JavaScript functionality in Python to show the core logic
"""

def test_strain_owner_mapping():
    """Test the strain-to-owner auto-population feature"""
    
    # Demo data matching the JavaScript implementation
    demo_data = {
        "strains": {
            "1": "Animal Cookies",
            "2": "Baker's Dozen", 
            "3": "Chem Reserve",
            "4": "Cake Mix",
            "5": "Cinderella 99",
            "10": "Tropical Runts",
            "22": "StarDawg",
            "23": "A187.2",
            "68": "Cherry OG",
            "71": "Blue Dream"
        },
        "strain_owner_mapping": {
            "1": "vibe",
            "2": "vibe",
            "3": "vibe",
            "4": "vibe", 
            "5": "vibe",
            "10": "vibe",
            "22": "LWB",
            "23": "LWB",
            "68": "beau",
            "71": "jay"
        },
        "owners": {
            "vibe": "Vibe Genetics",
            "LWB": "Lone Wolf Botanicals",
            "beau": "Beau Labs",
            "jay": "Jay Genetics",
            "ted": "Ted's Research"
        }
    }
    
    print("🧬 Strain-to-Owner Mapping Test")
    print("=" * 50)
    
    # Display available mappings
    print("\n📋 Available Strain-Owner Mappings:")
    print("-" * 40)
    for strain_id, owner_code in demo_data["strain_owner_mapping"].items():
        strain_name = demo_data["strains"][strain_id]
        owner_name = demo_data["owners"][owner_code]
        print(f"Strain {strain_id:2} ({strain_name:15}) → {owner_code:4} ({owner_name})")
    
    # Test barcode generation with auto-population
    print("\n🏷️  Barcode Generation Tests:")
    print("-" * 40)
    
    test_cases = [
        {"strain": "1", "media": "MS", "stage": "2", "tissue": "15", "date": "20240630"},
        {"strain": "22", "media": "IA", "stage": "3", "tissue": "8", "date": "20240701"},
        {"strain": "68", "media": "ML", "stage": "1", "tissue": "25", "date": "20240702"},
        {"strain": "99", "media": "MS", "stage": "2", "tissue": "10", "date": "20240703"}  # Unknown strain
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\nTest {i}: Strain {test_case['strain']}")
        try:
            result = generate_barcode_with_auto_population(test_case, demo_data)
            print(f"  ✅ Success: {result}")
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    # Test container transfer display
    print("\n📦 Container Transfer Display Tests:")
    print("-" * 40)
    
    # Single strain container
    container_data = {
        "container_id": "5",
        "total_samples": 12,
        "strains": ["1"],
        "strain_groups": {
            "1": [
                {"strain": "1", "tissue_count": 3},
                {"strain": "1", "tissue_count": 5},
                {"strain": "1", "tissue_count": 4}
            ]
        }
    }
    
    print("\nSingle Strain Container:")
    display_container_info(container_data, demo_data)
    
    # Multi-strain container
    multi_container_data = {
        "container_id": "Mixed-Container",
        "total_samples": 18,
        "strains": ["1", "22", "68"],
        "strain_groups": {
            "1": [{"strain": "1", "tissue_count": 6}],
            "22": [{"strain": "22", "tissue_count": 8}],
            "68": [{"strain": "68", "tissue_count": 4}]
        }
    }
    
    print("\nMulti-Strain Container:")
    display_container_info(multi_container_data, demo_data)

def generate_barcode_with_auto_population(test_case, demo_data):
    """Generate barcode with automatic owner population"""
    strain_id = test_case["strain"]
    
    # Auto-populate owner from strain
    if strain_id not in demo_data["strain_owner_mapping"]:
        raise ValueError(f"No owner mapping found for strain {strain_id}")
    
    owner_code = demo_data["strain_owner_mapping"][strain_id]
    owner_name = demo_data["owners"][owner_code]
    strain_name = demo_data["strains"][strain_id]
    
    # Format fields for barcode
    fields = {
        "strain": strain_id.zfill(5),
        "owner": owner_code,
        "media": test_case["media"].upper(),
        "stage": test_case["stage"],
        "tissue": test_case["tissue"].zfill(2),
        "date": test_case["date"]
    }
    
    composite_string = f"{fields['owner']}{fields['strain']}{fields['media']}{fields['stage']}{fields['tissue']}{fields['date']}"
    
    return {
        "composite_string": composite_string,
        "auto_populated_owner": f"{owner_code} ({owner_name})",
        "strain_info": f"{strain_id} ({strain_name})",
        "fields": fields
    }

def display_container_info(container_data, demo_data):
    """Display enhanced container information with strain-owner details"""
    print(f"  Container ID: {container_data['container_id']}")
    print(f"  Total Samples: {container_data['total_samples']}")
    print(f"  Number of Strains: {len(container_data['strains'])}")
    
    owners_detected = set()
    for strain in container_data['strains']:
        owner_code = demo_data["strain_owner_mapping"].get(strain, "unknown")
        owner_name = demo_data["owners"].get(owner_code, "Unknown")
        strain_name = demo_data["strains"].get(strain, "Unknown")
        entry_count = len(container_data["strain_groups"].get(strain, []))
        
        print(f"    • Strain {strain} ({strain_name}) → {owner_code} ({owner_name}) - {entry_count} entries")
        owners_detected.add(owner_code)
    
    if len(owners_detected) > 1:
        owners_list = ", ".join(sorted(owners_detected))
        print(f"  ⚠️  Multiple owners detected: {owners_list}")

if __name__ == "__main__":
    test_strain_owner_mapping()
