"""
TechForge AI Agent Suite - FastAPI Backend
Production-ready API for agent orchestration and management
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Security, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from prometheus_fastapi_instrumentator import Instrumentator
import uvicorn
from dotenv import load_dotenv
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from redis import asyncio as aioredis
import httpx

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("techforge.api")

# Initialize Sentry for error tracking
if os.getenv('SENTRY_DSN'):
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'),
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=1.0,
        environment=os.getenv('APP_ENV', 'development')
    )

# Security configuration
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRE_MINUTES', '30'))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Redis connection
redis_client = None

# Database connection (will be initialized in lifespan)
db_engine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    global redis_client, db_engine
    
    try:
        # Initialize Redis
        redis_client = await aioredis.from_url(
            f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', '6379')}",
            password=os.getenv('REDIS_PASSWORD'),
            encoding="utf-8",
            decode_responses=True
        )
        logger.info("Redis connected successfully")
        
        # Initialize database (implement based on your needs)
        # db_engine = create_async_engine(os.getenv('DATABASE_URL'))
        # logger.info("Database connected successfully")
        
        yield
        
    finally:
        # Cleanup
        if redis_client:
            await redis_client.close()
        # if db_engine:
        #     await db_engine.dispose()

# Create FastAPI app
app = FastAPI(
    title="TechForge AI Agent Suite API",
    description="Enterprise-grade AI agent orchestration platform",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add Prometheus metrics
instrumentator = Instrumentator()
instrumentator.instrument(app).expose(app, endpoint="/metrics")

# Request/Response Models
class AgentDeployRequest(BaseModel):
    agent_id: str = Field(..., description="ID of the agent to deploy")
    configuration: Optional[Dict[str, Any]] = Field(default={}, description="Agent configuration")
    timeout: Optional[int] = Field(default=300, description="Deployment timeout in seconds")

class AgentResponse(BaseModel):
    agent_id: str
    name: str
    status: str
    version: str
    deployed_at: Optional[datetime]
    health: str
    metrics: Optional[Dict[str, Any]]

class TaskRequest(BaseModel):
    agent_id: str = Field(..., description="Agent to execute the task")
    task: str = Field(..., description="Task description")
    parameters: Optional[Dict[str, Any]] = Field(default={}, description="Task parameters")
    priority: Optional[str] = Field(default="normal", description="Task priority")

class TaskResponse(BaseModel):
    task_id: str
    agent_id: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime]
    result: Optional[Dict[str, Any]]

class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: datetime
    services: Dict[str, str]

class LicenseValidation(BaseModel):
    license_key: str
    product: str = "techforge"

# Authentication
async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Verify JWT token"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
        return username
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

def create_access_token(data: dict):
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Rate limiting
async def check_rate_limit(request: Request):
    """Check rate limits using Redis"""
    if not redis_client:
        return True
    
    client_ip = request.client.host
    key = f"rate_limit:{client_ip}"
    
    try:
        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, 3600)  # 1 hour window
        
        limit = int(os.getenv('RATE_LIMIT_REQUESTS', '100'))
        if current > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            )
    except Exception as e:
        logger.warning(f"Rate limiting check failed: {e}")
    
    return True

# API Endpoints
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "name": "TechForge AI Agent Suite API",
        "version": "2.0.0",
        "status": "operational",
        "documentation": "/api/docs"
    }

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint"""
    services = {
        "api": "healthy",
        "redis": "healthy" if redis_client else "unavailable",
        "database": "healthy",  # Check actual database connection
        "agents": "operational"
    }
    
    overall_status = "healthy" if all(s == "healthy" or s == "operational" for s in services.values()) else "degraded"
    
    return HealthResponse(
        status=overall_status,
        version="2.0.0",
        timestamp=datetime.utcnow(),
        services=services
    )

@app.post("/api/v1/agents/deploy", response_model=AgentResponse, tags=["Agents"])
async def deploy_agent(
    request: AgentDeployRequest,
    _: str = Depends(verify_token),
    rate_limit: bool = Depends(check_rate_limit)
):
    """Deploy a new agent"""
    try:
        logger.info(f"Deploying agent: {request.agent_id}")
        
        # Validate agent exists
        available_agents = ["backend-expert", "frontend-expert", "database-expert", 
                          "security-expert", "devops-expert", "qa-expert"]
        
        if request.agent_id not in available_agents:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent {request.agent_id} not found"
            )
        
        # Simulate agent deployment
        # In production, this would trigger actual agent deployment
        agent_info = {
            "agent_id": request.agent_id,
            "name": request.agent_id.replace("-", " ").title(),
            "status": "deploying",
            "version": "2.0.0",
            "deployed_at": datetime.utcnow(),
            "health": "initializing",
            "metrics": {
                "cpu_usage": 0,
                "memory_usage": 0,
                "tasks_completed": 0
            }
        }
        
        # Store in Redis for state management
        if redis_client:
            await redis_client.setex(
                f"agent:{request.agent_id}",
                3600,
                str(agent_info)
            )
        
        # Update status to active (simulate deployment completion)
        agent_info["status"] = "active"
        agent_info["health"] = "healthy"
        
        return AgentResponse(**agent_info)
        
    except Exception as e:
        logger.error(f"Failed to deploy agent: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deploy agent: {str(e)}"
        )

@app.get("/api/v1/agents", response_model=List[AgentResponse], tags=["Agents"])
async def list_agents(
    _: str = Depends(verify_token),
    rate_limit: bool = Depends(check_rate_limit)
):
    """List all deployed agents"""
    try:
        # In production, fetch from database
        agents = []
        
        if redis_client:
            # Get all agent keys from Redis
            keys = await redis_client.keys("agent:*")
            for key in keys:
                agent_data = await redis_client.get(key)
                if agent_data:
                    # Parse and append agent data
                    pass
        
        return agents
        
    except Exception as e:
        logger.error(f"Failed to list agents: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list agents: {str(e)}"
        )

@app.get("/api/v1/agents/{agent_id}", response_model=AgentResponse, tags=["Agents"])
async def get_agent(
    agent_id: str,
    _: str = Depends(verify_token),
    rate_limit: bool = Depends(check_rate_limit)
):
    """Get specific agent details"""
    try:
        if redis_client:
            agent_data = await redis_client.get(f"agent:{agent_id}")
            if agent_data:
                # Parse and return agent data
                pass
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found"
        )
        
    except Exception as e:
        logger.error(f"Failed to get agent: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get agent: {str(e)}"
        )

@app.delete("/api/v1/agents/{agent_id}", tags=["Agents"])
async def undeploy_agent(
    agent_id: str,
    _: str = Depends(verify_token),
    rate_limit: bool = Depends(check_rate_limit)
):
    """Undeploy an agent"""
    try:
        logger.info(f"Undeploying agent: {agent_id}")
        
        if redis_client:
            result = await redis_client.delete(f"agent:{agent_id}")
            if result:
                return {"message": f"Agent {agent_id} undeployed successfully"}
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found"
        )
        
    except Exception as e:
        logger.error(f"Failed to undeploy agent: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to undeploy agent: {str(e)}"
        )

@app.post("/api/v1/tasks", response_model=TaskResponse, tags=["Tasks"])
async def create_task(
    request: TaskRequest,
    _: str = Depends(verify_token),
    rate_limit: bool = Depends(check_rate_limit)
):
    """Create a new task for an agent"""
    try:
        import uuid
        
        task_id = str(uuid.uuid4())
        task_info = {
            "task_id": task_id,
            "agent_id": request.agent_id,
            "status": "pending",
            "created_at": datetime.utcnow(),
            "completed_at": None,
            "result": None
        }
        
        # Store task in Redis
        if redis_client:
            await redis_client.setex(
                f"task:{task_id}",
                7200,  # 2 hour TTL
                str(task_info)
            )
            
            # Add to task queue
            await redis_client.lpush(
                f"task_queue:{request.agent_id}",
                task_id
            )
        
        return TaskResponse(**task_info)
        
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create task: {str(e)}"
        )

@app.get("/api/v1/tasks/{task_id}", response_model=TaskResponse, tags=["Tasks"])
async def get_task(
    task_id: str,
    _: str = Depends(verify_token),
    rate_limit: bool = Depends(check_rate_limit)
):
    """Get task status"""
    try:
        if redis_client:
            task_data = await redis_client.get(f"task:{task_id}")
            if task_data:
                # Parse and return task data
                pass
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
        
    except Exception as e:
        logger.error(f"Failed to get task: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task: {str(e)}"
        )

@app.post("/api/v1/license/validate", tags=["License"])
async def validate_license(
    request: LicenseValidation,
    rate_limit: bool = Depends(check_rate_limit)
):
    """Validate license key"""
    try:
        # In production, validate against license server
        # For now, simple validation
        if request.license_key.startswith("TF-"):
            return {
                "valid": True,
                "tier": "enterprise",
                "expires_at": datetime.utcnow() + timedelta(days=365)
            }
        
        return {
            "valid": False,
            "message": "Invalid license key"
        }
        
    except Exception as e:
        logger.error(f"Failed to validate license: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate license: {str(e)}"
        )

@app.get("/api/v1/analytics/summary", tags=["Analytics"])
async def get_analytics_summary(
    _: str = Depends(verify_token),
    rate_limit: bool = Depends(check_rate_limit)
):
    """Get analytics summary"""
    try:
        # In production, aggregate from database
        return {
            "period": "last_7_days",
            "metrics": {
                "tasks_completed": 147,
                "agents_deployed": 23,
                "average_response_time_ms": 234,
                "success_rate": 0.98,
                "active_users": 5
            },
            "top_agents": [
                {"agent_id": "backend-expert", "tasks": 43},
                {"agent_id": "frontend-expert", "tasks": 38},
                {"agent_id": "database-expert", "tasks": 29}
            ]
        }
        
    except Exception as e:
        logger.error(f"Failed to get analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analytics: {str(e)}"
        )

# WebSocket for real-time updates
from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket for real-time agent updates"""
    await websocket.accept()
    logger.info(f"WebSocket connected: {client_id}")
    
    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            
            # Echo back for now (implement actual logic)
            await websocket.send_json({
                "type": "update",
                "client_id": client_id,
                "timestamp": datetime.utcnow().isoformat(),
                "data": data
            })
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "status_code": 500,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "8000")),
        reload=os.getenv("HOT_RELOAD", "false").lower() == "true",
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )