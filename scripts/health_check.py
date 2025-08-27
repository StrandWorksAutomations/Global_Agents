#!/usr/bin/env python3
"""
TechForge AI Agent Suite - Health Check Script
Comprehensive health monitoring for all system components
"""

import asyncio
import aiohttp
import asyncpg
import aioredis
import json
import sys
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import argparse
import os
from pathlib import Path

# Add project root to path
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class HealthStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

@dataclass
class HealthResult:
    service: str
    status: HealthStatus
    response_time: float
    message: str
    details: Optional[Dict[str, Any]] = None

class HealthChecker:
    """Comprehensive health checker for all system components"""
    
    def __init__(self):
        self.results: List[HealthResult] = []
        self.api_base_url = os.getenv('API_BASE_URL', 'http://localhost:8000')
        self.db_url = os.getenv('DATABASE_URL', 'postgresql://techforge:techforge_password@localhost:5432/techforge_db')
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.timeout = int(os.getenv('HEALTH_CHECK_TIMEOUT', '10'))
    
    async def check_api_health(self) -> HealthResult:
        """Check API service health"""
        start_time = time.time()
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.get(f"{self.api_base_url}/health") as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        data = await response.json()
                        return HealthResult(
                            service="API",
                            status=HealthStatus.HEALTHY if data.get('status') == 'healthy' else HealthStatus.DEGRADED,
                            response_time=response_time,
                            message=f"API responding in {response_time:.2f}ms",
                            details=data
                        )
                    else:
                        return HealthResult(
                            service="API",
                            status=HealthStatus.DEGRADED,
                            response_time=response_time,
                            message=f"API returned status {response.status}"
                        )
        
        except asyncio.TimeoutError:
            return HealthResult(
                service="API",
                status=HealthStatus.UNHEALTHY,
                response_time=self.timeout * 1000,
                message="API request timed out"
            )
        except Exception as e:
            return HealthResult(
                service="API",
                status=HealthStatus.UNHEALTHY,
                response_time=(time.time() - start_time) * 1000,
                message=f"API error: {str(e)}"
            )
    
    async def check_database_health(self) -> HealthResult:
        """Check PostgreSQL database health"""
        start_time = time.time()
        
        try:
            conn = await asyncpg.connect(self.db_url, command_timeout=self.timeout)
            
            # Test basic query
            result = await conn.fetchval("SELECT 1")
            
            # Check database stats
            stats = await conn.fetchrow("""
                SELECT 
                    count(*) as table_count,
                    pg_database_size(current_database()) as db_size
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            
            await conn.close()
            
            response_time = (time.time() - start_time) * 1000
            
            return HealthResult(
                service="Database",
                status=HealthStatus.HEALTHY,
                response_time=response_time,
                message=f"Database responding in {response_time:.2f}ms",
                details={
                    "table_count": stats['table_count'],
                    "database_size_bytes": stats['db_size'],
                    "connection_successful": result == 1
                }
            )
        
        except asyncio.TimeoutError:
            return HealthResult(
                service="Database",
                status=HealthStatus.UNHEALTHY,
                response_time=self.timeout * 1000,
                message="Database connection timed out"
            )
        except Exception as e:
            return HealthResult(
                service="Database",
                status=HealthStatus.UNHEALTHY,
                response_time=(time.time() - start_time) * 1000,
                message=f"Database error: {str(e)}"
            )
    
    async def check_redis_health(self) -> HealthResult:
        """Check Redis health"""
        start_time = time.time()
        
        try:
            redis = aioredis.from_url(self.redis_url)
            
            # Test ping
            ping_result = await redis.ping()
            
            # Test set/get
            test_key = f"health_check_{int(time.time())}"
            await redis.set(test_key, "test_value", ex=5)
            test_value = await redis.get(test_key)
            await redis.delete(test_key)
            
            # Get Redis info
            info = await redis.info()
            
            await redis.close()
            
            response_time = (time.time() - start_time) * 1000
            
            return HealthResult(
                service="Redis",
                status=HealthStatus.HEALTHY,
                response_time=response_time,
                message=f"Redis responding in {response_time:.2f}ms",
                details={
                    "ping_successful": ping_result,
                    "read_write_test": test_value == b"test_value",
                    "version": info.get('redis_version'),
                    "memory_used": info.get('used_memory_human'),
                    "connected_clients": info.get('connected_clients')
                }
            )
        
        except asyncio.TimeoutError:
            return HealthResult(
                service="Redis",
                status=HealthStatus.UNHEALTHY,
                response_time=self.timeout * 1000,
                message="Redis connection timed out"
            )
        except Exception as e:
            return HealthResult(
                service="Redis",
                status=HealthStatus.UNHEALTHY,
                response_time=(time.time() - start_time) * 1000,
                message=f"Redis error: {str(e)}"
            )
    
    async def check_external_dependencies(self) -> List[HealthResult]:
        """Check external service dependencies"""
        results = []
        
        # Check external APIs
        external_services = [
            ("OpenAI API", "https://api.openai.com/v1/models", {"Authorization": f"Bearer {os.getenv('OPENAI_API_KEY', 'test')}"}),
            ("Anthropic API", "https://api.anthropic.com/v1/messages", {"x-api-key": os.getenv('ANTHROPIC_API_KEY', 'test')}),
        ]
        
        for service_name, url, headers in external_services:
            start_time = time.time()
            
            try:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                    async with session.get(url, headers=headers) as response:
                        response_time = (time.time() - start_time) * 1000
                        
                        # 401/403 is expected for test keys, means service is responding
                        if response.status in [200, 401, 403]:
                            status = HealthStatus.HEALTHY
                            message = f"{service_name} responding in {response_time:.2f}ms"
                        else:
                            status = HealthStatus.DEGRADED
                            message = f"{service_name} returned status {response.status}"
                        
                        results.append(HealthResult(
                            service=service_name,
                            status=status,
                            response_time=response_time,
                            message=message
                        ))
            
            except Exception as e:
                results.append(HealthResult(
                    service=service_name,
                    status=HealthStatus.UNHEALTHY,
                    response_time=(time.time() - start_time) * 1000,
                    message=f"{service_name} error: {str(e)}"
                ))
        
        return results
    
    async def check_disk_space(self) -> HealthResult:
        """Check disk space"""
        start_time = time.time()
        
        try:
            import shutil
            
            # Check disk usage
            total, used, free = shutil.disk_usage("/")
            
            free_percent = (free / total) * 100
            used_percent = (used / total) * 100
            
            if free_percent < 5:
                status = HealthStatus.UNHEALTHY
                message = f"Critical: Only {free_percent:.1f}% disk space remaining"
            elif free_percent < 10:
                status = HealthStatus.DEGRADED
                message = f"Warning: Only {free_percent:.1f}% disk space remaining"
            else:
                status = HealthStatus.HEALTHY
                message = f"Disk space: {free_percent:.1f}% free"
            
            response_time = (time.time() - start_time) * 1000
            
            return HealthResult(
                service="Disk Space",
                status=status,
                response_time=response_time,
                message=message,
                details={
                    "total_gb": round(total / (1024**3), 2),
                    "used_gb": round(used / (1024**3), 2),
                    "free_gb": round(free / (1024**3), 2),
                    "used_percent": round(used_percent, 2),
                    "free_percent": round(free_percent, 2)
                }
            )
        
        except Exception as e:
            return HealthResult(
                service="Disk Space",
                status=HealthStatus.UNKNOWN,
                response_time=(time.time() - start_time) * 1000,
                message=f"Disk check error: {str(e)}"
            )
    
    async def run_all_checks(self) -> Dict[str, Any]:
        """Run all health checks"""
        print("🏥 Running TechForge Health Checks...")
        start_time = time.time()
        
        # Run all checks concurrently
        tasks = [
            self.check_api_health(),
            self.check_database_health(),
            self.check_redis_health(),
            self.check_disk_space(),
        ]
        
        # Run external dependency checks
        external_checks = await self.check_external_dependencies()
        
        # Wait for core checks
        core_results = await asyncio.gather(*tasks)
        
        # Combine all results
        all_results = list(core_results) + external_checks
        
        total_time = (time.time() - start_time) * 1000
        
        # Determine overall health
        unhealthy_count = sum(1 for r in all_results if r.status == HealthStatus.UNHEALTHY)
        degraded_count = sum(1 for r in all_results if r.status == HealthStatus.DEGRADED)
        
        if unhealthy_count > 0:
            overall_status = HealthStatus.UNHEALTHY
        elif degraded_count > 0:
            overall_status = HealthStatus.DEGRADED
        else:
            overall_status = HealthStatus.HEALTHY
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "overall_status": overall_status.value,
            "total_checks": len(all_results),
            "healthy_count": sum(1 for r in all_results if r.status == HealthStatus.HEALTHY),
            "degraded_count": degraded_count,
            "unhealthy_count": unhealthy_count,
            "total_time_ms": round(total_time, 2),
            "checks": [
                {
                    "service": r.service,
                    "status": r.status.value,
                    "response_time_ms": round(r.response_time, 2),
                    "message": r.message,
                    "details": r.details
                }
                for r in all_results
            ]
        }
    
    def print_results(self, results: Dict[str, Any]) -> None:
        """Print formatted results"""
        status_colors = {
            HealthStatus.HEALTHY.value: "\033[92m",      # Green
            HealthStatus.DEGRADED.value: "\033[93m",     # Yellow
            HealthStatus.UNHEALTHY.value: "\033[91m",    # Red
            HealthStatus.UNKNOWN.value: "\033[94m"       # Blue
        }
        reset_color = "\033[0m"
        
        print("\n" + "="*60)
        print("🏥 TechForge AI Agent Suite - Health Report")
        print("="*60)
        
        overall_color = status_colors.get(results["overall_status"], "")
        print(f"Overall Status: {overall_color}{results['overall_status'].upper()}{reset_color}")
        print(f"Total Checks: {results['total_checks']}")
        print(f"Healthy: {results['healthy_count']} | Degraded: {results['degraded_count']} | Unhealthy: {results['unhealthy_count']}")
        print(f"Total Time: {results['total_time_ms']:.2f}ms")
        print(f"Timestamp: {results['timestamp']}")
        
        print("\n" + "-"*60)
        print("Service Details:")
        print("-"*60)
        
        for check in results["checks"]:
            status_color = status_colors.get(check["status"], "")
            status_icon = {
                HealthStatus.HEALTHY.value: "✅",
                HealthStatus.DEGRADED.value: "⚠️",
                HealthStatus.UNHEALTHY.value: "❌",
                HealthStatus.UNKNOWN.value: "❓"
            }.get(check["status"], "❓")
            
            print(f"{status_icon} {check['service']:20} {status_color}{check['status']:10}{reset_color} {check['response_time_ms']:8.2f}ms  {check['message']}")
        
        print("="*60)

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="TechForge AI Agent Suite Health Checker")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("--timeout", type=int, default=10, help="Request timeout in seconds")
    parser.add_argument("--continuous", action="store_true", help="Run continuous health checks")
    parser.add_argument("--interval", type=int, default=30, help="Interval for continuous checks (seconds)")
    
    args = parser.parse_args()
    
    checker = HealthChecker()
    checker.timeout = args.timeout
    
    if args.continuous:
        print(f"Starting continuous health monitoring (interval: {args.interval}s)")
        print("Press Ctrl+C to stop")
        
        try:
            while True:
                results = await checker.run_all_checks()
                
                if args.json:
                    print(json.dumps(results, indent=2))
                else:
                    checker.print_results(results)
                
                # Exit code based on health
                if results["overall_status"] == HealthStatus.UNHEALTHY.value:
                    print("⚠️  System is unhealthy!")
                elif results["overall_status"] == HealthStatus.DEGRADED.value:
                    print("⚠️  System is degraded")
                else:
                    print("✅ System is healthy")
                
                await asyncio.sleep(args.interval)
        
        except KeyboardInterrupt:
            print("\n👋 Health monitoring stopped")
            return 0
    
    else:
        # Single run
        results = await checker.run_all_checks()
        
        if args.json:
            print(json.dumps(results, indent=2))
        else:
            checker.print_results(results)
        
        # Exit code based on overall health
        if results["overall_status"] == HealthStatus.UNHEALTHY.value:
            return 2
        elif results["overall_status"] == HealthStatus.DEGRADED.value:
            return 1
        else:
            return 0

if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        sys.exit(0)