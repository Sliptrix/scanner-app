#!/bin/bash

# Lab Scanner System Demo Launcher
# Complete recipe integration demo

echo "🚀 Lab Scanner System - Recipe Integration Demo"
echo "============================================="
echo ""
echo "🔧 Starting development server..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the Scanner project directory"
    exit 1
fi

# Check if node modules exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✅ Starting server on port 8000..."
echo ""
echo "🌐 Open your browser and go to:"
echo "   📍 http://localhost:8000"
echo ""
echo "📚 Demo Features:"
echo "   🧪 Recipe Integration (NEW - Mandatory Step 5)"
echo "   🏗️  Barcode Builder (8-step workflow)"
echo "   🔄 Container Transfer & Tissue Splitting"
echo "   📦 Inventory Management with Recipe Tracking"
echo "   📊 Excel Export with Recipe Details"
echo "   💾 Recipe Import/Export System"
echo ""
echo "📖 For complete demo guide, see: DEMO_GUIDE.md"
echo ""
echo "⏹️  Press Ctrl+C to stop the server"
echo "============================================="
echo ""

# Start the development server
npm start
