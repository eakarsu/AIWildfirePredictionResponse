#!/bin/bash

# AI Wildfire Prediction & Response - Start Script
# This script sets up and runs the full application

set -e

echo "=========================================="
echo "  AI Wildfire Prediction & Response"
echo "  Starting Application..."
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
  echo -e "${GREEN}[OK]${NC} Loaded .env configuration"
else
  echo -e "${RED}[ERROR]${NC} .env file not found. Please create one from .env.example"
  exit 1
fi

BACKEND_PORT=${PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

# Function to kill processes on ports
cleanup_ports() {
  echo -e "${YELLOW}[CLEAN]${NC} Cleaning up ports $BACKEND_PORT and $FRONTEND_PORT..."

  # Kill processes on backend port
  lsof -ti:$BACKEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true

  # Kill processes on frontend port
  lsof -ti:$FRONTEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true

  echo -e "${GREEN}[OK]${NC} Ports cleaned up"
}

# Cleanup on exit
trap 'echo -e "\n${YELLOW}[STOP]${NC} Shutting down..."; kill 0 2>/dev/null; cleanup_ports; exit 0' SIGINT SIGTERM EXIT

# Clean up ports first
cleanup_ports

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}[ERROR]${NC} Node.js is not installed. Please install Node.js 18+"
  exit 1
fi
echo -e "${GREEN}[OK]${NC} Node.js $(node --version) found"

# Check for PostgreSQL
if ! command -v psql &> /dev/null; then
  echo -e "${RED}[ERROR]${NC} PostgreSQL is not installed"
  exit 1
fi
echo -e "${GREEN}[OK]${NC} PostgreSQL found"

# Check if PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
  echo -e "${YELLOW}[WARN]${NC} PostgreSQL doesn't appear to be running. Attempting to start..."
  brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || {
    echo -e "${RED}[ERROR]${NC} Could not start PostgreSQL. Please start it manually."
    exit 1
  }
  sleep 2
fi
echo -e "${GREEN}[OK]${NC} PostgreSQL is running"

# Create database if not exists
echo -e "${BLUE}[DB]${NC} Setting up database..."
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'wildfire_db'" 2>/dev/null | grep -q 1 || \
  createdb -U postgres wildfire_db 2>/dev/null || \
  psql postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'wildfire_db'" | grep -q 1 || \
  createdb wildfire_db 2>/dev/null || true
echo -e "${GREEN}[OK]${NC} Database ready"

# Install backend dependencies
echo -e "${BLUE}[INSTALL]${NC} Installing backend dependencies..."
cd backend
npm install --silent 2>/dev/null
echo -e "${GREEN}[OK]${NC} Backend dependencies installed"

# Seed the database
echo -e "${BLUE}[SEED]${NC} Seeding database with sample data..."
node src/seeds/seed.js 2>/dev/null && echo -e "${GREEN}[OK]${NC} Database seeded successfully" || echo -e "${YELLOW}[WARN]${NC} Seed may have partially failed, continuing..."

# Install frontend dependencies
echo -e "${BLUE}[INSTALL]${NC} Installing frontend dependencies..."
cd ../frontend
npm install --silent 2>/dev/null
echo -e "${GREEN}[OK]${NC} Frontend dependencies installed"

cd ..

# Start backend with nodemon for hot reload
echo -e "${BLUE}[START]${NC} Starting backend on port $BACKEND_PORT with hot reload..."
cd backend
npx nodemon src/index.js &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo -e "${YELLOW}[WAIT]${NC} Waiting for backend..."
for i in {1..30}; do
  if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}[OK]${NC} Backend is running on http://localhost:$BACKEND_PORT"
    break
  fi
  sleep 1
done

# Start frontend with hot reload (React scripts auto-reloads)
echo -e "${BLUE}[START]${NC} Starting frontend on port $FRONTEND_PORT with hot reload..."
cd frontend
BROWSER=none PORT=$FRONTEND_PORT npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}=========================================="
echo -e "  Application Started Successfully!"
echo -e "==========================================${NC}"
echo ""
echo -e "  Frontend:  ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  Backend:   ${BLUE}http://localhost:$BACKEND_PORT${NC}"
echo ""
echo -e "  Login Credentials:"
echo -e "    Email:    ${YELLOW}admin@wildfire.gov${NC}"
echo -e "    Password: ${YELLOW}password123${NC}"
echo ""
echo -e "  ${YELLOW}Hot reload enabled - changes auto-refresh${NC}"
echo -e "  Press ${RED}Ctrl+C${NC} to stop all services"
echo ""

# Wait for background processes
wait
