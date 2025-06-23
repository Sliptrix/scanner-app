#!/usr/bin/env python3
"""
Enhanced Transfer System Test Runner

This script runs all unit tests for the enhanced transfer system and provides
comprehensive test reporting. Follows the test-driven development approach.
"""

import unittest
import sys
import os
import time
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr

# Add the tests directory to the path
sys.path.insert(0, os.path.dirname(__file__))

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header():
    """Print the test suite header."""
    print(f"{Colors.BOLD}{Colors.HEADER}")
    print("=" * 70)
    print("🧪 ENHANCED TRANSFER SYSTEM - COMPREHENSIVE TEST SUITE")
    print("=" * 70)
    print(f"{Colors.ENDC}")
    print(f"{Colors.OKBLUE}Testing technician control features and laboratory workflow{Colors.ENDC}")
    print()

def print_test_category(category_name):
    """Print a test category header."""
    print(f"{Colors.BOLD}{Colors.OKCYAN}")
    print(f"📋 {category_name}")
    print("-" * 50)
    print(f"{Colors.ENDC}")

def run_test_category(test_class, category_name):
    """Run tests for a specific category and return results."""
    print_test_category(category_name)
    
    # Create test suite for this category
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(test_class)
    
    # Capture output
    test_output = StringIO()
    
    # Run tests with custom result handler
    runner = unittest.TextTestRunner(
        stream=test_output,
        verbosity=2,
        buffer=True
    )
    
    start_time = time.time()
    result = runner.run(suite)
    end_time = time.time()
    
    # Print results
    passed = result.testsRun - len(result.failures) - len(result.errors)
    
    print(f"Tests run: {result.testsRun}")
    print(f"{Colors.OKGREEN}✓ Passed: {passed}{Colors.ENDC}")
    
    if result.failures:
        print(f"{Colors.FAIL}✗ Failed: {len(result.failures)}{Colors.ENDC}")
        for test, traceback in result.failures:
            print(f"  - {test}: {traceback.split('AssertionError:')[-1].strip() if 'AssertionError:' in traceback else 'Unknown failure'}")
    
    if result.errors:
        print(f"{Colors.WARNING}⚠ Errors: {len(result.errors)}{Colors.ENDC}")
        for test, traceback in result.errors:
            print(f"  - {test}: {traceback.split('Error:')[-1].strip() if 'Error:' in traceback else 'Unknown error'}")
    
    print(f"Duration: {end_time - start_time:.2f}s")
    print()
    
    return {
        'category': category_name,
        'total': result.testsRun,
        'passed': passed,
        'failed': len(result.failures),
        'errors': len(result.errors),
        'duration': end_time - start_time,
        'success': len(result.failures) + len(result.errors) == 0
    }

def print_summary(results):
    """Print overall test summary."""
    print(f"{Colors.BOLD}{Colors.HEADER}")
    print("=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    print(f"{Colors.ENDC}")
    
    total_tests = sum(r['total'] for r in results)
    total_passed = sum(r['passed'] for r in results)
    total_failed = sum(r['failed'] for r in results)
    total_errors = sum(r['errors'] for r in results)
    total_duration = sum(r['duration'] for r in results)
    
    success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"Total Tests: {total_tests}")
    print(f"{Colors.OKGREEN}✓ Passed: {total_passed}{Colors.ENDC}")
    if total_failed > 0:
        print(f"{Colors.FAIL}✗ Failed: {total_failed}{Colors.ENDC}")
    if total_errors > 0:
        print(f"{Colors.WARNING}⚠ Errors: {total_errors}{Colors.ENDC}")
    
    print(f"Success Rate: {success_rate:.1f}%")
    print(f"Total Duration: {total_duration:.2f}s")
    
    print()
    print("Category Breakdown:")
    for result in results:
        status = "✓" if result['success'] else "✗"
        color = Colors.OKGREEN if result['success'] else Colors.FAIL
        print(f"  {color}{status} {result['category']}: {result['passed']}/{result['total']} passed{Colors.ENDC}")
    
    print()
    
    if total_failed == 0 and total_errors == 0:
        print(f"{Colors.BOLD}{Colors.OKGREEN}")
        print("🎉 ALL TESTS PASSED! System ready for implementation.")
        print(f"{Colors.ENDC}")
        return True
    else:
        print(f"{Colors.BOLD}{Colors.FAIL}")
        print("❌ SOME TESTS FAILED! Fix issues before proceeding with implementation.")
        print(f"{Colors.ENDC}")
        print(f"{Colors.WARNING}Following TDD principles: All tests must pass before implementing code.{Colors.ENDC}")
        return False

def main():
    """Main test runner function."""
    print_header()
    
    # Import test classes
    try:
        from unit.test_transfer_system import (
            TestTransferInputManager,
            TestTransferProcessor,
            TestTechnicianControlFeatures,
            TestUserInterfaceValidation
        )
        from unit.test_barcode_enhancements import (
            TestCode128BarcodeGeneration,
            TestBarcodeScanning,
            TestBarcodeEventPersistence
        )
    except ImportError as e:
        print(f"{Colors.FAIL}Error importing test modules: {e}{Colors.ENDC}")
        sys.exit(1)
    
    # Define test categories
    test_categories = [
        (TestTransferInputManager, "Transfer Input Management"),
        (TestTransferProcessor, "Transfer Processing Logic"),
        (TestTechnicianControlFeatures, "Technician Control Features"),
        (TestUserInterfaceValidation, "User Interface Validation"),
        (TestCode128BarcodeGeneration, "Code128 Barcode Generation"),
        (TestBarcodeScanning, "Barcode Scanning & Parsing"),
        (TestBarcodeEventPersistence, "Barcode Event Persistence")
    ]
    
    # Run all test categories
    results = []
    for test_class, category_name in test_categories:
        result = run_test_category(test_class, category_name)
        results.append(result)
    
    # Print overall summary
    all_passed = print_summary(results)
    
    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)

if __name__ == '__main__':
    main()
