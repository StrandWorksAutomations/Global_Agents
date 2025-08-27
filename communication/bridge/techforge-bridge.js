#!/usr/bin/env node

import { TechForgeBridge } from './TechForgeBridge.js';
import chalk from 'chalk';

async function start() {
  console.log(chalk.cyan.bold('\n🌉 Starting TechForge Bridge...\n'));
  
  const bridge = new TechForgeBridge({
    serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
    wsUrl: process.env.WS_URL || 'ws://localhost:8081'
  });

  try {
    await bridge.connect();
    console.log(chalk.green.bold('\n✅ TechForge Bridge is now orchestrating your AI team!\n'));
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nShutting down TechForge Bridge...'));
      bridge.disconnect();
      process.exit(0);
    });
    
  } catch (err) {
    console.error(chalk.red(`Failed to start bridge: ${err.message}`));
    process.exit(1);
  }
}

start();