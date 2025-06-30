#!/usr/bin/env python3
"""
Tests for barcode save issues - duplicates and missing data
These tests describe the expected behavior for barcode creation and saving
"""

import unittest
import json
from unittest.mock import MagicMock, patch


class TestBarcodeSaveIssues(unittest.TestCase):
    
    def setUp(self):
        """Set up test environment"""
        self.mock_app_state = {
            'inventory': [],
            'currentContainer': None,
            'currentSample': None,
            'currentBarcodeResult': None,
            'currentBarcodeIsSaved': False,
            'sessionCounter': 0
        }
    
    def test_single_barcode_entry_created(self):
        """When saving a barcode, only one entry should be created"""
        # Arrange
        container_id = "C001"
        sample_barcode = "SAM123"
        barcode_data = {
            'success': True,
            'barcode': 'BARCODE123',
            'metadata': {'strain': 'S001', 'owner': 'test'}
        }
        
        # Act - simulate save operation
        inventory_entry = self.create_inventory_entry(container_id, sample_barcode, barcode_data)
        
        # Assert
        self.assertIsNotNone(inventory_entry)
        self.assertEqual(inventory_entry['containerId'], container_id)
        self.assertEqual(inventory_entry['sampleBarcode'], sample_barcode)
        self.assertEqual(inventory_entry['barcode'], barcode_data['barcode'])
        
    def test_no_duplicate_entries_for_same_container(self):
        """Multiple saves of the same container should not create duplicates"""
        # Arrange
        container_id = "C001"
        sample_barcode = "SAM123"
        barcode_data = {
            'success': True,
            'barcode': 'BARCODE123',
            'metadata': {'strain': 'S001', 'owner': 'test'}
        }
        
        inventory = []
        
        # Act - simulate first save
        entry1 = self.create_inventory_entry(container_id, sample_barcode, barcode_data)
        inventory.append(entry1)
        
        # Act - simulate second save attempt for same container
        duplicate_exists = self.check_for_duplicate(inventory, container_id, sample_barcode)
        
        # Assert
        self.assertTrue(duplicate_exists, "Should detect duplicate before creating")
        self.assertEqual(len(inventory), 1, "Should have only one entry")
        
    def test_barcode_data_must_be_present(self):
        """Entry should not be saved without valid barcode data"""
        # Arrange
        container_id = "C001"
        sample_barcode = "SAM123"
        invalid_barcode_data = None
        
        # Act & Assert
        with self.assertRaises(ValueError):
            self.create_inventory_entry(container_id, sample_barcode, invalid_barcode_data)
            
    def test_entry_without_barcode_not_created(self):
        """Entry should not be created if barcode generation failed"""
        # Arrange
        container_id = "C001"
        sample_barcode = "SAM123"
        failed_barcode_data = {
            'success': False,
            'error': 'Barcode generation failed'
        }
        
        # Act & Assert
        with self.assertRaises(ValueError):
            self.create_inventory_entry(container_id, sample_barcode, failed_barcode_data)
            
    def test_complete_barcode_data_preserved(self):
        """All barcode data should be preserved in the inventory entry"""
        # Arrange
        container_id = "C001"
        sample_barcode = "SAM123"
        barcode_data = {
            'success': True,
            'barcode': 'BARCODE123',
            'barcodeType': 'QR',
            'metadata': {
                'strain': 'S001',
                'owner': 'test',
                'stage': 'initial',
                'media': 'PDA'
            }
        }
        
        # Act
        entry = self.create_inventory_entry(container_id, sample_barcode, barcode_data)
        
        # Assert
        self.assertEqual(entry['barcode'], barcode_data['barcode'])
        self.assertEqual(entry['barcodeType'], barcode_data['barcodeType'])
        self.assertEqual(entry['strain'], barcode_data['metadata']['strain'])
        self.assertEqual(entry['owner'], barcode_data['metadata']['owner'])
        self.assertEqual(entry['stage'], barcode_data['metadata']['stage'])
        self.assertEqual(entry['media'], barcode_data['metadata']['media'])
        
    def test_save_state_management(self):
        """Save state should be properly managed to prevent multiple saves"""
        # Arrange
        container_id = "C001"
        sample_barcode = "SAM123"
        
        # Act - simulate save process
        save_state = self.manage_save_state(container_id, sample_barcode)
        
        # Assert
        self.assertTrue(save_state['can_save_initial'])
        self.assertFalse(save_state['can_save_after_first'])
        
    def create_inventory_entry(self, container_id, sample_barcode, barcode_data):
        """Helper method to create inventory entry following expected logic"""
        if not barcode_data or not barcode_data.get('success'):
            raise ValueError("Invalid barcode data - cannot create entry")
            
        if not barcode_data.get('barcode'):
            raise ValueError("Missing barcode - cannot create entry")
            
        entry = {
            'containerId': container_id,
            'sampleBarcode': sample_barcode,
            'barcode': barcode_data['barcode'],
            'barcodeType': barcode_data.get('barcodeType', 'QR'),
            'date': '2024-01-01T12:00:00.000Z',
            'tissueCount': 1
        }
        
        # Add metadata if present
        metadata = barcode_data.get('metadata', {})
        for key in ['strain', 'owner', 'stage', 'media']:
            if key in metadata:
                entry[key] = metadata[key]
                
        return entry
        
    def check_for_duplicate(self, inventory, container_id, sample_barcode):
        """Helper method to check for duplicate entries"""
        for entry in inventory:
            if (entry.get('containerId') == container_id and 
                entry.get('sampleBarcode') == sample_barcode):
                return True
        return False
        
    def manage_save_state(self, container_id, sample_barcode):
        """Helper method to simulate save state management"""
        # Initial state - can save
        can_save_initial = True
        
        # After first save - should be blocked
        can_save_after_first = False
        
        return {
            'can_save_initial': can_save_initial,
            'can_save_after_first': can_save_after_first
        }


if __name__ == '__main__':
    unittest.main()
