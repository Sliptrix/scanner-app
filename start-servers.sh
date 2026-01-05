#!/bin/bash

# Start Scanner App with Email & Authentication
# This script starts both the frontend and backend servers

set -o pipefail

echo "🚀 Starting Scanner App Servers..."
echo ""

# Start backend server
echo "📧 Starting backend server (port 3001)..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait for backend to start
for i in {1..10}; do
    if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! curl -sf http://localhost:3001/health >/dev/null 2>&1; then
    echo "❌ Backend health check failed (http://localhost:3001/health)"
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 1
fi

# Start frontend server
echo "🌐 Starting frontend server (port 8000)..."

if ! command -v python3 >/dev/null 2>&1; then
    echo "❌ python3 not found on PATH"
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 1
fi

python3 server.py &
FRONTEND_PID=$!

# Wait for frontend to start
for i in {1..10}; do
    if curl -sf http://localhost:8000/ >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! curl -sf http://localhost:8000/ >/dev/null 2>&1; then
    echo "❌ Frontend did not become ready on http://localhost:8000/"
    kill "$BACKEND_PID" 2>/dev/null || true
    kill "$FRONTEND_PID" 2>/dev/null || true
    exit 1
fi

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
    if [[ -n "${BACKEND_PID:-}" ]]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [[ -n "${FRONTEND_PID:-}" ]]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    echo "✅ Servers stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for user to stop
wait
