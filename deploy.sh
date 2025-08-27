#!/bin/bash

# TechForge AI Agent Suite - Production Deployment Script
# Supports multiple deployment targets and environments

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="techforge-ai-suite"
VERSION=${VERSION:-"2.0.0"}
ENVIRONMENT=${1:-production}
DEPLOYMENT_TARGET=${2:-docker}

# Functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   TechForge AI Agent Suite Deployment${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    print_success "Docker found"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    print_success "Docker Compose found"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed"
        exit 1
    fi
    print_success "Python 3 found"
    
    # Check environment file
    if [ "$ENVIRONMENT" = "production" ]; then
        if [ ! -f ".env.production" ]; then
            print_error ".env.production file not found"
            print_info "Please copy .env.example to .env.production and configure it"
            exit 1
        fi
    else
        if [ ! -f ".env" ]; then
            print_warning ".env file not found, creating from .env.example"
            cp .env.example .env
        fi
    fi
    print_success "Environment configuration found"
    
    echo ""
}

build_docker_images() {
    echo -e "${BLUE}Building Docker images...${NC}"
    
    # Build main application image
    docker build -t ${PROJECT_NAME}:${VERSION} .
    print_success "Built ${PROJECT_NAME}:${VERSION}"
    
    # Tag as latest
    docker tag ${PROJECT_NAME}:${VERSION} ${PROJECT_NAME}:latest
    print_success "Tagged as latest"
    
    echo ""
}

run_database_migrations() {
    echo -e "${BLUE}Running database migrations...${NC}"
    
    # Start only database services
    docker-compose up -d postgres redis
    
    # Wait for database to be ready
    sleep 5
    
    # Run migrations
    docker-compose run --rm api python -m alembic upgrade head
    print_success "Database migrations completed"
    
    echo ""
}

deploy_docker() {
    echo -e "${BLUE}Deploying with Docker Compose...${NC}"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        # Production deployment
        docker-compose -f docker-compose.prod.yml up -d
        print_success "Production services started"
    else
        # Development deployment
        docker-compose up -d
        print_success "Development services started"
    fi
    
    # Wait for services to be healthy
    echo "Waiting for services to be healthy..."
    sleep 10
    
    # Check health
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        print_success "API is healthy"
    else
        print_warning "API health check failed"
    fi
    
    echo ""
}

deploy_kubernetes() {
    echo -e "${BLUE}Deploying to Kubernetes...${NC}"
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi
    
    # Apply Kubernetes manifests
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/secret.yaml
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/service.yaml
    kubectl apply -f k8s/ingress.yaml
    
    print_success "Kubernetes resources deployed"
    
    # Wait for deployment
    kubectl rollout status deployment/${PROJECT_NAME} -n techforge
    
    echo ""
}

deploy_aws() {
    echo -e "${BLUE}Deploying to AWS...${NC}"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Build and push to ECR
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=${AWS_REGION:-us-west-2}
    ECR_REPOSITORY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}"
    
    # Login to ECR
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPOSITORY}
    
    # Tag and push image
    docker tag ${PROJECT_NAME}:${VERSION} ${ECR_REPOSITORY}:${VERSION}
    docker push ${ECR_REPOSITORY}:${VERSION}
    
    print_success "Image pushed to ECR"
    
    # Deploy with ECS or EKS
    # Add your AWS deployment commands here
    
    echo ""
}

deploy_gcp() {
    echo -e "${BLUE}Deploying to Google Cloud Platform...${NC}"
    
    # Check gcloud CLI
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed"
        exit 1
    fi
    
    # Configure project
    GCP_PROJECT=${GCP_PROJECT:-techforge-ai}
    GCP_REGION=${GCP_REGION:-us-central1}
    
    # Build and push to Container Registry
    gcloud builds submit --tag gcr.io/${GCP_PROJECT}/${PROJECT_NAME}:${VERSION}
    
    print_success "Image pushed to GCR"
    
    # Deploy to Cloud Run
    gcloud run deploy ${PROJECT_NAME} \
        --image gcr.io/${GCP_PROJECT}/${PROJECT_NAME}:${VERSION} \
        --platform managed \
        --region ${GCP_REGION} \
        --allow-unauthenticated
    
    print_success "Deployed to Cloud Run"
    
    echo ""
}

run_tests() {
    echo -e "${BLUE}Running tests...${NC}"
    
    # Run unit tests
    docker-compose run --rm api pytest tests/unit -v
    print_success "Unit tests passed"
    
    # Run integration tests
    docker-compose run --rm api pytest tests/integration -v
    print_success "Integration tests passed"
    
    # Run API tests
    docker-compose run --rm api pytest tests/api -v
    print_success "API tests passed"
    
    echo ""
}

show_status() {
    echo -e "${BLUE}Deployment Status${NC}"
    echo "===================="
    
    # Show running containers
    docker-compose ps
    
    echo ""
    echo -e "${BLUE}Service URLs:${NC}"
    echo "API: http://localhost:8000"
    echo "API Docs: http://localhost:8000/api/docs"
    echo "Prometheus: http://localhost:9090"
    echo "Grafana: http://localhost:3000"
    echo "Flower: http://localhost:5555"
    
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "View logs: docker-compose logs -f api"
    echo "Shell access: docker-compose exec api bash"
    echo "Stop services: docker-compose down"
    echo "Clean up: docker-compose down -v"
    
    echo ""
}

rollback() {
    echo -e "${YELLOW}Rolling back deployment...${NC}"
    
    # Rollback Docker deployment
    docker-compose down
    
    # Restore previous version
    PREVIOUS_VERSION=${PREVIOUS_VERSION:-"1.9.0"}
    docker tag ${PROJECT_NAME}:${PREVIOUS_VERSION} ${PROJECT_NAME}:latest
    docker-compose up -d
    
    print_success "Rolled back to version ${PREVIOUS_VERSION}"
    
    echo ""
}

# Main execution
main() {
    print_header
    
    print_info "Environment: ${ENVIRONMENT}"
    print_info "Deployment Target: ${DEPLOYMENT_TARGET}"
    print_info "Version: ${VERSION}"
    echo ""
    
    check_prerequisites
    
    case $DEPLOYMENT_TARGET in
        docker)
            build_docker_images
            run_database_migrations
            deploy_docker
            ;;
        kubernetes|k8s)
            build_docker_images
            deploy_kubernetes
            ;;
        aws)
            build_docker_images
            deploy_aws
            ;;
        gcp)
            deploy_gcp
            ;;
        test)
            build_docker_images
            run_tests
            ;;
        rollback)
            rollback
            ;;
        *)
            print_error "Unknown deployment target: $DEPLOYMENT_TARGET"
            print_info "Available targets: docker, kubernetes, aws, gcp, test, rollback"
            exit 1
            ;;
    esac
    
    show_status
    
    print_success "Deployment completed successfully!"
}

# Run main function
main