#!/usr/bin/env node

import { TechForgeAgent } from './TechForgeAgent.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import yaml from 'yaml';
import minimist from 'minimist';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = minimist(process.argv.slice(2));

async function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../../.techforge.yaml');
    const configContent = await fs.readFile(configPath, 'utf-8');
    return yaml.parse(configContent);
  } catch (err) {
    console.error(chalk.red('Failed to load .techforge.yaml'));
    return null;
  }
}

async function spawnAgent(expertise, name) {
  const config = await loadConfig();
  
  const agentName = name || `${expertise.charAt(0).toUpperCase() + expertise.slice(1)}Expert`;
  
  const agent = new TechForgeAgent({
    name: agentName,
    type: 'techforge',
    expertise,
    serverUrl: config?.communication?.server_url || 'http://localhost:3000',
    wsUrl: config?.communication?.ws_url || 'ws://localhost:8081'
  });

  try {
    await agent.connect();
    console.log(chalk.green(`✓ ${agentName} (${expertise}) is now online`));
    console.log(chalk.cyan(`Capabilities: ${agent.capabilities.join(', ')}`));
    console.log(chalk.blue(`Tech Stack: ${agent.techStack.join(', ')}`));
    
    process.on('SIGINT', () => {
      console.log(chalk.yellow(`\nShutting down ${agentName}...`));
      agent.disconnect();
      process.exit(0);
    });
  } catch (err) {
    console.error(chalk.red(`Failed to start agent: ${err.message}`));
    process.exit(1);
  }
}

async function spawnTeam(teamName) {
  const config = await loadConfig();
  
  if (!config?.teams?.[teamName]) {
    console.error(chalk.red(`Team '${teamName}' not found in configuration`));
    return;
  }
  
  const team = config.teams[teamName];
  console.log(chalk.cyan.bold(`\nDeploying ${teamName} team:`));
  console.log(chalk.gray(team.description));
  console.log(chalk.white(`Agents: ${team.agents.join(', ')}\n`));
  
  for (const agentType of team.agents) {
    const expertise = agentType.replace('-expert', '').replace(/-/g, '_');
    await spawnAgent(expertise);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(chalk.green.bold(`\n✓ ${teamName} team deployed successfully!`));
}

async function main() {
  const expertise = argv.expertise || argv.e;
  const name = argv.name || argv.n;
  const team = argv.team || argv.t;
  const interactive = argv.interactive || argv.i;
  
  if (team) {
    await spawnTeam(team);
  } else if (expertise) {
    await spawnAgent(expertise, name);
  } else if (interactive) {
    console.log(chalk.cyan('Interactive mode - Select agent to spawn:'));
    const agents = [
      'backend', 'frontend', 'database', 'devops', 'security',
      'ai_ml', 'qa', 'mobile', 'game', 'hardware_iot', 'uiux'
    ];
    
    agents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent}`);
    });
    
    process.stdin.on('data', async (data) => {
      const choice = parseInt(data.toString().trim());
      if (choice > 0 && choice <= agents.length) {
        await spawnAgent(agents[choice - 1]);
      } else {
        console.error(chalk.red('Invalid choice'));
        process.exit(1);
      }
    });
  } else {
    console.log(chalk.yellow('Usage:'));
    console.log('  node techforge-spawn.js --expertise <type> [--name <name>]');
    console.log('  node techforge-spawn.js --team <team-name>');
    console.log('  node techforge-spawn.js --interactive');
    console.log('\nExamples:');
    console.log('  node techforge-spawn.js --expertise backend --name APIExpert');
    console.log('  node techforge-spawn.js --team fullstack');
    console.log('  node techforge-spawn.js -e frontend -n UIBuilder');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(chalk.red(`Error: ${err.message}`));
  process.exit(1);
});