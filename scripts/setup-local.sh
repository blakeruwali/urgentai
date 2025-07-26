#!/bin/bash

# AI App Platform Local Setup Script (No Docker)
# This script sets up the development environment for local development

set -e

echo "🚀 Setting up AI App Platform (Local Development)..."

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
    "redhat.vscode-yaml"
  ]
}
EOF

    print_success "VS Code configuration created"
}

# Create basic package.json files for workspaces
create_workspace_packages() {
    print_status "Creating workspace package.json files..."
    
    # Frontend package.json
    cat > apps/frontend/package.json << EOF
{
  "name": "@ai-app-platform/frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
EOF

    # Backend package.json
    cat > apps/backend/package.json << EOF
{
  "name": "@ai-app-platform/backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint . --ext ts --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.18.2",
    "@types/express": "^4.17.21"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
EOF

    # Shared package.json
    cat > packages/shared/package.json << EOF
{
  "name": "@ai-app-platform/shared",
  "version": "1.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint . --ext ts --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
EOF

    print_success "Workspace package.json files created"
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
    echo "🤖 AI App Platform Local Setup"
    echo "============================================"
    echo ""
    
    check_node
    setup_env
    install_dependencies
    create_directories
    generate_jwt_secret
    setup_vscode
    create_workspace_packages
    verify_setup
    
    echo ""
    echo "============================================"
    print_success "Local setup completed successfully! 🎉"
    echo "============================================"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env file with your API keys"
    echo "2. Install database (PostgreSQL) and Redis manually"
    echo "3. Run 'npm run dev' to start development"
    echo ""
    echo "For full Docker setup, install Docker and run './scripts/setup.sh'"
    echo ""
    echo "Documentation:"
    echo "- README.md - Project overview"
    echo "- docs/DEVELOPMENT.md - Development guide"
    echo "- docs/ARCHITECTURE.md - Architecture overview"
    echo "- docs/API.md - API documentation"
    echo ""
    print_warning "Don't forget to add your API keys to the .env file!"
}

# Run main function
main "$@"