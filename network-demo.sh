#!/bin/bash

# Lab Scanner System - Network Demo Launcher
# Allows access from other computers on the same network

echo "🌐 Lab Scanner System - Network Access Demo"
echo "============================================="
echo ""

# Get the local IP address
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if [ -z "$LOCAL_IP" ]; then
    echo "❌ Error: Could not determine local IP address"
    echo "Please check your network connection"
    exit 1
fi

echo "🔧 Starting network-accessible server..."
echo ""
echo "📍 Your computer's IP address: $LOCAL_IP"
echo ""
echo "🌐 Access URLs:"
echo "   📱 Local access:    http://localhost:8000"
echo "   🌍 Network access:  http://$LOCAL_IP:8000"
echo ""
echo "📤 Share this URL with other computers on your network:"
echo "   🔗 http://$LOCAL_IP:8000"
echo ""
echo "📚 Demo Features Available:"
echo "   🧪 Recipe Integration (Mandatory Step 5)"
echo "   🏗️  Barcode Builder (8-step workflow)"
echo "   🔄 Container Transfer & Tissue Splitting"
echo "   📦 Inventory Management with Recipe Tracking"
echo "   📊 Excel Export with Recipe Details"
echo "   💾 Recipe Import/Export System"
echo ""
echo "🔒 Security Note: Server accessible to your local network only"
echo "⏹️  Press Ctrl+C to stop the server"
echo "============================================="
echo ""

# Start the server with network access
python3 -m http.server 8000 --directory public --bind 0.0.0.0
