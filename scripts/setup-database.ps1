# Database Setup Script for AI App Platform (Windows PowerShell)
# This script sets up a local PostgreSQL database using Docker

param(
    [switch]$SkipEnvCheck
)

$ErrorActionPreference = "Stop"

Write-Host "🗃️  Setting up database for AI App Platform..." -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
$envPath = "apps/backend/.env"
if (-not (Test-Path $envPath)) {
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    
    $envContent = @"
# Environment variables for AI App Platform Backend

# Anthropic API Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/urgentai?schema=public"

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
"@
    
    $envContent | Out-File -FilePath $envPath -Encoding UTF8
    Write-Host "✅ Created apps/backend/.env file" -ForegroundColor Green
    Write-Host "⚠️  Please update ANTHROPIC_API_KEY in apps/backend/.env" -ForegroundColor Yellow
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Create docker-compose.yml if it doesn't exist
$dockerComposePath = "docker-compose.yml"
if (-not (Test-Path $dockerComposePath)) {
    Write-Host "📝 Creating docker-compose.yml..." -ForegroundColor Yellow
    
    $dockerComposeContent = @"
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: urgentai-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: urgentai
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  # Optional: pgAdmin for database management
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: urgentai-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@urgentai.dev
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    restart: unless-stopped
    depends_on:
      - postgres

volumes:
  postgres_data:
  pgadmin_data:
"@
    
    $dockerComposeContent | Out-File -FilePath $dockerComposePath -Encoding UTF8
    Write-Host "✅ Created docker-compose.yml" -ForegroundColor Green
} else {
    Write-Host "✅ docker-compose.yml already exists" -ForegroundColor Green
}

# Start PostgreSQL
Write-Host "🚀 Starting PostgreSQL database..." -ForegroundColor Blue
docker compose up -d postgres

# Wait for PostgreSQL to be ready
Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test connection
Write-Host "🔗 Testing database connection..." -ForegroundColor Blue
try {
    docker compose exec postgres pg_isready -U postgres | Out-Null
    Write-Host "✅ PostgreSQL is ready" -ForegroundColor Green
} catch {
    Write-Host "❌ PostgreSQL is not ready. Please check the logs:" -ForegroundColor Red
    Write-Host "   docker compose logs postgres" -ForegroundColor Yellow
    exit 1
}

# Navigate to backend directory
Set-Location "apps/backend"

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Blue
    npm install
}

# Generate Prisma client
Write-Host "🔧 Generating Prisma client..." -ForegroundColor Blue
npx prisma generate

# Run database migrations
Write-Host "🔄 Running database migrations..." -ForegroundColor Blue
npx prisma db push

Write-Host ""
Write-Host "🎉 Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Database Information:" -ForegroundColor Cyan
Write-Host "   Host: localhost"
Write-Host "   Port: 5432"
Write-Host "   Database: urgentai"
Write-Host "   Username: postgres"
Write-Host "   Password: password"
Write-Host ""
Write-Host "🔗 Connection URL:" -ForegroundColor Cyan
Write-Host "   postgresql://postgres:password@localhost:5432/urgentai"
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Update ANTHROPIC_API_KEY in apps/backend/.env"
Write-Host "   2. Start the backend: cd apps/backend && npm run dev"
Write-Host "   3. Start the frontend: cd apps/frontend && npm run dev"
Write-Host ""
Write-Host "🎯 Optional: Access pgAdmin at http://localhost:5050" -ForegroundColor Cyan
Write-Host "   Email: admin@urgentai.dev"
Write-Host "   Password: admin"
Write-Host ""
Write-Host "✅ Ready to go!" -ForegroundColor Green 