"""Initial database schema

Revision ID: 001
Revises: 
Create Date: 2024-12-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create custom enums
    user_tier_enum = postgresql.ENUM('free', 'starter', 'professional', 'enterprise', name='usertier')
    user_tier_enum.create(op.get_bind())
    
    agent_status_enum = postgresql.ENUM('inactive', 'deploying', 'active', 'busy', 'error', 'maintenance', name='agentstatus')
    agent_status_enum.create(op.get_bind())
    
    task_status_enum = postgresql.ENUM('pending', 'queued', 'running', 'completed', 'failed', 'cancelled', name='taskstatus')
    task_status_enum.create(op.get_bind())
    
    task_priority_enum = postgresql.ENUM('low', 'normal', 'high', 'critical', name='taskpriority')
    task_priority_enum.create(op.get_bind())
    
    health_status_enum = postgresql.ENUM('healthy', 'degraded', 'unhealthy', 'unknown', name='healthstatus')
    health_status_enum.create(op.get_bind())

    # Create users table
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('company', sa.String(length=255), nullable=True),
        sa.Column('tier', user_tier_enum, nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False),
        sa.Column('api_key', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'", name='valid_email'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username'),
        sa.UniqueConstraint('api_key')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=False)
    op.create_index(op.f('ix_users_api_key'), 'users', ['api_key'], unique=False)

    # Create agents table
    op.create_table('agents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('specialization', sa.String(length=255), nullable=True),
        sa.Column('tech_stack', sa.JSON(), nullable=True),
        sa.Column('capabilities', sa.JSON(), nullable=True),
        sa.Column('resource_requirements', sa.JSON(), nullable=True),
        sa.Column('default_config', sa.JSON(), nullable=True),
        sa.Column('max_concurrent_tasks', sa.Integer(), nullable=True),
        sa.Column('timeout_seconds', sa.Integer(), nullable=True),
        sa.Column('is_available', sa.Boolean(), nullable=False),
        sa.Column('min_tier', user_tier_enum, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('agent_id')
    )
    op.create_index(op.f('ix_agents_agent_id'), 'agents', ['agent_id'], unique=False)

    # Create licenses table
    op.create_table('licenses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('license_key', sa.String(length=255), nullable=False),
        sa.Column('tier', user_tier_enum, nullable=False),
        sa.Column('max_agents', sa.Integer(), nullable=False),
        sa.Column('max_tasks_per_month', sa.Integer(), nullable=True),
        sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('license_key')
    )
    op.create_index(op.f('ix_licenses_license_key'), 'licenses', ['license_key'], unique=False)

    # Create agent_deployments table
    op.create_table('agent_deployments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deployment_id', sa.String(length=255), nullable=False),
        sa.Column('status', agent_status_enum, nullable=False),
        sa.Column('health', health_status_enum, nullable=False),
        sa.Column('configuration', sa.JSON(), nullable=True),
        sa.Column('environment', sa.JSON(), nullable=True),
        sa.Column('deployed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_health_check', sa.DateTime(timezone=True), nullable=True),
        sa.Column('terminated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('tasks_completed', sa.Integer(), nullable=True),
        sa.Column('tasks_failed', sa.Integer(), nullable=True),
        sa.Column('average_response_time_ms', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('deployment_id')
    )
    op.create_index('idx_deployment_status', 'agent_deployments', ['status'], unique=False)
    op.create_index('idx_deployment_user_agent', 'agent_deployments', ['user_id', 'agent_id'], unique=False)

    # Create tasks table
    op.create_table('tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('task_id', sa.String(length=255), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('priority', task_priority_enum, nullable=False),
        sa.Column('status', task_status_enum, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('queued_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('execution_time_ms', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
        sa.ForeignKeyConstraint(['deployment_id'], ['agent_deployments.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id')
    )
    op.create_index('idx_task_status', 'tasks', ['status'], unique=False)
    op.create_index('idx_task_priority_created', 'tasks', ['priority', 'created_at'], unique=False)
    op.create_index('idx_task_user_created', 'tasks', ['user_id', 'created_at'], unique=False)

    # Create agent_metrics table
    op.create_table('agent_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('cpu_usage_percent', sa.Float(), nullable=True),
        sa.Column('memory_usage_mb', sa.Float(), nullable=True),
        sa.Column('disk_usage_mb', sa.Float(), nullable=True),
        sa.Column('network_in_bytes', sa.Integer(), nullable=True),
        sa.Column('network_out_bytes', sa.Integer(), nullable=True),
        sa.Column('response_time_p50', sa.Float(), nullable=True),
        sa.Column('response_time_p95', sa.Float(), nullable=True),
        sa.Column('response_time_p99', sa.Float(), nullable=True),
        sa.Column('error_rate', sa.Float(), nullable=True),
        sa.Column('success_rate', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_metric_agent_timestamp', 'agent_metrics', ['agent_id', 'timestamp'], unique=False)
    op.create_index('idx_metric_deployment_timestamp', 'agent_metrics', ['deployment_id', 'timestamp'], unique=False)

    # Create usage_metrics table
    op.create_table('usage_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tasks_executed', sa.Integer(), nullable=True),
        sa.Column('agents_deployed', sa.Integer(), nullable=True),
        sa.Column('compute_hours', sa.Float(), nullable=True),
        sa.Column('storage_gb_hours', sa.Float(), nullable=True),
        sa.Column('network_gb', sa.Float(), nullable=True),
        sa.Column('estimated_cost', sa.Float(), nullable=True),
        sa.Column('billed_cost', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'period_start', 'period_end', name='unique_user_period')
    )
    op.create_index('idx_usage_user_period', 'usage_metrics', ['user_id', 'period_start', 'period_end'], unique=False)

    # Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('event_action', sa.String(length=100), nullable=False),
        sa.Column('resource_type', sa.String(length=100), nullable=True),
        sa.Column('resource_id', sa.String(length=255), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('request_id', sa.String(length=255), nullable=True),
        sa.Column('event_data', sa.JSON(), nullable=True),
        sa.Column('changes', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_audit_user_created', 'audit_logs', ['user_id', 'created_at'], unique=False)
    op.create_index('idx_audit_event_created', 'audit_logs', ['event_type', 'created_at'], unique=False)
    op.create_index(op.f('ix_audit_logs_event_type'), 'audit_logs', ['event_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('audit_logs')
    op.drop_table('usage_metrics')
    op.drop_table('agent_metrics')
    op.drop_table('tasks')
    op.drop_table('agent_deployments')
    op.drop_table('licenses')
    op.drop_table('agents')
    op.drop_table('users')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS healthstatus')
    op.execute('DROP TYPE IF EXISTS taskpriority')
    op.execute('DROP TYPE IF EXISTS taskstatus')
    op.execute('DROP TYPE IF EXISTS agentstatus')
    op.execute('DROP TYPE IF EXISTS usertier')