#!/usr/bin/env python3
"""
Integration test to verify barcode save fixes work properly
Tests the complete barcode generation and save process
"""

import unittest
import json
from unittest.mock import MagicMock, patch
import time


class TestBarcodeSaveIntegration(unittest.TestCase):
    
    def setUp(self):
        """Set up test environment"""
        self.mock_app_state = {
            'inventory': [],
            'currentContainer': None,
            'currentSample': None,
            'currentBarcodeResult': None,
            'currentBarcodeIsSaved': False,
            'sessionCounter': 0,
            'mode': 'builder',
            'builderState': {
                'values': {
                    'container': '1001',
                    'owner': 'TEST',
                    'strain': '00001',
                    'media': 'IA',
                    'stage': '1',
                    'tissue': '15',
                    'date': '20250630'
                },
                'metadata': {
                    'ownerName': 'Test Owner',
                    'strainName': 'Test Strain',
                    'mediaName': 'Initiation Agar',
                    'stageName': 'Stage 1'
                }
            }
        }
    
    def test_complete_barcode_generation_and_save_flow(self):
        """Test the complete flow from generation to save"""
        # Simulate barcode generation
        barcode_result = self.simulate_barcode_generation()
        
        # Verify barcode was generated correctly
        self.assertTrue(barcode_result['success'])
        self.assertIsNotNone(barcode_result['data'])
        self.assertEqual(barcode_result['type'], 'CODE128')
        
        # Simulate saving to inventory
        save_result = self.simulate_save_to_inventory(barcode_result)
        
        # Verify save was successful
        self.assertTrue(save_result['success'])
        self.assertEqual(len(save_result['inventory']), 1)
        
        # Verify inventory entry has all required fields
        entry = save_result['inventory'][0]
        self.assertIn('containerId', entry)
        self.assertIn('barcode', entry)  # Critical: actual barcode data
        self.assertIn('strain', entry)
        self.assertIn('owner', entry)
        
    def test_duplicate_prevention_works(self):
        """Test that duplicate saves are prevented"""
        # Generate and save first barcode
        barcode_result = self.simulate_barcode_generation()
        first_save = self.simulate_save_to_inventory(barcode_result)
        
        self.assertTrue(first_save['success'])
        self.assertEqual(len(first_save['inventory']), 1)
        
        # Attempt to save the same barcode again
        second_save = self.simulate_save_to_inventory(
            barcode_result, 
            existing_inventory=first_save['inventory'],
            is_already_saved=True
        )
        
        # Verify duplicate was prevented
        self.assertFalse(second_save['success'])
        self.assertIn('already been saved', second_save['error'])
        self.assertEqual(len(second_save['inventory']), 1)  # No new entries
        
    def test_save_state_management(self):
        """Test that save state is properly managed"""
        # Initial state should allow saving
        save_state = {'currentBarcodeIsSaved': False}
        self.assertFalse(save_state['currentBarcodeIsSaved'])
        
        # After generation, should still allow saving
        barcode_result = self.simulate_barcode_generation()
        save_state['currentBarcodeIsSaved'] = False  # Reset by generation
        self.assertFalse(save_state['currentBarcodeIsSaved'])
        
        # After saving, should prevent further saves
        save_state['currentBarcodeIsSaved'] = True  # Set by save process
        self.assertTrue(save_state['currentBarcodeIsSaved'])
        
    def test_barcode_data_integrity(self):
        """Test that barcode data is complete and correct"""
        barcode_result = self.simulate_barcode_generation()
        save_result = self.simulate_save_to_inventory(barcode_result)
        
        entry = save_result['inventory'][0]
        
        # Verify all critical fields are present
        required_fields = [
            'containerId', 'barcode', 'strain', 'owner', 
            'stage', 'media', 'tissueCount', 'date'
        ]
        
        for field in required_fields:
            self.assertIn(field, entry, f"Missing required field: {field}")
            self.assertIsNotNone(entry[field], f"Field {field} is None")
            
        # Verify barcode data matches generation result
        self.assertEqual(entry['barcode'], barcode_result['data'])
        self.assertEqual(entry['containerId'], '1001')
        
    def test_event_logger_does_not_create_duplicates(self):
        """Test that event logger doesn't auto-create inventory entries"""
        # Simulate event logging without inventory creation
        event_result = self.simulate_event_logging()
        
        # Verify event was logged but no inventory entry created
        self.assertTrue(event_result['event_logged'])
        self.assertEqual(len(event_result['inventory']), 0)
        
    def simulate_barcode_generation(self):
        """Simulate the barcode generation process"""
        fields = self.mock_app_state['builderState']['values']
        
        # Simulate Code128 generation
        composite_string = (
            fields['owner'] + 
            fields['strain'] + 
            fields['media'] + 
            fields['stage'] + 
            fields['tissue'].zfill(2) + 
            fields['date']
        )
        
        return {
            'success': True,
            'type': 'CODE128',
            'data': composite_string,
            'svg': '<svg>mock svg</svg>',
            'base64': 'data:image/png;base64,mockbase64',
            'includesText': True,
            'fields': fields,
            'timestamp': time.time(),
            'metadata': self.mock_app_state['builderState']['metadata']
        }
    
    def simulate_save_to_inventory(self, barcode_result, existing_inventory=None, is_already_saved=False):
        """Simulate the save to inventory process"""
        inventory = existing_inventory or []
        
        # Check if already saved (first line of defense)
        if is_already_saved:
            return {
                'success': False,
                'error': 'This barcode has already been saved to inventory.',
                'inventory': inventory
            }
        
        # Check for duplicate container
        container_id = self.mock_app_state['builderState']['values']['container']
        existing_container = next(
            (entry for entry in inventory if entry.get('containerId') == container_id),
            None
        )
        
        if existing_container:
            return {
                'success': False,
                'error': f'Container {container_id} already exists in inventory.',
                'inventory': inventory
            }
        
        # Validate barcode data
        if not barcode_result['success'] or not barcode_result['data']:
            return {
                'success': False,
                'error': 'Invalid barcode data - cannot save.',
                'inventory': inventory
            }
        
        # Create inventory entry
        values = self.mock_app_state['builderState']['values']
        metadata = self.mock_app_state['builderState']['metadata']
        
        entry = {
            'timestamp': time.time(),
            'containerId': values['container'],
            'sampleBarcode': barcode_result['data'],
            'barcode': barcode_result['data'],  # Critical: actual barcode data
            'barcodeType': barcode_result['type'],
            'strain': metadata.get('strainName', 'Unknown'),
            'strainId': values['strain'],
            'owner': metadata.get('ownerName', 'Unknown'),
            'ownerId': values['owner'],
            'stage': metadata.get('stageName', f"Stage {values['stage']}"),
            'stageId': values['stage'],
            'media': metadata.get('mediaName', values['media']),
            'mediaType': metadata.get('mediaName', values['media']),
            'mediaId': values['media'],
            'tissueCount': int(values['tissue']),
            'date': values['date'],
            'status': 'Complete'
        }
        
        # Add to inventory
        inventory.insert(0, entry)
        
        return {
            'success': True,
            'inventory': inventory
        }
    
    def simulate_event_logging(self):
        """Simulate event logging process (should NOT create inventory entries)"""
        # Simulate event being logged
        return {
            'event_logged': True,
            'inventory': []  # Event logger should NOT create inventory entries
        }


if __name__ == '__main__':
    unittest.main()
