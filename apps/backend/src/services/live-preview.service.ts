import { exec } from 'child_process';
import { promisify } from 'util';
import { databaseProjectService } from './database-project.service';
import { errorDetectionService, PreviewError } from './error-detection.service';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface PreviewContainer {
  id: string;
  projectId: string;
  port: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  url: string;
  createdAt: Date;
  lastAccessed: Date;
  containerId?: string; // Docker container ID
  logs?: string[]; // Container logs for debugging
  errors?: string[]; // Error logs
  detectedErrors?: PreviewError[]; // Structured error detection
  lastErrorScan?: Date;
}

export interface PreviewConfig {
  projectId: string;
  userId: string;
  autoCleanup?: boolean;
  timeout?: number; // minutes
}

export class LivePreviewService {
  private containers: Map<string, PreviewContainer> = new Map();
  private portRange = { start: 4000, end: 5000 };
  private usedPorts = new Set<number>();
  private previewBaseDir = path.join(process.cwd(), 'live-previews');

  constructor() {
    this.ensurePreviewDirectory();
    this.startCleanupJob();
    this.cleanupExistingContainers();
  }

  /**
   * Create a live preview for a database-stored project
   */
  async createPreview(config: PreviewConfig): Promise<PreviewContainer> {
    try {
      const { projectId, userId } = config;
      
      // Check if preview already exists
      const existingContainer = this.containers.get(projectId);
      if (existingContainer && existingContainer.status === 'running') {
        existingContainer.lastAccessed = new Date();
        return existingContainer;
      }

      console.log(`🚀 Creating live preview for project: ${projectId}`);

      // Get project from database
      const project = await databaseProjectService.getProject(projectId);
      if (!project || !project.files) {
        throw new Error(`Project ${projectId} not found or has no files`);
      }

             // Allocate port
       const port = await this.allocatePort();
      
      // Create preview directory
      const previewDir = path.join(this.previewBaseDir, `project-${projectId}-${Date.now()}`);
      await fs.mkdir(previewDir, { recursive: true });

      // Generate physical files from database
      await this.generateProjectFiles(project, previewDir);

      // Initialize and start the project
      const containerId = await this.createDockerContainer(previewDir, port, project.type);

      // Create container record
      const container: PreviewContainer = {
        id: containerId,
        projectId,
        port,
        status: 'starting',
        url: `http://localhost:${port}`,
        createdAt: new Date(),
        lastAccessed: new Date(),
        containerId: containerId,
        logs: [],
        errors: []
      };

      this.containers.set(projectId, container);
      this.usedPorts.add(port);

      // Monitor container startup
      this.monitorContainerStartup(container);

      console.log(`✅ Live preview created: ${container.url}`);
      return container;

    } catch (error) {
      console.error('Error creating live preview:', error);
      throw new Error(`Failed to create preview: ${error}`);
    }
  }

  /**
   * Get preview status and URL
   */
  async getPreview(projectId: string): Promise<PreviewContainer | null> {
    const container = this.containers.get(projectId);
    if (!container) return null;

    // Update last accessed time
    container.lastAccessed = new Date();
    
    // Check if container is still running
    if (container.status === 'running') {
      const isRunning = await this.checkContainerHealth(container);
      if (!isRunning) {
        container.status = 'stopped';
      }
    }

    return container;
  }

  /**
   * Stop a preview and cleanup resources
   */
  async stopPreview(projectId: string): Promise<void> {
    try {
      const container = this.containers.get(projectId);
      if (!container) {
        throw new Error(`Preview for project ${projectId} not found`);
      }

      console.log(`🛑 Stopping preview for project: ${projectId}`);

      // Stop the container process
      await this.stopContainer(container);

      // Cleanup files
      await this.cleanupPreviewFiles(container);

      // Free the port
      this.usedPorts.delete(container.port);

      // Remove from containers map
      this.containers.delete(projectId);

      console.log(`✅ Preview stopped: ${projectId}`);

    } catch (error) {
      console.error('Error stopping preview:', error);
      throw new Error(`Failed to stop preview: ${error}`);
    }
  }

  /**
   * List all active previews
   */
  async listPreviews(): Promise<PreviewContainer[]> {
    return Array.from(this.containers.values()).filter(c => c.status !== 'stopped');
  }

  /**
   * Update preview with new files from database
   */
  async updatePreview(projectId: string): Promise<PreviewContainer> {
    try {
      const container = this.containers.get(projectId);
      if (!container) {
        throw new Error(`Preview for project ${projectId} not found`);
      }

      console.log(`🔄 Updating preview for project: ${projectId}`);

      // Get updated project from database
      const project = await databaseProjectService.getProject(projectId);
      if (!project || !project.files) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Determine preview directory from container
      const previewDir = path.join(this.previewBaseDir, `project-${projectId}-*`);
      const dirs = await fs.readdir(this.previewBaseDir);
      const matchingDir = dirs.find(dir => dir.startsWith(`project-${projectId}-`));
      
      if (matchingDir) {
        const fullPreviewDir = path.join(this.previewBaseDir, matchingDir);
        
        // Update files from database
        await this.generateProjectFiles(project, fullPreviewDir);
        
        console.log(`✅ Preview updated: ${container.url}`);
      }

      container.lastAccessed = new Date();
      return container;

    } catch (error) {
      console.error('Error updating preview:', error);
      throw new Error(`Failed to update preview: ${error}`);
    }
  }

  /**
   * Generate physical files from database project
   */
  private async generateProjectFiles(project: any, outputDir: string): Promise<void> {
    try {
      // Create all file directories
      for (const file of project.files) {
        const fullPath = path.join(outputDir, file.path);
        const dir = path.dirname(fullPath);
        
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, file.content, 'utf-8');
      }

      console.log(`📁 Generated ${project.files.length} files for preview`);

    } catch (error) {
      console.error('Error generating project files:', error);
      throw error;
    }
  }

  /**
   * Generate Dockerfile based on project type
   */
  private generateDockerfile(projectType: string, port: number): string {
    switch (projectType) {
             case 'react':
       case 'react-todo':
         return `# React App Dockerfile
 FROM node:18-alpine
 
 WORKDIR /app
 
 # Copy package files
 COPY package*.json ./
 
 # Install dependencies
 RUN npm install
 
 # Copy source code
 COPY . .
 
 # Expose port
 EXPOSE ${port}
 
 # Set environment variables
 ENV PORT=${port}
 ENV NODE_ENV=development
 ENV WATCHPACK_POLLING=true
 ENV CHOKIDAR_USEPOLLING=true
 ENV HOST=0.0.0.0
 
 # Create a startup script
 RUN echo '#!/bin/sh' > /app/start.sh && \\
     echo 'echo "Starting React development server..."' >> /app/start.sh && \\
     echo 'npm start -- --host 0.0.0.0 --port $PORT' >> /app/start.sh && \\
     chmod +x /app/start.sh
 
 # Start the development server
 CMD ["/app/start.sh"]`;

      case 'vue':
        return `# Vue App Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE ${port}

# Set environment variables
ENV PORT=${port}
ENV NODE_ENV=development

# Start the development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "${port}"]`;

      default:
        return `# Generic Node.js App Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE ${port}

# Set environment variables
ENV PORT=${port}
ENV NODE_ENV=development

# Start the development server
CMD ["npm", "start"]`;
    }
  }

  /**
   * Generate docker-compose.yml for easier management
   */
  private generateDockerCompose(projectType: string, port: number): string {
    const containerName = `preview-${Date.now()}`;
    
    return `version: '3.8'
services:
  app:
    build: .
    container_name: ${containerName}
    ports:
      - "${port}:${port}"
    environment:
      - PORT=${port}
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
    restart: unless-stopped
    networks:
      - preview-network

networks:
  preview-network:
    driver: bridge`;
  }



    /**
   * Create a Docker container for the project
   */
  private async createDockerContainer(projectDir: string, port: number, projectType: string): Promise<string> {
    try {
      // Create Dockerfile based on project type
      const dockerfile = this.generateDockerfile(projectType, port);
      await fs.writeFile(path.join(projectDir, 'Dockerfile'), dockerfile);

      // Create docker-compose.yml for easier management
      const dockerCompose = this.generateDockerCompose(projectType, port);
      await fs.writeFile(path.join(projectDir, 'docker-compose.yml'), dockerCompose);

      // Build and start the Docker container
      console.log(`🐳 Building Docker container for ${projectType} project in ${projectDir}`);
      
      const containerName = `preview-${Date.now()}`;
      
      // First, check if we can access the directory
      const dirExists = await fs.access(projectDir).then(() => true).catch(() => false);
      if (!dirExists) {
        throw new Error(`Project directory does not exist: ${projectDir}`);
      }

      // List files in the directory to verify they exist
      const files = await fs.readdir(projectDir);
      console.log(`📁 Files in project directory: ${files.join(', ')}`);
      
      // Build the Docker image with proper error handling
      console.log(`🔨 Building Docker image: ${containerName}`);
      const buildResult = await execAsync(`docker build -t ${containerName} .`, { 
        cwd: projectDir,
        timeout: 120000 // 2 minutes timeout
      });
      
      console.log(`✅ Docker build successful: ${buildResult.stdout}`);
      
      // Run the container
      console.log(`🚀 Starting Docker container: ${containerName}`);
      const runCommand = `docker run -d --name ${containerName} -p ${port}:${port} --rm ${containerName}`;
      
      // First, try to stop any existing container with the same name
      try {
        await execAsync(`docker stop ${containerName}`, { timeout: 5000 });
        await execAsync(`docker rm ${containerName}`, { timeout: 5000 });
      } catch {
        // Container doesn't exist, which is fine
      }
      
      const runResult = await execAsync(runCommand, { 
        cwd: projectDir,
        timeout: 30000 // 30 seconds timeout
      });
      
      const containerId = runResult.stdout.trim();
      console.log(`✅ Docker container started: ${containerId}`);
      
      // Enhanced logging for debugging
      setTimeout(async () => {
        try {
          const { stdout } = await execAsync(`docker logs ${containerName}`);
          console.log(`📋 Container logs for ${containerName} (5s):`, stdout);
          
          // Also check if container is still running
          const { stdout: psOutput } = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`);
          console.log(`🐳 Container status (5s): ${psOutput.trim() || 'Not running'}`);
        } catch (error) {
          console.log(`📋 No logs available for ${containerName} yet`);
        }
      }, 5000);
      
      // Check logs again after 15 seconds
      setTimeout(async () => {
        try {
          const { stdout } = await execAsync(`docker logs ${containerName}`);
          console.log(`📋 Container logs for ${containerName} (15s):`, stdout);
          
          // Check container status again
          const { stdout: psOutput } = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`);
          console.log(`🐳 Container status (15s): ${psOutput.trim() || 'Not running'}`);
          
          // If container is running, try to test the service
          if (psOutput.trim()) {
            try {
              const response = await fetch(`http://localhost:${port}`, { 
                method: 'HEAD',
                signal: AbortSignal.timeout(5000)
              });
              console.log(`🌐 Service test (15s): ${response.status} ${response.statusText}`);
            } catch (error) {
              console.log(`🌐 Service test (15s): Failed - ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        } catch (error) {
          console.log(`📋 No logs available for ${containerName} at 15s`);
        }
      }, 15000);
    
      return containerId;

    } catch (error) {
      console.error('Error creating Docker container:', error);
      
      // Provide more detailed error information
      if (error instanceof Error) {
        if (error.message.includes('docker build')) {
          throw new Error(`Docker build failed: ${error.message}. Make sure Docker Desktop is running and the project files are valid.`);
        } else if (error.message.includes('docker run')) {
          throw new Error(`Docker run failed: ${error.message}. Port ${port} might be in use.`);
        } else {
          throw new Error(`Docker operation failed: ${error.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Monitor container startup and update status
   */
  private async monitorContainerStartup(container: PreviewContainer): Promise<void> {
    const maxAttempts = 180; // 3 minutes for React development servers
    let attempts = 0;

    const checkHealth = async (): Promise<void> => {
      try {
        attempts++;
        
        console.log(`🔍 Health check attempt ${attempts}/${maxAttempts} for ${container.url}`);
        
        // Check if container is running
        if (container.containerId) {
          try {
            const { stdout } = await execAsync(`docker ps --filter "id=${container.containerId}" --format "{{.Status}}"`);
            console.log(`🐳 Container status: ${stdout.trim() || 'Not running'}`);
            if (!stdout.trim()) {
              // Get container logs to see what happened
              try {
                const { stdout: logs } = await execAsync(`docker logs ${container.containerId}`);
                console.log(`📋 Container logs:`, logs);
                container.logs?.push(logs);
              } catch (logError) {
                console.log(`📋 No logs available for ${container.containerId}`);
              }
              
              container.status = 'error';
              container.errors?.push('Container failed to start');
              return;
            }
          } catch (error) {
            console.log(`❌ Error checking container status:`, error);
          }
        }
        
        // Get detailed container logs and detect errors every 10 attempts
        if (attempts % 10 === 0 && container.containerId) {
          try {
            const { stdout: logs } = await execAsync(`docker logs ${container.containerId}`);
            console.log(`📋 Container logs (attempt ${attempts}):`, logs);
            container.logs?.push(logs);
            
            // Detect errors in logs
            const detectedErrors = await this.detectErrors(container.containerId);
            if (detectedErrors.length > 0) {
              container.detectedErrors = detectedErrors;
              container.lastErrorScan = new Date();
              console.log(`🔍 Error detection: Found ${detectedErrors.length} error(s)`);
            }
          } catch (error) {
            console.log(`📋 No logs available at attempt ${attempts}`);
          }
        }
        
        // Try multiple endpoints for React dev server
        const endpoints = [
          container.url,
          `${container.url}/`,
          `${container.url}/index.html`,
          `${container.url}/static/js/`
        ];
        
        let isHealthy = false;
        for (const endpoint of endpoints) {
          try {
            console.log(`🔍 Testing endpoint: ${endpoint}`);
            const response = await fetch(endpoint, { 
              method: 'HEAD',
              signal: AbortSignal.timeout(5000) // 5 second timeout per endpoint
            });
            console.log(`📡 Response from ${endpoint}: ${response.status} ${response.statusText}`);
            if (response && response.ok) {
              isHealthy = true;
              console.log(`✅ Endpoint ${endpoint} is healthy!`);
              break;
            }
          } catch (error) {
            console.log(`❌ Endpoint ${endpoint} failed:`, error instanceof Error ? error.message : String(error));
          }
        }
        
        if (isHealthy) {
          container.status = 'running';
          console.log(`✅ Docker VM preview is now running: ${container.url}`);
          return;
        }

        if (attempts < maxAttempts) {
          console.log(`⏳ Waiting 3 seconds before next health check...`);
          setTimeout(checkHealth, 3000); // Check every 3 seconds
        } else {
          container.status = 'error';
          container.errors?.push('Preview failed to start within timeout');
          console.error(`❌ Docker VM preview failed to start: ${container.url}`);
          
          // Final diagnostic information
          console.log(`🔍 FINAL DIAGNOSTIC FOR ${container.url}:`);
          console.log(`- Container ID: ${container.containerId}`);
          console.log(`- Port: ${container.port}`);
          console.log(`- Project ID: ${container.projectId}`);
          console.log(`- Status: ${container.status}`);
          console.log(`- Errors:`, container.errors);
          console.log(`- Logs:`, container.logs);
        }

      } catch (error) {
        console.error(`❌ Health check error:`, error);
        if (attempts < maxAttempts) {
          setTimeout(checkHealth, 3000);
        } else {
          container.status = 'error';
          container.errors?.push(`Error: ${error}`);
        }
      }
    };

    // Start monitoring after a longer delay for React dev servers
    console.log(`⏰ Starting health monitoring for ${container.url} in 15 seconds...`);
    setTimeout(checkHealth, 15000); // Give React dev server more time to start
  }

  /**
   * Check if container is still healthy
   */
  private async checkContainerHealth(container: PreviewContainer): Promise<boolean> {
    try {
      // Check if container is still running
      if (container.containerId) {
        const { stdout } = await execAsync(`docker ps --filter "id=${container.containerId}" --format "{{.ID}}"`);
        if (!stdout.trim()) {
          return false;
        }
      }
      
      // Check if service is responding
      const response = await fetch(container.url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Stop container process
   */
  private async stopContainer(container: PreviewContainer): Promise<void> {
    try {
      if (container.containerId) {
        await execAsync(`docker stop ${container.containerId}`);
        await execAsync(`docker rm ${container.containerId}`);
      }
    } catch (error) {
      console.error('Error stopping Docker container:', error);
    }
  }

  /**
   * Cleanup preview files and directories
   */
  private async cleanupPreviewFiles(container: PreviewContainer): Promise<void> {
    try {
      const dirs = await fs.readdir(this.previewBaseDir);
      const matchingDir = dirs.find(dir => dir.startsWith(`project-${container.projectId}-`));
      
      if (matchingDir) {
        const fullPath = path.join(this.previewBaseDir, matchingDir);
        await fs.rm(fullPath, { recursive: true, force: true });
        console.log(`🧹 Cleaned up preview files: ${fullPath}`);
      }

    } catch (error) {
      console.error('Error cleaning up preview files:', error);
    }
  }

  /**
   * Allocate an available port
   */
  private async allocatePort(): Promise<number> {
    console.log(`🔍 Allocating port from range ${this.portRange.start}-${this.portRange.end}`);
    
    for (let port = this.portRange.start; port <= this.portRange.end; port++) {
      if (!this.usedPorts.has(port)) {
        console.log(`🔍 Checking port ${port}...`);
        
        // Check if port is actually available in the system
        try {
          const { stdout } = await execAsync(`netstat -an | findstr :${port}`);
          console.log(`📊 System port check for ${port}: ${stdout.trim() ? 'IN USE' : 'AVAILABLE'}`);
          
          if (!stdout.trim()) {
            // Also check if any Docker container is using this port
            try {
              const { stdout: dockerStdout } = await execAsync(`docker ps --format "{{.Ports}}" | findstr :${port}`);
              console.log(`🐳 Docker port check for ${port}: ${dockerStdout.trim() ? 'IN USE' : 'AVAILABLE'}`);
              
              if (!dockerStdout.trim()) {
                console.log(`✅ Port ${port} is available!`);
                return port;
              } else {
                console.log(`❌ Port ${port} is used by Docker container`);
              }
            } catch (dockerError) {
              console.log(`❌ Error checking Docker port ${port}:`, dockerError);
            }
          } else {
            console.log(`❌ Port ${port} is used by system process`);
          }
        } catch (netstatError) {
          console.log(`❌ Error checking system port ${port}:`, netstatError);
          // If netstat fails, assume port is available
          console.log(`✅ Assuming port ${port} is available (netstat failed)`);
          return port;
        }
      } else {
        console.log(`❌ Port ${port} is already allocated by our system`);
      }
    }
    
    console.log(`❌ No available ports found in range ${this.portRange.start}-${this.portRange.end}`);
    throw new Error('No available ports for preview');
  }

  /**
   * Get start command for different project types
   */
  private getStartCommand(projectType: string, port: number): string {
    switch (projectType) {
      case 'REACT':
        return `npm run dev -- --port ${port}`;
      case 'VUE':
        return `npm run dev -- --port ${port}`;
      case 'NODE':
        return `npm start`;
      default:
        return `npm run dev`;
    }
  }

  /**
   * Ensure preview directory exists
   */
  private async ensurePreviewDirectory(): Promise<void> {
    try {
      await fs.access(this.previewBaseDir);
    } catch {
      await fs.mkdir(this.previewBaseDir, { recursive: true });
      console.log(`📁 Created preview directory: ${this.previewBaseDir}`);
    }
  }

  /**
   * Start automatic cleanup job for expired previews
   */
  private startCleanupJob(): void {
    // Cleanup every 10 minutes
    setInterval(async () => {
      try {
        await this.cleanupExpiredPreviews();
      } catch (error) {
        console.error('Error in cleanup job:', error);
      }
    }, 10 * 60 * 1000);

    console.log('🧹 Started automatic preview cleanup job');
  }

  /**
   * Cleanup any existing preview containers on startup
   */
  private async cleanupExistingContainers(): Promise<void> {
    try {
      console.log(`🧹 Cleaning up existing preview containers...`);
      
      // Find and stop any existing preview containers
      const { stdout } = await execAsync(`docker ps --filter "name=preview-" --format "{{.ID}}"`);
      if (stdout.trim()) {
        const containerIds = stdout.trim().split('\n');
        console.log(`🔍 Found ${containerIds.length} existing preview containers`);
        
        for (const containerId of containerIds) {
          try {
            console.log(`🛑 Stopping container: ${containerId}`);
            await execAsync(`docker stop ${containerId}`);
            console.log(`🗑️ Removing container: ${containerId}`);
            await execAsync(`docker rm ${containerId}`);
            console.log(`✅ Cleaned up existing container: ${containerId}`);
          } catch (error) {
            console.error(`❌ Error cleaning up container ${containerId}:`, error);
          }
        }
      } else {
        console.log(`✅ No existing preview containers found`);
      }
      
      // Also clean up any containers using our port range
      console.log(`🔍 Checking for containers using ports ${this.portRange.start}-${this.portRange.end}...`);
      for (let port = this.portRange.start; port <= this.portRange.end; port++) {
        try {
          const { stdout: portCheck } = await execAsync(`docker ps --format "{{.ID}}\t{{.Ports}}" | findstr :${port}`);
          if (portCheck.trim()) {
            console.log(`⚠️ Found container using port ${port}: ${portCheck.trim()}`);
            // Extract container ID and stop it
            const lines = portCheck.trim().split('\n');
            for (const line of lines) {
              const containerId = line.split('\t')[0];
              if (containerId) {
                try {
                  console.log(`🛑 Stopping container ${containerId} using port ${port}`);
                  await execAsync(`docker stop ${containerId}`);
                  await execAsync(`docker rm ${containerId}`);
                  console.log(`✅ Cleaned up container ${containerId} using port ${port}`);
                } catch (error) {
                  console.error(`❌ Error cleaning up container ${containerId}:`, error);
                }
              }
            }
          }
        } catch (error) {
          // Port not in use, which is fine
        }
      }
      
    } catch (error) {
      console.error('Error cleaning up existing containers:', error);
    }
  }

  /**
   * Cleanup expired previews (inactive for > 30 minutes)
   */
  private async cleanupExpiredPreviews(): Promise<void> {
    const now = new Date();
    const expiredContainers: string[] = [];

    for (const [projectId, container] of this.containers.entries()) {
      const inactiveTime = now.getTime() - container.lastAccessed.getTime();
      const thirtyMinutes = 30 * 60 * 1000;

      if (inactiveTime > thirtyMinutes) {
        expiredContainers.push(projectId);
      }
    }

    for (const projectId of expiredContainers) {
      try {
        await this.stopPreview(projectId);
        console.log(`🧹 Cleaned up expired preview: ${projectId}`);
      } catch (error) {
        console.error(`Error cleaning up preview ${projectId}:`, error);
      }
    }

    if (expiredContainers.length > 0) {
      console.log(`🧹 Cleaned up ${expiredContainers.length} expired previews`);
    }
  }

  /**
   * Get container logs for debugging
   */
  async getContainerLogs(containerId: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`docker logs ${containerId}`);
      return stdout;
    } catch (error) {
      return `Error getting logs: ${error}`;
    }
  }

  /**
   * Get detailed container information for debugging
   */
  async getContainerInfo(containerId: string): Promise<any> {
    try {
      const { stdout: inspect } = await execAsync(`docker inspect ${containerId}`);
      const { stdout: logs } = await execAsync(`docker logs ${containerId}`);
      const { stdout: ps } = await execAsync(`docker ps --filter "id=${containerId}" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"`);
      
      return {
        inspect: JSON.parse(inspect),
        logs,
        ps: ps.trim(),
        containerId
      };
    } catch (error) {
      return {
        error: `Error getting container info: ${error}`,
        containerId
      };
    }
  }

  /**
   * Execute command in container for debugging
   */
  async executeInContainer(containerId: string, command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`docker exec ${containerId} ${command}`);
      return stdout;
    } catch (error) {
      return `Error executing command: ${error}`;
    }
  }

  /**
   * Detect errors in container logs
   */
  async detectErrors(containerId: string): Promise<PreviewError[]> {
    try {
      console.log(`🔍 Scanning for errors in container: ${containerId}`);
      const errors = await errorDetectionService.scanContainerLogs(containerId);
      
      if (errors.length > 0) {
        console.log(`❌ Detected ${errors.length} error(s) in container ${containerId}:`);
        errors.forEach(error => {
          console.log(`  - ${error.type.toUpperCase()}: ${error.message} (${error.severity})`);
        });
      } else {
        console.log(`✅ No errors detected in container ${containerId}`);
      }
      
      return errors;
    } catch (error) {
      console.error('Error detecting errors:', error);
      return [];
    }
  }

  /**
   * Get error analysis for a container
   */
  async getErrorAnalysis(containerId: string): Promise<{
    errors: PreviewError[];
    analysis: any;
    hasCriticalErrors: boolean;
  }> {
    const errors = await this.detectErrors(containerId);
    const analysis = errorDetectionService.getErrorAnalysis(errors);
    const hasCriticalErrors = errorDetectionService.hasCriticalErrors(errors);
    
    return {
      errors,
      analysis,
      hasCriticalErrors
    };
  }

  /**
   * Update container with detected errors
   */
  async updateContainerErrors(projectId: string): Promise<PreviewContainer | null> {
    const container = this.containers.get(projectId);
    if (!container || !container.containerId) {
      return null;
    }

    const errors = await this.detectErrors(container.containerId);
    container.detectedErrors = errors;
    container.lastErrorScan = new Date();

    // Update status if critical errors detected
    if (errorDetectionService.hasCriticalErrors(errors)) {
      container.status = 'error';
    }

    return container;
  }
}

export const livePreviewService = new LivePreviewService(); 