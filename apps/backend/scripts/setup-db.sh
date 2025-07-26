#!/bin/bash

# Database setup script for local development
echo "🚀 Setting up database for UrgentAI backend..."

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo "📝 Creating .env file from example..."
  cp .env.example .env
  echo "⚠️  Please update .env with your database credentials and OpenAI API key"
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "📊 Running database migrations..."
npx prisma migrate dev --name init

# Run seed data
echo "🌱 Seeding database..."
npm run prisma:seed

echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure PostgreSQL is running"
echo "2. Update .env with your Anthropic API key"
echo "3. Run 'npm run dev' to start the server"