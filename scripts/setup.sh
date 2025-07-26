#!/bin/bash

# AI App Platform Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up AI App Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | sed 's/v//')
    REQUIRED_VERSION="18.0.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        print_error "Node.js version $NODE_VERSION is not supported. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    print_success "Node.js $NODE_VERSION is installed"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker from https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    print_success "Docker is installed and running"
}

# Check if Docker Compose is installed
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose from https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    print_success "Docker Compose is installed"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
}

# Setup environment variables
setup_env() {
    print_status "Setting up environment variables..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env file from .env.example"
            print_warning "Please edit .env file with your API keys and configuration"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    else
        print_warning ".env file already exists, skipping creation"
    fi
}

# Create directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p apps/frontend/src/{components,pages,hooks,stores,services,utils}
    mkdir -p apps/backend/src/{controllers,services,models,middleware,routes,utils}
    mkdir -p apps/backend/prisma
    mkdir -p packages/shared/src
    mkdir -p packages/ui/src
    mkdir -p packages/ai-engine/src
    mkdir -p docker/{backend,frontend,sandbox,nginx,postgres,prometheus,grafana}
    mkdir -p tests/{unit,integration,e2e}
    mkdir -p uploads
    mkdir -p logs
    
    print_success "Directories created"
}

# Generate JWT secret
generate_jwt_secret() {
    print_status "Generating JWT secret..."
    
    if [ -f ".env" ]; then
        if ! grep -q "JWT_SECRET=" .env || grep -q "JWT_SECRET=your_super_secure_jwt_secret_here_make_it_long_and_random" .env; then
            JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
            if command -v sed &> /dev/null; then
                sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
                rm .env.bak
                print_success "JWT secret generated and added to .env"
            else
                print_warning "Could not automatically update JWT_SECRET. Please update it manually in .env"
            fi
        else
            print_warning "JWT_SECRET already set in .env"
        fi
    fi
}

# Setup Git hooks
setup_git_hooks() {
    print_status "Setting up Git hooks..."
    
    if [ -d ".git" ]; then
        if command -v npx &> /dev/null; then
            npx husky install
            npx husky add .husky/pre-commit "npm run lint && npm run type-check"
            npx husky add .husky/commit-msg "npx commitlint --edit \$1"
            print_success "Git hooks setup completed"
        else
            print_warning "Husky not available, skipping Git hooks setup"
        fi
    else
        print_warning "Not a Git repository, skipping Git hooks setup"
    fi
}

# Create VS Code configuration
setup_vscode() {
    print_status "Setting up VS Code configuration..."
    
    mkdir -p .vscode
    
    cat > .vscode/settings.json << EOF
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true
  }
}
EOF

    cat > .vscode/extensions.json << EOF
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-docker"
  ]
}
EOF

    print_success "VS Code configuration created"
}

# Verify setup
verify_setup() {
    print_status "Verifying setup..."
    
    if [ -f "package.json" ] && [ -f ".env" ] && [ -d "apps" ] && [ -d "packages" ]; then
        print_success "Setup verification passed"
    else
        print_error "Setup verification failed"
        exit 1
    fi
}

# Main setup function
main() {
    echo "============================================"
    echo "🤖 AI App Platform Setup"
    echo "============================================"
    echo ""
    
    check_node
    check_docker
    check_docker_compose
    setup_env
    install_dependencies
    create_directories
    generate_jwt_secret
    setup_git_hooks
    setup_vscode
    verify_setup
    
    echo ""
    echo "============================================"
    print_success "Setup completed successfully! 🎉"
    echo "============================================"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env file with your API keys"
    echo "2. Run 'npm run docker:up' to start services"
    echo "3. Run 'npm run dev' to start development"
    echo ""
    echo "Documentation:"
    echo "- README.md - Project overview"
    echo "- docs/DEVELOPMENT.md - Development guide"
    echo "- docs/ARCHITECTURE.md - Architecture overview"
    echo ""
    print_warning "Don't forget to add your API keys to the .env file!"
}

# Run main function
main "$@"