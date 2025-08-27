# 🚀 TechForge AI Agents - Real-time Communication Integration

## Overview

The TechForge AI Agent Suite now includes **real-time communication capabilities**, allowing all agents to:
- 💬 Send and receive messages instantly
- 📁 Share files and media
- 🤝 Collaborate on tasks
- 🧠 Stream their "thoughts" live
- 🎯 Execute commands on other agents
- 📊 Display activity on a web dashboard

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TechForge Bridge                         │
│                  (Orchestration Layer)                      │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────▼────────┐
    │ Communication   │
    │     Server      │◄──── WebSocket ────► Agent Network
    │  (Express/WS)   │                           │
    └────────┬────────┘                           │
             │                                     │
    ┌────────▼────────┐                  ┌────────▼────────┐
    │   Web Showcase  │                  │  TechForge      │
    │   (React UI)    │                  │    Agents       │
    └─────────────────┘                  └─────────────────┘
```

## Quick Start

### 1. One-Command Launch
```bash
# Start everything with one command
./start-techforge.sh
```

This starts:
- Communication server (port 3000)
- WebSocket server (port 8081)
- TechForge Bridge (orchestrator)
- Web showcase (port 5173)

### 2. Deploy Agents

#### Deploy a Full Team
```bash
cd communication
node agents/techforge-spawn.js --team fullstack
```

#### Deploy Individual Agent
```bash
node agents/techforge-spawn.js --expertise backend --name APIExpert
```

#### Interactive Deployment
```bash
node agents/techforge-spawn.js --interactive
```

### 3. Use Enhanced CLI

```bash
# Start communication system
python3 cli/techforge_enhanced.py comm start --bridge --showcase

# Deploy agents with live communication
python3 cli/techforge_enhanced.py deploy-live --team fullstack

# Send task to agents
python3 cli/techforge_enhanced.py task "Build a REST API for user management" --priority high

# Interactive chat
python3 cli/techforge_enhanced.py chat

# Check status
python3 cli/techforge_enhanced.py comm status
```

## Features

### 🎯 Agent Communication

Each TechForge agent can:
- **Broadcast messages** to all agents
- **Direct message** specific agents
- **Request collaboration** from experts
- **Share code and files**
- **Execute commands** on other agents

### 🧠 Live Thought Streaming

Agents continuously stream their internal reasoning:
```javascript
agent.thought("Analyzing database schema...");
agent.thought("Found optimization opportunity in query");
```

These thoughts appear live in:
- Web showcase dashboard
- Terminal output
- Log files

### 🤝 Collaborative Task Execution

Agents automatically collaborate based on expertise:

1. **Task Assignment**: Bridge assigns tasks to appropriate agents
2. **Expertise Matching**: Agents assess task relevance
3. **Collaboration Request**: Agents request help when needed
4. **Result Aggregation**: Bridge collects and reports results

### 📊 Web Dashboard

Access the live dashboard at `http://localhost:5173` to see:
- Active agents and their status
- Real-time message flow
- Agent thought streams
- File transfers
- Task progress

## Agent Capabilities

### Backend Expert
```javascript
expertise: ['API Development', 'Database Design', 'Microservices']
can_collaborate_with: ['Database', 'Security', 'DevOps']
```

### Frontend Expert
```javascript
expertise: ['UI Development', 'State Management', 'Performance']
can_collaborate_with: ['Backend', 'UX/UI', 'Mobile']
```

### Database Expert
```javascript
expertise: ['Schema Design', 'Query Optimization', 'Migrations']
can_collaborate_with: ['Backend', 'DevOps', 'Security']
```

### Security Expert
```javascript
expertise: ['Vulnerability Assessment', 'Compliance', 'Encryption']
can_collaborate_with: ['Backend', 'DevOps', 'Database']
```

## Example Workflows

### 1. Full-Stack Application Development
```bash
# Deploy team
node agents/techforge-spawn.js --team fullstack

# Send project request
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{
    "from": "user",
    "to": "broadcast",
    "type": "project-request",
    "project": "E-commerce Platform",
    "requirements": "API, database, frontend UI, authentication, deployment"
  }'
```

### 2. Code Review Workflow
```bash
# Request code review from Security Expert
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{
    "from": "user",
    "to": "security-expert",
    "type": "code-review-request",
    "code": "/* your code here */",
    "language": "javascript"
  }'
```

### 3. Database Optimization
```bash
# Send optimization task
node -e "
const agent = new TechForgeAgent({expertise: 'database'});
agent.connect();
agent.sendMessage('broadcast', 'Optimize user queries', {
  type: 'task-request',
  task: 'Analyze and optimize database queries for /api/users endpoint'
});
"
```

## API Reference

### REST Endpoints

```bash
POST /api/register       # Register new agent
POST /api/message        # Send message
POST /api/upload         # Upload file
POST /api/thoughts       # Stream thought
GET  /api/agents         # List agents
GET  /api/messages       # Get message history
GET  /api/thoughts/:id   # Get agent thoughts
```

### WebSocket Events

```javascript
// Agent → Server
socket.send({
  type: 'register',
  agentId: 'agent-123',
  expertise: 'backend'
});

socket.send({
  type: 'execute',
  targetId: 'agent-456',
  command: 'npm test'
});

// Server → Agent
socket.on('message', (data) => {
  // Handle incoming message
});

socket.on('execute-command', (data) => {
  // Execute requested command
});
```

## Configuration

Update `.techforge.yaml` for communication settings:

```yaml
integrations:
  communication:
    real_time:
      enabled: true
      server_url: http://localhost:3000
      ws_url: ws://localhost:8081
      auto_start: true
      showcase_url: http://localhost:5173
```

## Troubleshooting

### Port Already in Use
```bash
# Kill existing processes
pkill -f "techforge"
lsof -ti:3000 | xargs kill
lsof -ti:8081 | xargs kill
```

### Agent Not Connecting
```bash
# Check server status
curl http://localhost:3000/api/agents

# Restart communication system
python3 cli/techforge_enhanced.py comm stop
python3 cli/techforge_enhanced.py comm start
```

### Missing Dependencies
```bash
cd communication
npm install
cd ../strands/showcase
npm install
```

## Advanced Usage

### Custom Agent Implementation
```javascript
import { TechForgeAgent } from './TechForgeAgent.js';

class CustomExpert extends TechForgeAgent {
  constructor() {
    super({
      expertise: 'custom',
      capabilities: ['specific-skill']
    });
  }
  
  async onMessage(message) {
    // Custom message handling
  }
  
  async onExecute(command) {
    // Custom command execution
  }
}
```

### Programmatic Control
```javascript
import { TechForgeBridge } from './bridge/TechForgeBridge.js';

const bridge = new TechForgeBridge();
await bridge.connect();

// Deploy team
await bridge.deployTeam('fullstack');

// Send project
await bridge.handleProjectRequest({
  project: 'My App',
  requirements: 'Full stack web application'
});
```

## Next Steps

1. **Explore the Dashboard**: Open http://localhost:5173
2. **Deploy Your First Team**: Try the fullstack preset
3. **Send a Task**: Use the CLI to assign work
4. **Watch Collaboration**: See agents work together in real-time
5. **Customize**: Modify agent expertise and capabilities

## Support

- Documentation: See individual agent `.md` files
- Issues: Check `LAUNCH_INSTRUCTIONS.md`
- Configuration: Review `.techforge.yaml`

---

**The TechForge AI Agent Suite is now supercharged with real-time communication!** 🚀

Your AI development team can now collaborate, share, and execute in perfect synchronization.