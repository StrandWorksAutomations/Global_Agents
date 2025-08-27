# 🚀 TechForge AI Agent Suite - Complete Setup Guide

## Quick Setup (Recommended)

### 1. One-Command Installation
```bash
cd /Users/jonathanbouren/PROJECTS/Global_Agents
./install-deps.sh
```

This automatically:
- ✅ Checks system requirements
- ✅ Installs all dependencies
- ✅ Sets up directories
- ✅ Makes scripts executable
- ✅ Validates the installation

### 2. Start the System
```bash
./start-techforge.sh
```

### 3. Try the Quick Start
```bash
cd examples
node quick-start.js
```

---

## Manual Setup (Alternative)

### Prerequisites
- Node.js 16+ 
- npm 7+
- Python 3.7+ (for enhanced CLI)

### Installation Steps

1. **Install Communication System Dependencies**
```bash
cd communication
npm install
```

2. **Install Showcase Dependencies** (optional)
```bash
cd ../strands/showcase  # if available
npm install
```

3. **Install Python Dependencies**
```bash
pip3 install pyyaml requests
```

4. **Create Required Directories**
```bash
mkdir -p communication/uploads
mkdir -p communication/logs
mkdir -p ~/.techforge/cache
```

5. **Make Scripts Executable**
```bash
chmod +x start-techforge.sh
chmod +x install-deps.sh
chmod +x examples/*.js
chmod +x communication/test/*.js
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                 TechForge Suite                     │
├─────────────────────────────────────────────────────┤
│  Enhanced CLI (Python)                             │
│  ├─ comm start/stop/status                         │
│  ├─ deploy-live --team fullstack                   │
│  ├─ task "Build API"                               │
│  └─ chat                                           │
├─────────────────────────────────────────────────────┤
│  Communication Layer                               │
│  ├─ Express Server (HTTP/REST)                     │
│  ├─ WebSocket Server (Real-time)                   │
│  ├─ TechForge Bridge (Orchestrator)                │
│  └─ Health Monitoring                              │
├─────────────────────────────────────────────────────┤
│  Agent Layer                                       │
│  ├─ TechForgeAgent (Base)                          │
│  ├─ Backend Expert                                 │
│  ├─ Frontend Expert                                │
│  ├─ Database Expert                                │
│  ├─ DevOps Expert                                  │
│  ├─ Security Expert                                │
│  ├─ QA Expert                                      │
│  ├─ AI/ML Expert                                   │
│  └─ [More specialists...]                          │
├─────────────────────────────────────────────────────┤
│  Web Dashboard                                     │
│  └─ React Showcase (http://localhost:5173)         │
└─────────────────────────────────────────────────────┘
```

---

## Usage Examples

### Deploy Teams

**Full-Stack Team:**
```bash
# Method 1: NPM script
cd communication && npm run team:fullstack

# Method 2: Enhanced CLI
python3 cli/techforge_enhanced.py deploy-live --team fullstack

# Method 3: Direct spawn
node communication/agents/techforge-spawn.js --team fullstack
```

**Individual Agents:**
```bash
npm run agent:backend
npm run agent:security
python3 cli/techforge_enhanced.py deploy-live --agent backend-expert
```

### Assign Tasks

**Via Enhanced CLI:**
```bash
python3 cli/techforge_enhanced.py task "Build user authentication system" --priority high
```

**Via HTTP API:**
```bash
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{
    "from": "user",
    "to": "broadcast", 
    "text": "Create REST API",
    "type": "task-request"
  }'
```

### Interactive Communication

**Chat Mode:**
```bash
python3 cli/techforge_enhanced.py chat
```

**Monitor System:**
```bash
python3 cli/techforge_enhanced.py comm status
```

---

## Testing & Validation

### Run System Tests
```bash
cd communication
npm test
```

### Validate Installation
```bash
node -e "
const { StartupValidator } = await import('./communication/utils/StartupValidator.js');
const validator = new StartupValidator();
await validator.validate();
"
```

### Health Check
```bash
node -e "
const { HealthChecker } = await import('./communication/utils/HealthChecker.js');
const checker = new HealthChecker();
await checker.checkSystemHealth();
"
```

---

## Available Scripts

### Communication System
```bash
npm run start          # Start server
npm run server         # Start server  
npm run bridge         # Start orchestration bridge
npm run team:fullstack # Deploy full-stack team
npm run agent:backend  # Deploy backend expert
npm run test          # Run tests
npm run clean         # Stop all agents
```

### Enhanced CLI
```bash
python3 cli/techforge_enhanced.py comm start --bridge --showcase
python3 cli/techforge_enhanced.py deploy-live --team enterprise  
python3 cli/techforge_enhanced.py task "Build mobile app"
python3 cli/techforge_enhanced.py chat
python3 cli/techforge_enhanced.py comm status
```

### Examples & Demos
```bash
node examples/quick-start.js       # Interactive setup
node examples/demo-workflow.js     # Full demo workflow
```

---

## Configuration

### Main Config (`.techforge.yaml`)
```yaml
integrations:
  communication:
    real_time:
      enabled: true
      server_url: http://localhost:3000
      ws_url: ws://localhost:8081
      showcase_url: http://localhost:5173

teams:
  fullstack:
    agents: [backend-expert, frontend-expert, database-expert, devops-expert, qa-expert]
    coordination: orchestrated
```

### Communication Config (`communication/package.json`)
- Contains all dependencies and scripts
- Configured for Node.js 16+ compatibility
- Includes testing and cleanup commands

---

## Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Kill existing processes
lsof -ti:3000 | xargs kill
lsof -ti:8081 | xargs kill
pkill -f techforge
```

**Dependencies Missing:**
```bash
./install-deps.sh    # Re-run installation
cd communication && npm install
```

**Agents Not Connecting:**
```bash
# Check server status
curl http://localhost:3000/api/agents

# Restart system
npm run clean
./start-techforge.sh
```

**Permission Errors:**
```bash
chmod +x start-techforge.sh
chmod +x install-deps.sh
chmod +x examples/*.js
```

### Logs & Debugging

**View Server Logs:**
```bash
tail -f communication/logs/server.log
```

**Check Agent Status:**
```bash
curl http://localhost:3000/api/agents | jq
```

**Monitor Messages:**
```bash
curl http://localhost:3000/api/messages | jq
```

---

## Advanced Features

### Custom Agent Creation
```javascript
import { TechForgeAgent } from './communication/agents/TechForgeAgent.js';

class CustomExpert extends TechForgeAgent {
  constructor() {
    super({
      expertise: 'custom-domain',
      capabilities: ['custom-skill-1', 'custom-skill-2']
    });
  }
}
```

### Slack Integration
1. Configure Slack app at https://api.slack.com/apps
2. Set environment variables:
   ```bash
   export SLACK_BOT_TOKEN=xoxb-...
   export SLACK_SIGNING_SECRET=...
   export SLACK_APP_TOKEN=xapp-...
   ```
3. Start Slack bridge:
   ```bash
   node communication/integrations/start-slack.js
   ```

### Health Monitoring
```javascript
import { HealthChecker } from './communication/utils/HealthChecker.js';

const checker = new HealthChecker();
checker.startHealthMonitoring(); // Every 30 seconds
```

---

## File Structure

```
Global_Agents/
├── 📁 communication/           # Real-time communication system
│   ├── 📁 agents/             # Agent implementations
│   ├── 📁 bridge/             # Orchestration layer
│   ├── 📁 server/             # Communication server
│   ├── 📁 utils/              # Health check & validation
│   ├── 📁 test/               # Automated tests
│   └── 📄 package.json        # Dependencies & scripts
├── 📁 examples/               # Usage examples & demos
├── 📁 cli/                    # Command-line interfaces
├── 📄 .techforge.yaml         # Main configuration
├── 📄 start-techforge.sh      # One-command launcher
├── 📄 install-deps.sh         # Installation script
└── 📄 COMMUNICATION_README.md # Detailed documentation
```

---

## Next Steps

1. **✅ Complete Setup**: Run `./install-deps.sh`
2. **🚀 Start System**: Run `./start-techforge.sh`  
3. **🎯 Try Quick Start**: Run `node examples/quick-start.js`
4. **📊 Open Dashboard**: Visit http://localhost:5173
5. **💬 Deploy Team**: Use enhanced CLI or npm scripts
6. **🎮 Assign Tasks**: Give your AI team real work to do!

---

**Your enterprise-grade AI development team is ready to revolutionize how you build software!** 🤖✨