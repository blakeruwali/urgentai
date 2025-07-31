# AI App Platform API Documentation

## 🚀 Database-First Voice/Text-to-App Platform API

This API provides **revolutionary voice/text-to-app creation capabilities** with database-first project storage, multi-user support, and Claude-powered code generation.

## Base URL
```
http://localhost:3001/api
```

## Authentication
Currently using `default-user` for single-user development. Multi-user authentication ready for implementation.

---

## 🗣️ Voice/Text-to-App Creation Endpoints

### Create Project from Natural Language Description
**`POST /projects/create-from-description`**

Transform natural language descriptions into complete applications stored in the database.

**Request Body:**
```json
{
  "description": "Create a modern todo app with dark mode and user authentication",
  "projectName": "MyAwesomeTodoApp",
  "userId": "default-user"
}
```

**Response:**
```json
{
  "success": true,
  "project": {
    "id": "cmdqwghc400017k1or1bet0bd",
    "name": "MyAwesomeTodoApp",
    "description": "Create a modern todo app with dark mode and user authentication",
    "type": "REACT",
    "templateId": "react-todo",
    "fileCount": 6,
    "status": "READY",
    "createdAt": "2025-01-31T04:33:22.125Z"
  },
  "message": "Project created successfully in database with 6 files",
  "storage": "database"
}
```

### Create Project from Template
**`POST /projects`**

Create a project using a specific template with customizations.

**Request Body:**
```json
{
  "templateId": "react-todo",
  "projectName": "TaskManager",
  "customizations": {
    "primaryColor": "blue",
    "darkMode": true
  },
  "userId": "default-user"
}
```

---

## 🗂️ Project Management Endpoints

### List User Projects
**`GET /projects?userId=default-user`**

Get all projects for a user from the database.

**Response:**
```json
{
  "success": true,
  "projects": [
    {
      "id": "cmdqwghc400017k1or1bet0bd",
      "name": "MyAwesomeTodoApp",
      "description": "Modern todo application",
      "type": "REACT",
      "status": "READY",
      "fileCount": 6,
      "createdAt": "2025-01-31T04:33:22.125Z",
      "updatedAt": "2025-01-31T04:33:22.125Z"
    }
  ],
  "storage": "database"
}
```

### Get Project Details
**`GET /projects/:projectId`**

Retrieve complete project details including all files from the database.

**Response:**
```json
{
  "success": true,
  "project": {
    "id": "cmdqwghc400017k1or1bet0bd",
    "name": "MyAwesomeTodoApp",
    "type": "REACT",
    "status": "READY",
    "files": [
      {
        "id": "file123",
        "path": "src/App.tsx",
        "content": "import React from 'react';\n\nfunction App() {\n  return <div>Todo App</div>;\n}",
        "type": "CODE",
        "size": 89,
        "createdAt": "2025-01-31T04:33:22.125Z"
      }
    ]
  },
  "storage": "database"
}
```

---

## 📝 File Management Endpoints

### Update File with Claude
**`PUT /projects/:projectId/files`**

Update a file using natural language instructions powered by Claude.

**Request Body:**
```json
{
  "filePath": "src/App.tsx",
  "instruction": "Add a dark mode toggle button to the header",
  "currentContent": "existing file content..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "File updated successfully in database",
  "file": {
    "id": "file123",
    "path": "src/App.tsx",
    "content": "// Updated content with dark mode toggle...",
    "type": "CODE",
    "size": 156,
    "updatedAt": "2025-01-31T04:35:10.000Z"
  },
  "storage": "database"
}
```

### Add New File with Claude
**`POST /projects/:projectId/files`**

Generate and add a new file using natural language instructions.

**Request Body:**
```json
{
  "filePath": "src/components/DarkModeToggle.tsx",
  "instruction": "Create a reusable dark mode toggle component with icons"
}
```

---

## 🎯 Template Management Endpoints

### Get Available Templates
**`GET /templates`**

List all available project templates.

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "id": "react-todo",
      "name": "React Todo App",
      "description": "Modern todo application with TypeScript and Tailwind CSS",
      "type": "REACT"
    },
    {
      "id": "react-landing",
      "name": "React Landing Page",
      "description": "Professional landing page template",
      "type": "REACT"
    }
  ]
}
```

---

## 👀 Preview & Export Endpoints

### Generate Preview Files
**`POST /projects/:projectId/preview`**

Generate temporary files for live preview from database storage.

**Response:**
```json
{
  "success": true,
  "message": "Preview files generated",
  "outputPath": "./temp-preview/cmdqwghc400017k1or1bet0bd-1643637845000",
  "fileCount": 6,
  "storage": "database -> temporary files"
}
```

### Export Project
**`GET /projects/:projectId/export`**

Export project as downloadable zip file.

**Response:**
```json
{
  "success": true,
  "message": "Export feature coming soon",
  "project": {
    "id": "cmdqwghc400017k1or1bet0bd",
    "name": "MyAwesomeTodoApp",
    "fileCount": 6
  },
  "note": "Will generate downloadable zip file"
}
```

---

## 💬 Chat & Conversation Endpoints

### Send Message to Claude
**`POST /chat/send`**

Send a message to Claude with conversation context.

**Request Body:**
```json
{
  "conversationId": "conv_123",
  "message": "Help me create a user authentication system",
  "options": {
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

### Stream Claude Response
**`POST /chat/stream`**

Get real-time streaming response from Claude.

**Request Body:**
```json
{
  "conversationId": "conv_123",
  "message": "Explain how React hooks work",
  "stream": true
}
```

### Create Conversation
**`POST /conversations`**

Create a new conversation for chat context.

**Request Body:**
```json
{
  "title": "React Development Help",
  "userId": "default-user",
  "model": "claude-3-opus-20240229"
}
```

---

## 🔍 Health & Status Endpoints

### Health Check
**`GET /health`**

Check API health and configuration status.

**Response:**
```json
{
  "status": "healthy",
  "service": "AI App Platform Backend",
  "timestamp": "2025-01-31T04:33:22.125Z",
  "environment": "development",
  "anthropicConfigured": true,
  "databaseConnected": true,
  "storage": "database"
}
```

---

## 🗄️ Database Schema Overview

### Project Types
- `REACT` - React applications
- `VUE` - Vue.js applications  
- `NODE` - Node.js applications
- `STATIC` - Static HTML/CSS/JS
- `LANDING_PAGE` - Landing page sites
- `TODO_APP` - Todo applications
- `DASHBOARD` - Dashboard applications
- `BLOG` - Blog sites

### Project Status
- `DRAFT` - Project being created
- `BUILDING` - Files being generated
- `READY` - Project ready for preview
- `DEPLOYED` - Project deployed to production
- `ERROR` - Error in project creation

### File Types
- `CODE` - TypeScript/JavaScript files (.tsx, .ts, .jsx, .js)
- `STYLE` - CSS/SCSS files (.css, .scss, .sass)
- `CONFIG` - Configuration files (.json, .yml, .yaml)
- `MARKUP` - HTML files (.html, .htm)
- `DOCUMENTATION` - Markdown files (.md, .mdx)
- `ASSET` - Images and other assets

---

## 🚀 Revolutionary Features

### Database-First Architecture
- **Centralized Storage**: All projects and files stored in PostgreSQL
- **Multi-User Ready**: User-scoped project isolation
- **Scalable**: Cloud-ready database architecture
- **Searchable**: Full-text search through project code

### Voice/Text-to-App Creation
- **Natural Language Processing**: Claude analyzes descriptions
- **Intelligent Template Selection**: Automatic template matching
- **Real-time Generation**: Instant project creation
- **Customizable**: Dynamic placeholder replacement

### On-Demand File Generation
- **Virtual File System**: Files stored as database records
- **Preview Generation**: Create physical files only when needed
- **Export Ready**: Generate downloadable project packages
- **Resource Efficient**: No persistent file storage required

---

## 🎯 Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "message": "Detailed error message",
  "timestamp": "2025-01-31T04:33:22.125Z"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing required fields)
- `404` - Not Found (project/file doesn't exist)
- `500` - Internal Server Error (Claude API issues, database errors)

---

## 🔮 Coming Soon: Phase 3B - Live Preview System

- **Docker Container Management**: Isolated execution environments
- **Hot Reload Integration**: Real-time preview updates
- **Preview URLs**: Shareable application links
- **Resource Monitoring**: Performance tracking
- **Auto-cleanup**: Temporary container lifecycle management