#!/usr/bin/env python3

"""
TechForge AI Agent Suite CLI - Production Enhanced Version
Enterprise-grade AI development team management system with full logging and error handling
"""

import argparse
import json
import os
import sys
import subprocess
import logging
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from functools import wraps
import asyncio

import yaml
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.logging import RichHandler
from dotenv import load_dotenv
import click

# Load environment variables
load_dotenv()

__version__ = "2.0.0"

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format="%(message)s",
    handlers=[RichHandler(rich_tracebacks=True)]
)
logger = logging.getLogger("techforge")

# Rich console for beautiful output
console = Console()

class TechForgeError(Exception):
    """Base exception for TechForge errors"""
    pass

class AgentError(TechForgeError):
    """Agent-specific errors"""
    pass

class ConfigError(TechForgeError):
    """Configuration errors"""
    pass

class DeploymentError(TechForgeError):
    """Deployment errors"""
    pass

def handle_errors(func):
    """Decorator to handle errors gracefully"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except TechForgeError as e:
            logger.error(f"TechForge Error: {e}")
            console.print(f"[red bold]Error:[/red bold] {e}")
            sys.exit(1)
        except KeyboardInterrupt:
            logger.info("Operation cancelled by user")
            console.print("\n[yellow]Operation cancelled[/yellow]")
            sys.exit(130)
        except Exception as e:
            logger.exception(f"Unexpected error: {e}")
            console.print(f"[red bold]Unexpected error:[/red bold] {e}")
            if os.getenv('DEBUG') == 'true':
                console.print_exception()
            sys.exit(1)
    return wrapper

class ConfigManager:
    """Manages configuration with validation and security"""
    
    def __init__(self):
        self.config_path = Path.home() / ".techforge"
        self.config_file = self.config_path / "config.yaml"
        self.secrets_file = self.config_path / "secrets.encrypted"
        self.config = {}
        self.load_config()
    
    def load_config(self):
        """Load configuration with validation"""
        try:
            if not self.config_path.exists():
                self.config_path.mkdir(parents=True, mode=0o700)
                logger.info(f"Created config directory: {self.config_path}")
            
            if not self.config_file.exists():
                self.create_default_config()
            
            with open(self.config_file, 'r') as f:
                self.config = yaml.safe_load(f)
                self.validate_config()
                logger.info("Configuration loaded successfully")
                
        except yaml.YAMLError as e:
            raise ConfigError(f"Invalid YAML configuration: {e}")
        except Exception as e:
            raise ConfigError(f"Failed to load configuration: {e}")
    
    def create_default_config(self):
        """Create default configuration file"""
        default_config = {
            "version": __version__,
            "workspace": str(Path.cwd()),
            "default_team": "fullstack",
            "analytics": True,
            "auto_update": True,
            "api": {
                "endpoint": os.getenv("API_ENDPOINT", "https://api.techforge.ai"),
                "timeout": 30,
                "retry_attempts": 3
            },
            "telemetry": {
                "enabled": os.getenv("TELEMETRY_ENABLED", "true").lower() == "true",
                "endpoint": os.getenv("ANALYTICS_ENDPOINT", "https://analytics.techforge.ai")
            },
            "security": {
                "verify_ssl": True,
                "api_key_location": "environment"
            },
            "performance": {
                "max_concurrent_agents": int(os.getenv("AGENT_MAX_CONCURRENT", "5")),
                "agent_timeout": int(os.getenv("AGENT_TIMEOUT_SECONDS", "300"))
            }
        }
        
        with open(self.config_file, 'w') as f:
            yaml.dump(default_config, f, default_flow_style=False)
        
        # Set secure permissions
        self.config_file.chmod(0o600)
        self.config = default_config
        logger.info("Created default configuration")
    
    def validate_config(self):
        """Validate configuration values"""
        required_keys = ['version', 'workspace', 'api', 'security']
        for key in required_keys:
            if key not in self.config:
                raise ConfigError(f"Missing required configuration key: {key}")
        
        # Validate API endpoint
        if not self.config['api'].get('endpoint'):
            raise ConfigError("API endpoint not configured")
        
        # Validate workspace
        workspace = Path(self.config['workspace'])
        if not workspace.exists():
            logger.warning(f"Workspace does not exist: {workspace}")
    
    def get(self, key: str, default=None):
        """Safely get configuration value"""
        keys = key.split('.')
        value = self.config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default
        return value if value is not None else default
    
    def set(self, key: str, value: Any):
        """Set configuration value"""
        keys = key.split('.')
        config = self.config
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        config[keys[-1]] = value
        self.save_config()
    
    def save_config(self):
        """Save configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                yaml.dump(self.config, f, default_flow_style=False)
            logger.info("Configuration saved")
        except Exception as e:
            raise ConfigError(f"Failed to save configuration: {e}")

class AgentManager:
    """Manages AI agents with health checks and monitoring"""
    
    def __init__(self, config: ConfigManager):
        self.config = config
        self.agents = {}
        self.active_agents = {}
        self.load_agent_definitions()
    
    def load_agent_definitions(self):
        """Load agent definitions from configuration"""
        self.agents = {
            "backend-expert": {
                "name": "Backend Expert",
                "version": "2.0.0",
                "specialization": "Distributed Systems & APIs",
                "tech_stack": ["Node.js", "Python", "Java", "Go"],
                "resource_requirements": {
                    "cpu": "2 cores",
                    "memory": "4GB",
                    "timeout": 300
                }
            },
            "frontend-expert": {
                "name": "Frontend Expert",
                "version": "2.0.0",
                "specialization": "Modern UI Development",
                "tech_stack": ["React", "Vue", "Angular", "TypeScript"],
                "resource_requirements": {
                    "cpu": "1 core",
                    "memory": "2GB",
                    "timeout": 300
                }
            },
            "database-expert": {
                "name": "Database Expert",
                "version": "2.0.0",
                "specialization": "Data Architecture",
                "tech_stack": ["PostgreSQL", "MongoDB", "Redis", "Elasticsearch"],
                "resource_requirements": {
                    "cpu": "2 cores",
                    "memory": "8GB",
                    "timeout": 600
                }
            },
            "security-expert": {
                "name": "Security Expert",
                "version": "2.0.0",
                "specialization": "Cybersecurity & Compliance",
                "tech_stack": ["OWASP", "Penetration Testing", "Encryption"],
                "resource_requirements": {
                    "cpu": "2 cores",
                    "memory": "4GB",
                    "timeout": 900
                }
            },
            "devops-expert": {
                "name": "DevOps Expert",
                "version": "2.0.0",
                "specialization": "Infrastructure & Automation",
                "tech_stack": ["Docker", "Kubernetes", "Terraform", "CI/CD"],
                "resource_requirements": {
                    "cpu": "2 cores",
                    "memory": "4GB",
                    "timeout": 600
                }
            }
        }
        logger.info(f"Loaded {len(self.agents)} agent definitions")
    
    async def deploy_agent(self, agent_id: str) -> bool:
        """Deploy an agent with health checks"""
        if agent_id not in self.agents:
            raise AgentError(f"Unknown agent: {agent_id}")
        
        agent = self.agents[agent_id]
        console.print(f"[cyan]Deploying {agent['name']}...[/cyan]")
        
        try:
            # Simulate deployment steps
            steps = [
                ("Validating environment", self._validate_environment),
                ("Checking resources", self._check_resources),
                ("Loading agent configuration", self._load_agent_config),
                ("Establishing connections", self._establish_connections),
                ("Running health check", self._health_check)
            ]
            
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                task = progress.add_task(f"Deploying {agent['name']}", total=len(steps))
                
                for step_name, step_func in steps:
                    progress.update(task, description=step_name)
                    await step_func(agent_id)
                    progress.advance(task)
            
            self.active_agents[agent_id] = {
                "agent": agent,
                "status": "active",
                "deployed_at": datetime.now().isoformat(),
                "health": "healthy"
            }
            
            console.print(f"[green]✓ {agent['name']} deployed successfully[/green]")
            logger.info(f"Agent deployed: {agent_id}")
            return True
            
        except Exception as e:
            console.print(f"[red]✗ Failed to deploy {agent['name']}: {e}[/red]")
            logger.error(f"Agent deployment failed: {agent_id} - {e}")
            return False
    
    async def _validate_environment(self, agent_id: str):
        """Validate environment for agent deployment"""
        await asyncio.sleep(0.5)  # Simulate validation
        api_key = os.getenv('API_KEY')
        if not api_key:
            raise DeploymentError("API_KEY not configured")
    
    async def _check_resources(self, agent_id: str):
        """Check system resources"""
        await asyncio.sleep(0.5)  # Simulate resource check
        # In production, check actual system resources
        pass
    
    async def _load_agent_config(self, agent_id: str):
        """Load agent-specific configuration"""
        await asyncio.sleep(0.5)  # Simulate config loading
        pass
    
    async def _establish_connections(self, agent_id: str):
        """Establish network connections"""
        await asyncio.sleep(0.5)  # Simulate connection
        pass
    
    async def _health_check(self, agent_id: str):
        """Run agent health check"""
        await asyncio.sleep(0.5)  # Simulate health check
        pass
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of all active agents"""
        return {
            "active_count": len(self.active_agents),
            "agents": self.active_agents
        }

class TelemetryManager:
    """Manages telemetry and analytics"""
    
    def __init__(self, config: ConfigManager):
        self.config = config
        self.enabled = config.get('telemetry.enabled', True)
        self.endpoint = config.get('telemetry.endpoint')
    
    async def track_event(self, event_name: str, properties: Dict[str, Any] = None):
        """Track an analytics event"""
        if not self.enabled:
            return
        
        try:
            event_data = {
                "event": event_name,
                "timestamp": datetime.now().isoformat(),
                "version": __version__,
                "properties": properties or {}
            }
            
            # In production, send to analytics endpoint
            logger.debug(f"Telemetry event: {event_name}")
            
        except Exception as e:
            logger.warning(f"Failed to track telemetry: {e}")

class TechForgeCLI:
    """Enhanced CLI controller with production features"""
    
    def __init__(self):
        self.config = ConfigManager()
        self.agent_manager = AgentManager(self.config)
        self.telemetry = TelemetryManager(self.config)
    
    @handle_errors
    def cmd_init(self, args):
        """Initialize TechForge in current project"""
        console.print("[bold cyan]TechForge Initialization[/bold cyan]")
        
        project_config = {
            "project_name": Path.cwd().name,
            "initialized_at": datetime.now().isoformat(),
            "agents": [],
            "team_preset": args.team if hasattr(args, 'team') else "fullstack",
            "version": __version__
        }
        
        config_file = Path.cwd() / ".techforge.yaml"
        
        if config_file.exists():
            if not click.confirm("Project already initialized. Reinitialize?"):
                return
        
        with open(config_file, 'w') as f:
            yaml.dump(project_config, f, default_flow_style=False)
        
        # Create project directories
        dirs = [".techforge", "logs", "data", "configs"]
        for dir_name in dirs:
            (Path.cwd() / dir_name).mkdir(exist_ok=True)
        
        console.print(f"[green]✓ Initialized TechForge in {Path.cwd()}[/green]")
        console.print("\n[bold]Next steps:[/bold]")
        console.print("  1. Deploy agents: [cyan]techforge deploy --team fullstack[/cyan]")
        console.print("  2. Check status: [cyan]techforge status[/cyan]")
        console.print("  3. View insights: [cyan]techforge insights[/cyan]")
        
        asyncio.run(self.telemetry.track_event("project_initialized", {
            "project_name": project_config["project_name"]
        }))
    
    @handle_errors
    def cmd_deploy(self, args):
        """Deploy agents with enhanced error handling"""
        console.print("[bold cyan]Agent Deployment[/bold cyan]\n")
        
        agents_to_deploy = []
        
        if args.team:
            # Define team presets
            team_presets = {
                "fullstack": ["backend-expert", "frontend-expert", "database-expert"],
                "enterprise": ["backend-expert", "frontend-expert", "database-expert", 
                             "security-expert", "devops-expert"]
            }
            
            if args.team not in team_presets:
                raise DeploymentError(f"Unknown team preset: {args.team}")
            
            agents_to_deploy = team_presets[args.team]
            console.print(f"Deploying [cyan]{args.team}[/cyan] team ({len(agents_to_deploy)} agents)\n")
        
        elif args.agent:
            agents_to_deploy = [args.agent]
        
        else:
            raise DeploymentError("Please specify --agent or --team")
        
        # Deploy agents asynchronously
        async def deploy_all():
            tasks = [self.agent_manager.deploy_agent(agent_id) for agent_id in agents_to_deploy]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            success_count = sum(1 for r in results if r is True)
            console.print(f"\n[bold green]Deployment complete![/bold green]")
            console.print(f"Successfully deployed: {success_count}/{len(agents_to_deploy)} agents")
            
            await self.telemetry.track_event("agents_deployed", {
                "count": success_count,
                "team": args.team if args.team else None
            })
        
        asyncio.run(deploy_all())
    
    @handle_errors
    def cmd_status(self, args):
        """Show enhanced status with health checks"""
        console.print("[bold cyan]Agent Status[/bold cyan]\n")
        
        status = self.agent_manager.get_status()
        
        if status['active_count'] == 0:
            console.print("[yellow]No active agents[/yellow]")
            console.print("Deploy agents using: [cyan]techforge deploy --team fullstack[/cyan]")
            return
        
        # Create status table
        table = Table(title="Active Agents")
        table.add_column("Agent", style="cyan")
        table.add_column("Status", style="green")
        table.add_column("Health")
        table.add_column("Deployed At")
        
        for agent_id, info in status['agents'].items():
            health_icon = "✅" if info['health'] == 'healthy' else "⚠️"
            table.add_row(
                info['agent']['name'],
                info['status'],
                health_icon,
                info['deployed_at']
            )
        
        console.print(table)
    
    def run(self):
        """Main CLI entry point with enhanced argument parsing"""
        parser = argparse.ArgumentParser(
            description='TechForge AI Agent Suite - Production CLI',
            formatter_class=argparse.RawDescriptionHelpFormatter
        )
        
        parser.add_argument('--version', action='version', 
                          version=f'TechForge CLI v{__version__}')
        parser.add_argument('--debug', action='store_true',
                          help='Enable debug mode')
        
        subparsers = parser.add_subparsers(dest='command', help='Available commands')
        
        # Init command
        parser_init = subparsers.add_parser('init', help='Initialize TechForge')
        parser_init.add_argument('--team', help='Pre-select team preset')
        
        # Deploy command
        parser_deploy = subparsers.add_parser('deploy', help='Deploy agents')
        deploy_group = parser_deploy.add_mutually_exclusive_group()
        deploy_group.add_argument('agent', nargs='?', help='Agent ID to deploy')
        deploy_group.add_argument('--team', help='Deploy team preset')
        
        # Status command
        parser_status = subparsers.add_parser('status', help='Show agent status')
        
        args = parser.parse_args()
        
        if args.debug:
            logging.getLogger().setLevel(logging.DEBUG)
            os.environ['DEBUG'] = 'true'
        
        if not args.command:
            parser.print_help()
            return
        
        # Route to command handlers
        command_handlers = {
            'init': self.cmd_init,
            'deploy': self.cmd_deploy,
            'status': self.cmd_status
        }
        
        handler = command_handlers.get(args.command)
        if handler:
            handler(args)

@handle_errors
def main():
    """Main entry point"""
    console.print("[bold cyan]TechForge AI Agent Suite[/bold cyan]")
    console.print(f"Version {__version__}\n")
    
    cli = TechForgeCLI()
    cli.run()

if __name__ == "__main__":
    main()