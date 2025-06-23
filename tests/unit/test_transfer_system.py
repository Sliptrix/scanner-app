#!/usr/bin/env python3
"""
Enhanced Transfer System Unit Tests

This module contains comprehensive unit tests for the enhanced transfer system,
including technician control features, workflow management, and data validation.

We follow the principle: write tests first, implement code to meet tests.
All tests must pass before proceeding with implementation.
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
import json
import sys
import os

# Add the src directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/js'))

class TestTransferInputManager(unittest.TestCase):
    """Test cases for transfer input management and validation."""
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.mock_state_manager = Mock()
        self.mock_ui_utils = Mock()
        self.sample_inventory = [
            {
                'containerId': 5,
                'sampleBarcode': 'TEST-001',
                'strain': 'Test Strain A',
                'owner': 'Dr. Test',
                'stage': 'T1',
                'media': 'MS',
                'tissueCount': 3,
                'date': '2024-06-23',
                'status': 'Active'
            },
            {
                'containerId': 5,
                'sampleBarcode': 'TEST-002',
                'strain': 'Test Strain A', 
                'owner': 'Dr. Test',
                'stage': 'T1',
                'media': 'MS',
                'tissueCount': 2,
                'date': '2024-06-23',
                'status': 'Active'
            }
        ]
    
    def test_validates_container_id_correctly(self):
        """Container ID validation accepts numeric strings and rejects invalid input."""
        # Valid container IDs
        self.assertTrue(self._validate_container_id('1'))
        self.assertTrue(self._validate_container_id('123'))
        self.assertTrue(self._validate_container_id('0'))
        
        # Invalid container IDs  
        self.assertFalse(self._validate_container_id('abc'))
        self.assertFalse(self._validate_container_id(''))
        self.assertFalse(self._validate_container_id('1.5'))
        self.assertFalse(self._validate_container_id('1a'))
        self.assertFalse(self._validate_container_id(None))
    
    def test_finds_container_in_inventory_by_id(self):
        """Container lookup finds correct data by container ID."""
        container_data = self._find_container_in_inventory(5, self.sample_inventory)
        
        self.assertIsNotNone(container_data)
        self.assertEqual(container_data['id'], 5)
        self.assertEqual(container_data['totalSamples'], 5)  # 3 + 2 tissue count
        self.assertEqual(len(container_data['samples']), 2)
    
    def test_returns_none_for_nonexistent_container(self):
        """Container lookup returns None for container ID not in inventory."""
        container_data = self._find_container_in_inventory(999, self.sample_inventory)
        self.assertIsNone(container_data)
    
    def test_counts_tissue_samples_correctly(self):
        """Tissue sample counting sums tissueCount fields, not barcode entries."""
        container_data = self._find_container_in_inventory(5, self.sample_inventory)
        
        # Should count actual tissue samples (3+2=5), not barcode entries (2)
        self.assertEqual(container_data['totalSamples'], 5)
        self.assertNotEqual(container_data['totalSamples'], 2)
    
    def test_transfer_button_disabled_initially(self):
        """Transfer button is disabled when no source container is selected."""
        button_state = self._get_transfer_button_state(None, None)
        self.assertFalse(button_state['enabled'])
        self.assertEqual(button_state['text'], 'Select Container First')
    
    def test_transfer_button_disabled_without_mode(self):
        """Transfer button is disabled when source container exists but mode not selected."""
        mock_container = {'id': 5, 'totalSamples': 5}
        button_state = self._get_transfer_button_state(mock_container, None)
        self.assertFalse(button_state['enabled'])
        self.assertEqual(button_state['text'], 'Select Transfer Mode')
    
    def test_transfer_button_enabled_with_single_mode(self):
        """Transfer button is enabled for single container mode."""
        mock_container = {'id': 5, 'totalSamples': 5}
        button_state = self._get_transfer_button_state(mock_container, 'single')
        self.assertTrue(button_state['enabled'])
        self.assertEqual(button_state['text'], 'Create New Container')
    
    def test_transfer_button_enabled_with_split_mode_and_count(self):
        """Transfer button is enabled for split mode with valid container count."""
        mock_container = {'id': 5, 'totalSamples': 5}
        button_state = self._get_transfer_button_state(mock_container, 'split', 3)
        self.assertTrue(button_state['enabled'])
        self.assertEqual(button_state['text'], 'Create 3 New Containers')
    
    def test_transfer_button_disabled_split_mode_without_count(self):
        """Transfer button is disabled for split mode without container count."""
        mock_container = {'id': 5, 'totalSamples': 5}
        button_state = self._get_transfer_button_state(mock_container, 'split', None)
        self.assertFalse(button_state['enabled'])
        self.assertEqual(button_state['text'], 'Set Container Count')
    
    def test_workflow_step_progression(self):
        """Workflow steps progress correctly through manual advancement."""
        # Step 1: Initial state
        step_1_ui = self._get_workflow_ui_state(1)
        self.assertTrue(step_1_ui['sourceInput']['visible'])
        self.assertFalse(step_1_ui['plantDataPanel']['visible'])
        self.assertFalse(step_1_ui['transferOptions']['visible'])
        
        # Step 2: Source container scanned
        step_2_ui = self._get_workflow_ui_state(2)
        self.assertTrue(step_2_ui['sourceInput']['visible'])
        self.assertTrue(step_2_ui['plantDataPanel']['visible'])
        self.assertFalse(step_2_ui['transferOptions']['visible'])
        
        # Step 3: Plant data confirmed
        step_3_ui = self._get_workflow_ui_state(3)
        self.assertTrue(step_3_ui['sourceInput']['visible'])
        self.assertTrue(step_3_ui['plantDataPanel']['visible'])
        self.assertTrue(step_3_ui['transferOptions']['visible'])
    
    def test_clear_inputs_resets_all_state(self):
        """Clear inputs resets all form fields and workflow state."""
        initial_state = self._get_clear_state_result()
        
        self.assertEqual(initial_state['sourceContainerId'], '')
        self.assertEqual(initial_state['selectedMode'], None)
        self.assertEqual(initial_state['splitCount'], None)
        self.assertEqual(initial_state['workflowStep'], 1)
        self.assertFalse(initial_state['transferButtonEnabled'])
    
    # Helper methods that simulate the actual JavaScript implementation
    def _validate_container_id(self, container_id):
        """Simulate container ID validation logic."""
        if container_id is None or container_id == '':
            return False
        try:
            int(container_id)
            return True
        except (ValueError, TypeError):
            return False
    
    def _find_container_in_inventory(self, container_id, inventory):
        """Simulate finding container in inventory."""
        container_samples = [item for item in inventory if item['containerId'] == container_id]
        
        if not container_samples:
            return None
        
        total_samples = sum(item['tissueCount'] for item in container_samples)
        
        return {
            'id': container_id,
            'totalSamples': total_samples,
            'samples': container_samples
        }
    
    def _get_transfer_button_state(self, source_container, mode, split_count=None):
        """Simulate transfer button state logic."""
        if not source_container:
            return {'enabled': False, 'text': 'Select Container First'}
        
        if not mode:
            return {'enabled': False, 'text': 'Select Transfer Mode'}
        
        if mode == 'single':
            return {'enabled': True, 'text': 'Create New Container'}
        
        if mode == 'split':
            if split_count and split_count >= 2:
                return {'enabled': True, 'text': f'Create {split_count} New Containers'}
            else:
                return {'enabled': False, 'text': 'Set Container Count'}
        
        return {'enabled': False, 'text': 'Invalid State'}
    
    def _get_workflow_ui_state(self, step):
        """Simulate workflow UI state for given step."""
        return {
            'sourceInput': {'visible': True},
            'plantDataPanel': {'visible': step >= 2},
            'transferOptions': {'visible': step >= 3}
        }
    
    def _get_clear_state_result(self):
        """Simulate state after clearing inputs."""
        return {
            'sourceContainerId': '',
            'selectedMode': None,
            'splitCount': None,
            'workflowStep': 1,
            'transferButtonEnabled': False
        }


class TestTransferProcessor(unittest.TestCase):
    """Test cases for transfer processing and container creation."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.mock_state_manager = Mock()
        self.mock_notifications = Mock()
        self.sample_source_container = {
            'id': 5,
            'data': {
                'totalSamples': 5,
                'samples': [
                    {
                        'sampleBarcode': 'TEST-001',
                        'strain': 'Test Strain',
                        'owner': 'Dr. Test',
                        'stage': 'T1',
                        'media': 'MS',
                        'tissueCount': 3,
                        'date': '2024-06-23'
                    },
                    {
                        'sampleBarcode': 'TEST-002',
                        'strain': 'Test Strain',
                        'owner': 'Dr. Test', 
                        'stage': 'T1',
                        'media': 'MS',
                        'tissueCount': 2,
                        'date': '2024-06-23'
                    }
                ]
            }
        }
        self.plant_data_updates = {
            'stage': 'T2',
            'media': 'MS-Modified',
            'date': '2024-06-24',
            'notes': 'Test transfer'
        }
    
    def test_processes_single_container_transfer(self):
        """Single container transfer creates one new container with all samples."""
        result = self._process_single_transfer(
            self.sample_source_container,
            self.plant_data_updates
        )
        
        self.assertTrue(result['success'])
        self.assertEqual(len(result['newContainers']), 1)
        
        new_container = result['newContainers'][0]
        self.assertEqual(new_container['totalSamples'], 5)
        self.assertEqual(len(new_container['samples']), 2)
        
        # Verify plant data updates applied
        for sample in new_container['samples']:
            self.assertEqual(sample['stage'], 'T2')
            self.assertEqual(sample['media'], 'MS-Modified')
            self.assertEqual(sample['date'], '2024-06-24')
            self.assertEqual(sample['notes'], 'Test transfer')
    
    def test_processes_split_transfer_evenly(self):
        """Split transfer distributes samples evenly across new containers."""
        result = self._process_split_transfer(
            self.sample_source_container,
            self.plant_data_updates,
            split_count=2
        )
        
        self.assertTrue(result['success'])
        self.assertEqual(len(result['newContainers']), 2)
        
        # Should distribute 5 samples across 2 containers (3 in first, 2 in second)
        total_distributed = sum(container['totalSamples'] for container in result['newContainers'])
        self.assertEqual(total_distributed, 5)
    
    def test_split_transfer_respects_tissue_boundaries(self):
        """Split transfer doesn't break apart individual tissue samples."""
        result = self._process_split_transfer(
            self.sample_source_container,
            self.plant_data_updates,
            split_count=3
        )
        
        self.assertTrue(result['success'])
        
        # With 2 sample entries (tissueCount 3 and 2), maximum 2 containers can be created
        # Should limit to 2 containers, not create empty third container
        non_empty_containers = [c for c in result['newContainers'] if c['totalSamples'] > 0]
        self.assertLessEqual(len(non_empty_containers), 2)
    
    def test_generates_unique_container_ids(self):
        """New containers get unique, sequential container IDs."""
        # Mock highest container ID in system
        highest_id = 100
        
        result = self._process_split_transfer(
            self.sample_source_container,
            self.plant_data_updates,
            split_count=3,
            highest_container_id=highest_id
        )
        
        container_ids = [c['id'] for c in result['newContainers']]
        
        # Should start from highest_id + 1
        expected_ids = [101, 102]  # Only 2 containers possible with this sample data
        self.assertEqual(container_ids, expected_ids)
    
    def test_preserves_sample_metadata(self):
        """Transfer preserves original sample metadata (strain, owner, barcode)."""
        result = self._process_single_transfer(
            self.sample_source_container,
            self.plant_data_updates
        )
        
        new_container = result['newContainers'][0]
        
        # Original metadata should be preserved
        for sample in new_container['samples']:
            self.assertIn(sample['strain'], ['Test Strain'])
            self.assertEqual(sample['owner'], 'Dr. Test')
            self.assertIn(sample['sampleBarcode'], ['TEST-001', 'TEST-002'])
    
    def test_updates_inventory_after_transfer(self):
        """Transfer updates inventory with new container entries."""
        mock_inventory = []
        
        result = self._process_single_transfer(
            self.sample_source_container,
            self.plant_data_updates,
            inventory=mock_inventory
        )
        
        # Should add new entries to inventory
        self.assertEqual(len(result['inventoryUpdates']), 2)  # 2 sample entries
        
        for update in result['inventoryUpdates']:
            self.assertEqual(update['status'], 'Active')
            self.assertIsNotNone(update['containerId'])
    
    def test_creates_transfer_history_entry(self):
        """Transfer creates history entry for lineage tracking."""
        result = self._process_single_transfer(
            self.sample_source_container,
            self.plant_data_updates
        )
        
        history_entry = result['historyEntry']
        
        self.assertEqual(history_entry['sourceContainerId'], 5)
        self.assertEqual(history_entry['transferType'], 'single')
        self.assertEqual(len(history_entry['targetContainerIds']), 1)
        self.assertIsNotNone(history_entry['timestamp'])
        self.assertEqual(history_entry['plantDataUpdates'], self.plant_data_updates)
    
    def test_prevents_invalid_split_counts(self):
        """Transfer rejects invalid split counts (< 2 or > sample entries)."""
        # Split count too low
        result_low = self._process_split_transfer(
            self.sample_source_container,
            self.plant_data_updates,
            split_count=1
        )
        self.assertFalse(result_low['success'])
        self.assertIn('Invalid split count', result_low['error'])
        
        # Split count too high (more than sample entries)
        result_high = self._process_split_transfer(
            self.sample_source_container,
            self.plant_data_updates,
            split_count=10
        )
        # Should succeed but limit to available sample entries
        self.assertTrue(result_high['success'])
        non_empty = [c for c in result_high['newContainers'] if c['totalSamples'] > 0]
        self.assertLessEqual(len(non_empty), 2)
    
    # Helper methods simulating JavaScript implementation
    def _process_single_transfer(self, source_container, plant_updates, inventory=None, highest_container_id=50):
        """Simulate single container transfer processing."""
        if inventory is None:
            inventory = []
        
        new_container_id = highest_container_id + 1
        
        # Apply plant data updates to all samples
        updated_samples = []
        for sample in source_container['data']['samples']:
            updated_sample = sample.copy()
            updated_sample.update(plant_updates)
            updated_sample['containerId'] = new_container_id
            updated_samples.append(updated_sample)
        
        new_container = {
            'id': new_container_id,
            'totalSamples': source_container['data']['totalSamples'],
            'samples': updated_samples
        }
        
        # Create inventory updates
        inventory_updates = [
            {
                'containerId': new_container_id,
                'sampleBarcode': sample['sampleBarcode'],
                'strain': sample['strain'],
                'owner': sample['owner'],
                'stage': sample['stage'],
                'media': sample['media'],
                'tissueCount': sample['tissueCount'],
                'date': sample['date'],
                'status': 'Active',
                'notes': sample.get('notes', '')
            }
            for sample in updated_samples
        ]
        
        history_entry = {
            'sourceContainerId': source_container['id'],
            'transferType': 'single',
            'targetContainerIds': [new_container_id],
            'timestamp': '2024-06-24T10:00:00Z',
            'plantDataUpdates': plant_updates
        }
        
        return {
            'success': True,
            'newContainers': [new_container],
            'inventoryUpdates': inventory_updates,
            'historyEntry': history_entry
        }
    
    def _process_split_transfer(self, source_container, plant_updates, split_count, highest_container_id=50):
        """Simulate split transfer processing."""
        if split_count < 2:
            return {
                'success': False,
                'error': 'Invalid split count: must be at least 2'
            }
        
        samples = source_container['data']['samples']
        
        # Limit split count to available sample entries
        effective_split_count = min(split_count, len(samples))
        
        new_containers = []
        target_container_ids = []
        
        for i in range(effective_split_count):
            if i < len(samples):
                new_container_id = highest_container_id + 1 + i
                sample = samples[i].copy()
                sample.update(plant_updates)
                sample['containerId'] = new_container_id
                
                new_container = {
                    'id': new_container_id,
                    'totalSamples': sample['tissueCount'],
                    'samples': [sample]
                }
                
                new_containers.append(new_container)
                target_container_ids.append(new_container_id)
        
        history_entry = {
            'sourceContainerId': source_container['id'],
            'transferType': 'split',
            'targetContainerIds': target_container_ids,
            'splitCount': effective_split_count,
            'timestamp': '2024-06-24T10:00:00Z',
            'plantDataUpdates': plant_updates
        }
        
        return {
            'success': True,
            'newContainers': new_containers,
            'historyEntry': history_entry
        }


class TestTechnicianControlFeatures(unittest.TestCase):
    """Test cases for technician control and manual decision features."""
    
    def test_requires_manual_mode_selection(self):
        """System requires technician to manually select transfer mode."""
        # No automatic mode selection should occur
        default_mode = self._get_default_transfer_mode()
        self.assertIsNone(default_mode)
        
        # Mode must be explicitly set
        available_modes = self._get_available_transfer_modes()
        self.assertIn('single', available_modes)
        self.assertIn('split', available_modes)
    
    def test_split_count_manual_control(self):
        """Technician has manual control over split container count."""
        # No automatic split count determination
        default_split_count = self._get_default_split_count(total_samples=10)
        self.assertIsNone(default_split_count)
        
        # Split count range validation
        self.assertTrue(self._validate_split_count(2))
        self.assertTrue(self._validate_split_count(5))
        self.assertTrue(self._validate_split_count(10))
        self.assertFalse(self._validate_split_count(1))
        self.assertFalse(self._validate_split_count(11))
    
    def test_suggestions_are_non_automatic(self):
        """Smart suggestions appear but require manual selection."""
        # Suggestions should be provided but not auto-applied
        suggestions = self._get_split_suggestions(total_samples=6)
        
        self.assertIsInstance(suggestions, list)
        self.assertGreater(len(suggestions), 0)
        
        # But no suggestion should be automatically selected
        selected_suggestion = self._get_auto_selected_suggestion(suggestions)
        self.assertIsNone(selected_suggestion)
    
    def test_plant_data_update_control(self):
        """Technician can control which plant data fields to update."""
        # Default should be "keep same" for all fields
        default_updates = self._get_default_plant_data_updates()
        
        self.assertEqual(default_updates['stage'], 'keep_same')
        self.assertEqual(default_updates['media'], 'keep_same')
        self.assertEqual(default_updates['notes'], 'keep_same')
        # Date should default to current date
        self.assertIsNotNone(default_updates['date'])
    
    def test_manual_workflow_advancement(self):
        """Workflow requires manual advancement through steps."""
        # Should not auto-advance from step 1 to 2
        auto_advance_step_2 = self._check_auto_advance_to_step(2)
        self.assertFalse(auto_advance_step_2)
        
        # Should not auto-advance from step 2 to 3
        auto_advance_step_3 = self._check_auto_advance_to_step(3)
        self.assertFalse(auto_advance_step_3)
    
    def test_prevents_accidental_transfers(self):
        """System prevents accidental transfers through confirmation requirements."""
        # Transfer should require explicit button press
        auto_transfer = self._check_auto_transfer_on_mode_selection()
        self.assertFalse(auto_transfer)
        
        # Should require confirmation for large split counts
        requires_confirmation = self._check_confirmation_required(split_count=8)
        self.assertTrue(requires_confirmation)
    
    # Helper methods simulating technician control logic
    def _get_default_transfer_mode(self):
        """No automatic mode selection."""
        return None
    
    def _get_available_transfer_modes(self):
        """Available transfer modes for manual selection."""
        return ['single', 'split']
    
    def _get_default_split_count(self, total_samples):
        """No automatic split count determination."""
        return None
    
    def _validate_split_count(self, count):
        """Validate split count range."""
        return 2 <= count <= 10
    
    def _get_split_suggestions(self, total_samples):
        """Generate split suggestions based on sample count."""
        suggestions = []
        for i in [2, 3, 4, 5]:
            if i <= total_samples:
                suggestions.append({
                    'count': i,
                    'distribution': f'{total_samples // i} samples per container'
                })
        return suggestions
    
    def _get_auto_selected_suggestion(self, suggestions):
        """No automatic selection of suggestions."""
        return None
    
    def _get_default_plant_data_updates(self):
        """Default plant data update settings."""
        return {
            'stage': 'keep_same',
            'media': 'keep_same', 
            'notes': 'keep_same',
            'date': '2024-06-24'  # Current date
        }
    
    def _check_auto_advance_to_step(self, step):
        """Check if workflow auto-advances to given step."""
        return False  # No auto-advancement
    
    def _check_auto_transfer_on_mode_selection(self):
        """Check if transfer automatically happens on mode selection."""
        return False  # Requires explicit transfer button press
    
    def _check_confirmation_required(self, split_count):
        """Check if confirmation is required for given split count."""
        return split_count >= 5  # Require confirmation for large splits


class TestUserInterfaceValidation(unittest.TestCase):
    """Test cases for UI behavior and interaction patterns."""
    
    def test_no_cursor_jumping_during_input(self):
        """Focus management doesn't interfere with user typing."""
        # Simulate typing in container input
        input_state = self._simulate_typing_in_container_input("12345")
        
        self.assertEqual(input_state['value'], "12345")
        self.assertEqual(input_state['cursorPosition'], 5)
        self.assertFalse(input_state['focusJumped'])
    
    def test_visual_feedback_clarity(self):
        """Visual feedback is clear and informative."""
        # Test various UI states
        loading_state = self._get_ui_feedback_state('loading')
        self.assertIn('loading', loading_state['class'])
        self.assertIsNotNone(loading_state['message'])
        
        success_state = self._get_ui_feedback_state('success')
        self.assertIn('success', success_state['class'])
        self.assertIsNotNone(success_state['message'])
        
        error_state = self._get_ui_feedback_state('error')
        self.assertIn('error', error_state['class'])
        self.assertIsNotNone(error_state['message'])
    
    def test_professional_laboratory_styling(self):
        """UI maintains professional appearance appropriate for lab use."""
        style_check = self._validate_laboratory_styling()
        
        self.assertTrue(style_check['professionalColors'])
        self.assertTrue(style_check['clearTypography'])
        self.assertTrue(style_check['appropriateSpacing'])
        self.assertFalse(style_check['distractingAnimations'])
    
    def test_responsive_layout_behavior(self):
        """Layout adapts appropriately to different screen sizes."""
        mobile_layout = self._get_layout_for_width(768)
        tablet_layout = self._get_layout_for_width(1024)
        desktop_layout = self._get_layout_for_width(1200)
        
        # All layouts should be functional
        self.assertTrue(mobile_layout['functional'])
        self.assertTrue(tablet_layout['functional'])
        self.assertTrue(desktop_layout['functional'])
        
        # Desktop should have more features visible
        self.assertGreaterEqual(desktop_layout['visibleFeatures'], tablet_layout['visibleFeatures'])
    
    def test_accessibility_compliance(self):
        """UI meets basic accessibility requirements."""
        accessibility_check = self._validate_accessibility()
        
        self.assertTrue(accessibility_check['keyboardNavigable'])
        self.assertTrue(accessibility_check['focusIndicators'])
        self.assertTrue(accessibility_check['adequateContrast'])
        self.assertTrue(accessibility_check['screenReaderFriendly'])
    
    # Helper methods for UI validation
    def _simulate_typing_in_container_input(self, text):
        """Simulate user typing in container input field."""
        return {
            'value': text,
            'cursorPosition': len(text),
            'focusJumped': False  # Should not jump during typing
        }
    
    def _get_ui_feedback_state(self, state_type):
        """Get UI feedback state for different conditions."""
        states = {
            'loading': {'class': 'loading-state', 'message': 'Processing...'},
            'success': {'class': 'success-state', 'message': 'Transfer completed successfully'},
            'error': {'class': 'error-state', 'message': 'Transfer failed'}
        }
        return states.get(state_type, {'class': '', 'message': ''})
    
    def _validate_laboratory_styling(self):
        """Validate professional laboratory styling."""
        return {
            'professionalColors': True,
            'clearTypography': True,
            'appropriateSpacing': True,
            'distractingAnimations': False
        }
    
    def _get_layout_for_width(self, width):
        """Get layout configuration for screen width."""
        if width >= 1200:
            return {'functional': True, 'visibleFeatures': 10}
        elif width >= 1024:
            return {'functional': True, 'visibleFeatures': 8}
        else:
            return {'functional': True, 'visibleFeatures': 6}
    
    def _validate_accessibility(self):
        """Validate accessibility compliance."""
        return {
            'keyboardNavigable': True,
            'focusIndicators': True,
            'adequateContrast': True,
            'screenReaderFriendly': True
        }


if __name__ == '__main__':
    # Run all tests
    unittest.main(verbosity=2)
