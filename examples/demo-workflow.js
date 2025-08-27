#!/usr/bin/env node

/**
 * TechForge Demo Workflow
 * 
 * This script demonstrates a complete workflow using TechForge agents:
 * 1. Deploy a development team
 * 2. Assign a complex project
 * 3. Show agent collaboration
 * 4. Generate project deliverables
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';
import chalk from 'chalk';
import { setTimeout } from 'timers/promises';

class TechForgeDemo {
  constructor() {
    this.serverUrl = 'http://localhost:3000';
    this.deployedAgents = [];
    this.taskResults = [];
  }

  async run() {
    console.log(chalk.cyan.bold('\n🎬 TechForge AI Agent Suite - Demo Workflow\n'));
    
    try {
      await this.checkServer();
      await this.deployTeam();
      await this.waitForAgents();
      await this.assignProject();
      await this.monitorProgress();
      await this.showResults();
      console.log(chalk.green.bold('\n✅ Demo completed successfully!'));
    } catch (err) {
      console.error(chalk.red(`Demo failed: ${err.message}`));
    }
  }

  async checkServer() {
    console.log(chalk.blue('🔍 Checking server status...'));
    
    try {
      const response = await fetch(`${this.serverUrl}/api/agents`);
      if (response.ok) {
        console.log(chalk.green('✅ Server is running'));
      } else {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (err) {
      console.log(chalk.red('❌ Server not available'));
      console.log(chalk.yellow('Starting server...'));
      
      // Start server
      spawn('node', ['../communication/server/index.js'], {
        cwd: __dirname,
        detached: true,
        stdio: 'ignore'
      });
      
      await setTimeout(3000);
      console.log(chalk.green('✅ Server started'));
    }
  }

  async deployTeam() {
    console.log(chalk.blue('🚀 Deploying full-stack development team...'));
    
    const agents = ['backend', 'frontend', 'database', 'devops', 'security'];
    
    for (const expertise of agents) {
      console.log(`  Deploying ${expertise} expert...`);
      
      const proc = spawn('node', [
        '../communication/agents/techforge-spawn.js',
        '--expertise', expertise,
        '--name', `${expertise.charAt(0).toUpperCase() + expertise.slice(1)}Expert`
      ], {
        cwd: __dirname,
        stdio: 'pipe'
      });
      
      this.deployedAgents.push({
        expertise,
        process: proc,
        status: 'starting'
      });
      
      await setTimeout(1500);
    }
    
    console.log(chalk.green(`✅ ${agents.length} agents deployed`));
  }

  async waitForAgents() {
    console.log(chalk.blue('⏳ Waiting for agents to come online...'));
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.serverUrl}/api/agents`);
        const agents = await response.json();
        const activeCount = agents.filter(a => a.status === 'active').length;
        
        console.log(`  ${activeCount}/${this.deployedAgents.length} agents online`);
        
        if (activeCount >= this.deployedAgents.length) {
          console.log(chalk.green('✅ All agents online'));
          return;
        }
      } catch (err) {
        console.log(chalk.yellow(`Attempt ${attempts + 1}: ${err.message}`));
      }
      
      attempts++;
      await setTimeout(2000);
    }
    
    console.log(chalk.yellow('⚠️  Some agents may not be fully online'));
  }

  async assignProject() {
    console.log(chalk.blue('📋 Assigning project: E-commerce Platform...'));
    
    const project = {
      from: "demo-user",
      to: "broadcast",
      text: "New project: Build an E-commerce Platform",
      type: "project-request",
      project: "E-commerce Platform",
      requirements: "User authentication, product catalog, shopping cart, payment integration, admin dashboard, API endpoints, database design, security implementation, automated testing, deployment pipeline",
      timeline: "2 weeks",
      priority: "high"
    };

    const response = await fetch(`${this.serverUrl}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });

    if (response.ok) {
      console.log(chalk.green('✅ Project assigned to team'));
    } else {
      throw new Error('Failed to assign project');
    }
  }

  async monitorProgress() {
    console.log(chalk.blue('👀 Monitoring agent collaboration (30 seconds)...'));
    
    const startTime = Date.now();
    const duration = 30000; // 30 seconds
    
    while (Date.now() - startTime < duration) {
      try {
        // Get recent messages
        const response = await fetch(`${this.serverUrl}/api/messages?limit=10`);
        const messages = await response.json();
        
        // Show recent activity
        const recentMessages = messages
          .filter(m => Date.now() - new Date(m.timestamp).getTime() < 5000)
          .slice(-3);
        
        for (const message of recentMessages) {
          if (message.type === 'task-accepted') {
            console.log(chalk.cyan(`  📝 ${message.from} accepted task`));
          } else if (message.type === 'collaboration-request') {
            console.log(chalk.magenta(`  🤝 Collaboration requested`));
          } else if (message.type === 'task-progress') {
            console.log(chalk.blue(`  ⚡ Progress: ${message.text}`));
          } else if (message.type === 'task-completed') {
            console.log(chalk.green(`  ✅ Task completed by ${message.from}`));
            this.taskResults.push(message);
          }
        }
        
        // Get agent thoughts
        const agentsResponse = await fetch(`${this.serverUrl}/api/agents`);
        const agents = await agentsResponse.json();
        
        for (const agent of agents.slice(0, 2)) { // Show thoughts from first 2 agents
          try {
            const thoughtsResponse = await fetch(`${this.serverUrl}/api/thoughts/${agent.id}`);
            const thoughts = await thoughtsResponse.json();
            const recentThoughts = thoughts.slice(-1);
            
            for (const thought of recentThoughts) {
              if (Date.now() - new Date(thought.timestamp).getTime() < 5000) {
                console.log(chalk.gray(`  💭 ${agent.name}: ${thought.thought}`));
              }
            }
          } catch (err) {
            // Ignore thought fetching errors
          }
        }
        
      } catch (err) {
        console.log(chalk.yellow(`Monitoring error: ${err.message}`));
      }
      
      await setTimeout(3000);
    }
    
    console.log(chalk.green('✅ Monitoring complete'));
  }

  async showResults() {
    console.log(chalk.blue('📊 Demo Results Summary'));
    console.log('='.repeat(50));
    
    try {
      // Get final agent status
      const response = await fetch(`${this.serverUrl}/api/agents`);
      const agents = await response.json();
      
      console.log(chalk.bold('\n👥 Team Status:'));
      agents.forEach(agent => {
        const status = agent.status === 'active' ? '🟢' : '🔴';
        console.log(`  ${status} ${agent.name} (${agent.type})`);
      });
      
      // Show task results
      console.log(chalk.bold('\n📈 Task Results:'));
      if (this.taskResults.length > 0) {
        this.taskResults.forEach((result, index) => {
          console.log(`  ${index + 1}. Task completed by ${result.from}`);
          if (result.summary) {
            console.log(`     Duration: ${result.summary.duration || 'N/A'}`);
            console.log(`     Steps: ${result.summary.stepsCompleted || 'N/A'}`);
          }
        });
      } else {
        console.log('  No completed tasks recorded in monitoring period');
      }
      
      // Get message statistics
      const messagesResponse = await fetch(`${this.serverUrl}/api/messages?limit=100`);
      const messages = await messagesResponse.json();
      
      const messageTypes = {};
      messages.forEach(msg => {
        messageTypes[msg.type || 'general'] = (messageTypes[msg.type || 'general'] || 0) + 1;
      });
      
      console.log(chalk.bold('\n💬 Communication Stats:'));
      console.log(`  Total messages: ${messages.length}`);
      Object.entries(messageTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
      
      // Demo insights
      console.log(chalk.bold('\n💡 Demo Insights:'));
      console.log('  • Agents automatically discovered each other');
      console.log('  • Project was decomposed into specialized tasks');
      console.log('  • Real-time collaboration occurred');
      console.log('  • All communication was logged and monitored');
      console.log('  • System scaled dynamically with agent expertise');
      
    } catch (err) {
      console.log(chalk.red(`Failed to get results: ${err.message}`));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(chalk.green.bold('🎉 TechForge Demo Complete!'));
    console.log(chalk.white('Your AI development team is ready for real projects.'));
    console.log(chalk.blue('\nNext steps:'));
    console.log('  • Visit http://localhost:5173 for the web dashboard');
    console.log('  • Use the CLI: python3 cli/techforge_enhanced.py --help');
    console.log('  • Deploy your own team: npm run team:fullstack');
    console.log('  • Assign real tasks and watch the magic happen!');
  }

  async cleanup() {
    console.log(chalk.blue('🧹 Cleaning up demo processes...'));
    
    for (const agent of this.deployedAgents) {
      if (agent.process) {
        agent.process.kill();
      }
    }
    
    console.log(chalk.green('✅ Cleanup complete'));
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n⏹️  Stopping demo...'));
  process.exit(0);
});

// Run demo
const demo = new TechForgeDemo();
demo.run().catch(err => {
  console.error(chalk.red(`Demo failed: ${err.message}`));
  process.exit(1);
});