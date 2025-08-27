"""
TechForge AI Agent Suite SDK - Python Edition
Enterprise-grade SDK for programmatic agent control
Version: 2.0.0
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union
from uuid import uuid4

import aiohttp
import websockets
from pydantic import BaseModel, Field

# Configure logging
logger = logging.getLogger('techforge')
logger.setLevel(logging.INFO)


# ==================== Enums and Constants ====================

class AgentStatus(Enum):
    """Agent status enumeration"""
    INACTIVE = "inactive"
    DEPLOYING = "deploying"
    ACTIVE = "active"
    BUSY = "busy"
    ERROR = "error"
    SHUTTING_DOWN = "shutting_down"


class TaskStatus(Enum):
    """Task status enumeration"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TeamCoordination(Enum):
    """Team coordination modes"""
    ORCHESTRATED = "orchestrated"
    COLLABORATIVE = "collaborative"
    HIERARCHICAL = "hierarchical"
    AGILE = "agile"
    AUTONOMOUS = "autonomous"


# ==================== Data Models ====================

@dataclass
class AgentConfig:
    """Agent configuration"""
    agent_id: str
    name: str
    version: str = "2.0.0"
    specialization: str = ""
    tech_stack: List[str] = field(default_factory=list)
    config: Dict[str, Any] = field(default_factory=dict)
    resource_limits: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TaskResult:
    """Task execution result"""
    task_id: str
    agent_id: str
    status: TaskStatus
    output: Any
    metrics: Dict[str, Any]
    timestamp: datetime
    execution_time: float
    
    def is_success(self) -> bool:
        """Check if task was successful"""
        return self.status == TaskStatus.COMPLETED
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'task_id': self.task_id,
            'agent_id': self.agent_id,
            'status': self.status.value,
            'output': self.output,
            'metrics': self.metrics,
            'timestamp': self.timestamp.isoformat(),
            'execution_time': self.execution_time
        }


@dataclass
class TeamTaskResult:
    """Team task execution result"""
    task_id: str
    team_id: str
    status: TaskStatus
    agents_involved: List[str]
    results: List[TaskResult]
    coordination_log: List[Dict[str, Any]]
    total_time: float
    
    def is_success(self) -> bool:
        """Check if all tasks were successful"""
        return (self.status == TaskStatus.COMPLETED and 
                all(r.is_success() for r in self.results))
    
    def get_agent_results(self, agent_id: str) -> List[TaskResult]:
        """Get results for specific agent"""
        return [r for r in self.results if r.agent_id == agent_id]


@dataclass
class Insight:
    """AI-generated insight"""
    insight_id: str
    agent_id: str
    category: str
    severity: str
    finding: str
    recommendation: str
    timestamp: datetime
    confidence: float
    
    def is_critical(self) -> bool:
        """Check if insight is critical"""
        return self.severity == "critical"


@dataclass
class Analytics:
    """Analytics data"""
    period: str
    metrics: Dict[str, Any]
    agent_performance: Dict[str, Dict[str, Any]]
    task_statistics: Dict[str, Any]
    roi_metrics: Dict[str, Any]
    
    def get_productivity_gain(self) -> float:
        """Get productivity gain percentage"""
        return self.roi_metrics.get('productivity_gain', 0.0)
    
    def get_top_agents(self, limit: int = 5) -> List[tuple]:
        """Get top performing agents"""
        sorted_agents = sorted(
            self.agent_performance.items(),
            key=lambda x: x[1].get('tasks_completed', 0),
            reverse=True
        )
        return sorted_agents[:limit]


# ==================== Base Agent Class ====================

class Agent:
    """Base agent class"""
    
    def __init__(self, config: AgentConfig, sdk: 'TechForgeSDK'):
        self.id = config.agent_id
        self.name = config.name
        self.version = config.version
        self.specialization = config.specialization
        self.tech_stack = config.tech_stack
        self.config = config.config
        self.sdk = sdk
        self.status = AgentStatus.INACTIVE
        self.tasks = []
        self._session = None
    
    async def execute(self, task: str, options: Dict[str, Any] = None) -> TaskResult:
        """Execute a task"""
        options = options or {}
        
        try:
            async with self.sdk._session.post(
                f"{self.sdk.config['endpoint']}/agents/{self.id}/execute",
                json={'task': task, 'options': options},
                headers=self.sdk._get_headers()
            ) as response:
                data = await response.json()
                result = TaskResult(
                    task_id=data['task_id'],
                    agent_id=self.id,
                    status=TaskStatus(data['status']),
                    output=data['output'],
                    metrics=data.get('metrics', {}),
                    timestamp=datetime.fromisoformat(data['timestamp']),
                    execution_time=data.get('execution_time', 0)
                )
                self.tasks.append(result)
                return result
        except Exception as e:
            logger.error(f"Agent {self.id} execution error: {e}")
            raise
    
    async def get_status(self) -> Dict[str, Any]:
        """Get agent status"""
        try:
            async with self.sdk._session.get(
                f"{self.sdk.config['endpoint']}/agents/{self.id}/status",
                headers=self.sdk._get_headers()
            ) as response:
                data = await response.json()
                self.status = AgentStatus(data['status'])
                return data
        except Exception as e:
            logger.error(f"Agent {self.id} status error: {e}")
            raise
    
    async def configure(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Update agent configuration"""
        try:
            async with self.sdk._session.put(
                f"{self.sdk.config['endpoint']}/agents/{self.id}/config",
                json=config,
                headers=self.sdk._get_headers()
            ) as response:
                data = await response.json()
                self.config = data['config']
                return self.config
        except Exception as e:
            logger.error(f"Agent {self.id} configuration error: {e}")
            raise
    
    async def shutdown(self):
        """Shutdown agent"""
        try:
            async with self.sdk._session.post(
                f"{self.sdk.config['endpoint']}/agents/{self.id}/shutdown",
                headers=self.sdk._get_headers()
            ) as response:
                await response.json()
                self.status = AgentStatus.INACTIVE
        except Exception as e:
            logger.error(f"Agent {self.id} shutdown error: {e}")
            raise


# ==================== Specialized Agent Classes ====================

class BackendAgent(Agent):
    """Backend development agent"""
    
    async def create_api(self, specification: Dict[str, Any]) -> TaskResult:
        """Create an API from specification"""
        return await self.execute('create_api', {'specification': specification})
    
    async def optimize_performance(self, target: str) -> TaskResult:
        """Optimize performance for target"""
        return await self.execute('optimize_performance', {'target': target})
    
    async def implement_microservice(self, service: Dict[str, Any]) -> TaskResult:
        """Implement microservice"""
        return await self.execute('implement_microservice', {'service': service})


class FrontendAgent(Agent):
    """Frontend development agent"""
    
    async def create_component(self, specification: Dict[str, Any]) -> TaskResult:
        """Create UI component"""
        return await self.execute('create_component', {'specification': specification})
    
    async def optimize_bundle(self) -> TaskResult:
        """Optimize JavaScript bundle"""
        return await self.execute('optimize_bundle')
    
    async def implement_responsive_design(self, breakpoints: List[int]) -> TaskResult:
        """Implement responsive design"""
        return await self.execute('responsive_design', {'breakpoints': breakpoints})


class DatabaseAgent(Agent):
    """Database expert agent"""
    
    async def optimize_query(self, query: str) -> TaskResult:
        """Optimize database query"""
        return await self.execute('optimize_query', {'query': query})
    
    async def design_schema(self, requirements: Dict[str, Any]) -> TaskResult:
        """Design database schema"""
        return await self.execute('design_schema', {'requirements': requirements})
    
    async def plan_migration(self, from_version: str, to_version: str) -> TaskResult:
        """Plan database migration"""
        return await self.execute('plan_migration', {
            'from_version': from_version,
            'to_version': to_version
        })


class DevOpsAgent(Agent):
    """DevOps and cloud engineering agent"""
    
    async def setup_ci(self) -> TaskResult:
        """Setup CI/CD pipeline"""
        return await self.execute('setup_ci')
    
    async def deploy_to_cloud(self, provider: str, config: Dict[str, Any]) -> TaskResult:
        """Deploy to cloud provider"""
        return await self.execute('deploy_cloud', {'provider': provider, 'config': config})
    
    async def configure_monitoring(self, services: List[str]) -> TaskResult:
        """Configure monitoring"""
        return await self.execute('configure_monitoring', {'services': services})


class SecurityAgent(Agent):
    """Security expert agent"""
    
    async def audit_security(self) -> TaskResult:
        """Perform security audit"""
        return await self.execute('security_audit')
    
    async def implement_authentication(self, method: str) -> TaskResult:
        """Implement authentication"""
        return await self.execute('implement_auth', {'method': method})
    
    async def scan_vulnerabilities(self) -> TaskResult:
        """Scan for vulnerabilities"""
        return await self.execute('scan_vulnerabilities')


class QAAgent(Agent):
    """Quality assurance agent"""
    
    async def create_tests(self, scope: str) -> TaskResult:
        """Create test suite"""
        return await self.execute('create_tests', {'scope': scope})
    
    async def run_test_suite(self, suite: str) -> TaskResult:
        """Run test suite"""
        return await self.execute('run_tests', {'suite': suite})
    
    async def generate_test_report(self) -> TaskResult:
        """Generate test report"""
        return await self.execute('test_report')


# ==================== Team Class ====================

class Team:
    """Agent team management"""
    
    def __init__(self, team_id: str, name: str, agents: List[str], 
                 sdk: 'TechForgeSDK', coordination: TeamCoordination = TeamCoordination.ORCHESTRATED):
        self.id = team_id
        self.name = name
        self.agents = agents
        self.sdk = sdk
        self.coordination = coordination
    
    async def execute(self, task: str, options: Dict[str, Any] = None) -> TeamTaskResult:
        """Execute team task"""
        options = options or {}
        
        try:
            async with self.sdk._session.post(
                f"{self.sdk.config['endpoint']}/teams/{self.id}/execute",
                json={'task': task, 'options': options},
                headers=self.sdk._get_headers()
            ) as response:
                data = await response.json()
                
                results = [
                    TaskResult(
                        task_id=r['task_id'],
                        agent_id=r['agent_id'],
                        status=TaskStatus(r['status']),
                        output=r['output'],
                        metrics=r.get('metrics', {}),
                        timestamp=datetime.fromisoformat(r['timestamp']),
                        execution_time=r.get('execution_time', 0)
                    )
                    for r in data['results']
                ]
                
                return TeamTaskResult(
                    task_id=data['task_id'],
                    team_id=self.id,
                    status=TaskStatus(data['status']),
                    agents_involved=data['agents_involved'],
                    results=results,
                    coordination_log=data.get('coordination_log', []),
                    total_time=data.get('total_time', 0)
                )
        except Exception as e:
            logger.error(f"Team {self.id} execution error: {e}")
            raise


# ==================== Main SDK Class ====================

class TechForgeSDK:
    """TechForge SDK main class"""
    
    # Agent registry mapping
    AGENT_CLASSES = {
        'backend-expert': BackendAgent,
        'frontend-expert': FrontendAgent,
        'database-expert': DatabaseAgent,
        'devops-expert': DevOpsAgent,
        'security-expert': SecurityAgent,
        'qa-expert': QAAgent,
    }
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize SDK"""
        config = config or {}
        
        self.config = {
            'api_key': config.get('api_key') or os.getenv('TECHFORGE_API_KEY'),
            'endpoint': config.get('endpoint', 'https://api.techforge.ai/v2'),
            'ws_endpoint': config.get('ws_endpoint', 'wss://stream.techforge.ai/v2'),
            'timeout': config.get('timeout', 30),
            'retries': config.get('retries', 3),
            'debug': config.get('debug', False),
            **config
        }
        
        self.agents = {}
        self.active_team = None
        self._session = None
        self._ws = None
        self._event_handlers = {}
        self._running = False
        
        if self.config['debug']:
            logger.setLevel(logging.DEBUG)
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.shutdown()
    
    async def connect(self):
        """Connect to TechForge services"""
        # Create HTTP session
        timeout = aiohttp.ClientTimeout(total=self.config['timeout'])
        self._session = aiohttp.ClientSession(timeout=timeout)
        
        # Connect WebSocket for real-time updates
        self._running = True
        asyncio.create_task(self._websocket_handler())
        
        logger.info("TechForge SDK connected")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        return {
            'Authorization': f"Bearer {self.config['api_key']}",
            'Content-Type': 'application/json',
            'X-SDK-Version': '2.0.0',
            'User-Agent': 'TechForge-SDK-Python/2.0.0'
        }
    
    async def _websocket_handler(self):
        """Handle WebSocket connection"""
        while self._running:
            try:
                async with websockets.connect(
                    self.config['ws_endpoint'],
                    extra_headers=self._get_headers()
                ) as websocket:
                    self._ws = websocket
                    logger.info("WebSocket connected")
                    
                    async for message in websocket:
                        await self._handle_message(json.loads(message))
                        
            except websockets.exceptions.ConnectionClosed:
                logger.warning("WebSocket disconnected, reconnecting...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                await asyncio.sleep(5)
    
    async def _handle_message(self, message: Dict[str, Any]):
        """Handle WebSocket message"""
        msg_type = message.get('type')
        data = message.get('data')
        
        if msg_type in self._event_handlers:
            for handler in self._event_handlers[msg_type]:
                await handler(data) if asyncio.iscoroutinefunction(handler) else handler(data)
    
    def on(self, event: str, handler: Callable):
        """Register event handler"""
        if event not in self._event_handlers:
            self._event_handlers[event] = []
        self._event_handlers[event].append(handler)
    
    async def deploy_agent(self, agent_id: str, config: Dict[str, Any] = None) -> Agent:
        """Deploy a single agent"""
        config = config or {}
        
        try:
            async with self._session.post(
                f"{self.config['endpoint']}/agents/deploy",
                json={'agent_id': agent_id, 'config': config},
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                agent_config = AgentConfig(
                    agent_id=data['agent_id'],
                    name=data['name'],
                    version=data.get('version', '2.0.0'),
                    specialization=data.get('specialization', ''),
                    tech_stack=data.get('tech_stack', []),
                    config=data.get('config', {})
                )
                
                agent_class = self.AGENT_CLASSES.get(agent_id, Agent)
                agent = agent_class(agent_config, self)
                agent.status = AgentStatus.ACTIVE
                
                self.agents[agent_id] = agent
                logger.info(f"Deployed agent: {agent_id}")
                
                return agent
                
        except Exception as e:
            logger.error(f"Failed to deploy agent {agent_id}: {e}")
            raise
    
    async def deploy_team(self, preset: str) -> Team:
        """Deploy a team of agents"""
        try:
            async with self._session.post(
                f"{self.config['endpoint']}/teams/deploy",
                json={'preset': preset},
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                team = Team(
                    team_id=data['team_id'],
                    name=data['name'],
                    agents=data['agents'],
                    sdk=self,
                    coordination=TeamCoordination(data.get('coordination', 'orchestrated'))
                )
                
                # Deploy all agents in team
                for agent_id in team.agents:
                    if agent_id not in self.agents:
                        await self.deploy_agent(agent_id)
                
                self.active_team = team
                logger.info(f"Deployed team: {preset}")
                
                return team
                
        except Exception as e:
            logger.error(f"Failed to deploy team {preset}: {e}")
            raise
    
    async def execute_task(self, agent_id: str, task: str, options: Dict[str, Any] = None) -> TaskResult:
        """Execute task with specific agent"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not deployed")
        
        return await self.agents[agent_id].execute(task, options)
    
    async def execute_team_task(self, task: str, options: Dict[str, Any] = None) -> TeamTaskResult:
        """Execute task with active team"""
        if not self.active_team:
            raise ValueError("No team deployed")
        
        return await self.active_team.execute(task, options)
    
    async def get_insights(self, options: Dict[str, Any] = None) -> List[Insight]:
        """Get AI insights"""
        options = options or {}
        
        try:
            async with self._session.get(
                f"{self.config['endpoint']}/insights",
                params=options,
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                return [
                    Insight(
                        insight_id=i['insight_id'],
                        agent_id=i['agent_id'],
                        category=i['category'],
                        severity=i['severity'],
                        finding=i['finding'],
                        recommendation=i['recommendation'],
                        timestamp=datetime.fromisoformat(i['timestamp']),
                        confidence=i.get('confidence', 0.0)
                    )
                    for i in data['insights']
                ]
                
        except Exception as e:
            logger.error(f"Failed to get insights: {e}")
            raise
    
    async def get_analytics(self, period: str = 'week') -> Analytics:
        """Get analytics data"""
        try:
            async with self._session.get(
                f"{self.config['endpoint']}/analytics",
                params={'period': period},
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                return Analytics(
                    period=data['period'],
                    metrics=data.get('metrics', {}),
                    agent_performance=data.get('agent_performance', {}),
                    task_statistics=data.get('task_statistics', {}),
                    roi_metrics=data.get('roi_metrics', {})
                )
                
        except Exception as e:
            logger.error(f"Failed to get analytics: {e}")
            raise
    
    async def stream_task(self, task: str, on_update: Callable[[Dict[str, Any]], None]) -> TaskResult:
        """Stream task execution with real-time updates"""
        stream_id = f"stream_{uuid4().hex}"
        
        # Register update handler
        async def handle_update(data):
            if data.get('stream_id') == stream_id:
                await on_update(data) if asyncio.iscoroutinefunction(on_update) else on_update(data)
        
        self.on('task_update', handle_update)
        
        try:
            async with self._session.post(
                f"{self.config['endpoint']}/tasks/stream",
                json={'task': task, 'stream_id': stream_id},
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                # Wait for completion
                while True:
                    await asyncio.sleep(0.5)
                    # Check for completion in handler
                    
        except Exception as e:
            logger.error(f"Failed to stream task: {e}")
            raise
    
    async def shutdown(self):
        """Shutdown SDK and cleanup"""
        self._running = False
        
        # Shutdown all agents
        for agent in self.agents.values():
            await agent.shutdown()
        
        # Close connections
        if self._ws:
            await self._ws.close()
        
        if self._session:
            await self._session.close()
        
        logger.info("TechForge SDK shutdown complete")


# ==================== Convenience Functions ====================

async def quick_deploy(api_key: str, team_preset: str = 'fullstack') -> TechForgeSDK:
    """Quick deploy helper function"""
    sdk = TechForgeSDK({'api_key': api_key})
    await sdk.connect()
    await sdk.deploy_team(team_preset)
    return sdk


# ==================== Usage Example ====================

async def main():
    """Example usage"""
    
    # Initialize SDK
    async with TechForgeSDK({'api_key': 'your-api-key', 'debug': True}) as sdk:
        
        # Deploy a single agent
        backend = await sdk.deploy_agent('backend-expert')
        
        # Execute a task
        result = await backend.execute('Create a REST API for user management')
        print(f"Task completed: {result.is_success()}")
        
        # Deploy a team
        team = await sdk.deploy_team('fullstack')
        
        # Execute team task
        team_result = await sdk.execute_team_task(
            'Build a real-time chat application with authentication'
        )
        print(f"Team task success: {team_result.is_success()}")
        
        # Get insights
        insights = await sdk.get_insights()
        critical = [i for i in insights if i.is_critical()]
        print(f"Critical insights: {len(critical)}")
        
        # Get analytics
        analytics = await sdk.get_analytics('week')
        print(f"Productivity gain: {analytics.get_productivity_gain()}%")
        
        # Stream task with real-time updates
        def on_update(update):
            print(f"Progress: {update.get('progress')}% - {update.get('message')}")
        
        await sdk.stream_task('Optimize database performance', on_update)


if __name__ == '__main__':
    # Run example
    asyncio.run(main())