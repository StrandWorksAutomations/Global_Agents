/**
 * TechForge AI Agent Suite SDK
 * Enterprise-grade SDK for programmatic agent control
 * @version 2.0.0
 * @license Proprietary
 */

const EventEmitter = require('events');
const WebSocket = require('ws');
const axios = require('axios');

/**
 * Main TechForge SDK Client
 */
class TechForgeSDK extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            apiKey: config.apiKey || process.env.TECHFORGE_API_KEY,
            endpoint: config.endpoint || 'https://api.techforge.ai/v2',
            wsEndpoint: config.wsEndpoint || 'wss://stream.techforge.ai/v2',
            timeout: config.timeout || 30000,
            retries: config.retries || 3,
            debug: config.debug || false,
            ...config
        };
        
        this.agents = {};
        this.activeTeam = null;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this._initializeAPI();
        this._initializeWebSocket();
        this._setupAgentRegistry();
    }
    
    /**
     * Initialize API client
     */
    _initializeAPI() {
        this.api = axios.create({
            baseURL: this.config.endpoint,
            timeout: this.config.timeout,
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'X-SDK-Version': '2.0.0',
                'User-Agent': 'TechForge-SDK-JS/2.0.0'
            }
        });
        
        // Request interceptor for debugging
        this.api.interceptors.request.use(request => {
            if (this.config.debug) {
                console.log('[TechForge] Request:', request.method, request.url);
            }
            return request;
        });
        
        // Response interceptor for error handling
        this.api.interceptors.response.use(
            response => response,
            async error => {
                if (error.response?.status === 401) {
                    this.emit('auth_error', 'Invalid API key');
                }
                if (error.response?.status === 429) {
                    this.emit('rate_limit', error.response.headers['x-ratelimit-reset']);
                }
                return Promise.reject(error);
            }
        );
    }
    
    /**
     * Initialize WebSocket connection for real-time updates
     */
    _initializeWebSocket() {
        this.ws = new WebSocket(this.config.wsEndpoint, {
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`
            }
        });
        
        this.ws.on('open', () => {
            this.reconnectAttempts = 0;
            this.emit('connected');
            if (this.config.debug) {
                console.log('[TechForge] WebSocket connected');
            }
        });
        
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this._handleWebSocketMessage(message);
            } catch (error) {
                console.error('[TechForge] WebSocket message parse error:', error);
            }
        });
        
        this.ws.on('close', () => {
            this.emit('disconnected');
            this._attemptReconnect();
        });
        
        this.ws.on('error', (error) => {
            this.emit('error', error);
        });
    }
    
    /**
     * Handle WebSocket messages
     */
    _handleWebSocketMessage(message) {
        switch (message.type) {
            case 'agent_status':
                this.emit('agent_status', message.data);
                break;
            case 'task_update':
                this.emit('task_update', message.data);
                break;
            case 'insight':
                this.emit('insight', message.data);
                break;
            case 'error':
                this.emit('agent_error', message.data);
                break;
            case 'metrics':
                this.emit('metrics', message.data);
                break;
            default:
                if (this.config.debug) {
                    console.log('[TechForge] Unknown message type:', message.type);
                }
        }
    }
    
    /**
     * Attempt to reconnect WebSocket
     */
    _attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                if (this.config.debug) {
                    console.log(`[TechForge] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                }
                this._initializeWebSocket();
            }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
        } else {
            this.emit('connection_lost');
        }
    }
    
    /**
     * Setup agent registry
     */
    _setupAgentRegistry() {
        this.agentRegistry = {
            'backend-expert': BackendAgent,
            'frontend-expert': FrontendAgent,
            'database-expert': DatabaseAgent,
            'devops-expert': DevOpsAgent,
            'security-expert': SecurityAgent,
            'qa-expert': QAAgent,
            'ai-ml-expert': AIMLAgent,
            'mobile-expert': MobileAgent,
            'game-expert': GameAgent,
            'hardware-iot-expert': HardwareIoTAgent,
            'uiux-principal': UIUXAgent,
            'web-design-agent': WebDesignAgent,
            'refactor-agent': RefactorAgent
        };
    }
    
    // ==================== Core Methods ====================
    
    /**
     * Deploy a single agent
     * @param {string} agentId - Agent identifier
     * @param {object} config - Agent configuration
     * @returns {Promise<Agent>}
     */
    async deployAgent(agentId, config = {}) {
        try {
            const response = await this.api.post(`/agents/deploy`, {
                agent_id: agentId,
                config: config
            });
            
            const AgentClass = this.agentRegistry[agentId];
            if (!AgentClass) {
                throw new Error(`Unknown agent: ${agentId}`);
            }
            
            const agent = new AgentClass(response.data, this);
            this.agents[agentId] = agent;
            
            this.emit('agent_deployed', { agentId, agent });
            return agent;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Deploy a team of agents
     * @param {string} teamPreset - Team preset name
     * @returns {Promise<Team>}
     */
    async deployTeam(teamPreset) {
        try {
            const response = await this.api.post(`/teams/deploy`, {
                preset: teamPreset
            });
            
            const team = new Team(response.data, this);
            this.activeTeam = team;
            
            // Deploy all agents in the team
            for (const agentId of response.data.agents) {
                await this.deployAgent(agentId);
            }
            
            this.emit('team_deployed', { teamPreset, team });
            return team;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Execute a task with an agent
     * @param {string} agentId - Agent identifier
     * @param {string} task - Task description
     * @param {object} options - Task options
     * @returns {Promise<TaskResult>}
     */
    async executeTask(agentId, task, options = {}) {
        const agent = this.agents[agentId];
        if (!agent) {
            throw new Error(`Agent ${agentId} not deployed`);
        }
        
        return agent.execute(task, options);
    }
    
    /**
     * Execute a complex task with multiple agents
     * @param {string} task - Task description
     * @param {object} options - Task options
     * @returns {Promise<TeamTaskResult>}
     */
    async executeTeamTask(task, options = {}) {
        if (!this.activeTeam) {
            throw new Error('No team deployed');
        }
        
        return this.activeTeam.execute(task, options);
    }
    
    /**
     * Get insights from agents
     * @param {object} options - Insight options
     * @returns {Promise<Insights>}
     */
    async getInsights(options = {}) {
        try {
            const response = await this.api.get('/insights', { params: options });
            return new Insights(response.data);
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Get analytics data
     * @param {object} options - Analytics options
     * @returns {Promise<Analytics>}
     */
    async getAnalytics(options = {}) {
        try {
            const response = await this.api.get('/analytics', { params: options });
            return new Analytics(response.data);
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * List available agents
     * @returns {Promise<Array>}
     */
    async listAgents() {
        try {
            const response = await this.api.get('/agents');
            return response.data;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Get agent status
     * @param {string} agentId - Agent identifier
     * @returns {Promise<object>}
     */
    async getAgentStatus(agentId) {
        const agent = this.agents[agentId];
        if (!agent) {
            throw new Error(`Agent ${agentId} not deployed`);
        }
        
        return agent.getStatus();
    }
    
    /**
     * Stream task execution
     * @param {string} task - Task description
     * @param {function} onUpdate - Callback for updates
     * @returns {Promise<StreamResult>}
     */
    async streamTask(task, onUpdate) {
        return new Promise((resolve, reject) => {
            const streamId = this._generateStreamId();
            
            const handleUpdate = (data) => {
                if (data.streamId === streamId) {
                    onUpdate(data);
                    if (data.status === 'completed') {
                        this.removeListener('task_update', handleUpdate);
                        resolve(data.result);
                    } else if (data.status === 'error') {
                        this.removeListener('task_update', handleUpdate);
                        reject(new Error(data.error));
                    }
                }
            };
            
            this.on('task_update', handleUpdate);
            
            this.api.post('/tasks/stream', {
                task: task,
                stream_id: streamId
            }).catch(reject);
        });
    }
    
    /**
     * Generate unique stream ID
     */
    _generateStreamId() {
        return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Shutdown SDK and cleanup
     */
    async shutdown() {
        if (this.ws) {
            this.ws.close();
        }
        
        for (const agent of Object.values(this.agents)) {
            await agent.shutdown();
        }
        
        this.emit('shutdown');
    }
}

// ==================== Agent Classes ====================

/**
 * Base Agent Class
 */
class Agent {
    constructor(data, sdk) {
        this.id = data.id;
        this.name = data.name;
        this.status = data.status;
        this.sdk = sdk;
        this.tasks = [];
        this.config = data.config || {};
    }
    
    async execute(task, options = {}) {
        try {
            const response = await this.sdk.api.post(`/agents/${this.id}/execute`, {
                task: task,
                options: options
            });
            
            const taskResult = new TaskResult(response.data);
            this.tasks.push(taskResult);
            return taskResult;
        } catch (error) {
            this.sdk.emit('agent_error', { agent: this.id, error });
            throw error;
        }
    }
    
    async getStatus() {
        try {
            const response = await this.sdk.api.get(`/agents/${this.id}/status`);
            this.status = response.data.status;
            return response.data;
        } catch (error) {
            this.sdk.emit('agent_error', { agent: this.id, error });
            throw error;
        }
    }
    
    async configure(config) {
        try {
            const response = await this.sdk.api.put(`/agents/${this.id}/config`, config);
            this.config = response.data.config;
            return this.config;
        } catch (error) {
            this.sdk.emit('agent_error', { agent: this.id, error });
            throw error;
        }
    }
    
    async shutdown() {
        try {
            await this.sdk.api.post(`/agents/${this.id}/shutdown`);
            this.status = 'inactive';
        } catch (error) {
            this.sdk.emit('agent_error', { agent: this.id, error });
            throw error;
        }
    }
}

// Specialized Agent Classes
class BackendAgent extends Agent {
    async createAPI(specification) {
        return this.execute('create_api', { specification });
    }
    
    async optimizePerformance(target) {
        return this.execute('optimize_performance', { target });
    }
    
    async implementMicroservice(service) {
        return this.execute('implement_microservice', { service });
    }
}

class FrontendAgent extends Agent {
    async createComponent(specification) {
        return this.execute('create_component', { specification });
    }
    
    async optimizeBundle() {
        return this.execute('optimize_bundle');
    }
    
    async implementResponsiveDesign(breakpoints) {
        return this.execute('responsive_design', { breakpoints });
    }
}

class DatabaseAgent extends Agent {
    async optimizeQuery(query) {
        return this.execute('optimize_query', { query });
    }
    
    async designSchema(requirements) {
        return this.execute('design_schema', { requirements });
    }
    
    async planMigration(fromVersion, toVersion) {
        return this.execute('plan_migration', { fromVersion, toVersion });
    }
}

class DevOpsAgent extends Agent {
    async setupCI() {
        return this.execute('setup_ci');
    }
    
    async deployToCloud(provider, config) {
        return this.execute('deploy_cloud', { provider, config });
    }
    
    async configureMonitoring(services) {
        return this.execute('configure_monitoring', { services });
    }
}

class SecurityAgent extends Agent {
    async auditSecurity() {
        return this.execute('security_audit');
    }
    
    async implementAuthentication(method) {
        return this.execute('implement_auth', { method });
    }
    
    async scanVulnerabilities() {
        return this.execute('scan_vulnerabilities');
    }
}

class QAAgent extends Agent {
    async createTests(scope) {
        return this.execute('create_tests', { scope });
    }
    
    async runTestSuite(suite) {
        return this.execute('run_tests', { suite });
    }
    
    async generateTestReport() {
        return this.execute('test_report');
    }
}

class AIMLAgent extends Agent {
    async trainModel(dataset, config) {
        return this.execute('train_model', { dataset, config });
    }
    
    async optimizeModel(model) {
        return this.execute('optimize_model', { model });
    }
    
    async deployModel(target) {
        return this.execute('deploy_model', { target });
    }
}

class MobileAgent extends Agent {
    async createMobileApp(platform, specification) {
        return this.execute('create_mobile_app', { platform, specification });
    }
    
    async optimizeForDevice(device) {
        return this.execute('optimize_device', { device });
    }
    
    async implementOfflineMode() {
        return this.execute('offline_mode');
    }
}

class GameAgent extends Agent {
    async createGameMechanic(specification) {
        return this.execute('create_mechanic', { specification });
    }
    
    async optimizeRendering() {
        return this.execute('optimize_rendering');
    }
    
    async implementMultiplayer() {
        return this.execute('implement_multiplayer');
    }
}

class HardwareIoTAgent extends Agent {
    async configureSensors(sensors) {
        return this.execute('configure_sensors', { sensors });
    }
    
    async implementProtocol(protocol) {
        return this.execute('implement_protocol', { protocol });
    }
    
    async optimizePower() {
        return this.execute('optimize_power');
    }
}

class UIUXAgent extends Agent {
    async auditUX() {
        return this.execute('audit_ux');
    }
    
    async createDesignSystem() {
        return this.execute('create_design_system');
    }
    
    async improveAccessibility() {
        return this.execute('improve_accessibility');
    }
}

class WebDesignAgent extends Agent {
    async createWebsite(specification) {
        return this.execute('create_website', { specification });
    }
    
    async optimizeSEO() {
        return this.execute('optimize_seo');
    }
    
    async implementPWA() {
        return this.execute('implement_pwa');
    }
}

class RefactorAgent extends Agent {
    async analyzeCodeQuality() {
        return this.execute('analyze_quality');
    }
    
    async refactorCode(patterns) {
        return this.execute('refactor', { patterns });
    }
    
    async reduceTechnicalDebt() {
        return this.execute('reduce_debt');
    }
}

// ==================== Supporting Classes ====================

/**
 * Team Class
 */
class Team {
    constructor(data, sdk) {
        this.id = data.id;
        this.name = data.name;
        this.agents = data.agents;
        this.sdk = sdk;
        this.coordination = data.coordination || 'orchestrated';
    }
    
    async execute(task, options = {}) {
        try {
            const response = await this.sdk.api.post(`/teams/${this.id}/execute`, {
                task: task,
                options: options
            });
            
            return new TeamTaskResult(response.data);
        } catch (error) {
            this.sdk.emit('team_error', { team: this.id, error });
            throw error;
        }
    }
    
    async coordinate(agents, task) {
        try {
            const response = await this.sdk.api.post(`/teams/${this.id}/coordinate`, {
                agents: agents,
                task: task
            });
            
            return response.data;
        } catch (error) {
            this.sdk.emit('team_error', { team: this.id, error });
            throw error;
        }
    }
}

/**
 * Task Result Class
 */
class TaskResult {
    constructor(data) {
        this.id = data.id;
        this.status = data.status;
        this.output = data.output;
        this.metrics = data.metrics;
        this.timestamp = data.timestamp;
        this.agent = data.agent;
    }
    
    isSuccess() {
        return this.status === 'completed';
    }
    
    getExecutionTime() {
        return this.metrics?.execution_time || 0;
    }
}

/**
 * Team Task Result Class
 */
class TeamTaskResult {
    constructor(data) {
        this.id = data.id;
        this.status = data.status;
        this.agents_involved = data.agents_involved;
        this.results = data.results.map(r => new TaskResult(r));
        this.coordination_log = data.coordination_log;
        this.total_time = data.total_time;
    }
    
    isSuccess() {
        return this.status === 'completed' && 
               this.results.every(r => r.isSuccess());
    }
    
    getAgentResults(agentId) {
        return this.results.filter(r => r.agent === agentId);
    }
}

/**
 * Insights Class
 */
class Insights {
    constructor(data) {
        this.insights = data.insights;
        this.timestamp = data.timestamp;
        this.severity_counts = data.severity_counts;
    }
    
    getCritical() {
        return this.insights.filter(i => i.severity === 'critical');
    }
    
    getByAgent(agentId) {
        return this.insights.filter(i => i.agent === agentId);
    }
    
    getByCategory(category) {
        return this.insights.filter(i => i.category === category);
    }
}

/**
 * Analytics Class
 */
class Analytics {
    constructor(data) {
        this.period = data.period;
        this.metrics = data.metrics;
        this.agent_performance = data.agent_performance;
        this.task_statistics = data.task_statistics;
        this.roi_metrics = data.roi_metrics;
    }
    
    getProductivityGain() {
        return this.roi_metrics?.productivity_gain || 0;
    }
    
    getTopAgents(limit = 5) {
        return Object.entries(this.agent_performance)
            .sort((a, b) => b[1].tasks_completed - a[1].tasks_completed)
            .slice(0, limit);
    }
}

// ==================== Exports ====================

module.exports = {
    TechForgeSDK,
    Agent,
    Team,
    TaskResult,
    TeamTaskResult,
    Insights,
    Analytics,
    
    // Agent classes
    BackendAgent,
    FrontendAgent,
    DatabaseAgent,
    DevOpsAgent,
    SecurityAgent,
    QAAgent,
    AIMLAgent,
    MobileAgent,
    GameAgent,
    HardwareIoTAgent,
    UIUXAgent,
    WebDesignAgent,
    RefactorAgent
};

// ==================== Usage Example ====================

/*
const { TechForgeSDK } = require('techforge-sdk');

// Initialize SDK
const techforge = new TechForgeSDK({
    apiKey: 'your-api-key',
    debug: true
});

// Deploy agents
async function main() {
    // Deploy a single agent
    const backend = await techforge.deployAgent('backend-expert');
    
    // Execute a task
    const result = await backend.execute('Create a REST API for user management');
    console.log('Task completed:', result);
    
    // Deploy a team
    const team = await techforge.deployTeam('fullstack');
    
    // Execute team task
    const teamResult = await techforge.executeTeamTask(
        'Build a real-time chat application with authentication'
    );
    
    // Get insights
    const insights = await techforge.getInsights();
    console.log('Critical insights:', insights.getCritical());
    
    // Stream task with real-time updates
    await techforge.streamTask('Optimize database performance', (update) => {
        console.log('Progress:', update.progress, update.message);
    });
    
    // Get analytics
    const analytics = await techforge.getAnalytics({ period: 'week' });
    console.log('Productivity gain:', analytics.getProductivityGain());
    
    // Shutdown when done
    await techforge.shutdown();
}

// Event handling
techforge.on('agent_deployed', ({ agentId, agent }) => {
    console.log(`Agent ${agentId} deployed successfully`);
});

techforge.on('task_update', (update) => {
    console.log('Task update:', update);
});

techforge.on('insight', (insight) => {
    console.log('New insight:', insight);
});

techforge.on('error', (error) => {
    console.error('Error:', error);
});

main().catch(console.error);
*/