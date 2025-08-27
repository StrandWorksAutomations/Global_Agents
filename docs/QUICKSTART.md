# 🚀 TechForge Quick Start Guide

> **Get your AI development team up and running in 5 minutes**

## Prerequisites

- Python 3.8+ or Node.js 14+
- Git
- 4GB RAM minimum
- Active internet connection

## Installation

### Method 1: NPM (Recommended)
```bash
npm install -g techforge-cli
```

### Method 2: Python Package
```bash
pip install techforge-cli
```

### Method 3: From Source
```bash
git clone https://github.com/techforge/agent-suite.git
cd agent-suite
python3 cli/techforge.py
```

## Step 1: Initialize Your Project

Navigate to your project directory and initialize TechForge:

```bash
cd your-project
techforge init
```

This creates a `.techforge.yaml` configuration file in your project root.

## Step 2: Choose Your Team

### Option A: Quick Deploy (Recommended for new projects)

Deploy a pre-configured team based on your project type:

```bash
# For web applications
techforge deploy --team fullstack

# For mobile apps
techforge deploy --team mobile

# For MVP/prototype
techforge deploy --team mvp

# For enterprise modernization
techforge deploy --team modernize
```

### Option B: Custom Selection

Choose specific agents for your needs:

```bash
# Interactive selection
techforge deploy --interactive

# Or specify agents directly
techforge deploy backend-expert frontend-expert database-expert
```

## Step 3: Verify Deployment

Check that your agents are active:

```bash
techforge status
```

Expected output:
```
===============================================
           Agent Status
===============================================

● Backend Expert
  Status: active
  Version: 2.0.0
  Tasks completed: 0

● Frontend Expert
  Status: active
  Version: 2.0.0
  Tasks completed: 0

● Database Expert
  Status: active
  Version: 2.0.0
  Tasks completed: 0
```

## Step 4: Start Working

### Example 1: Build a REST API

```bash
# Ask the Backend Expert to create an API
echo "Create a REST API for user authentication with JWT" | techforge task backend-expert

# The agent will:
# 1. Analyze your project structure
# 2. Generate the API code
# 3. Set up routes and middleware
# 4. Add authentication logic
# 5. Create tests
```

### Example 2: Optimize Database Performance

```bash
# Get database insights
techforge insights --agent database-expert

# Apply optimizations
techforge optimize database
```

### Example 3: Full-Stack Feature

```bash
# Deploy a complete feature across the stack
techforge feature "Add user profile with avatar upload"

# Agents coordinate to:
# - Backend: Create API endpoints
# - Database: Design schema
# - Frontend: Build UI components
# - Security: Validate implementation
# - QA: Generate tests
```

## Common Commands

| Command | Description |
|---------|-------------|
| `techforge list` | Show all available agents |
| `techforge status` | Check active agents |
| `techforge insights` | Get AI-powered recommendations |
| `techforge analytics` | View productivity metrics |
| `techforge upgrade` | Update agents to latest version |
| `techforge config` | Modify settings |
| `techforge help` | Show help information |

## Working with Agents

### Direct Agent Communication

```bash
# Send task to specific agent
techforge task <agent-id> "Your request here"

# Examples:
techforge task frontend-expert "Convert this component to TypeScript"
techforge task security-expert "Audit authentication flow for vulnerabilities"
techforge task qa-expert "Create E2E tests for checkout process"
```

### Team Coordination

```bash
# Coordinate multiple agents for complex tasks
techforge coordinate "Implement real-time chat feature"

# Agents automatically determine:
# - Who handles what
# - Task dependencies
# - Optimal execution order
```

### Code Review

```bash
# Have agents review your code
techforge review --files src/**/*.js

# Get specific feedback
techforge review --security  # Security-focused review
techforge review --performance  # Performance optimization
techforge review --quality  # Code quality and best practices
```

## Configuration

### Basic Configuration

Edit `.techforge.yaml` in your project:

```yaml
team_preset: fullstack
auto_deploy: true
agents:
  backend-expert:
    languages: [python, nodejs]
    framework: fastapi
  frontend-expert:
    framework: react
    styling: tailwind
```

### Environment Variables

```bash
export TECHFORGE_API_KEY="your-api-key"
export TECHFORGE_WORKSPACE="/path/to/workspace"
export TECHFORGE_LOG_LEVEL="info"
```

## Best Practices

### 1. Start Small
Begin with a minimal team (MVP preset) and add agents as needed.

### 2. Use Team Presets
Leverage pre-configured teams for common project types.

### 3. Regular Updates
Keep agents updated for latest capabilities:
```bash
techforge upgrade
```

### 4. Monitor Performance
Check analytics regularly:
```bash
techforge analytics --period week
```

### 5. Leverage Insights
Use AI insights to identify improvements:
```bash
techforge insights --deep
```

## Troubleshooting

### Agents Not Responding

```bash
# Restart agents
techforge restart

# Check logs
techforge logs --tail 50
```

### Performance Issues

```bash
# Adjust resource limits
techforge config set resource.cpu 4
techforge config set resource.memory 8GB

# Enable performance mode
techforge config set performance.mode aggressive
```

### Connection Problems

```bash
# Test connectivity
techforge diagnose

# Use offline mode (limited features)
techforge --offline
```

## Example Projects

### 1. SaaS Application

```bash
# Initialize
techforge init --template saas

# Deploy team
techforge deploy --team saas

# Bootstrap application
techforge bootstrap "Multi-tenant SaaS for project management"
```

### 2. Mobile E-commerce App

```bash
# Initialize
techforge init --template mobile-commerce

# Deploy team
techforge deploy --team mobile

# Generate foundation
techforge scaffold "E-commerce app with cart and payments"
```

### 3. Microservices Migration

```bash
# Initialize
techforge init --template microservices

# Deploy modernization team
techforge deploy --team modernize

# Analyze monolith
techforge analyze --architecture

# Plan migration
techforge plan migration --strategy strangler-fig
```

## Integration Examples

### GitHub Integration

```bash
# Connect to GitHub
techforge integrate github --repo owner/repo

# Auto-create PRs for agent changes
techforge config set github.auto_pr true
```

### CI/CD Pipeline

```yaml
# .github/workflows/techforge.yml
name: TechForge AI Review
on: [pull_request]
jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: TechForge Review
        run: |
          techforge review --all
          techforge test --coverage
```

### VS Code Integration

```json
// .vscode/settings.json
{
  "techforge.autoSuggest": true,
  "techforge.agents": ["backend-expert", "frontend-expert"],
  "techforge.realtime": true
}
```

## Getting Help

- **Documentation**: [docs.techforge.ai](https://docs.techforge.ai)
- **Video Tutorials**: [learn.techforge.ai](https://learn.techforge.ai)
- **Community Discord**: [discord.techforge.ai](https://discord.techforge.ai)
- **Support Email**: support@techforge.ai

## Next Steps

1. ✅ Complete the [interactive tutorial](https://learn.techforge.ai/tutorial)
2. 📚 Read agent-specific guides in [docs/agents/](https://docs.techforge.ai/agents)
3. 🎯 Join our [community challenges](https://community.techforge.ai/challenges)
4. 💡 Share your experience on [Twitter](https://twitter.com/techforgeai)

---

**Ready to 10x your development speed?** Start with:
```bash
techforge deploy --team fullstack
techforge insights
```

Welcome to the future of software development! 🚀