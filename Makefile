# TechForge AI Agent Suite - Makefile
# Common development and deployment tasks

.PHONY: help install dev-install clean test lint format security build run stop logs shell migrate backup

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

# Variables
PYTHON := python3
PIP := pip3
DOCKER_COMPOSE := docker-compose
PROJECT_NAME := techforge-ai-suite
VERSION := 2.0.0

help: ## Show this help message
	@echo "$(BLUE)TechForge AI Agent Suite - Development Commands$(RESET)"
	@echo "================================================"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "$(GREEN)%-20s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Installation
install: ## Install production dependencies
	@echo "$(BLUE)Installing production dependencies...$(RESET)"
	$(PIP) install -r requirements.txt
	$(PIP) install -e .

dev-install: ## Install development dependencies
	@echo "$(BLUE)Installing development dependencies...$(RESET)"
	$(PIP) install -r requirements.txt
	$(PIP) install -e .[dev,test,monitoring,ai]
	pre-commit install

# Development
clean: ## Clean up build artifacts and cache
	@echo "$(BLUE)Cleaning up...$(RESET)"
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	rm -rf build/ dist/ htmlcov/ .coverage coverage.xml
	docker system prune -f

# Testing
test: ## Run all tests
	@echo "$(BLUE)Running tests...$(RESET)"
	pytest tests/ -v --cov=./ --cov-report=html --cov-report=term-missing

test-unit: ## Run unit tests only
	@echo "$(BLUE)Running unit tests...$(RESET)"
	pytest tests/unit -v

test-integration: ## Run integration tests only
	@echo "$(BLUE)Running integration tests...$(RESET)"
	pytest tests/integration -v

test-api: ## Run API tests only
	@echo "$(BLUE)Running API tests...$(RESET)"
	pytest tests/api -v

test-coverage: ## Generate test coverage report
	@echo "$(BLUE)Generating coverage report...$(RESET)"
	pytest tests/ --cov=./ --cov-report=html --cov-report=term-missing
	@echo "$(GREEN)Coverage report generated in htmlcov/index.html$(RESET)"

# Code Quality
lint: ## Run linting checks
	@echo "$(BLUE)Running linting checks...$(RESET)"
	flake8 cli/ api/ --max-line-length=127
	pylint cli/ api/ --disable=C0103,R0903,W0613
	mypy cli/ api/ --ignore-missing-imports

format: ## Format code with black and isort
	@echo "$(BLUE)Formatting code...$(RESET)"
	black . --line-length=127
	isort . --profile=black

format-check: ## Check code formatting
	@echo "$(BLUE)Checking code formatting...$(RESET)"
	black --check --diff . --line-length=127
	isort --check-only --profile=black .

security: ## Run security checks
	@echo "$(BLUE)Running security checks...$(RESET)"
	bandit -r . -f json -o bandit-report.json
	safety check --json --output safety-report.json
	@echo "$(GREEN)Security reports generated: bandit-report.json, safety-report.json$(RESET)"

# Docker Development
build: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(RESET)"
	$(DOCKER_COMPOSE) build

run: ## Start all services
	@echo "$(BLUE)Starting services...$(RESET)"
	$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)Services started! API: http://localhost:8000$(RESET)"

run-dev: ## Start services in development mode
	@echo "$(BLUE)Starting development services...$(RESET)"
	$(DOCKER_COMPOSE) -f docker-compose.yml up -d
	@echo "$(GREEN)Development services started!$(RESET)"

stop: ## Stop all services
	@echo "$(BLUE)Stopping services...$(RESET)"
	$(DOCKER_COMPOSE) down

restart: ## Restart all services
	@echo "$(BLUE)Restarting services...$(RESET)"
	$(DOCKER_COMPOSE) down
	$(DOCKER_COMPOSE) up -d

logs: ## Show logs for all services
	$(DOCKER_COMPOSE) logs -f

logs-api: ## Show API service logs
	$(DOCKER_COMPOSE) logs -f api

logs-db: ## Show database logs
	$(DOCKER_COMPOSE) logs -f postgres

shell: ## Access shell in API container
	$(DOCKER_COMPOSE) exec api bash

shell-db: ## Access PostgreSQL shell
	$(DOCKER_COMPOSE) exec postgres psql -U techforge -d techforge_db

# Database
migrate: ## Run database migrations
	@echo "$(BLUE)Running database migrations...$(RESET)"
	$(DOCKER_COMPOSE) exec api python -m alembic upgrade head

migrate-create: ## Create new migration
	@echo "$(BLUE)Creating new migration...$(RESET)"
	@read -p "Migration name: " name; \
	$(DOCKER_COMPOSE) exec api python -m alembic revision --autogenerate -m "$$name"

migrate-downgrade: ## Downgrade database by one migration
	@echo "$(YELLOW)Downgrading database...$(RESET)"
	$(DOCKER_COMPOSE) exec api python -m alembic downgrade -1

seed-db: ## Seed database with sample data
	@echo "$(BLUE)Seeding database...$(RESET)"
	$(DOCKER_COMPOSE) exec api python api/seed.py

# Monitoring
health: ## Check service health
	@echo "$(BLUE)Checking service health...$(RESET)"
	@curl -s http://localhost:8000/health | python -m json.tool || echo "$(RED)API not responding$(RESET)"
	@curl -s http://localhost:9090/-/healthy || echo "$(RED)Prometheus not responding$(RESET)"

metrics: ## Show Prometheus metrics
	@curl -s http://localhost:8000/metrics

# Backup & Restore
backup: ## Backup database
	@echo "$(BLUE)Creating database backup...$(RESET)"
	mkdir -p backups
	$(DOCKER_COMPOSE) exec postgres pg_dump -U techforge -d techforge_db > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Backup created in backups/ directory$(RESET)"

restore: ## Restore database from backup
	@echo "$(YELLOW)Restoring database...$(RESET)"
	@read -p "Backup file path: " backup; \
	$(DOCKER_COMPOSE) exec -T postgres psql -U techforge -d techforge_db < $$backup

# Deployment
deploy-dev: ## Deploy to development environment
	@echo "$(BLUE)Deploying to development...$(RESET)"
	./deploy.sh development docker

deploy-staging: ## Deploy to staging environment
	@echo "$(BLUE)Deploying to staging...$(RESET)"
	./deploy.sh staging kubernetes

deploy-prod: ## Deploy to production environment
	@echo "$(YELLOW)Deploying to production...$(RESET)"
	@read -p "Are you sure you want to deploy to production? [y/N]: " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		./deploy.sh production kubernetes; \
	else \
		echo "Deployment cancelled"; \
	fi

rollback: ## Rollback deployment
	@echo "$(YELLOW)Rolling back deployment...$(RESET)"
	./deploy.sh rollback

# Package Management
package: ## Build Python package
	@echo "$(BLUE)Building Python package...$(RESET)"
	python setup.py sdist bdist_wheel
	@echo "$(GREEN)Package built in dist/ directory$(RESET)"

publish: ## Publish package to PyPI
	@echo "$(BLUE)Publishing package to PyPI...$(RESET)"
	twine upload dist/*

publish-test: ## Publish package to Test PyPI
	@echo "$(BLUE)Publishing package to Test PyPI...$(RESET)"
	twine upload --repository-url https://test.pypi.org/legacy/ dist/*

# Documentation
docs: ## Generate documentation
	@echo "$(BLUE)Generating documentation...$(RESET)"
	mkdocs build

docs-serve: ## Serve documentation locally
	@echo "$(BLUE)Serving documentation...$(RESET)"
	mkdocs serve

# CLI Testing
cli-test: ## Test CLI commands
	@echo "$(BLUE)Testing CLI commands...$(RESET)"
	python cli/techforge_enhanced.py --help
	python cli/techforge_enhanced.py --version

# Performance Testing
load-test: ## Run load tests
	@echo "$(BLUE)Running load tests...$(RESET)"
	@if command -v locust >/dev/null 2>&1; then \
		locust -f tests/load/locustfile.py --host=http://localhost:8000; \
	else \
		echo "$(RED)Locust not installed. Run: pip install locust$(RESET)"; \
	fi

# Quick commands
quick-start: clean install run migrate seed-db ## Quick start for new developers
	@echo "$(GREEN)🚀 TechForge AI Suite is ready!$(RESET)"
	@echo "$(GREEN)API: http://localhost:8000$(RESET)"
	@echo "$(GREEN)Docs: http://localhost:8000/api/docs$(RESET)"
	@echo "$(GREEN)Monitoring: http://localhost:3000 (admin/admin)$(RESET)"

ci: lint test security ## Run all CI checks locally
	@echo "$(GREEN)✅ All CI checks passed!$(RESET)"

# Status check
status: ## Show status of all services
	@echo "$(BLUE)Service Status:$(RESET)"
	@$(DOCKER_COMPOSE) ps
	@echo "\n$(BLUE)Disk Usage:$(RESET)"
	@docker system df
	@echo "\n$(BLUE)Network:$(RESET)"
	@docker network ls | grep techforge || echo "No TechForge networks found"