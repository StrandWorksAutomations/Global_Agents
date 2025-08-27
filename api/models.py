"""
Database models for TechForge AI Agent Suite
SQLAlchemy ORM models with async support
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum
import uuid

from sqlalchemy import (
    Column, String, Integer, DateTime, Boolean, Text, JSON, ForeignKey,
    Float, Enum as SQLEnum, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql import func

Base = declarative_base()

# Enums
class UserTier(str, Enum):
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"

class AgentStatus(str, Enum):
    INACTIVE = "inactive"
    DEPLOYING = "deploying"
    ACTIVE = "active"
    BUSY = "busy"
    ERROR = "error"
    MAINTENANCE = "maintenance"

class TaskStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

# Models
class User(Base):
    """User model for authentication and authorization"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    company = Column(String(255))
    tier = Column(SQLEnum(UserTier), default=UserTier.FREE, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    api_key = Column(String(255), unique=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True))
    
    # Relationships
    licenses = relationship("License", back_populates="user", cascade="all, delete-orphan")
    deployments = relationship("AgentDeployment", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    usage_metrics = relationship("UsageMetric", back_populates="user", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'", name="valid_email"),
    )
    
    @validates('email')
    def validate_email(self, key, email):
        """Validate email format"""
        return email.lower()
    
    def __repr__(self):
        return f"<User {self.username}>"

class License(Base):
    """License management model"""
    __tablename__ = "licenses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    license_key = Column(String(255), unique=True, nullable=False, index=True)
    tier = Column(SQLEnum(UserTier), nullable=False)
    max_agents = Column(Integer, nullable=False)
    max_tasks_per_month = Column(Integer)
    
    # Validity
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Metadata
    metadata = Column(JSON, default={})
    
    # Relationships
    user = relationship("User", back_populates="licenses")
    
    @hybrid_property
    def is_expired(self):
        """Check if license is expired"""
        return datetime.utcnow() > self.expires_at
    
    def __repr__(self):
        return f"<License {self.license_key[:8]}...>"

class Agent(Base):
    """Agent definition model"""
    __tablename__ = "agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    description = Column(Text)
    specialization = Column(String(255))
    
    # Capabilities
    tech_stack = Column(JSON, default=[])
    capabilities = Column(JSON, default={})
    resource_requirements = Column(JSON, default={})
    
    # Configuration
    default_config = Column(JSON, default={})
    max_concurrent_tasks = Column(Integer, default=5)
    timeout_seconds = Column(Integer, default=300)
    
    # Metadata
    is_available = Column(Boolean, default=True, nullable=False)
    min_tier = Column(SQLEnum(UserTier), default=UserTier.STARTER)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    deployments = relationship("AgentDeployment", back_populates="agent", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="agent", cascade="all, delete-orphan")
    metrics = relationship("AgentMetric", back_populates="agent", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Agent {self.agent_id}>"

class AgentDeployment(Base):
    """Agent deployment instance model"""
    __tablename__ = "agent_deployments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    deployment_id = Column(String(255), unique=True, nullable=False, index=True)
    
    # Status
    status = Column(SQLEnum(AgentStatus), default=AgentStatus.INACTIVE, nullable=False)
    health = Column(SQLEnum(HealthStatus), default=HealthStatus.UNKNOWN, nullable=False)
    
    # Configuration
    configuration = Column(JSON, default={})
    environment = Column(JSON, default={})
    
    # Timestamps
    deployed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_health_check = Column(DateTime(timezone=True))
    terminated_at = Column(DateTime(timezone=True))
    
    # Metrics
    tasks_completed = Column(Integer, default=0)
    tasks_failed = Column(Integer, default=0)
    average_response_time_ms = Column(Float)
    
    # Relationships
    user = relationship("User", back_populates="deployments")
    agent = relationship("Agent", back_populates="deployments")
    tasks = relationship("Task", back_populates="deployment", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_deployment_status", "status"),
        Index("idx_deployment_user_agent", "user_id", "agent_id"),
    )
    
    def __repr__(self):
        return f"<AgentDeployment {self.deployment_id}>"

class Task(Base):
    """Task execution model"""
    __tablename__ = "tasks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("agent_deployments.id"))
    
    # Task details
    name = Column(String(255), nullable=False)
    description = Column(Text)
    parameters = Column(JSON, default={})
    priority = Column(SQLEnum(TaskPriority), default=TaskPriority.NORMAL, nullable=False)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    queued_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Results
    result = Column(JSON)
    error_message = Column(Text)
    execution_time_ms = Column(Float)
    
    # Relationships
    user = relationship("User", back_populates="tasks")
    agent = relationship("Agent", back_populates="tasks")
    deployment = relationship("AgentDeployment", back_populates="tasks")
    
    # Indexes
    __table_args__ = (
        Index("idx_task_status", "status"),
        Index("idx_task_priority_created", "priority", "created_at"),
        Index("idx_task_user_created", "user_id", "created_at"),
    )
    
    @hybrid_property
    def is_completed(self):
        """Check if task is completed"""
        return self.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]
    
    def __repr__(self):
        return f"<Task {self.task_id}>"

class AgentMetric(Base):
    """Agent performance metrics"""
    __tablename__ = "agent_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("agent_deployments.id"))
    
    # Metrics
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    cpu_usage_percent = Column(Float)
    memory_usage_mb = Column(Float)
    disk_usage_mb = Column(Float)
    network_in_bytes = Column(Integer)
    network_out_bytes = Column(Integer)
    
    # Performance
    response_time_p50 = Column(Float)
    response_time_p95 = Column(Float)
    response_time_p99 = Column(Float)
    error_rate = Column(Float)
    success_rate = Column(Float)
    
    # Relationships
    agent = relationship("Agent", back_populates="metrics")
    
    # Indexes
    __table_args__ = (
        Index("idx_metric_agent_timestamp", "agent_id", "timestamp"),
        Index("idx_metric_deployment_timestamp", "deployment_id", "timestamp"),
    )
    
    def __repr__(self):
        return f"<AgentMetric {self.agent_id} @ {self.timestamp}>"

class UsageMetric(Base):
    """User usage metrics for billing"""
    __tablename__ = "usage_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Period
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    
    # Usage
    tasks_executed = Column(Integer, default=0)
    agents_deployed = Column(Integer, default=0)
    compute_hours = Column(Float, default=0.0)
    storage_gb_hours = Column(Float, default=0.0)
    network_gb = Column(Float, default=0.0)
    
    # Costs
    estimated_cost = Column(Float, default=0.0)
    billed_cost = Column(Float)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    metadata = Column(JSON, default={})
    
    # Relationships
    user = relationship("User", back_populates="usage_metrics")
    
    # Indexes
    __table_args__ = (
        Index("idx_usage_user_period", "user_id", "period_start", "period_end"),
        UniqueConstraint("user_id", "period_start", "period_end", name="unique_user_period"),
    )
    
    def __repr__(self):
        return f"<UsageMetric {self.user_id} {self.period_start}-{self.period_end}>"

class AuditLog(Base):
    """Audit log for compliance and security"""
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Event details
    event_type = Column(String(100), nullable=False, index=True)
    event_action = Column(String(100), nullable=False)
    resource_type = Column(String(100))
    resource_id = Column(String(255))
    
    # Context
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    request_id = Column(String(255))
    
    # Data
    event_data = Column(JSON, default={})
    changes = Column(JSON, default={})
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Indexes
    __table_args__ = (
        Index("idx_audit_user_created", "user_id", "created_at"),
        Index("idx_audit_event_created", "event_type", "created_at"),
    )
    
    def __repr__(self):
        return f"<AuditLog {self.event_type} {self.created_at}>

# Database initialization
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

async def init_database():
    """Initialize database with tables"""
    engine = create_async_engine(
        os.getenv('DATABASE_URL', 'postgresql+asyncpg://user:password@localhost/techforge'),
        echo=os.getenv('SQL_ECHO', 'false').lower() == 'true',
        pool_size=int(os.getenv('DATABASE_POOL_SIZE', '10')),
        max_overflow=int(os.getenv('DATABASE_MAX_OVERFLOW', '20'))
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    return engine

def get_session_factory(engine):
    """Create async session factory"""
    return sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )