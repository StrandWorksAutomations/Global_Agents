#!/bin/bash

# TechForge Dependencies Installation Script
# Automatically installs all required dependencies

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         TechForge AI Agent Suite - Installation         ║"
echo "║             Installing Dependencies...                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check system requirements
echo -e "${BLUE}🔍 Checking system requirements...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 16+ from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION is too old${NC}"
    echo "Please upgrade to Node.js 16 or higher"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) found${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm $(npm --version) found${NC}"

# Check Python (for CLI)
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}⚠️  Python3 not found - Enhanced CLI will not work${NC}"
else
    echo -e "${GREEN}✅ Python3 $(python3 --version) found${NC}"
fi

echo ""

# Install communication system dependencies
echo -e "${BLUE}📦 Installing communication system dependencies...${NC}"
cd communication

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found in communication directory${NC}"
    exit 1
fi

npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install communication dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Communication dependencies installed${NC}"

# Install showcase dependencies if available
cd ..
SHOWCASE_DIR="strands/showcase"
if [ -d "$SHOWCASE_DIR" ]; then
    echo -e "${BLUE}📦 Installing showcase dependencies...${NC}"
    cd "$SHOWCASE_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}⚠️  Showcase dependencies failed - web UI will not work${NC}"
    else
        echo -e "${GREEN}✅ Showcase dependencies installed${NC}"
    fi
    cd ../..
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating directories...${NC}"
mkdir -p communication/uploads
mkdir -p communication/logs
mkdir -p ~/.techforge/cache
mkdir -p ~/.techforge/logs

echo -e "${GREEN}✅ Directories created${NC}"

# Check Python dependencies
echo -e "${BLUE}🐍 Checking Python dependencies...${NC}"
if command -v python3 &> /dev/null; then
    # Check if required packages are available
    python3 -c "import yaml, requests" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}⚠️  Installing Python dependencies...${NC}"
        pip3 install pyyaml requests 2>/dev/null || echo -e "${YELLOW}⚠️  Could not install Python packages${NC}"
    else
        echo -e "${GREEN}✅ Python dependencies available${NC}"
    fi
fi

# Make scripts executable
echo -e "${BLUE}🔧 Setting up executable scripts...${NC}"
chmod +x start-techforge.sh
chmod +x install-deps.sh
chmod +x communication/agents/techforge-spawn.js
chmod +x communication/bridge/techforge-bridge.js
chmod +x cli/techforge.py

if [ -f "cli/techforge_enhanced.py" ]; then
    chmod +x cli/techforge_enhanced.py
fi

echo -e "${GREEN}✅ Scripts made executable${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "🚀 Quick Start:"
echo "   ./start-techforge.sh"
echo ""
echo "📖 Or follow the manual steps:"
echo "   1. Start system: cd communication && npm run server"
echo "   2. Deploy agents: npm run team:fullstack"  
echo "   3. View dashboard: http://localhost:5173"
echo ""
echo "🔧 Available Commands:"
echo "   npm run team:fullstack    # Deploy full-stack team"
echo "   npm run agent:backend     # Deploy single backend agent"
echo "   npm run bridge            # Start orchestration bridge"
echo "   npm run clean             # Stop all agents"
echo ""
if command -v python3 &> /dev/null; then
    echo "✨ Enhanced CLI:"
    echo "   python3 cli/techforge_enhanced.py --help"
    echo ""
fi
echo -e "${BLUE}Happy coding with your AI development team! 🤖${NC}"