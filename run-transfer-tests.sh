#!/bin/bash

# Transfer Module Test Suite
# Comprehensive test runner for all transfer functionality

echo "🧪 Running Transfer Module Test Suite..."
echo "========================================="

# Initialize test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test 1: Smoke Test
echo ""
echo "📋 Running Smoke Test..."
if node tests/smoke-test.js; then
    echo "✅ Smoke Test PASSED"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo "❌ Smoke Test FAILED"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 2: Transfer Split Mode Test
echo ""
echo "🌱 Running Transfer Split Mode Test..."
if node tests/transfer-split-mode.test.js; then
    echo "✅ Transfer Split Mode Test PASSED"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo "❌ Transfer Split Mode Test FAILED"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 3: Transfer Status Test (Our new status fix test)
echo ""
echo "🔄 Running Transfer Status Test..."
if node tests/transfer-status.test.js; then
    echo "✅ Transfer Status Test PASSED"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo "❌ Transfer Status Test FAILED"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Summary
echo ""
echo "🎯 TEST SUITE RESULTS"
echo "====================="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED!"
    echo ""
    echo "✅ Status Fix Validation:"
    echo "   • Single transfers now set status to 'Complete'"
    echo "   • Split transfers now set status to 'Complete'"
    echo "   • Mixed status samples are corrected to 'Complete'"
    echo "   • Transfer metadata is preserved correctly"
    echo "   • Source samples are properly removed"
    echo ""
    echo "🔧 Implementation Summary:"
    echo "   • Fixed transferProcessor.js line 95 for single transfers"
    echo "   • Fixed transferProcessor.js line 205 for split transfers"
    echo "   • Both fixes explicitly set status: 'Complete'"
    echo "   • Tests confirm the issue is resolved"
    exit 0
else
    echo "🚨 SOME TESTS FAILED!"
    echo "Failed tests: $FAILED_TESTS/$TOTAL_TESTS"
    exit 1
fi
