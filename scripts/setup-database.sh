#!/bin/bash

# Database Setup Script for AI App Platform
# This script sets up a local PostgreSQL database using Docker

set -e

echo "🗃️  Setting up database for AI App Platform..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Create .env file if it doesn't exist
if [ ! -f "apps/backend/.env" ]; then
    echo "📝 Creating .env file..."
    cat > apps/backend/.env << EOF
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
EOF
    echo "✅ Created apps/backend/.env file"
    echo "⚠️  Please update ANTHROPIC_API_KEY in apps/backend/.env"
else
    echo "✅ .env file already exists"
fi

# Create docker-compose.yml if it doesn't exist
if [ ! -f "docker-compose.yml" ]; then
    echo "📝 Creating docker-compose.yml..."
    cat > docker-compose.yml << EOF
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
EOF
    echo "✅ Created docker-compose.yml"
else
    echo "✅ docker-compose.yml already exists"
fi

# Start PostgreSQL
echo "🚀 Starting PostgreSQL database..."
docker compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Test connection
echo "🔗 Testing database connection..."
if docker compose exec postgres pg_isready -U postgres; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready. Please check the logs:"
    echo "   docker compose logs postgres"
    exit 1
fi

# Navigate to backend directory
cd apps/backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🔄 Running database migrations..."
npx prisma db push

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "📋 Database Information:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: urgentai"
echo "   Username: postgres"
echo "   Password: password"
echo ""
echo "🔗 Connection URL:"
echo "   postgresql://postgres:password@localhost:5432/urgentai"
echo ""
echo "🚀 Next steps:"
echo "   1. Update ANTHROPIC_API_KEY in apps/backend/.env"
echo "   2. Start the backend: cd apps/backend && npm run dev"
echo "   3. Start the frontend: cd apps/frontend && npm run dev"
echo ""
echo "🎯 Optional: Access pgAdmin at http://localhost:5050"
echo "   Email: admin@urgentai.dev"
echo "   Password: admin"
echo ""
echo "✅ Ready to go!" 