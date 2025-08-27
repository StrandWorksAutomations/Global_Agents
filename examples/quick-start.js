#!/usr/bin/env node

/**
 * TechForge Quick Start Example
 * 
 * Simple script to get up and running with TechForge agents quickly.
 * Demonstrates basic agent deployment and task assignment.
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';
import chalk from 'chalk';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class TechForgeQuickStart {
  constructor() {
    this.serverUrl = 'http://localhost:3000';
  }

  async run() {
    console.log(chalk.cyan.bold('\n🚀 TechForge Quick Start\n'));
    console.log('This will help you deploy your first AI agent team!\n');

    try {
      await this.selectTeamType();
      await this.deployTeam();
      await this.assignFirstTask();
      await this.showNextSteps();
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
    } finally {
      rl.close();
    }
  }

  async selectTeamType() {
    console.log(chalk.bold('1. Choose your team type:\n'));
    console.log('  1) 🌐 Full-Stack Team (backend, frontend, database, devops, qa)');
    console.log('  2) 📱 Mobile Team (mobile, backend, database, qa)');
    console.log('  3) 🏢 Enterprise Team (backend, frontend, database, devops, security, qa)');
    console.log('  4) ⚡ MVP Team (backend, frontend, database)');
    console.log('  5) 🔧 Custom (choose individual agents)\n');

    const choice = await this.ask('Select team type (1-5): ');

    switch (choice) {
      case '1':
        this.teamType = 'fullstack';
        this.agents = ['backend', 'frontend', 'database', 'devops', 'qa'];
        break;
      case '2':
        this.teamType = 'mobile';
        this.agents = ['mobile', 'backend', 'database', 'qa'];
        break;
      case '3':
        this.teamType = 'enterprise';
        this.agents = ['backend', 'frontend', 'database', 'devops', 'security', 'qa'];
        break;
      case '4':
        this.teamType = 'mvp';
        this.agents = ['backend', 'frontend', 'database'];
        break;
      case '5':
        this.agents = await this.selectCustomAgents();
        this.teamType = 'custom';
        break;
      default:
        throw new Error('Invalid choice');
    }

    console.log(chalk.green(`\n✅ Selected: ${this.teamType} team with ${this.agents.length} agents\n`));
  }

  async selectCustomAgents() {
    const availableAgents = [
      'backend', 'frontend', 'database', 'devops', 'security',
      'qa', 'ai_ml', 'mobile', 'game', 'hardware_iot', 'uiux'
    ];

    console.log('\nAvailable agents:');
    availableAgents.forEach((agent, index) => {
      console.log(`  ${index + 1}) ${agent}`);
    });

    const selection = await this.ask('\nEnter agent numbers (comma-separated, e.g., 1,2,3): ');
    const indices = selection.split(',').map(s => parseInt(s.trim()) - 1);
    
    return indices
      .filter(i => i >= 0 && i < availableAgents.length)
      .map(i => availableAgents[i]);
  }

  async deployTeam() {
    console.log(chalk.blue('🚀 Deploying your team...\n'));

    // Check if server is running
    try {
      await fetch(`${this.serverUrl}/api/agents`);
      console.log(chalk.green('✅ Server is already running'));
    } catch (err) {
      console.log(chalk.yellow('⚠️  Server not running, starting it...'));
      
      spawn('node', ['../communication/server/index.js'], {
        cwd: __dirname,
        detached: true,
        stdio: 'ignore'
      });
      
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log(chalk.green('✅ Server started'));
    }

    // Deploy each agent
    for (const expertise of this.agents) {
      console.log(chalk.cyan(`  Deploying ${expertise} expert...`));
      
      const proc = spawn('node', [
        '../communication/agents/techforge-spawn.js',
        '--expertise', expertise
      ], {
        cwd: __dirname,
        stdio: 'pipe',
        detached: true
      });

      // Give each agent time to start
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(chalk.green(`\n✅ Team deployment initiated!`));
    console.log(chalk.blue('Agents are connecting to the communication system...\n'));

    // Wait for agents to come online
    await this.waitForAgents();
  }

  async waitForAgents() {
    console.log(chalk.blue('⏳ Waiting for agents to come online...\n'));

    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const response = await fetch(`${this.serverUrl}/api/agents`);
        const agents = await response.json();
        const activeCount = agents.filter(a => a.status === 'active').length;

        console.log(`  ${activeCount}/${this.agents.length} agents online`);

        if (activeCount >= this.agents.length) {
          console.log(chalk.green('\n✅ All agents are online and ready!\n'));
          return;
        }
      } catch (err) {
        // Continue trying
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(chalk.yellow('\n⚠️  Some agents may still be starting up, but let\'s continue...\n'));
  }

  async assignFirstTask() {
    console.log(chalk.bold('2. Let\'s assign your first task!\n'));

    const projectName = await this.ask('What are you building? (e.g., "Todo App", "Blog Platform"): ');
    
    if (!projectName.trim()) {
      console.log(chalk.yellow('Using default project: "Sample Web Application"'));
      this.projectName = 'Sample Web Application';
    } else {
      this.projectName = projectName.trim();
    }

    const features = await this.ask('What features do you need? (e.g., "user auth, REST API, responsive UI"): ');
    
    const taskMessage = {
      from: "quick-start-user",
      to: "broadcast",
      text: `New project: ${this.projectName}`,
      type: "project-request",
      project: this.projectName,
      requirements: features || "Basic web application with modern features",
      timeline: "1 week",
      priority: "normal"
    };

    try {
      const response = await fetch(`${this.serverUrl}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskMessage)
      });

      if (response.ok) {
        console.log(chalk.green(`\n✅ Project "${this.projectName}" assigned to your team!`));
        console.log(chalk.cyan('Your agents are now collaborating on the project...\n'));
      } else {
        throw new Error('Failed to assign task');
      }
    } catch (err) {
      console.log(chalk.yellow(`⚠️  Could not assign task: ${err.message}`));
      console.log('You can still interact with agents manually via the dashboard');
    }
  }

  async showNextSteps() {
    console.log(chalk.bold('🎉 Quick Start Complete!\n'));
    
    console.log(chalk.green('Your TechForge AI team is now running and working on your project.\n'));
    
    console.log(chalk.bold('What you can do now:\n'));
    console.log('📊 ' + chalk.cyan('View Live Dashboard:'));
    console.log('   Open http://localhost:5173 in your browser\n');
    
    console.log('💬 ' + chalk.cyan('Chat with Agents:'));
    console.log('   python3 cli/techforge_enhanced.py chat\n');
    
    console.log('📋 ' + chalk.cyan('Send More Tasks:'));
    console.log('   python3 cli/techforge_enhanced.py task "Add user authentication"\n');
    
    console.log('📈 ' + chalk.cyan('Monitor Status:'));
    console.log('   python3 cli/techforge_enhanced.py comm status\n');
    
    console.log('🛠️  ' + chalk.cyan('Available Commands:'));
    console.log('   npm run team:fullstack    # Deploy another team');
    console.log('   npm run agent:security    # Add a security expert');
    console.log('   npm run clean             # Stop all agents\n');
    
    console.log(chalk.yellow('💡 Tip: Leave this running and open the web dashboard to see your agents collaborate in real-time!\n'));
    
    const openDashboard = await this.ask('Open web dashboard now? (y/n): ');
    if (openDashboard.toLowerCase() === 'y' || openDashboard.toLowerCase() === 'yes') {
      const { exec } = await import('child_process');
      exec('open http://localhost:5173 || xdg-open http://localhost:5173');
      console.log(chalk.green('🌐 Opening dashboard in your browser...\n'));
    }
    
    console.log(chalk.green.bold('Happy coding with your AI development team! 🚀'));
  }

  async ask(question) {
    return new Promise(resolve => {
      rl.question(question, resolve);
    });
  }
}

// Run quick start
const quickStart = new TechForgeQuickStart();
quickStart.run();