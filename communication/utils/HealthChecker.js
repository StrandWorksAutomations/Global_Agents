import chalk from 'chalk';
import fetch from 'node-fetch';
import { spawn } from 'child_process';

export class HealthChecker {
  constructor(config = {}) {
    this.serverUrl = config.serverUrl || 'http://localhost:3000';
    this.wsUrl = config.wsUrl || 'ws://localhost:8081';
    this.checkInterval = config.checkInterval || 30000; // 30 seconds
    this.healthTimer = null;
    this.issues = new Map();
  }

  async checkSystemHealth() {
    const health = {
      timestamp: new Date(),
      server: await this.checkServer(),
      agents: await this.checkAgents(),
      memory: this.checkMemoryUsage(),
      processes: this.checkProcesses()
    };

    this.reportHealth(health);
    return health;
  }

  async checkServer() {
    try {
      const response = await fetch(`${this.serverUrl}/api/agents`, { 
        timeout: 5000,
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        return {
          status: 'healthy',
          responseTime: response.headers.get('x-response-time') || 'unknown'
        };
      } else {
        return {
          status: 'unhealthy',
          error: `HTTP ${response.status}`
        };
      }
    } catch (err) {
      return {
        status: 'down',
        error: err.message
      };
    }
  }

  async checkAgents() {
    try {
      const response = await fetch(`${this.serverUrl}/api/agents`, { 
        timeout: 5000,
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const agents = await response.json();
        const activeCount = agents.filter(a => a.status === 'active').length;
        const totalCount = agents.length;
        
        return {
          status: activeCount > 0 ? 'healthy' : 'warning',
          active: activeCount,
          total: totalCount,
          agents: agents.map(a => ({
            id: a.id,
            name: a.name,
            status: a.status,
            type: a.type
          }))
        };
      } else {
        return {
          status: 'unknown',
          error: 'Cannot fetch agent list'
        };
      }
    } catch (err) {
      return {
        status: 'unknown',
        error: err.message
      };
    }
  }

  checkMemoryUsage() {
    const used = process.memoryUsage();
    const totalMB = Math.round(used.heapTotal / 1024 / 1024);
    const usedMB = Math.round(used.heapUsed / 1024 / 1024);
    const usage = (usedMB / totalMB) * 100;

    return {
      status: usage > 80 ? 'warning' : 'healthy',
      totalMB,
      usedMB,
      usage: Math.round(usage)
    };
  }

  checkProcesses() {
    return new Promise((resolve) => {
      const proc = spawn('pgrep', ['-f', 'techforge'], { stdio: 'pipe' });
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        const processes = output.trim() ? output.trim().split('\n') : [];
        resolve({
          status: processes.length > 0 ? 'healthy' : 'warning',
          count: processes.length,
          pids: processes
        });
      });

      proc.on('error', () => {
        resolve({
          status: 'unknown',
          error: 'Cannot check processes'
        });
      });
    });
  }

  reportHealth(health) {
    console.log(chalk.blue('\n📊 System Health Check'));
    console.log(`Timestamp: ${health.timestamp.toISOString()}`);
    
    // Server status
    const serverIcon = health.server.status === 'healthy' ? '🟢' : 
                      health.server.status === 'unhealthy' ? '🟡' : '🔴';
    console.log(`Server: ${serverIcon} ${health.server.status}`);
    if (health.server.error) {
      console.log(`  Error: ${health.server.error}`);
    }

    // Agent status
    const agentIcon = health.agents.status === 'healthy' ? '🟢' : 
                     health.agents.status === 'warning' ? '🟡' : '🔴';
    console.log(`Agents: ${agentIcon} ${health.agents.active || 0}/${health.agents.total || 0} active`);

    // Memory status
    const memoryIcon = health.memory.status === 'healthy' ? '🟢' : '🟡';
    console.log(`Memory: ${memoryIcon} ${health.memory.usedMB}MB/${health.memory.totalMB}MB (${health.memory.usage}%)`);

    // Process status
    const processIcon = health.processes.status === 'healthy' ? '🟢' : '🟡';
    console.log(`Processes: ${processIcon} ${health.processes.count} running`);

    this.checkForIssues(health);
  }

  checkForIssues(health) {
    const newIssues = [];

    if (health.server.status !== 'healthy') {
      newIssues.push({
        type: 'server',
        severity: health.server.status === 'down' ? 'critical' : 'warning',
        message: `Server is ${health.server.status}`,
        suggestion: 'Restart the communication server'
      });
    }

    if (health.agents.active === 0 && health.agents.total === 0) {
      newIssues.push({
        type: 'agents',
        severity: 'warning',
        message: 'No agents are deployed',
        suggestion: 'Deploy agents using: npm run team:fullstack'
      });
    }

    if (health.memory.usage > 85) {
      newIssues.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${health.memory.usage}%`,
        suggestion: 'Consider restarting agents or increasing memory limits'
      });
    }

    if (newIssues.length > 0) {
      console.log(chalk.yellow('\n⚠️  Issues Detected:'));
      newIssues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🚨' : '⚠️';
        console.log(`  ${icon} ${issue.message}`);
        console.log(`     Suggestion: ${issue.suggestion}`);
      });
    }

    // Store issues for tracking
    this.issues.set('latest', newIssues);
  }

  startHealthMonitoring() {
    if (this.healthTimer) {
      this.stopHealthMonitoring();
    }

    console.log(chalk.blue(`🏥 Starting health monitoring (every ${this.checkInterval/1000}s)`));
    
    this.healthTimer = setInterval(async () => {
      try {
        await this.checkSystemHealth();
      } catch (err) {
        console.error(chalk.red(`Health check failed: ${err.message}`));
      }
    }, this.checkInterval);

    // Initial check
    setTimeout(() => this.checkSystemHealth(), 1000);
  }

  stopHealthMonitoring() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
      console.log(chalk.blue('🏥 Health monitoring stopped'));
    }
  }

  async autoRecover() {
    const health = await this.checkSystemHealth();
    const issues = this.issues.get('latest') || [];
    
    for (const issue of issues) {
      if (issue.type === 'server' && issue.severity === 'critical') {
        console.log(chalk.yellow('🔄 Attempting server recovery...'));
        // Could implement server restart logic here
      }
    }
  }

  getHealthSummary() {
    return {
      issues: this.issues.get('latest') || [],
      monitoringActive: !!this.healthTimer
    };
  }
}