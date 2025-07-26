# API Documentation

## Overview

The AI App Platform API provides endpoints for managing conversations, projects, code generation, and deployments. All endpoints use JSON for request and response bodies and follow RESTful conventions.

## Base URL

- **Development**: `http://localhost:3001/api`
- **Staging**: `https://staging-api.ai-app-platform.com/api`
- **Production**: `https://api.ai-app-platform.com/api`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Authentication Endpoints

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "token": "jwt-token-here"
}
```

#### POST /auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token-here"
}
```

## User Management

#### GET /users/profile
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "subscriptionTier": "free",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### PUT /users/profile
Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

## Project Management

#### GET /projects
List user's projects.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search query

**Response:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "My Todo App",
      "description": "A simple todo application",
      "framework": "react",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

#### POST /projects
Create a new project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "My New App",
  "description": "Description of the app",
  "framework": "react",
  "template": "blank"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "My New App",
  "description": "Description of the app",
  "framework": "react",
  "template": "blank",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /projects/:id
Get project details.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "uuid",
  "name": "My Todo App",
  "description": "A simple todo application",
  "framework": "react",
  "status": "active",
  "files": [
    {
      "path": "src/App.tsx",
      "type": "file",
      "size": 1024,
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### PUT /projects/:id
Update project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated App Name",
  "description": "Updated description"
}
```

#### DELETE /projects/:id
Delete project.

**Headers:** `Authorization: Bearer <token>`

**Response:** `204 No Content`

## File Management

#### GET /projects/:id/files
List project files.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "files": [
    {
      "path": "src/App.tsx",
      "type": "file",
      "size": 1024,
      "content": "import React from 'react'...",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### GET /projects/:id/files/*
Get specific file content.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "path": "src/App.tsx",
  "content": "import React from 'react'...",
  "type": "typescript",
  "size": 1024,
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### PUT /projects/:id/files/*
Update file content.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "import React from 'react'..."
}
```

## Conversation Management

#### GET /conversations
List user's conversations.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `projectId` (optional): Filter by project ID
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "title": "Building a todo app",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "lastMessage": {
        "role": "assistant",
        "content": "I've created your todo app...",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    }
  ]
}
```

#### POST /conversations
Create a new conversation.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "projectId": "uuid",
  "title": "Building a todo app"
}
```

#### GET /conversations/:id
Get conversation details with messages.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "title": "Building a todo app",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Create a todo app with React",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "I'll create a todo app for you...",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /conversations/:id/messages
Send a message in a conversation.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Add a dark mode toggle to the app"
}
```

**Response:**
```json
{
  "id": "uuid",
  "role": "user",
  "content": "Add a dark mode toggle to the app",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

## Code Generation

#### POST /generate/component
Generate a React component.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "prompt": "Create a responsive navigation component",
  "projectId": "uuid",
  "context": {
    "framework": "react",
    "styling": "tailwind",
    "typescript": true
  }
}
```

**Response:**
```json
{
  "code": "import React from 'react'...",
  "filename": "Navigation.tsx",
  "explanation": "This component creates a responsive navigation...",
  "dependencies": ["react", "@headlessui/react"]
}
```

#### POST /generate/page
Generate a complete page.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "prompt": "Create a login page with form validation",
  "projectId": "uuid",
  "context": {
    "framework": "react",
    "styling": "tailwind",
    "typescript": true
  }
}
```

#### POST /generate/api
Generate API endpoints.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "prompt": "Create CRUD endpoints for user management",
  "projectId": "uuid",
  "context": {
    "framework": "express",
    "database": "postgresql",
    "typescript": true
  }
}
```

## Deployment

#### GET /projects/:id/deployments
List project deployments.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "deployments": [
    {
      "id": "uuid",
      "url": "https://my-app-xyz.vercel.app",
      "status": "success",
      "provider": "vercel",
      "deployedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /projects/:id/deploy
Deploy project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "provider": "vercel",
  "environment": "production"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "pending",
  "provider": "vercel",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /deployments/:id/status
Get deployment status.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "uuid",
  "status": "success",
  "url": "https://my-app-xyz.vercel.app",
  "logs": "Building application...\nDeployment successful!",
  "deployedAt": "2024-01-01T00:00:00Z"
}
```

## WebSocket Events

The API supports real-time communication via WebSocket connections at `/ws`.

### Client to Server Events

#### `join_project`
Join a project room for real-time updates.
```json
{
  "event": "join_project",
  "data": {
    "projectId": "uuid"
  }
}
```

#### `message_send`
Send a message in a conversation.
```json
{
  "event": "message_send",
  "data": {
    "conversationId": "uuid",
    "content": "Create a button component"
  }
}
```

### Server to Client Events

#### `message_response`
AI response to user message.
```json
{
  "event": "message_response",
  "data": {
    "conversationId": "uuid",
    "message": {
      "id": "uuid",
      "role": "assistant",
      "content": "I'll create a button component for you...",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

#### `code_generated`
New code has been generated.
```json
{
  "event": "code_generated",
  "data": {
    "projectId": "uuid",
    "files": [
      {
        "path": "src/components/Button.tsx",
        "content": "import React from 'react'..."
      }
    ]
  }
}
```

#### `project_updated`
Project files have been updated.
```json
{
  "event": "project_updated",
  "data": {
    "projectId": "uuid",
    "changes": [
      {
        "type": "file_created",
        "path": "src/components/Button.tsx"
      }
    ]
  }
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  }
}
```

### Common Error Codes

- `UNAUTHORIZED`: Invalid or missing authentication token
- `FORBIDDEN`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid request data
- `NOT_FOUND`: Resource not found
- `RATE_LIMITED`: Too many requests
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API requests are rate limited based on subscription tier:

- **Free Tier**: 100 requests per hour
- **Pro Tier**: 1000 requests per hour
- **Enterprise Tier**: Unlimited

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Webhooks

The platform supports webhooks for external integrations.

#### POST /webhooks/github
GitHub webhook for repository events.

#### POST /webhooks/vercel
Vercel webhook for deployment events.

---

For more information, see the [Development Guide](./DEVELOPMENT.md) and [Architecture Documentation](./ARCHITECTURE.md).