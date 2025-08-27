import { BaseAgent } from '../BaseAgent.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import yaml from 'yaml';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TechForgeAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.expertise = config.expertise || 'general';
    this.agentProfile = null;
    this.capabilities = [];
    this.techStack = [];
    this.activeTask = null;
    this.collaborators = new Map();
    this.loadAgentProfile();
  }

  async loadAgentProfile() {
    const possiblePaths = [
      path.join(__dirname, '../../', `${this.expertise}_expert.md`),
      path.join(__dirname, '../../', `${this.expertise.replace('_', '-')}-expert.md`),
      path.join(__dirname, '../../', `${this.expertise.replace('_', '')}_expert.md`),
      path.join(__dirname, '../../', `${this.expertise}.md`)
    ];

    for (const profilePath of possiblePaths) {
      try {
        const profileContent = await fs.readFile(profilePath, 'utf-8');
        this.parseAgentProfile(profileContent);
        console.log(chalk.green(`✓ Loaded ${this.expertise} expert profile from ${path.basename(profilePath)}`));
        return;
      } catch (err) {
        // Continue to next path
      }
    }
    
    console.log(chalk.yellow(`Profile not found for ${this.expertise}, using defaults`));
    this.setDefaultCapabilities();
  }

  parseAgentProfile(content) {
    const lines = content.split('\n');
    let section = '';
    
    for (const line of lines) {
      if (line.startsWith('# ')) {
        this.name = line.replace('# ', '').replace(' Expert', '').trim();
      } else if (line.startsWith('## ')) {
        section = line.replace('## ', '').trim();
      } else if (section === 'Core Expertise' && line.startsWith('- ')) {
        this.capabilities.push(line.replace('- ', '').trim());
      } else if (section === 'Technologies' && line.startsWith('- ')) {
        this.techStack.push(line.replace('- ', '').trim());
      }
    }
  }

  setDefaultCapabilities() {
    const defaults = {
      backend: {
        capabilities: ['API Development', 'Database Design', 'Microservices', 'Authentication'],
        techStack: ['Node.js', 'Python', 'Java', 'PostgreSQL', 'Redis']
      },
      frontend: {
        capabilities: ['UI Development', 'State Management', 'Component Design', 'Performance'],
        techStack: ['React', 'Vue', 'TypeScript', 'CSS', 'Webpack']
      },
      database: {
        capabilities: ['Schema Design', 'Query Optimization', 'Data Modeling', 'Migrations'],
        techStack: ['PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'SQL']
      },
      devops: {
        capabilities: ['CI/CD', 'Infrastructure as Code', 'Containerization', 'Monitoring'],
        techStack: ['Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'AWS']
      },
      security: {
        capabilities: ['Vulnerability Assessment', 'Penetration Testing', 'Compliance', 'Encryption'],
        techStack: ['OWASP', 'Burp Suite', 'Metasploit', 'SSL/TLS', 'OAuth']
      },
      ai_ml: {
        capabilities: ['Model Training', 'Data Processing', 'Neural Networks', 'NLP'],
        techStack: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'Jupyter']
      },
      qa: {
        capabilities: ['Test Automation', 'Performance Testing', 'Test Planning', 'Bug Tracking'],
        techStack: ['Jest', 'Cypress', 'Selenium', 'JMeter', 'Postman']
      },
      mobile: {
        capabilities: ['Cross-Platform Development', 'Native Apps', 'App Store Deployment', 'Push Notifications'],
        techStack: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Xcode']
      },
      game: {
        capabilities: ['Game Engine Development', '3D Graphics', 'Physics', 'Multiplayer'],
        techStack: ['Unity', 'Unreal Engine', 'C++', 'WebGL', 'Blender']
      },
      hardware_iot: {
        capabilities: ['Embedded Systems', 'Firmware', 'Sensor Integration', 'Protocol Implementation'],
        techStack: ['Arduino', 'Raspberry Pi', 'C', 'MQTT', 'LoRaWAN']
      },
      uiux: {
        capabilities: ['User Research', 'Wireframing', 'Prototyping', 'Accessibility'],
        techStack: ['Figma', 'Sketch', 'Adobe XD', 'InVision', 'Principle']
      }
    };

    const profile = defaults[this.expertise] || defaults.backend;
    this.capabilities = profile.capabilities;
    this.techStack = profile.techStack;
  }

  async connect() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        await super.connect();
        this.thought(`${this.expertise} expert online with capabilities: ${this.capabilities.join(', ')}`);
        await this.broadcastCapabilities();
        return true;
      } catch (err) {
        retryCount++;
        console.log(chalk.yellow(`Connection attempt ${retryCount}/${maxRetries} failed: ${err.message}`));
        
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(chalk.blue(`Retrying in ${delay/1000} seconds...`));
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(chalk.red(`Failed to connect after ${maxRetries} attempts`));
    return false;
  }

  async broadcastCapabilities() {
    await this.sendMessage('broadcast', `${this.name} is online`, {
      type: 'agent-online',
      expertise: this.expertise,
      capabilities: this.capabilities,
      techStack: this.techStack
    });
  }

  async onMessage(message) {
    super.onMessage(message);
    
    if (message.type === 'agent-online' && message.from !== this.id) {
      this.collaborators.set(message.from, {
        expertise: message.expertise,
        capabilities: message.capabilities
      });
      this.thought(`Discovered collaborator: ${message.expertise} expert`);
    }
    
    if (message.type === 'task-request') {
      await this.handleTaskRequest(message);
    }
    
    if (message.type === 'collaboration-request') {
      await this.handleCollaborationRequest(message);
    }
    
    if (message.type === 'code-review-request') {
      await this.handleCodeReview(message);
    }
  }

  async handleTaskRequest(message) {
    const { task, requirements, priority } = message;
    
    this.thought(`Received task: ${task}`);
    this.activeTask = { task, requirements, priority, from: message.from };
    
    const taskRelevance = this.assessTaskRelevance(task, requirements);
    
    if (taskRelevance > 0.7) {
      await this.sendMessage(message.from, `I'll handle this task: ${task}`, {
        type: 'task-accepted',
        expertise: this.expertise,
        estimatedTime: this.estimateTaskTime(task)
      });
      
      await this.executeTask(task, requirements);
    } else if (taskRelevance > 0.4) {
      const bestExpert = this.findBestCollaborator(task);
      if (bestExpert) {
        await this.requestCollaboration(bestExpert, task, requirements);
      }
    }
  }

  assessTaskRelevance(task, requirements) {
    const taskLower = task.toLowerCase();
    const reqLower = requirements ? requirements.toLowerCase() : '';
    const combined = `${taskLower} ${reqLower}`;
    
    let relevance = 0;
    
    for (const capability of this.capabilities) {
      if (combined.includes(capability.toLowerCase())) {
        relevance += 0.3;
      }
    }
    
    for (const tech of this.techStack) {
      if (combined.includes(tech.toLowerCase())) {
        relevance += 0.2;
      }
    }
    
    return Math.min(relevance, 1.0);
  }

  findBestCollaborator(task) {
    let bestMatch = null;
    let highestRelevance = 0;
    
    for (const [agentId, profile] of this.collaborators) {
      const relevance = this.assessCollaboratorRelevance(task, profile);
      if (relevance > highestRelevance) {
        highestRelevance = relevance;
        bestMatch = agentId;
      }
    }
    
    return highestRelevance > 0.5 ? bestMatch : null;
  }

  assessCollaboratorRelevance(task, profile) {
    const taskLower = task.toLowerCase();
    let relevance = 0;
    
    for (const capability of profile.capabilities || []) {
      if (taskLower.includes(capability.toLowerCase())) {
        relevance += 0.4;
      }
    }
    
    return Math.min(relevance, 1.0);
  }

  async requestCollaboration(agentId, task, requirements) {
    this.thought(`Requesting collaboration from ${this.collaborators.get(agentId).expertise} expert`);
    
    await this.sendMessage(agentId, `Need help with: ${task}`, {
      type: 'collaboration-request',
      task,
      requirements,
      myExpertise: this.expertise
    });
  }

  async handleCollaborationRequest(message) {
    const { task, requirements, myExpertise } = message;
    
    this.thought(`Collaboration requested by ${myExpertise} expert for: ${task}`);
    
    const relevance = this.assessTaskRelevance(task, requirements);
    
    if (relevance > 0.5) {
      await this.sendMessage(message.from, 'Accepting collaboration', {
        type: 'collaboration-accepted',
        expertise: this.expertise
      });
      
      await this.collaborateOnTask(task, requirements, message.from);
    }
  }

  async executeTask(task, requirements) {
    this.thought(`Executing task: ${task}`);
    
    const steps = this.planTaskExecution(task, requirements);
    const results = [];
    
    for (const step of steps) {
      this.thought(`Step: ${step.description}`);
      const result = await this.executeStep(step);
      results.push(result);
      
      await this.sendMessage(this.activeTask.from, `Progress: ${step.description}`, {
        type: 'task-progress',
        step: step.description,
        result
      });
    }
    
    await this.sendMessage(this.activeTask.from, 'Task completed', {
      type: 'task-completed',
      results,
      summary: this.generateTaskSummary(results)
    });
    
    this.activeTask = null;
  }

  planTaskExecution(task, requirements) {
    const plans = {
      backend: [
        { description: 'Analyze requirements', action: 'analyze' },
        { description: 'Design API structure', action: 'design' },
        { description: 'Implement endpoints', action: 'implement' },
        { description: 'Add validation', action: 'validate' },
        { description: 'Write tests', action: 'test' }
      ],
      frontend: [
        { description: 'Create component structure', action: 'structure' },
        { description: 'Implement UI components', action: 'implement' },
        { description: 'Add state management', action: 'state' },
        { description: 'Style components', action: 'style' },
        { description: 'Add interactions', action: 'interact' }
      ],
      database: [
        { description: 'Design schema', action: 'schema' },
        { description: 'Create migrations', action: 'migrate' },
        { description: 'Add indexes', action: 'index' },
        { description: 'Optimize queries', action: 'optimize' }
      ],
      devops: [
        { description: 'Set up environment', action: 'environment' },
        { description: 'Configure CI/CD', action: 'cicd' },
        { description: 'Create containers', action: 'containerize' },
        { description: 'Deploy services', action: 'deploy' }
      ]
    };
    
    return plans[this.expertise] || plans.backend;
  }

  async executeStep(step) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      step: step.description,
      status: 'completed',
      output: `Successfully ${step.action} for ${this.activeTask.task}`,
      timestamp: new Date()
    };
  }

  async collaborateOnTask(task, requirements, partnerId) {
    this.thought(`Collaborating on: ${task}`);
    
    const myContribution = this.generateContribution(task, requirements);
    
    await this.sendMessage(partnerId, `My contribution: ${myContribution.description}`, {
      type: 'collaboration-contribution',
      contribution: myContribution
    });
  }

  generateContribution(task, requirements) {
    const contributions = {
      backend: {
        description: 'API endpoints and business logic',
        code: 'router.post("/api/resource", validateInput, controller.create);'
      },
      frontend: {
        description: 'React components and UI',
        code: 'const Component = () => <div className="container">Content</div>;'
      },
      database: {
        description: 'Optimized database schema',
        code: 'CREATE TABLE resources (id SERIAL PRIMARY KEY, name VARCHAR(255));'
      },
      security: {
        description: 'Security validation and authentication',
        code: 'middleware.authenticate = (req, res, next) => { /* auth logic */ };'
      }
    };
    
    return contributions[this.expertise] || contributions.backend;
  }

  async handleCodeReview(message) {
    const { code, language, purpose } = message;
    
    this.thought(`Reviewing ${language} code for ${purpose}`);
    
    const review = await this.performCodeReview(code, language);
    
    await this.sendMessage(message.from, 'Code review complete', {
      type: 'code-review-result',
      review,
      expertise: this.expertise
    });
  }

  async performCodeReview(code, language) {
    const issues = [];
    const suggestions = [];
    
    if (this.expertise === 'security') {
      if (code.includes('eval(') || code.includes('exec(')) {
        issues.push('Potential code injection vulnerability');
      }
      if (!code.includes('sanitize') && code.includes('user')) {
        suggestions.push('Add input sanitization for user data');
      }
    }
    
    if (this.expertise === 'backend') {
      if (!code.includes('try') && !code.includes('catch')) {
        suggestions.push('Add error handling');
      }
      if (!code.includes('async') && code.includes('await')) {
        issues.push('Missing async keyword');
      }
    }
    
    if (this.expertise === 'frontend') {
      if (code.includes('document.getElementById') && code.includes('React')) {
        issues.push('Avoid direct DOM manipulation in React');
      }
      if (!code.includes('key=') && code.includes('.map(')) {
        suggestions.push('Add key prop to list items');
      }
    }
    
    return {
      issues,
      suggestions,
      score: Math.max(0, 100 - (issues.length * 20) - (suggestions.length * 10)),
      reviewed: new Date()
    };
  }

  generateTaskSummary(results) {
    return {
      expertise: this.expertise,
      stepsCompleted: results.length,
      success: results.every(r => r.status === 'completed'),
      duration: Date.now() - (this.activeTask?.startTime || Date.now()),
      summary: `${this.expertise} expert completed ${results.length} steps successfully`
    };
  }

  estimateTaskTime(task) {
    const complexity = task.length > 100 ? 'complex' : task.length > 50 ? 'medium' : 'simple';
    const estimates = {
      simple: '5 minutes',
      medium: '15 minutes',
      complex: '30 minutes'
    };
    return estimates[complexity];
  }

  async onExecute(command) {
    this.thought(`Executing command: ${command}`);
    
    if (command.startsWith('review:')) {
      const filePath = command.replace('review:', '').trim();
      const code = await fs.readFile(filePath, 'utf-8');
      const review = await this.performCodeReview(code, path.extname(filePath));
      return review;
    }
    
    if (command.startsWith('generate:')) {
      const request = command.replace('generate:', '').trim();
      return this.generateCode(request);
    }
    
    return await execAsync(command);
  }

  generateCode(request) {
    const templates = {
      backend: `
// ${request}
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Implementation here
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;`,
      frontend: `
// ${request}
import React, { useState } from 'react';

const Component = () => {
  const [state, setState] = useState(null);
  
  return (
    <div className="component">
      {/* Implementation here */}
    </div>
  );
};

export default Component;`
    };
    
    return templates[this.expertise] || templates.backend;
  }
}