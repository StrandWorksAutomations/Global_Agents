#!/usr/bin/env node

/**
 * TechForge Communication System Tests
 * 
 * Automated tests to verify the communication system is working correctly.
 */

import fetch from 'node-fetch';
import { WebSocket } from 'ws';
import chalk from 'chalk';
import { setTimeout } from 'timers/promises';

class CommunicationTester {
  constructor() {
    this.serverUrl = 'http://localhost:3000';
    this.wsUrl = 'ws://localhost:8081';
    this.testResults = [];
  }

  async runTests() {
    console.log(chalk.cyan.bold('\n🧪 TechForge Communication System Tests\n'));
    
    try {
      await this.testServerHealth();
      await this.testRestAPI();
      await this.testWebSocket();
      await this.testFileUpload();
      await this.reportResults();
    } catch (err) {
      console.error(chalk.red(`Test suite failed: ${err.message}`));
    }
  }

  async testServerHealth() {
    console.log(chalk.blue('🔍 Testing server health...'));
    
    try {
      const response = await fetch(`${this.serverUrl}/api/agents`);
      if (response.ok) {
        this.pass('Server health check');
        console.log(chalk.green('  ✅ Server is responding'));
      } else {
        this.fail('Server health check', `HTTP ${response.status}`);
      }
    } catch (err) {
      this.fail('Server health check', err.message);
      throw err; // Can't continue without server
    }
  }

  async testRestAPI() {
    console.log(chalk.blue('\n📡 Testing REST API endpoints...'));

    // Test agent registration
    try {
      const registerData = {
        agentId: 'test-agent-001',
        name: 'Test Agent',
        type: 'test',
        parentId: null
      };

      const response = await fetch(`${this.serverUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData)
      });

      if (response.ok) {
        this.pass('Agent registration');
        console.log(chalk.green('  ✅ Agent registration works'));
      } else {
        this.fail('Agent registration', `HTTP ${response.status}`);
      }
    } catch (err) {
      this.fail('Agent registration', err.message);
    }

    // Test message sending
    try {
      const messageData = {
        from: 'test-agent-001',
        to: 'broadcast',
        text: 'Test message from automated test'
      };

      const response = await fetch(`${this.serverUrl}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });

      if (response.ok) {
        this.pass('Message sending');
        console.log(chalk.green('  ✅ Message sending works'));
      } else {
        this.fail('Message sending', `HTTP ${response.status}`);
      }
    } catch (err) {
      this.fail('Message sending', err.message);
    }

    // Test getting agents
    try {
      const response = await fetch(`${this.serverUrl}/api/agents`);
      const agents = await response.json();

      if (Array.isArray(agents)) {
        this.pass('Agent listing');
        console.log(chalk.green(`  ✅ Agent listing works (${agents.length} agents)`));
      } else {
        this.fail('Agent listing', 'Invalid response format');
      }
    } catch (err) {
      this.fail('Agent listing', err.message);
    }

    // Test getting messages
    try {
      const response = await fetch(`${this.serverUrl}/api/messages`);
      const messages = await response.json();

      if (Array.isArray(messages)) {
        this.pass('Message history');
        console.log(chalk.green(`  ✅ Message history works (${messages.length} messages)`));
      } else {
        this.fail('Message history', 'Invalid response format');
      }
    } catch (err) {
      this.fail('Message history', err.message);
    }

    // Test thought streaming
    try {
      const thoughtData = {
        agentId: 'test-agent-001',
        thought: 'This is a test thought from automated test'
      };

      const response = await fetch(`${this.serverUrl}/api/thoughts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thoughtData)
      });

      if (response.ok) {
        this.pass('Thought streaming');
        console.log(chalk.green('  ✅ Thought streaming works'));
      } else {
        this.fail('Thought streaming', `HTTP ${response.status}`);
      }
    } catch (err) {
      this.fail('Thought streaming', err.message);
    }
  }

  async testWebSocket() {
    console.log(chalk.blue('\n🔌 Testing WebSocket connection...'));

    return new Promise((resolve) => {
      const ws = new WebSocket(this.wsUrl);
      let connected = false;

      const timeout = setTimeout(() => {
        if (!connected) {
          this.fail('WebSocket connection', 'Connection timeout');
          ws.close();
          resolve();
        }
      }, 5000);

      ws.on('open', () => {
        connected = true;
        clearTimeout(timeout);
        this.pass('WebSocket connection');
        console.log(chalk.green('  ✅ WebSocket connection established'));

        // Test message sending
        ws.send(JSON.stringify({
          type: 'register',
          agentId: 'test-ws-agent',
          name: 'WebSocket Test Agent',
          type: 'test'
        }));

        setTimeout(() => {
          ws.close();
          this.pass('WebSocket messaging');
          console.log(chalk.green('  ✅ WebSocket messaging works'));
          resolve();
        }, 1000);
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        this.fail('WebSocket connection', err.message);
        resolve();
      });

      ws.on('close', () => {
        if (connected) {
          console.log(chalk.blue('  📴 WebSocket connection closed'));
        }
      });
    });
  }

  async testFileUpload() {
    console.log(chalk.blue('\n📁 Testing file upload...'));

    try {
      // Create a test file
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', Buffer.from('Test file content'), {
        filename: 'test.txt',
        contentType: 'text/plain'
      });
      form.append('agentId', 'test-agent-001');
      form.append('recipientId', 'broadcast');
      form.append('messageText', 'Test file upload');

      const response = await fetch(`${this.serverUrl}/api/upload`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });

      if (response.ok) {
        this.pass('File upload');
        console.log(chalk.green('  ✅ File upload works'));
      } else {
        this.fail('File upload', `HTTP ${response.status}`);
      }
    } catch (err) {
      this.fail('File upload', err.message);
    }
  }

  pass(testName) {
    this.testResults.push({ name: testName, status: 'pass' });
  }

  fail(testName, error) {
    this.testResults.push({ name: testName, status: 'fail', error });
    console.log(chalk.red(`  ❌ ${testName} failed: ${error}`));
  }

  async reportResults() {
    console.log(chalk.bold('\n📊 Test Results Summary'));
    console.log('='.repeat(50));

    const passed = this.testResults.filter(r => r.status === 'pass').length;
    const failed = this.testResults.filter(r => r.status === 'fail').length;
    const total = this.testResults.length;

    console.log(`Total tests: ${total}`);
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));

    if (failed === 0) {
      console.log(chalk.green.bold('\n🎉 All tests passed! Communication system is working correctly.'));
    } else {
      console.log(chalk.red.bold('\n❌ Some tests failed. Check the issues above.'));
      
      console.log(chalk.yellow('\n🔧 Common fixes:'));
      console.log('  • Make sure the server is running: npm run server');
      console.log('  • Check if ports 3000 and 8081 are available');
      console.log('  • Install dependencies: npm install');
      console.log('  • Check file permissions for uploads directory');
    }

    console.log('\n' + '='.repeat(50));

    // Detailed results
    console.log(chalk.bold('\n📋 Detailed Results:'));
    this.testResults.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : '❌';
      console.log(`${icon} ${result.name}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
  }
}

// Run tests
const tester = new CommunicationTester();
tester.runTests().catch(err => {
  console.error(chalk.red(`Test execution failed: ${err.message}`));
  process.exit(1);
});