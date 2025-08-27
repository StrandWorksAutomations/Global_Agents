import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';
import chalk from 'chalk';

export class BaseAgent extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id || uuidv4();
    this.name = config.name || `Agent-${this.id.slice(0, 8)}`;
    this.type = config.type || 'worker';
    this.parentId = config.parentId || null;
    this.serverUrl = config.serverUrl || 'http://localhost:3000';
    this.wsUrl = config.wsUrl || 'ws://localhost:8081';
    this.ws = null;
    this.isConnected = false;
    this.messageQueue = [];
    this.thoughtBuffer = [];
    this.thoughtInterval = null;
  }

  async connect() {
    try {
      await this.register();
      this.connectWebSocket();
      this.startThoughtStreaming();
      return true;
    } catch (err) {
      console.error(chalk.red(`Connection failed: ${err.message}`));
      return false;
    }
  }

  async register() {
    const response = await fetch(`${this.serverUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: this.id,
        name: this.name,
        type: this.type,
        parentId: this.parentId
      })
    });

    if (!response.ok) {
      throw new Error('Registration failed');
    }

    console.log(chalk.green(`✓ Agent ${this.name} registered`));
  }

  connectWebSocket() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      this.isConnected = true;
      console.log(chalk.green(`✓ WebSocket connected`));
      
      this.ws.send(JSON.stringify({
        type: 'register',
        agentId: this.id,
        name: this.name,
        type: this.type
      }));

      this.processMessageQueue();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (err) {
        console.error(chalk.red('Failed to parse message:', err));
      }
    });

    this.ws.on('close', () => {
      this.isConnected = false;
      console.log(chalk.yellow('WebSocket disconnected, attempting reconnect...'));
      setTimeout(() => this.connectWebSocket(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error(chalk.red(`WebSocket error: ${err.message}`));
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'message':
        this.onMessage(message.data);
        break;
      
      case 'execute-command':
        this.executeCommand(message.command, message.fromAgent);
        break;
      
      case 'file-shared':
        this.onFileReceived(message.data);
        break;
      
      default:
        this.emit('custom-message', message);
    }
  }

  async sendMessage(to, text, options = {}) {
    const message = {
      from: this.id,
      to: to || 'broadcast',
      text,
      ...options
    };

    if (!this.isConnected) {
      this.messageQueue.push(message);
      return null;
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      const result = await response.json();
      return result.messageId;
    } catch (err) {
      console.error(chalk.red(`Failed to send message: ${err.message}`));
      return null;
    }
  }

  async sendFile(filePath, recipientId, messageText) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('agentId', this.id);
    form.append('recipientId', recipientId || 'broadcast');
    if (messageText) form.append('messageText', messageText);

    try {
      const response = await fetch(`${this.serverUrl}/api/upload`, {
        method: 'POST',
        body: form
      });

      const result = await response.json();
      console.log(chalk.green(`✓ File sent: ${result.file.originalName}`));
      return result;
    } catch (err) {
      console.error(chalk.red(`Failed to send file: ${err.message}`));
      return null;
    }
  }

  thought(text) {
    this.thoughtBuffer.push({
      text,
      timestamp: new Date()
    });
  }

  startThoughtStreaming() {
    this.thoughtInterval = setInterval(async () => {
      if (this.thoughtBuffer.length === 0) return;

      const thoughts = this.thoughtBuffer.splice(0, 10);
      
      for (const thought of thoughts) {
        try {
          await fetch(`${this.serverUrl}/api/thoughts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: this.id,
              thought: thought.text
            })
          });
        } catch (err) {
          console.error(chalk.red(`Failed to stream thought: ${err.message}`));
        }
      }
    }, 1000);
  }

  async executeCommand(command, fromAgent) {
    console.log(chalk.cyan(`Executing command from ${fromAgent}: ${command}`));
    
    this.thought(`Received command: ${command}`);
    
    try {
      const result = await this.onExecute(command);
      await this.sendMessage(fromAgent, `Command executed: ${JSON.stringify(result)}`);
    } catch (err) {
      await this.sendMessage(fromAgent, `Command failed: ${err.message}`);
    }
  }

  async requestExecution(targetAgentId, command) {
    if (!this.ws || !this.isConnected) {
      console.error(chalk.red('Not connected to server'));
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'execute',
      targetId: targetAgentId,
      command,
      fromAgent: this.id
    }));
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this.sendMessage(message.to, message.text, message);
    }
  }

  onMessage(message) {
    console.log(chalk.blue(`[${message.from}]: ${message.text}`));
  }

  onFileReceived(message) {
    console.log(chalk.magenta(`File received from ${message.from}: ${message.file.originalName}`));
  }

  async onExecute(command) {
    console.log(chalk.yellow(`Default executor - override this method`));
    return { status: 'not-implemented' };
  }

  disconnect() {
    if (this.thoughtInterval) {
      clearInterval(this.thoughtInterval);
    }
    
    if (this.ws) {
      this.ws.close();
    }
    
    console.log(chalk.yellow(`Agent ${this.name} disconnected`));
  }
}