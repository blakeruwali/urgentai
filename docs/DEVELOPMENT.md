# Development Guide

## Prerequisites

Before starting development, ensure you have the following installed:

- **Node.js 18+**: [Download from nodejs.org](https://nodejs.org/)
- **Docker & Docker Compose**: [Install Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Git**: [Install Git](https://git-scm.com/downloads)
- **VS Code** (recommended): [Download VS Code](https://code.visualstudio.com/)

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd ai-app-platform

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env file with your API keys and configuration
```

### 2. Start Development Environment

```bash
# Start all services with Docker Compose
npm run docker:up

# Or start frontend and backend separately
npm run dev:frontend
npm run dev:backend
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Database Admin**: http://localhost:8080 (if pgAdmin is running)
- **Redis Admin**: http://localhost:8001 (if Redis Commander is running)
- **MinIO Console**: http://localhost:9001 (username: minioadmin, password: minioadmin)

## Project Structure

```
ai-app-platform/
├── apps/
│   ├── frontend/          # React frontend
│   └── backend/           # Node.js API
├── packages/
│   ├── shared/            # Shared utilities and types
│   ├── ui/                # Shared UI components
│   └── ai-engine/         # AI processing logic
├── docker/                # Docker configurations
├── docs/                  # Documentation
├── scripts/               # Build and deployment scripts
└── tests/                 # Test files
```

## Development Workflow

### 1. Feature Development

```bash
# Create a new feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... code changes ...

# Run tests
npm run test

# Check linting
npm run lint

# Commit your changes
git add .
git commit -m "feat: add your feature description"

# Push to remote
git push origin feature/your-feature-name
```

### 2. Code Quality

We use several tools to maintain code quality:

- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **Jest**: Unit testing
- **Cypress**: E2E testing

```bash
# Run all quality checks
npm run lint
npm run type-check
npm run test
npm run test:e2e
```

### 3. Git Hooks

Pre-commit hooks automatically run:
- Code formatting (Prettier)
- Linting (ESLint)
- Type checking (TypeScript)
- Unit tests

## Environment Configuration

### Required Environment Variables

#### AI Services
```env
OPENAI_API_KEY=sk-your_key_here
ANTHROPIC_API_KEY=your_key_here
```

#### Database
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_app_platform
REDIS_URL=redis://localhost:6379
```

#### Authentication
```env
JWT_SECRET=your_super_secure_secret
```

### Optional Services

#### File Storage (choose one)
```env
# AWS S3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=your_bucket

# Or Cloudflare R2
R2_ACCESS_KEY_ID=your_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET_NAME=your_bucket
```

## Database Management

### Running Migrations

```bash
# Generate a new migration
npm run db:migrate:create --name=your_migration_name

# Run pending migrations
npm run db:migrate

# Reset database (development only)
npm run db:reset

# Seed database with sample data
npm run db:seed
```

### Database Schema

The database uses PostgreSQL with the following main tables:
- `users`: User accounts and profiles
- `projects`: User projects and metadata
- `conversations`: Chat conversations
- `messages`: Individual chat messages
- `project_files`: Project file storage
- `deployments`: Deployment history

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests

```bash
# Run API integration tests
npm run test:integration

# Run specific test file
npm run test -- --testNamePattern="ConversationService"
```

### End-to-End Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests in headed mode
npm run test:e2e:headed
```

## Debugging

### Backend Debugging

1. Use VS Code debugger with the provided launch configuration
2. Set breakpoints in your code
3. Start debugging with F5

### Frontend Debugging

1. Use React Developer Tools browser extension
2. Use browser's built-in developer tools
3. Enable Redux DevTools for state debugging

### Database Debugging

```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/ai_app_platform

# Connect to Redis
redis-cli -h localhost -p 6379
```

## Performance Optimization

### Frontend Performance

- Use React.memo for component optimization
- Implement proper key props for lists
- Use lazy loading for routes and components
- Optimize bundle size with code splitting

### Backend Performance

- Use database connection pooling
- Implement caching with Redis
- Use proper database indexes
- Monitor API response times

### AI Performance

- Cache common code generation requests
- Use streaming responses for long operations
- Implement request queuing for rate limiting
- Monitor token usage and costs

## Deployment

### Development Deployment

```bash
# Build and deploy to staging
npm run deploy:staging
```

### Production Deployment

```bash
# Build and deploy to production
npm run deploy:production
```

## Troubleshooting

### Common Issues

#### Docker Issues
```bash
# Reset Docker environment
npm run docker:down
docker system prune -a
npm run docker:up
```

#### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart database
docker-compose restart postgres
```

#### Node.js Module Issues
```bash
# Clear node_modules and reinstall
npm run clean
npm install
```

### Getting Help

1. Check the [Architecture Documentation](./ARCHITECTURE.md)
2. Review existing [GitHub Issues](https://github.com/your-repo/issues)
3. Join our [Discord Community](https://discord.gg/your-discord)
4. Contact the development team

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style Guidelines

- Use TypeScript for all new code
- Follow existing naming conventions
- Write comprehensive tests
- Document complex logic with comments
- Use meaningful commit messages

### Pull Request Process

1. Ensure your code passes all checks
2. Update documentation if needed
3. Add or update tests
4. Request review from maintainers
5. Address any feedback
6. Merge when approved

---

For more detailed information, check out our other documentation files:
- [Architecture Overview](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)