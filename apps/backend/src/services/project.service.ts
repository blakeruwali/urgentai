import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: 'react' | 'vue' | 'node' | 'static';
  files: ProjectFile[];
}

export interface ProjectFile {
  path: string;
  content: string;
  type: 'component' | 'style' | 'config' | 'data';
}

export interface Project {
  id: string;
  name: string;
  type: string;
  path: string;
  files: ProjectFile[];
  previewUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectService {
  private projectsDir = path.join(process.cwd(), 'generated-projects');

  constructor() {
    this.ensureProjectsDirectory();
  }

  private async ensureProjectsDirectory(): Promise<void> {
    try {
      await fs.access(this.projectsDir);
    } catch {
      await fs.mkdir(this.projectsDir, { recursive: true });
    }
  }

  /**
   * Create a new project from template
   */
  async createProject(
    name: string, 
    template: ProjectTemplate,
    customizations?: any
  ): Promise<Project> {
    const projectId = `${name}-${Date.now()}`;
    const projectPath = path.join(this.projectsDir, projectId);

    try {
      // Create project directory
      await fs.mkdir(projectPath, { recursive: true });

      // Create all template files
      const files: ProjectFile[] = [];
      for (const file of template.files) {
        const fullPath = path.join(projectPath, file.path);
        const dir = path.dirname(fullPath);
        
        // Ensure directory exists
        await fs.mkdir(dir, { recursive: true });
        
        // Apply customizations to file content
        let content = file.content;
        if (customizations) {
          content = this.applyCustomizations(content, customizations);
        }
        
        // Write file
        await fs.writeFile(fullPath, content, 'utf-8');
        
        files.push({
          path: file.path,
          content,
          type: file.type
        });
      }

      // Initialize as npm project if needed
      if (template.type === 'react' || template.type === 'vue' || template.type === 'node') {
        await this.initializeNpmProject(projectPath, template.type);
      }

      const project: Project = {
        id: projectId,
        name,
        type: template.type,
        path: projectPath,
        files,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log(`✅ Project created: ${projectId} at ${projectPath}`);
      return project;

    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  /**
   * Update a file in an existing project
   */
  async updateFile(
    projectId: string, 
    filePath: string, 
    content: string
  ): Promise<void> {
    const projectPath = path.join(this.projectsDir, projectId);
    const fullPath = path.join(projectPath, filePath);

    try {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Write updated content
      await fs.writeFile(fullPath, content, 'utf-8');
      
      console.log(`✅ File updated: ${filePath} in project ${projectId}`);
    } catch (error) {
      console.error('Error updating file:', error);
      throw new Error(`Failed to update file: ${error}`);
    }
  }

  /**
   * Add a new file to existing project
   */
  async addFile(
    projectId: string,
    file: ProjectFile
  ): Promise<void> {
    const projectPath = path.join(this.projectsDir, projectId);
    const fullPath = path.join(projectPath, file.path);

    try {
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(fullPath, file.content, 'utf-8');
      
      console.log(`✅ File added: ${file.path} to project ${projectId}`);
    } catch (error) {
      console.error('Error adding file:', error);
      throw new Error(`Failed to add file: ${error}`);
    }
  }

  /**
   * Get project details
   */
  async getProject(projectId: string): Promise<Project | null> {
    const projectPath = path.join(this.projectsDir, projectId);

    try {
      await fs.access(projectPath);
      
      // Read all files in project
      const files = await this.readProjectFiles(projectPath);
      
      return {
        id: projectId,
        name: projectId, // TODO: Store metadata separately
        type: 'react', // TODO: Detect from package.json
        path: projectPath,
        files,
        createdAt: new Date(), // TODO: Get from file stats
        updatedAt: new Date()
      };
    } catch {
      return null;
    }
  }

  /**
   * Start development server for project
   */
  async startPreview(projectId: string): Promise<string> {
    const projectPath = path.join(this.projectsDir, projectId);
    
    try {
      // Check if project has package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      await fs.access(packageJsonPath);

      // Start development server
      const { stdout } = await execAsync('npm run dev', { 
        cwd: projectPath,
        timeout: 10000 
      });
      
      // Extract preview URL (usually localhost:3000 or similar)
      const urlMatch = stdout.match(/Local:\s+(http:\/\/[^\s]+)/);
      const previewUrl = urlMatch ? urlMatch[1] : 'http://localhost:3000';
      
      console.log(`✅ Preview started for ${projectId}: ${previewUrl}`);
      return previewUrl;
      
    } catch (error) {
      console.error('Error starting preview:', error);
      throw new Error(`Failed to start preview: ${error}`);
    }
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<Project[]> {
    try {
      const entries = await fs.readdir(this.projectsDir);
      const projects: Project[] = [];
      
      for (const entry of entries) {
        const project = await this.getProject(entry);
        if (project) {
          projects.push(project);
        }
      }
      
      return projects;
    } catch {
      return [];
    }
  }

  private async initializeNpmProject(projectPath: string, type: string): Promise<void> {
    try {
      // Install dependencies based on project type
      if (type === 'react') {
        await execAsync('npm install', { cwd: projectPath });
      }
      console.log(`✅ NPM project initialized: ${type}`);
    } catch (error) {
      console.error('Error initializing npm project:', error);
    }
  }

  private applyCustomizations(content: string, customizations: any): string {
    let customizedContent = content;
    
    // Replace placeholder values
    Object.keys(customizations).forEach(key => {
      const placeholder = `{{${key}}}`;
      customizedContent = customizedContent.replace(
        new RegExp(placeholder, 'g'), 
        customizations[key]
      );
    });
    
    return customizedContent;
  }

  private async readProjectFiles(projectPath: string): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    
    const readDir = async (dirPath: string, basePath = ''): Promise<void> => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue; // Skip hidden files and node_modules
        }
        
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.join(basePath, entry.name);
        
        if (entry.isDirectory()) {
          await readDir(fullPath, relativePath);
        } else {
          const content = await fs.readFile(fullPath, 'utf-8');
          files.push({
            path: relativePath,
            content,
            type: this.getFileType(entry.name)
          });
        }
      }
    };
    
    await readDir(projectPath);
    return files;
  }

  private getFileType(filename: string): 'component' | 'style' | 'config' | 'data' {
    const ext = path.extname(filename).toLowerCase();
    
    if (['.tsx', '.jsx', '.vue'].includes(ext)) return 'component';
    if (['.css', '.scss', '.sass'].includes(ext)) return 'style';
    if (['.json', '.js', '.ts', '.config.js'].includes(ext)) return 'config';
    return 'data';
  }
}

export const projectService = new ProjectService(); 