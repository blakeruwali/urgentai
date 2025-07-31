import { Request, Response } from 'express';
import { databaseProjectService } from '../services/database-project.service';
import { templateService } from '../services/template.service';
import { anthropicService } from '../services/anthropic.service';
import { ProjectType } from '../generated/prisma';

export class DatabaseProjectController {
  /**
   * Get all available templates
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = templateService.getTemplates();
      
      res.json({
        success: true,
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          type: t.type
        }))
      });
    } catch (error: any) {
      console.error('Error getting templates:', error);
      res.status(500).json({
        error: 'Failed to get templates',
        message: error.message
      });
    }
  }

  /**
   * Create a new project from natural language description - STORED IN DATABASE
   */
  async createProjectFromDescription(req: Request, res: Response): Promise<void> {
    try {
      const { description, projectName, userId = 'default-user' } = req.body;

      if (!description || !projectName) {
        res.status(400).json({
          error: 'Description and project name are required'
        });
        return;
      }

      // Use Claude to analyze the description and determine the best template
      const analysisPrompt = `
Analyze this app description and respond with ONLY a JSON object:

Description: "${description}"

Determine which template to use from: "react-todo" or "react-landing"

Respond with this exact JSON format:
{
  "templateId": "react-todo",
  "projectType": "REACT",
  "customizations": {
    "projectName": "${projectName}",
    "description": "Brief app description"
  },
  "reasoning": "Brief explanation"
}`;

      const analysisResponse = await anthropicService.sendMessage({
        messages: [{ 
          id: 'analysis-' + Date.now(),
          role: 'user', 
          content: analysisPrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `project-analysis-${Date.now()}`,
        options: { temperature: 0.1 }
      });

      // Parse Claude's response
      let templateId = 'react-todo';
      let projectType = ProjectType.REACT;
      let customizations = { projectName, description };
      
      try {
        const analysisJson = JSON.parse(analysisResponse.content);
        templateId = analysisJson.templateId || templateId;
        projectType = analysisJson.projectType || projectType;
        customizations = { ...customizations, ...analysisJson.customizations };
      } catch (parseError) {
        console.warn('Failed to parse Claude analysis, using defaults:', parseError);
      }

      // Create the project in database
      const project = await databaseProjectService.createProject({
        name: projectName,
        description: description,
        type: projectType,
        templateId,
        userId,
        customizations
      });

      res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          type: project.type,
          templateId: project.templateId,
          fileCount: project.files?.length || 0,
          status: project.status,
          createdAt: project.createdAt
        },
        message: `Project "${projectName}" created successfully in database with ${project.files?.length || 0} files`,
        storage: 'database'
      });

    } catch (error: any) {
      console.error('Error creating project from description:', error);
      res.status(500).json({
        error: 'Failed to create project',
        message: error.message
      });
    }
  }

  /**
   * Create project from specific template - STORED IN DATABASE
   */
  async createProject(req: Request, res: Response): Promise<void> {
    try {
      const { templateId, projectName, customizations, userId = 'default-user' } = req.body;

      if (!templateId || !projectName) {
        res.status(400).json({
          error: 'Template ID and project name are required'
        });
        return;
      }

      const template = templateService.getTemplate(templateId);
      if (!template) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      const project = await databaseProjectService.createProject({
        name: projectName,
        type: ProjectType.REACT, // Default to React for now
        templateId,
        userId,
        customizations: { projectName, ...customizations }
      });

      res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          type: project.type,
          fileCount: project.files?.length || 0,
          status: project.status,
          createdAt: project.createdAt
        },
        storage: 'database'
      });

    } catch (error: any) {
      console.error('Error creating project:', error);
      res.status(500).json({
        error: 'Failed to create project',
        message: error.message
      });
    }
  }

  /**
   * Get project details from database
   */
  async getProject(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      res.json({
        success: true,
        project,
        storage: 'database'
      });

    } catch (error: any) {
      console.error('Error getting project:', error);
      res.status(500).json({
        error: 'Failed to get project',
        message: error.message
      });
    }
  }

  /**
   * List all projects for a user from database
   */
  async listProjects(req: Request, res: Response): Promise<void> {
    try {
      const { userId = 'default-user' } = req.query;
      
      const projects = await databaseProjectService.listUserProjects(userId as string);
      
      res.json({
        success: true,
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          type: p.type,
          status: p.status,
          fileCount: p.metadata?.fileCount || 0,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        })),
        storage: 'database'
      });

    } catch (error: any) {
      console.error('Error listing projects:', error);
      res.status(500).json({
        error: 'Failed to list projects',
        message: error.message
      });
    }
  }

  /**
   * Update a file in the project using Claude - DATABASE STORAGE
   */
  async updateFile(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { filePath, instruction, currentContent } = req.body;

      if (!filePath || !instruction) {
        res.status(400).json({
          error: 'File path and instruction are required'
        });
        return;
      }

      // Get current project from database
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      // Use Claude to modify the file
      const modificationPrompt = `
You are a code generation expert. Update the following file based on the instruction.

File: ${filePath}
Current Content:
\`\`\`
${currentContent}
\`\`\`

Instruction: ${instruction}

Respond with ONLY the updated file content. No explanations, no markdown code blocks, just the raw content.`;

      const modificationResponse = await anthropicService.sendMessage({
        messages: [{ 
          id: 'modification-' + Date.now(),
          role: 'user', 
          content: modificationPrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `file-modification-${Date.now()}`,
        options: { temperature: 0.2 }
      });

      // Update the file in database
      const updatedFile = await databaseProjectService.updateFile(
        projectId, 
        filePath, 
        modificationResponse.content
      );

      res.json({
        success: true,
        message: 'File updated successfully in database',
        file: updatedFile,
        storage: 'database'
      });

    } catch (error: any) {
      console.error('Error updating file:', error);
      res.status(500).json({
        error: 'Failed to update file',
        message: error.message
      });
    }
  }

  /**
   * Add a new file to the project using Claude - DATABASE STORAGE
   */
  async addFile(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { filePath, instruction } = req.body;

      if (!filePath || !instruction) {
        res.status(400).json({
          error: 'File path and instruction are required'
        });
        return;
      }

      // Get current project from database
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      // Use Claude to generate the file content
      const generationPrompt = `
You are a code generation expert. Create a new file based on the instruction.

File: ${filePath}
Project: ${project.name} (${project.type})
Context: This is a ${project.type} project with existing files.

Instruction: ${instruction}

Respond with ONLY the file content. No explanations, no markdown code blocks, just the raw content.`;

      const generationResponse = await anthropicService.sendMessage({
        messages: [{ 
          id: 'generation-' + Date.now(),
          role: 'user', 
          content: generationPrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `file-generation-${Date.now()}`,
        options: { temperature: 0.3 }
      });

      // Add the file to database
      const newFile = await databaseProjectService.addFile(
        projectId, 
        filePath, 
        generationResponse.content
      );

      res.json({
        success: true,
        message: 'File added successfully to database',
        file: newFile,
        storage: 'database'
      });

    } catch (error: any) {
      console.error('Error adding file:', error);
      res.status(500).json({
        error: 'Failed to add file',
        message: error.message
      });
    }
  }

  /**
   * Generate project files on demand for preview
   */
  async generatePreview(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      // Generate files temporarily for preview
      const tempDir = `./temp-preview/${projectId}-${Date.now()}`;
      const outputPath = await databaseProjectService.generateProjectFiles(projectId, tempDir);

      res.json({
        success: true,
        message: 'Preview files generated',
        outputPath,
        fileCount: project.files?.length || 0,
        storage: 'database -> temporary files'
      });

    } catch (error: any) {
      console.error('Error generating preview:', error);
      res.status(500).json({
        error: 'Failed to generate preview',
        message: error.message
      });
    }
  }

  /**
   * Export project as downloadable zip
   */
  async exportProject(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      // TODO: Implement zip generation from database files
      res.json({
        success: true,
        message: 'Export feature coming soon',
        project: {
          id: project.id,
          name: project.name,
          fileCount: project.files?.length || 0
        },
        note: 'Will generate downloadable zip file'
      });

    } catch (error: any) {
      console.error('Error exporting project:', error);
      res.status(500).json({
        error: 'Failed to export project',
        message: error.message
      });
    }
  }
}

export const databaseProjectController = new DatabaseProjectController(); 