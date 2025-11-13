#!/bin/bash

# Start Scanner App with Email & Authentication
# This script starts both the frontend and backend servers

echo "🚀 Starting Scanner App Servers..."
echo ""

# Start backend server
echo "📧 Starting backend server (port 3001)..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Start frontend server
echo "🌐 Starting frontend server (port 8000)..."
python server.py &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 2

echo ""
echo "✅ Servers started successfully!"
echo ""
echo "📱 Frontend: http://localhost:8000"
echo "📧 Backend:  http://localhost:3001"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for user to stop
wait
