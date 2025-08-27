#!/bin/bash

# TechForge AI Agent Suite - Quick Start Script
# This script starts the complete TechForge communication system

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         TechForge AI Agent Suite - Quick Start          ║"
echo "║        Real-time Communication System Launcher          ║"
echo "╔══════════════════════════════════════════════════════════╗"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Navigate to communication directory
cd communication

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
fi

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check if server is already running
if check_port 3000; then
    echo -e "${YELLOW}⚠️  Server already running on port 3000${NC}"
else
    echo -e "${BLUE}🚀 Starting Communication Server...${NC}"
    node server/index.js &
    SERVER_PID=$!
    sleep 2
    echo -e "${GREEN}✅ Server started (PID: $SERVER_PID)${NC}"
fi

# Start the bridge
echo -e "${BLUE}🌉 Starting TechForge Bridge...${NC}"
node bridge/techforge-bridge.js &
BRIDGE_PID=$!
sleep 1
echo -e "${GREEN}✅ Bridge started (PID: $BRIDGE_PID)${NC}"

# Start showcase if available
SHOWCASE_DIR="../strands/showcase"
if [ -d "$SHOWCASE_DIR" ]; then
    echo -e "${BLUE}🎨 Starting Web Showcase...${NC}"
    cd $SHOWCASE_DIR
    if [ ! -d "node_modules" ]; then
        npm install >/dev/null 2>&1
    fi
    npm run dev >/dev/null 2>&1 &
    SHOWCASE_PID=$!
    cd - >/dev/null
    echo -e "${GREEN}✅ Showcase started (PID: $SHOWCASE_PID)${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ TechForge Communication System is Ready!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "📍 Services Running:"
echo "   • Communication Server: http://localhost:3000"
echo "   • WebSocket Server: ws://localhost:8081"
if [ ! -z "$SHOWCASE_PID" ]; then
    echo "   • Web Showcase: http://localhost:5173"
fi
echo ""
echo "🚀 Quick Commands:"
echo "   Deploy a team:"
echo "   $ node agents/techforge-spawn.js --team fullstack"
echo ""
echo "   Deploy single agent:"
echo "   $ node agents/techforge-spawn.js --expertise backend"
echo ""
echo "   Interactive deployment:"
echo "   $ node agents/techforge-spawn.js --interactive"
echo ""
echo "   Use enhanced CLI:"
echo "   $ python3 cli/techforge_enhanced.py deploy-live --team fullstack"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping TechForge services...${NC}"
    
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
        echo -e "${GREEN}✅ Server stopped${NC}"
    fi
    
    if [ ! -z "$BRIDGE_PID" ]; then
        kill $BRIDGE_PID 2>/dev/null
        echo -e "${GREEN}✅ Bridge stopped${NC}"
    fi
    
    if [ ! -z "$SHOWCASE_PID" ]; then
        kill $SHOWCASE_PID 2>/dev/null
        echo -e "${GREEN}✅ Showcase stopped${NC}"
    fi
    
    # Kill any remaining agent processes
    pkill -f "techforge-spawn.js" 2>/dev/null
    
    echo -e "${GREEN}All services stopped. Goodbye!${NC}"
    exit 0
}

# Set up trap to cleanup on Ctrl+C
trap cleanup SIGINT

# Keep script running
while true; do
    sleep 1
done