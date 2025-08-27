import { BaseAgent } from '../BaseAgent.js';
import { spawn } from 'child_process';
import chalk from 'chalk';
import yaml from 'yaml';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TechForgeBridge extends BaseAgent {
  constructor(config) {
    super({
      ...config,
      name: 'TechForgeBridge',
      type: 'orchestrator'
    });
    
    this.activeAgents = new Map();
    this.taskQueue = [];
    this.projectContext = {};
    this.teamConfiguration = null;
    this.loadConfiguration();
  }

  async loadConfiguration() {
    try {
      const configPath = path.join(__dirname, '../../.techforge.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      this.teamConfiguration = yaml.parse(configContent);
      console.log(chalk.green('✓ Loaded TechForge configuration'));
    } catch (err) {
      console.error(chalk.red('Failed to load configuration:', err.message));
    }
  }

  async connect() {
    await super.connect();
    console.log(chalk.cyan.bold('TechForge Bridge Online'));
    console.log(chalk.white('Ready to orchestrate AI development team'));
    this.startOrchestration();
  }

  startOrchestration() {
    setInterval(() => {
      this.processTaskQueue();
      this.monitorAgentHealth();
    }, 5000);
  }

  async deployTeam(teamName) {
    const team = this.teamConfiguration?.teams?.[teamName];
    
    if (!team) {
      console.error(chalk.red(`Team '${teamName}' not found`));
      return false;
    }
    
    console.log(chalk.cyan(`Deploying ${teamName} team...`));
    
    for (const agentType of team.agents) {
      await this.deployAgent(agentType);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(chalk.green(`✓ ${teamName} team deployed successfully`));
    return true;
  }

  async deployAgent(agentType) {
    const expertise = agentType.replace('-expert', '').replace(/-/g, '_');
    
    this.thought(`Deploying ${expertise} expert...`);
    
    const agentProcess = spawn('node', [
      path.join(__dirname, '../agents/techforge-spawn.js'),
      '--expertise', expertise
    ], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    this.activeAgents.set(expertise, {
      process: agentProcess,
      expertise,
      status: 'starting',
      startTime: Date.now()
    });
    
    agentProcess.stdout.on('data', (data) => {
      console.log(chalk.gray(`[${expertise}] ${data.toString().trim()}`));
    });
    
    agentProcess.stderr.on('data', (data) => {
      console.error(chalk.red(`[${expertise}] ${data.toString().trim()}`));
    });
    
    agentProcess.on('close', (code) => {
      console.log(chalk.yellow(`${expertise} agent exited with code ${code}`));
      this.activeAgents.delete(expertise);
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.activeAgents.get(expertise).status = 'active';
    
    await this.sendMessage('broadcast', `Deployed ${expertise} expert`, {
      type: 'agent-deployed',
      expertise
    });
    
    return true;
  }

  async onMessage(message) {
    super.onMessage(message);
    
    if (message.type === 'project-request') {
      await this.handleProjectRequest(message);
    }
    
    if (message.type === 'task-completed') {
      await this.handleTaskCompletion(message);
    }
    
    if (message.type === 'agent-online') {
      this.updateAgentRegistry(message);
    }
    
    if (message.type === 'orchestrate') {
      await this.orchestrateTask(message);
    }
  }

  async handleProjectRequest(message) {
    const { project, requirements, timeline } = message;
    
    this.thought(`New project request: ${project}`);
    
    this.projectContext = {
      name: project,
      requirements,
      timeline,
      startTime: Date.now(),
      tasks: []
    };
    
    const tasks = await this.decomposeProject(project, requirements);
    
    for (const task of tasks) {
      this.taskQueue.push(task);
    }
    
    await this.sendMessage(message.from, `Project '${project}' accepted`, {
      type: 'project-accepted',
      totalTasks: tasks.length,
      estimatedTime: this.estimateProjectTime(tasks)
    });
    
    this.processTaskQueue();
  }

  async decomposeProject(project, requirements) {
    const tasks = [];
    
    if (requirements.includes('API') || requirements.includes('backend')) {
      tasks.push({
        id: `task-${Date.now()}-1`,
        type: 'backend',
        description: 'Design and implement API endpoints',
        expertise: 'backend',
        priority: 'high'
      });
    }
    
    if (requirements.includes('UI') || requirements.includes('frontend')) {
      tasks.push({
        id: `task-${Date.now()}-2`,
        type: 'frontend',
        description: 'Create user interface components',
        expertise: 'frontend',
        priority: 'high'
      });
    }
    
    if (requirements.includes('database') || requirements.includes('data')) {
      tasks.push({
        id: `task-${Date.now()}-3`,
        type: 'database',
        description: 'Design database schema and queries',
        expertise: 'database',
        priority: 'high'
      });
    }
    
    if (requirements.includes('deploy') || requirements.includes('CI/CD')) {
      tasks.push({
        id: `task-${Date.now()}-4`,
        type: 'devops',
        description: 'Set up deployment pipeline',
        expertise: 'devops',
        priority: 'medium'
      });
    }
    
    if (requirements.includes('security') || requirements.includes('auth')) {
      tasks.push({
        id: `task-${Date.now()}-5`,
        type: 'security',
        description: 'Implement security measures',
        expertise: 'security',
        priority: 'high'
      });
    }
    
    if (requirements.includes('test') || requirements.includes('QA')) {
      tasks.push({
        id: `task-${Date.now()}-6`,
        type: 'qa',
        description: 'Create test suites',
        expertise: 'qa',
        priority: 'medium'
      });
    }
    
    return tasks;
  }

  async processTaskQueue() {
    if (this.taskQueue.length === 0) return;
    
    const task = this.taskQueue.shift();
    
    this.thought(`Assigning task: ${task.description} to ${task.expertise} expert`);
    
    const agentActive = await this.isAgentActive(task.expertise);
    
    if (!agentActive) {
      await this.deployAgent(`${task.expertise}-expert`);
    }
    
    await this.sendMessage('broadcast', `Task assignment: ${task.description}`, {
      type: 'task-request',
      task: task.description,
      requirements: this.projectContext.requirements,
      priority: task.priority,
      taskId: task.id
    });
    
    this.projectContext.tasks.push({
      ...task,
      status: 'assigned',
      assignedAt: Date.now()
    });
  }

  async isAgentActive(expertise) {
    const agent = this.activeAgents.get(expertise);
    return agent && agent.status === 'active';
  }

  async handleTaskCompletion(message) {
    const { taskId, results, summary } = message;
    
    this.thought(`Task completed: ${taskId}`);
    
    const taskIndex = this.projectContext.tasks.findIndex(t => t.id === taskId);
    if (taskIndex >= 0) {
      this.projectContext.tasks[taskIndex].status = 'completed';
      this.projectContext.tasks[taskIndex].results = results;
      this.projectContext.tasks[taskIndex].completedAt = Date.now();
    }
    
    const allTasksComplete = this.projectContext.tasks.every(t => t.status === 'completed');
    
    if (allTasksComplete) {
      await this.finalizeProject();
    }
  }

  async finalizeProject() {
    const duration = Date.now() - this.projectContext.startTime;
    
    const summary = {
      project: this.projectContext.name,
      tasksCompleted: this.projectContext.tasks.length,
      duration: `${Math.round(duration / 1000 / 60)} minutes`,
      agents: [...new Set(this.projectContext.tasks.map(t => t.expertise))],
      status: 'completed'
    };
    
    await this.sendMessage('broadcast', `Project '${this.projectContext.name}' completed`, {
      type: 'project-completed',
      summary
    });
    
    console.log(chalk.green.bold('\n✓ Project Completed Successfully!'));
    console.log(chalk.white(JSON.stringify(summary, null, 2)));
  }

  async orchestrateTask(message) {
    const { task, strategy } = message;
    
    this.thought(`Orchestrating: ${task} with strategy: ${strategy}`);
    
    if (strategy === 'parallel') {
      await this.orchestrateParallel(task);
    } else if (strategy === 'sequential') {
      await this.orchestrateSequential(task);
    } else {
      await this.orchestrateAdaptive(task);
    }
  }

  async orchestrateParallel(task) {
    const relevantAgents = this.findRelevantAgents(task);
    
    for (const agentType of relevantAgents) {
      await this.sendMessage('broadcast', `Parallel task: ${task}`, {
        type: 'task-request',
        task,
        strategy: 'parallel'
      });
    }
  }

  async orchestrateSequential(task) {
    const pipeline = this.createTaskPipeline(task);
    
    for (const step of pipeline) {
      await this.sendMessage('broadcast', `Sequential step: ${step.task}`, {
        type: 'task-request',
        task: step.task,
        expertise: step.expertise,
        dependsOn: step.dependsOn
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async orchestrateAdaptive(task) {
    const complexity = this.assessTaskComplexity(task);
    
    if (complexity > 0.7) {
      await this.orchestrateParallel(task);
    } else {
      await this.orchestrateSequential(task);
    }
  }

  findRelevantAgents(task) {
    const taskLower = task.toLowerCase();
    const relevant = [];
    
    if (taskLower.includes('api') || taskLower.includes('backend')) {
      relevant.push('backend');
    }
    if (taskLower.includes('ui') || taskLower.includes('frontend')) {
      relevant.push('frontend');
    }
    if (taskLower.includes('database') || taskLower.includes('data')) {
      relevant.push('database');
    }
    if (taskLower.includes('security')) {
      relevant.push('security');
    }
    if (taskLower.includes('test')) {
      relevant.push('qa');
    }
    
    return relevant;
  }

  createTaskPipeline(task) {
    return [
      { task: 'Design architecture', expertise: 'backend', dependsOn: null },
      { task: 'Create database schema', expertise: 'database', dependsOn: 'architecture' },
      { task: 'Implement backend', expertise: 'backend', dependsOn: 'schema' },
      { task: 'Build frontend', expertise: 'frontend', dependsOn: 'backend' },
      { task: 'Add security', expertise: 'security', dependsOn: 'backend' },
      { task: 'Write tests', expertise: 'qa', dependsOn: 'all' }
    ];
  }

  assessTaskComplexity(task) {
    const complexityFactors = [
      'microservices', 'distributed', 'real-time', 'machine learning',
      'blockchain', 'complex', 'enterprise', 'scalable'
    ];
    
    const taskLower = task.toLowerCase();
    let complexity = 0;
    
    for (const factor of complexityFactors) {
      if (taskLower.includes(factor)) {
        complexity += 0.2;
      }
    }
    
    return Math.min(complexity, 1.0);
  }

  estimateProjectTime(tasks) {
    const baseTime = 5;
    const timePerTask = 10;
    const parallelFactor = 0.6;
    
    const totalTime = baseTime + (tasks.length * timePerTask * parallelFactor);
    return `${Math.round(totalTime)} minutes`;
  }

  updateAgentRegistry(message) {
    const { expertise, capabilities } = message;
    
    if (this.activeAgents.has(expertise)) {
      this.activeAgents.get(expertise).capabilities = capabilities;
      this.activeAgents.get(expertise).status = 'active';
    }
  }

  monitorAgentHealth() {
    for (const [expertise, agent] of this.activeAgents) {
      const uptime = Date.now() - agent.startTime;
      
      if (agent.status === 'active' && uptime > 3600000) {
        this.thought(`${expertise} agent has been running for ${Math.round(uptime / 1000 / 60)} minutes`);
      }
    }
  }

  async onExecute(command) {
    if (command.startsWith('deploy:')) {
      const agentType = command.replace('deploy:', '').trim();
      return await this.deployAgent(agentType);
    }
    
    if (command.startsWith('team:')) {
      const teamName = command.replace('team:', '').trim();
      return await this.deployTeam(teamName);
    }
    
    if (command === 'status') {
      return this.getSystemStatus();
    }
    
    return { error: 'Unknown command' };
  }

  getSystemStatus() {
    return {
      bridge: 'active',
      activeAgents: Array.from(this.activeAgents.keys()),
      queuedTasks: this.taskQueue.length,
      currentProject: this.projectContext.name || 'none',
      uptime: `${Math.round((Date.now() - this.connectedAt) / 1000 / 60)} minutes`
    };
  }
}