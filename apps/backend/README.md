# UrgentAI Backend

A robust Node.js backend service for AI-powered chat applications with OpenAI integration and PostgreSQL database.

## Features

- 🤖 **OpenAI Integration**: Complete service with chat completions, embeddings, and streaming support
- 🗄️ **PostgreSQL Database**: Comprehensive schema with Prisma ORM for users, conversations, messages, and usage tracking
- 🔐 **Authentication Ready**: User management with bcrypt password hashing
- 📊 **Usage Tracking**: Monitor token usage and costs per user
- 🧪 **Comprehensive Testing**: Unit and integration tests with Vitest
- 📝 **Logging**: Winston logger with environment-based configuration
- 🛡️ **Error Handling**: Custom error classes and centralized error handling
- 🔄 **Type Safety**: Full TypeScript support with Zod validation

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- OpenAI API key

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   cd apps/backend
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and OpenAI API key
   ```

3. **Set up the database:**
   ```bash
   # Make sure PostgreSQL is running
   ./scripts/setup-db.sh
   ```

   Or manually:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npm run prisma:seed
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment mode | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_MODEL` | Default model to use | `gpt-4-turbo-preview` |
| `OPENAI_MAX_TOKENS` | Default max tokens | `1000` |
| `OPENAI_TEMPERATURE` | Default temperature | `0.7` |
| `CORS_ORIGIN` | CORS allowed origin | `http://localhost:5173` |
| `LOG_LEVEL` | Logging level | `info` |

## Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start            # Start production server

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:seed      # Seed database with sample data

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

## Project Structure

```
apps/backend/
├── prisma/
│   └── schema.prisma        # Database schema
├── src/
│   ├── __tests__/           # Test files
│   │   ├── services/        # Service unit tests
│   │   ├── database/        # Database integration tests
│   │   └── integration/     # API integration tests
│   ├── config/
│   │   └── env.ts           # Environment configuration
│   ├── database/
│   │   ├── client.ts        # Prisma client wrapper
│   │   ├── seed.ts          # Database seeding
│   │   └── repositories/    # Data access layer
│   ├── services/
│   │   └── openai.service.ts # OpenAI service
│   ├── utils/
│   │   ├── errors.ts        # Custom error classes
│   │   └── logger.ts        # Winston logger
│   └── index.ts             # Server entry point
└── scripts/
    └── setup-db.sh          # Database setup script
```

## API Endpoints

### Health Check
```http
GET /health
```
Returns server and service health status.

### API Information
```http
GET /api
```
Returns available API endpoints.

## Services

### OpenAI Service

The OpenAI service provides:

- **Chat Completions**: Generate AI responses with customizable parameters
- **Streaming**: Real-time streaming responses for better UX
- **Embeddings**: Generate text embeddings for semantic search
- **Token Estimation**: Estimate token usage before making requests
- **Model Management**: List and select available models
- **Error Handling**: Comprehensive error handling with retries

Example usage:
```typescript
import { openAIService } from './services/openai.service';

// Create a chat completion
const response = await openAIService.createChatCompletion([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' }
], {
  temperature: 0.7,
  maxTokens: 1000
});

// Create embeddings
const embeddings = await openAIService.createEmbedding('Text to embed');
```

### Database Operations

User repository example:
```typescript
import { userRepository } from './database/repositories/user.repository';

// Create user
const user = await userRepository.create({
  email: 'user@example.com',
  password: 'securepassword',
  name: 'John Doe'
});

// Find user
const found = await userRepository.findByEmail('user@example.com');

// Get user statistics
const stats = await userRepository.getUserStats(userId);
```

## Testing

### Run Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test openai.service.test.ts

# Run with coverage
npm test -- --coverage
```

### Test Structure
- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test database operations with real database
- **API Tests**: Test API endpoints (coming soon)

## Database Schema

Key models:
- **User**: User accounts with roles and authentication
- **Conversation**: Chat conversations with settings
- **Message**: Individual messages with token tracking
- **UsageRecord**: Track API usage and costs
- **ApiKey**: API keys for external integrations

## Error Handling

Custom error classes:
- `AppError`: Base application error
- `ValidationError`: Input validation errors
- `NotFoundError`: Resource not found
- `UnauthorizedError`: Authentication errors
- `OpenAIError`: OpenAI API errors
- `DatabaseError`: Database operation errors

## Security Considerations

- Passwords are hashed with bcrypt
- Environment variables for sensitive data
- CORS configuration for frontend access
- API key validation
- Input validation with Zod

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set production environment variables
3. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

4. Start the server:
   ```bash
   npm start
   ```

## Contributing

1. Create a feature branch
2. Write tests for new features
3. Ensure all tests pass
4. Run linting and type checking
5. Submit a pull request

## License

Private - All rights reserved