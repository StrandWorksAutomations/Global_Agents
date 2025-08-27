"""
TechForge Agent Orchestration Engine
Intelligent task routing and agent coordination system
Version: 2.0.0
"""

import asyncio
import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

import networkx as nx
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ==================== Task Analysis ====================

class TaskComplexity(Enum):
    SIMPLE = "simple"      # Single agent, straightforward
    MODERATE = "moderate"  # 2-3 agents, some coordination
    COMPLEX = "complex"    # 4+ agents, dependencies
    EXPERT = "expert"      # Requires specialized coordination


class TaskDomain(Enum):
    BACKEND = "backend"
    FRONTEND = "frontend"
    DATABASE = "database"
    DEVOPS = "devops"
    SECURITY = "security"
    TESTING = "testing"
    ML_AI = "ml_ai"
    MOBILE = "mobile"
    GAME = "game"
    IOT = "iot"
    DESIGN = "design"
    REFACTORING = "refactoring"
    FULL_STACK = "full_stack"


@dataclass
class TaskAnalysis:
    """Result of analyzing a task"""
    task_id: str
    original_task: str
    complexity: TaskComplexity
    domains: List[TaskDomain]
    required_agents: List[str]
    subtasks: List['SubTask']
    dependencies: Dict[str, List[str]]  # task_id -> [dependency_ids]
    estimated_time: float
    confidence: float


@dataclass
class SubTask:
    """Individual subtask for an agent"""
    id: str
    description: str
    agent_id: str
    domain: TaskDomain
    dependencies: List[str] = field(default_factory=list)
    priority: int = 0
    estimated_time: float = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


# ==================== Orchestration Engine ====================

class OrchestrationEngine:
    """Main orchestration engine for coordinating agents"""
    
    # Agent capability matrix
    AGENT_CAPABILITIES = {
        'backend-expert': {
            'domains': [TaskDomain.BACKEND, TaskDomain.FULL_STACK],
            'skills': ['api', 'microservices', 'database', 'authentication', 'performance'],
            'complexity_limit': TaskComplexity.EXPERT,
            'parallel_capacity': 3
        },
        'frontend-expert': {
            'domains': [TaskDomain.FRONTEND, TaskDomain.FULL_STACK],
            'skills': ['ui', 'responsive', 'spa', 'components', 'state-management'],
            'complexity_limit': TaskComplexity.EXPERT,
            'parallel_capacity': 3
        },
        'database-expert': {
            'domains': [TaskDomain.DATABASE],
            'skills': ['schema', 'optimization', 'migration', 'replication', 'nosql'],
            'complexity_limit': TaskComplexity.EXPERT,
            'parallel_capacity': 2
        },
        'devops-expert': {
            'domains': [TaskDomain.DEVOPS],
            'skills': ['ci-cd', 'infrastructure', 'deployment', 'monitoring', 'cloud'],
            'complexity_limit': TaskComplexity.EXPERT,
            'parallel_capacity': 2
        },
        'security-expert': {
            'domains': [TaskDomain.SECURITY],
            'skills': ['audit', 'penetration', 'encryption', 'compliance', 'authentication'],
            'complexity_limit': TaskComplexity.EXPERT,
            'parallel_capacity': 2
        },
        'qa-expert': {
            'domains': [TaskDomain.TESTING],
            'skills': ['unit-testing', 'e2e', 'performance', 'automation', 'coverage'],
            'complexity_limit': TaskComplexity.COMPLEX,
            'parallel_capacity': 3
        },
        'ai-ml-expert': {
            'domains': [TaskDomain.ML_AI],
            'skills': ['training', 'models', 'inference', 'data-pipeline', 'optimization'],
            'complexity_limit': TaskComplexity.EXPERT,
            'parallel_capacity': 1
        },
        'mobile-expert': {
            'domains': [TaskDomain.MOBILE],
            'skills': ['ios', 'android', 'cross-platform', 'native', 'responsive'],
            'complexity_limit': TaskComplexity.EXPERT,
            'parallel_capacity': 2
        },
        'game-expert': {
            'domains': [TaskDomain.GAME],
            'skills': ['graphics', 'physics', 'multiplayer', 'optimization', 'engines'],
            'complexity_limit': TaskComplexity.EXPERT,
            'parallel_capacity': 1
        },
        'hardware-iot-expert': {
            'domains': [TaskDomain.IOT],
            'skills': ['embedded', 'sensors', 'protocols', 'firmware', 'edge-computing'],
            'complexity_limit': TaskComplexity.COMPLEX,
            'parallel_capacity': 1
        },
        'uiux-principal': {
            'domains': [TaskDomain.DESIGN],
            'skills': ['ux', 'accessibility', 'design-systems', 'prototyping', 'research'],
            'complexity_limit': TaskComplexity.COMPLEX,
            'parallel_capacity': 2
        },
        'web-design-agent': {
            'domains': [TaskDomain.DESIGN, TaskDomain.FRONTEND],
            'skills': ['web-design', 'seo', 'performance', 'pwa', 'responsive'],
            'complexity_limit': TaskComplexity.COMPLEX,
            'parallel_capacity': 2
        },
        'refactor-agent': {
            'domains': [TaskDomain.REFACTORING],
            'skills': ['code-quality', 'patterns', 'modernization', 'debt-reduction', 'automation'],
            'complexity_limit': TaskComplexity.EXPERT,
            'parallel_capacity': 1
        }
    }
    
    # Task patterns for automatic recognition
    TASK_PATTERNS = {
        'api_creation': {
            'keywords': ['api', 'rest', 'graphql', 'endpoint', 'service'],
            'agents': ['backend-expert'],
            'complexity': TaskComplexity.MODERATE
        },
        'ui_component': {
            'keywords': ['component', 'ui', 'interface', 'widget', 'frontend'],
            'agents': ['frontend-expert'],
            'complexity': TaskComplexity.SIMPLE
        },
        'full_stack_feature': {
            'keywords': ['feature', 'application', 'full-stack', 'end-to-end'],
            'agents': ['backend-expert', 'frontend-expert', 'database-expert'],
            'complexity': TaskComplexity.COMPLEX
        },
        'database_optimization': {
            'keywords': ['database', 'query', 'optimize', 'performance', 'index'],
            'agents': ['database-expert'],
            'complexity': TaskComplexity.MODERATE
        },
        'security_audit': {
            'keywords': ['security', 'vulnerability', 'audit', 'penetration', 'compliance'],
            'agents': ['security-expert'],
            'complexity': TaskComplexity.COMPLEX
        },
        'deployment': {
            'keywords': ['deploy', 'ci/cd', 'pipeline', 'infrastructure', 'cloud'],
            'agents': ['devops-expert'],
            'complexity': TaskComplexity.MODERATE
        },
        'testing': {
            'keywords': ['test', 'testing', 'qa', 'coverage', 'automation'],
            'agents': ['qa-expert'],
            'complexity': TaskComplexity.MODERATE
        },
        'ml_model': {
            'keywords': ['machine learning', 'ml', 'ai', 'model', 'training'],
            'agents': ['ai-ml-expert'],
            'complexity': TaskComplexity.COMPLEX
        },
        'mobile_app': {
            'keywords': ['mobile', 'ios', 'android', 'app', 'native'],
            'agents': ['mobile-expert'],
            'complexity': TaskComplexity.COMPLEX
        },
        'refactoring': {
            'keywords': ['refactor', 'clean', 'optimize', 'modernize', 'tech debt'],
            'agents': ['refactor-agent'],
            'complexity': TaskComplexity.MODERATE
        }
    }
    
    def __init__(self):
        self.active_tasks = {}
        self.agent_workload = defaultdict(list)
        self.task_graph = nx.DiGraph()
        self.execution_history = []
        self.performance_metrics = defaultdict(dict)
    
    async def analyze_task(self, task: str) -> TaskAnalysis:
        """Analyze a task and determine execution strategy"""
        task_id = f"task_{uuid4().hex[:8]}"
        
        # Identify task domains and complexity
        domains = self._identify_domains(task)
        complexity = self._assess_complexity(task, domains)
        
        # Determine required agents
        required_agents = self._select_agents(task, domains, complexity)
        
        # Break down into subtasks
        subtasks = await self._decompose_task(task, required_agents, domains)
        
        # Build dependency graph
        dependencies = self._analyze_dependencies(subtasks)
        
        # Estimate execution time
        estimated_time = self._estimate_time(subtasks, dependencies)
        
        # Calculate confidence score
        confidence = self._calculate_confidence(task, domains, required_agents)
        
        return TaskAnalysis(
            task_id=task_id,
            original_task=task,
            complexity=complexity,
            domains=domains,
            required_agents=required_agents,
            subtasks=subtasks,
            dependencies=dependencies,
            estimated_time=estimated_time,
            confidence=confidence
        )
    
    def _identify_domains(self, task: str) -> List[TaskDomain]:
        """Identify task domains from text"""
        task_lower = task.lower()
        domains = []
        
        # Check for pattern matches
        for pattern_name, pattern_info in self.TASK_PATTERNS.items():
            if any(keyword in task_lower for keyword in pattern_info['keywords']):
                # Map agents to domains
                for agent in pattern_info['agents']:
                    agent_domains = self.AGENT_CAPABILITIES[agent]['domains']
                    domains.extend(agent_domains)
        
        # Deduplicate
        domains = list(set(domains))
        
        # Default to full-stack if no specific domain identified
        if not domains:
            domains = [TaskDomain.FULL_STACK]
        
        return domains
    
    def _assess_complexity(self, task: str, domains: List[TaskDomain]) -> TaskComplexity:
        """Assess task complexity"""
        task_lower = task.lower()
        
        # Check for complexity indicators
        complex_indicators = [
            'architecture', 'system', 'infrastructure', 'migration',
            'integration', 'optimization', 'redesign', 'refactor'
        ]
        
        expert_indicators = [
            'enterprise', 'scale', 'distributed', 'real-time',
            'high-performance', 'security-critical', 'compliance'
        ]
        
        if any(indicator in task_lower for indicator in expert_indicators):
            return TaskComplexity.EXPERT
        
        if any(indicator in task_lower for indicator in complex_indicators):
            return TaskComplexity.COMPLEX
        
        if len(domains) > 2:
            return TaskComplexity.COMPLEX
        elif len(domains) == 2:
            return TaskComplexity.MODERATE
        else:
            return TaskComplexity.SIMPLE
    
    def _select_agents(self, task: str, domains: List[TaskDomain], 
                      complexity: TaskComplexity) -> List[str]:
        """Select appropriate agents for the task"""
        selected_agents = set()
        task_lower = task.lower()
        
        # Pattern-based selection
        for pattern_name, pattern_info in self.TASK_PATTERNS.items():
            if any(keyword in task_lower for keyword in pattern_info['keywords']):
                selected_agents.update(pattern_info['agents'])
        
        # Domain-based selection
        for domain in domains:
            for agent_id, capabilities in self.AGENT_CAPABILITIES.items():
                if domain in capabilities['domains']:
                    # Check complexity compatibility
                    agent_complexity = capabilities['complexity_limit']
                    if self._complexity_value(complexity) <= self._complexity_value(agent_complexity):
                        selected_agents.add(agent_id)
        
        # Add QA expert for complex tasks
        if complexity in [TaskComplexity.COMPLEX, TaskComplexity.EXPERT]:
            selected_agents.add('qa-expert')
        
        # Add security expert for sensitive operations
        sensitive_keywords = ['auth', 'login', 'password', 'payment', 'sensitive', 'secure']
        if any(keyword in task_lower for keyword in sensitive_keywords):
            selected_agents.add('security-expert')
        
        return list(selected_agents)
    
    def _complexity_value(self, complexity: TaskComplexity) -> int:
        """Convert complexity to numeric value for comparison"""
        mapping = {
            TaskComplexity.SIMPLE: 1,
            TaskComplexity.MODERATE: 2,
            TaskComplexity.COMPLEX: 3,
            TaskComplexity.EXPERT: 4
        }
        return mapping[complexity]
    
    async def _decompose_task(self, task: str, agents: List[str], 
                             domains: List[TaskDomain]) -> List[SubTask]:
        """Decompose task into subtasks for each agent"""
        subtasks = []
        
        # Create subtasks based on agent capabilities
        for agent_id in agents:
            capabilities = self.AGENT_CAPABILITIES[agent_id]
            
            # Determine what this agent should handle
            agent_domains = set(capabilities['domains']) & set(domains)
            
            if agent_domains:
                subtask = SubTask(
                    id=f"subtask_{uuid4().hex[:8]}",
                    description=self._generate_subtask_description(task, agent_id, agent_domains),
                    agent_id=agent_id,
                    domain=list(agent_domains)[0],  # Primary domain
                    priority=self._calculate_priority(agent_id, domains),
                    estimated_time=self._estimate_agent_time(agent_id, task)
                )
                subtasks.append(subtask)
        
        # Establish dependencies
        subtasks = self._establish_dependencies(subtasks)
        
        return subtasks
    
    def _generate_subtask_description(self, task: str, agent_id: str, 
                                     domains: Set[TaskDomain]) -> str:
        """Generate specific subtask description for an agent"""
        agent_name = agent_id.replace('-', ' ').title()
        domain_str = ', '.join(d.value for d in domains)
        
        templates = {
            'backend-expert': f"Implement backend services and APIs for: {task}",
            'frontend-expert': f"Create user interface and frontend components for: {task}",
            'database-expert': f"Design and optimize database schema for: {task}",
            'devops-expert': f"Set up infrastructure and deployment for: {task}",
            'security-expert': f"Perform security audit and implement security measures for: {task}",
            'qa-expert': f"Create and run comprehensive tests for: {task}",
            'ai-ml-expert': f"Develop and train machine learning models for: {task}",
            'mobile-expert': f"Implement mobile application features for: {task}",
            'game-expert': f"Develop game mechanics and systems for: {task}",
            'hardware-iot-expert': f"Implement IoT/hardware integration for: {task}",
            'uiux-principal': f"Design user experience and interface for: {task}",
            'web-design-agent': f"Create web design and implementation for: {task}",
            'refactor-agent': f"Refactor and optimize code for: {task}"
        }
        
        return templates.get(agent_id, f"{agent_name} handles {domain_str} aspects of: {task}")
    
    def _calculate_priority(self, agent_id: str, domains: List[TaskDomain]) -> int:
        """Calculate execution priority for an agent"""
        # Design and architecture go first
        if agent_id in ['uiux-principal', 'web-design-agent']:
            return 1
        # Database schema early
        elif agent_id == 'database-expert':
            return 2
        # Backend before frontend
        elif agent_id == 'backend-expert':
            return 3
        elif agent_id == 'frontend-expert':
            return 4
        # Testing and security later
        elif agent_id in ['qa-expert', 'security-expert']:
            return 5
        # DevOps last
        elif agent_id == 'devops-expert':
            return 6
        else:
            return 4
    
    def _estimate_agent_time(self, agent_id: str, task: str) -> float:
        """Estimate execution time for an agent"""
        base_time = len(task) * 0.01  # Base on task length
        
        complexity_multipliers = {
            'backend-expert': 1.2,
            'frontend-expert': 1.0,
            'database-expert': 0.8,
            'devops-expert': 1.5,
            'security-expert': 2.0,
            'qa-expert': 1.3,
            'ai-ml-expert': 3.0,
            'mobile-expert': 1.5,
            'game-expert': 2.0,
            'hardware-iot-expert': 2.5,
            'uiux-principal': 1.0,
            'web-design-agent': 1.2,
            'refactor-agent': 1.8
        }
        
        multiplier = complexity_multipliers.get(agent_id, 1.0)
        return base_time * multiplier
    
    def _establish_dependencies(self, subtasks: List[SubTask]) -> List[SubTask]:
        """Establish dependencies between subtasks"""
        # Sort by priority
        sorted_tasks = sorted(subtasks, key=lambda x: x.priority)
        
        # Create dependencies based on priority
        for i, task in enumerate(sorted_tasks):
            if i > 0:
                # Depend on previous priority level tasks
                prev_priority = sorted_tasks[i-1].priority
                if task.priority > prev_priority:
                    dependencies = [t.id for t in sorted_tasks[:i] if t.priority == prev_priority]
                    task.dependencies = dependencies
        
        return subtasks
    
    def _analyze_dependencies(self, subtasks: List[SubTask]) -> Dict[str, List[str]]:
        """Analyze and return dependency map"""
        dependencies = {}
        for task in subtasks:
            dependencies[task.id] = task.dependencies
        return dependencies
    
    def _estimate_time(self, subtasks: List[SubTask], 
                      dependencies: Dict[str, List[str]]) -> float:
        """Estimate total execution time considering parallelism"""
        if not subtasks:
            return 0.0
        
        # Build execution graph
        G = nx.DiGraph()
        for task in subtasks:
            G.add_node(task.id, time=task.estimated_time)
            for dep in task.dependencies:
                G.add_edge(dep, task.id)
        
        # Calculate critical path
        if G.number_of_nodes() > 0:
            # Find longest path (critical path)
            try:
                longest_path_length = nx.dag_longest_path_length(G, weight='time')
                return longest_path_length
            except:
                # Fallback to sum if graph has cycles (shouldn't happen)
                return sum(task.estimated_time for task in subtasks)
        
        return sum(task.estimated_time for task in subtasks)
    
    def _calculate_confidence(self, task: str, domains: List[TaskDomain], 
                            agents: List[str]) -> float:
        """Calculate confidence score for task execution"""
        confidence = 1.0
        
        # Reduce confidence for vague tasks
        if len(task) < 20:
            confidence *= 0.8
        
        # Reduce confidence for multi-domain tasks
        if len(domains) > 3:
            confidence *= 0.9
        
        # Reduce confidence if many agents needed
        if len(agents) > 5:
            confidence *= 0.85
        
        # Boost confidence for pattern matches
        task_lower = task.lower()
        for pattern in self.TASK_PATTERNS.values():
            if any(keyword in task_lower for keyword in pattern['keywords']):
                confidence *= 1.1
                break
        
        return min(confidence, 1.0)
    
    async def execute_task(self, analysis: TaskAnalysis) -> Dict[str, Any]:
        """Execute task based on analysis"""
        start_time = datetime.now()
        
        # Build execution graph
        self._build_execution_graph(analysis)
        
        # Execute subtasks
        results = await self._execute_subtasks(analysis.subtasks, analysis.dependencies)
        
        # Collect and merge results
        final_result = self._merge_results(results)
        
        # Record execution
        execution_time = (datetime.now() - start_time).total_seconds()
        self._record_execution(analysis, final_result, execution_time)
        
        return {
            'task_id': analysis.task_id,
            'status': 'completed',
            'results': final_result,
            'execution_time': execution_time,
            'agents_used': analysis.required_agents,
            'confidence': analysis.confidence
        }
    
    def _build_execution_graph(self, analysis: TaskAnalysis):
        """Build execution graph for visualization"""
        G = nx.DiGraph()
        
        for task in analysis.subtasks:
            G.add_node(task.id, 
                      label=task.agent_id,
                      description=task.description,
                      time=task.estimated_time)
            
            for dep in task.dependencies:
                G.add_edge(dep, task.id)
        
        self.task_graph = G
    
    async def _execute_subtasks(self, subtasks: List[SubTask], 
                               dependencies: Dict[str, List[str]]) -> Dict[str, Any]:
        """Execute subtasks with dependency management"""
        results = {}
        completed = set()
        
        async def execute_when_ready(task: SubTask):
            """Execute task when dependencies are met"""
            # Wait for dependencies
            while not all(dep in completed for dep in task.dependencies):
                await asyncio.sleep(0.1)
            
            # Execute task
            result = await self._execute_single_task(task)
            results[task.id] = result
            completed.add(task.id)
        
        # Start all tasks
        tasks = [execute_when_ready(task) for task in subtasks]
        await asyncio.gather(*tasks)
        
        return results
    
    async def _execute_single_task(self, task: SubTask) -> Dict[str, Any]:
        """Execute a single subtask with an agent"""
        # Simulate agent execution
        await asyncio.sleep(task.estimated_time)
        
        return {
            'task_id': task.id,
            'agent_id': task.agent_id,
            'status': 'completed',
            'output': f"Completed: {task.description}",
            'execution_time': task.estimated_time
        }
    
    def _merge_results(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Merge results from multiple agents"""
        merged = {
            'combined_output': [],
            'by_agent': {},
            'summary': {}
        }
        
        for task_id, result in results.items():
            agent_id = result['agent_id']
            
            # Add to combined output
            merged['combined_output'].append(result['output'])
            
            # Organize by agent
            if agent_id not in merged['by_agent']:
                merged['by_agent'][agent_id] = []
            merged['by_agent'][agent_id].append(result)
        
        # Generate summary
        merged['summary'] = {
            'total_tasks': len(results),
            'agents_involved': len(merged['by_agent']),
            'all_successful': all(r['status'] == 'completed' for r in results.values())
        }
        
        return merged
    
    def _record_execution(self, analysis: TaskAnalysis, result: Dict[str, Any], 
                         execution_time: float):
        """Record execution for analytics"""
        record = {
            'task_id': analysis.task_id,
            'timestamp': datetime.now().isoformat(),
            'complexity': analysis.complexity.value,
            'domains': [d.value for d in analysis.domains],
            'agents': analysis.required_agents,
            'execution_time': execution_time,
            'estimated_time': analysis.estimated_time,
            'accuracy': execution_time / analysis.estimated_time if analysis.estimated_time > 0 else 1.0,
            'confidence': analysis.confidence,
            'success': result['summary']['all_successful']
        }
        
        self.execution_history.append(record)
        
        # Update performance metrics
        for agent_id in analysis.required_agents:
            if agent_id not in self.performance_metrics:
                self.performance_metrics[agent_id] = {
                    'total_tasks': 0,
                    'total_time': 0,
                    'success_rate': 0,
                    'avg_accuracy': 0
                }
            
            metrics = self.performance_metrics[agent_id]
            metrics['total_tasks'] += 1
            metrics['total_time'] += execution_time / len(analysis.required_agents)
            if result['summary']['all_successful']:
                metrics['success_rate'] = (
                    (metrics['success_rate'] * (metrics['total_tasks'] - 1) + 1) 
                    / metrics['total_tasks']
                )
    
    def get_execution_plan(self, analysis: TaskAnalysis) -> Dict[str, Any]:
        """Get visual execution plan"""
        plan = {
            'task_id': analysis.task_id,
            'complexity': analysis.complexity.value,
            'estimated_time': analysis.estimated_time,
            'confidence': analysis.confidence,
            'stages': []
        }
        
        # Group subtasks by priority
        priority_groups = defaultdict(list)
        for task in analysis.subtasks:
            priority_groups[task.priority].append({
                'id': task.id,
                'agent': task.agent_id,
                'description': task.description,
                'estimated_time': task.estimated_time,
                'dependencies': task.dependencies
            })
        
        # Create stages
        for priority in sorted(priority_groups.keys()):
            plan['stages'].append({
                'priority': priority,
                'parallel': True,
                'tasks': priority_groups[priority]
            })
        
        return plan
    
    def get_agent_recommendations(self, task: str) -> List[Dict[str, Any]]:
        """Get agent recommendations for a task"""
        recommendations = []
        task_lower = task.lower()
        
        for agent_id, capabilities in self.AGENT_CAPABILITIES.items():
            score = 0
            reasons = []
            
            # Check skill matches
            for skill in capabilities['skills']:
                if skill.replace('-', ' ') in task_lower:
                    score += 2
                    reasons.append(f"Expertise in {skill}")
            
            # Check domain relevance
            domains = self._identify_domains(task)
            for domain in domains:
                if domain in capabilities['domains']:
                    score += 3
                    reasons.append(f"Specializes in {domain.value}")
            
            if score > 0:
                recommendations.append({
                    'agent_id': agent_id,
                    'score': score,
                    'reasons': reasons,
                    'confidence': min(score / 10, 1.0)
                })
        
        # Sort by score
        recommendations.sort(key=lambda x: x['score'], reverse=True)
        
        return recommendations[:5]  # Top 5 recommendations


# ==================== Usage Example ====================

async def main():
    """Example orchestration"""
    engine = OrchestrationEngine()
    
    # Example task
    task = "Build a real-time chat application with user authentication and message history"
    
    # Analyze task
    analysis = await engine.analyze_task(task)
    
    print(f"Task Analysis:")
    print(f"  Complexity: {analysis.complexity.value}")
    print(f"  Domains: {[d.value for d in analysis.domains]}")
    print(f"  Required Agents: {analysis.required_agents}")
    print(f"  Estimated Time: {analysis.estimated_time:.2f}s")
    print(f"  Confidence: {analysis.confidence:.2%}")
    
    # Get execution plan
    plan = engine.get_execution_plan(analysis)
    print(f"\nExecution Plan:")
    for stage in plan['stages']:
        print(f"  Stage {stage['priority']}:")
        for task in stage['tasks']:
            print(f"    - {task['agent']}: {task['estimated_time']:.1f}s")
    
    # Execute task
    result = await engine.execute_task(analysis)
    print(f"\nExecution Result:")
    print(f"  Status: {result['status']}")
    print(f"  Time: {result['execution_time']:.2f}s")
    print(f"  Agents Used: {result['agents_used']}")


if __name__ == '__main__':
    asyncio.run(main())