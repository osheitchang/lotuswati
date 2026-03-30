#!/bin/bash
# LotusWati - Start both backend and frontend

echo "🌸 Starting LotusWati..."

# Start backend
echo "Starting backend on port 3001..."
cd "$(dirname "$0")/backend" && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to initialize
sleep 2

# Start frontend
echo "Starting frontend on port 3000..."
cd "$(dirname "$0")/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ LotusWati is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
