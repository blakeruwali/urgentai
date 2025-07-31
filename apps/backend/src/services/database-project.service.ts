import { PrismaClient, ProjectType, ProjectStatus, FileType } from '../generated/prisma';
import { templateService } from './template.service';
import { ProjectTemplate } from './project.service';

const prisma = new PrismaClient();

export interface DatabaseProject {
  id: string;
  name: string;
  description?: string;
  type: ProjectType;
  templateId?: string;
  userId: string;
  status: ProjectStatus;
  metadata?: any;
  previewUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  files?: DatabaseProjectFile[];
}

export interface DatabaseProjectFile {
  id: string;
  path: string;
  content: string;
  type: FileType;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  type: ProjectType;
  templateId?: string;
  userId: string;
  customizations?: Record<string, any>;
}

export class DatabaseProjectService {
  /**
   * Create a new project from template - stored in database
   */
  async createProject(request: CreateProjectRequest): Promise<DatabaseProject> {
    try {
      // Get template if specified
      let templateFiles: any[] = [];
      if (request.templateId) {
        const template = templateService.getTemplate(request.templateId);
        if (template) {
          templateFiles = template.files;
        }
      }

      // Create project in database
      const project = await prisma.project.create({
        data: {
          name: request.name,
          description: request.description,
          type: request.type,
          templateId: request.templateId,
          userId: request.userId,
          status: ProjectStatus.BUILDING,
          metadata: request.customizations || {}
        }
      });

      // Create project files in database
      const createdFiles = [];
      for (const templateFile of templateFiles) {
        // Apply customizations to file content
        let content = templateFile.content;
        if (request.customizations) {
          content = this.applyCustomizations(content, request.customizations);
        }

        const file = await prisma.projectFile.create({
          data: {
            projectId: project.id,
            path: templateFile.path,
            content,
            type: this.mapFileType(templateFile.type),
            size: content.length
          }
        });

        createdFiles.push({
          id: file.id,
          path: file.path,
          content: file.content,
          type: file.type,
          size: file.size,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt
        });
      }

      // Update project status to READY
      await prisma.project.update({
        where: { id: project.id },
        data: { status: ProjectStatus.READY }
      });

      console.log(`✅ Database project created: ${project.id} with ${createdFiles.length} files`);

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        templateId: project.templateId,
        userId: project.userId,
        status: ProjectStatus.READY,
        metadata: project.metadata,
        previewUrl: project.previewUrl,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        files: createdFiles
      };

    } catch (error) {
      console.error('Error creating database project:', error);
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  /**
   * Get project with files from database
   */
  async getProject(projectId: string): Promise<DatabaseProject | null> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          files: {
            orderBy: { path: 'asc' }
          }
        }
      });

      if (!project) return null;

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        templateId: project.templateId,
        userId: project.userId,
        status: project.status,
        metadata: project.metadata,
        previewUrl: project.previewUrl,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        files: project.files.map(file => ({
          id: file.id,
          path: file.path,
          content: file.content,
          type: file.type,
          size: file.size,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt
        }))
      };

    } catch (error) {
      console.error('Error getting project:', error);
      return null;
    }
  }

  /**
   * List all projects for a user
   */
  async listUserProjects(userId: string): Promise<DatabaseProject[]> {
    try {
      const projects = await prisma.project.findMany({
        where: { userId },
        include: {
          _count: {
            select: { files: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        templateId: project.templateId,
        userId: project.userId,
        status: project.status,
        metadata: { ...project.metadata, fileCount: project._count.files },
        previewUrl: project.previewUrl,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }));

    } catch (error) {
      console.error('Error listing projects:', error);
      return [];
    }
  }

  /**
   * Update a file in the project
   */
  async updateFile(projectId: string, filePath: string, content: string): Promise<DatabaseProjectFile> {
    try {
      const file = await prisma.projectFile.upsert({
        where: {
          projectId_path: {
            projectId,
            path: filePath
          }
        },
        update: {
          content,
          size: content.length,
          updatedAt: new Date()
        },
        create: {
          projectId,
          path: filePath,
          content,
          type: this.detectFileType(filePath),
          size: content.length
        }
      });

      // Update project timestamp
      await prisma.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() }
      });

      console.log(`✅ File updated in database: ${filePath} in project ${projectId}`);

      return {
        id: file.id,
        path: file.path,
        content: file.content,
        type: file.type,
        size: file.size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
      };

    } catch (error) {
      console.error('Error updating file:', error);
      throw new Error(`Failed to update file: ${error}`);
    }
  }

  /**
   * Add a new file to the project
   */
  async addFile(projectId: string, filePath: string, content: string): Promise<DatabaseProjectFile> {
    try {
      const file = await prisma.projectFile.create({
        data: {
          projectId,
          path: filePath,
          content,
          type: this.detectFileType(filePath),
          size: content.length
        }
      });

      // Update project timestamp
      await prisma.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() }
      });

      console.log(`✅ File added to database: ${filePath} in project ${projectId}`);

      return {
        id: file.id,
        path: file.path,
        content: file.content,
        type: file.type,
        size: file.size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
      };

    } catch (error) {
      console.error('Error adding file:', error);
      throw new Error(`Failed to add file: ${error}`);
    }
  }

  /**
   * Generate files on demand for preview/download
   */
  async generateProjectFiles(projectId: string, outputDir: string): Promise<string> {
    try {
      const project = await this.getProject(projectId);
      if (!project || !project.files) {
        throw new Error('Project not found');
      }

      const fs = await import('fs/promises');
      const path = await import('path');

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Write all files
      for (const file of project.files) {
        const fullPath = path.join(outputDir, file.path);
        const dir = path.dirname(fullPath);
        
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, file.content, 'utf-8');
      }

      console.log(`✅ Project files generated: ${outputDir}`);
      return outputDir;

    } catch (error) {
      console.error('Error generating project files:', error);
      throw new Error(`Failed to generate files: ${error}`);
    }
  }

  /**
   * Delete a project and all its files
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      await prisma.project.delete({
        where: { id: projectId }
      });

      console.log(`✅ Project deleted: ${projectId}`);

    } catch (error) {
      console.error('Error deleting project:', error);
      throw new Error(`Failed to delete project: ${error}`);
    }
  }

  private applyCustomizations(content: string, customizations: Record<string, any>): string {
    let customizedContent = content;
    
    Object.keys(customizations).forEach(key => {
      const placeholder = `{{${key}}}`;
      customizedContent = customizedContent.replace(
        new RegExp(placeholder, 'g'), 
        customizations[key]
      );
    });
    
    return customizedContent;
  }

  private mapFileType(templateType: string): FileType {
    switch (templateType) {
      case 'component': return FileType.CODE;
      case 'style': return FileType.STYLE;
      case 'config': return FileType.CONFIG;
      case 'data': return FileType.CONFIG;
      default: return FileType.CODE;
    }
  }

  private detectFileType(filePath: string): FileType {
    const ext = filePath.toLowerCase().split('.').pop();
    
    switch (ext) {
      case 'tsx':
      case 'ts':
      case 'jsx':
      case 'js':
        return FileType.CODE;
      case 'css':
      case 'scss':
      case 'sass':
        return FileType.STYLE;
      case 'json':
      case 'yml':
      case 'yaml':
      case 'toml':
        return FileType.CONFIG;
      case 'html':
      case 'htm':
        return FileType.MARKUP;
      case 'md':
      case 'mdx':
        return FileType.DOCUMENTATION;
      default:
        return FileType.CODE;
    }
  }
}

export const databaseProjectService = new DatabaseProjectService(); 