import { Request, Response } from 'express';
import { projectService } from '../services/project.service';
import { templateService } from '../services/template.service';
import { anthropicService } from '../services/anthropic.service';

export class ProjectController {
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
   * Create a new project from natural language description
   */
  async createProjectFromDescription(req: Request, res: Response): Promise<void> {
    try {
      const { description, projectName } = req.body;

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

Determine:
1. Which template to use: "react-todo" or "react-landing"
2. What customizations to apply

Respond with this exact JSON format:
{
  "templateId": "react-todo",
  "customizations": {
    "projectName": "${projectName}",
    "additionalFeatures": []
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
        options: { temperature: 0.1 } // Lower temperature for structured response
      });

      // Parse Claude's response
      let templateId = 'react-todo'; // Default fallback
      let customizations = { projectName };
      
      try {
        const analysisJson = JSON.parse(analysisResponse.content);
        templateId = analysisJson.templateId || templateId;
        customizations = { ...customizations, ...analysisJson.customizations };
      } catch (parseError) {
        console.warn('Failed to parse Claude analysis, using defaults:', parseError);
      }

      // Get the template
      const template = templateService.getTemplate(templateId);
      if (!template) {
        res.status(400).json({
          error: 'Template not found',
          templateId
        });
        return;
      }

      // Create the project
      const project = await projectService.createProject(
        projectName,
        template,
        customizations
      );

      res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          type: project.type,
          path: project.path,
          fileCount: project.files.length,
          createdAt: project.createdAt
        },
        template: {
          id: template.id,
          name: template.name
        },
        customizations
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
   * Create project from specific template
   */
  async createProject(req: Request, res: Response): Promise<void> {
    try {
      const { templateId, projectName, customizations } = req.body;

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

      const project = await projectService.createProject(
        projectName,
        template,
        { projectName, ...customizations }
      );

      res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          type: project.type,
          path: project.path,
          fileCount: project.files.length,
          createdAt: project.createdAt
        }
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
   * Get project details
   */
  async getProject(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await projectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      res.json({
        success: true,
        project
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
   * Update a file in the project using Claude
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

      // Get current project
      const project = await projectService.getProject(projectId);
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

      // Update the file
      await projectService.updateFile(projectId, filePath, modificationResponse.content);

      res.json({
        success: true,
        message: 'File updated successfully',
        filePath,
        updatedContent: modificationResponse.content
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
   * Add a new file to the project using Claude
   */
  async addFile(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { filePath, instruction, fileType } = req.body;

      if (!filePath || !instruction) {
        res.status(400).json({
          error: 'File path and instruction are required'
        });
        return;
      }

      // Get current project
      const project = await projectService.getProject(projectId);
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
Type: ${fileType || 'component'}
Project Context: This is a ${project.type} project with existing files.

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

      // Add the file
      await projectService.addFile(projectId, {
        path: filePath,
        content: generationResponse.content,
        type: fileType || 'component'
      });

      res.json({
        success: true,
        message: 'File added successfully',
        filePath,
        content: generationResponse.content
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
   * Start preview for a project
   */
  async startPreview(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await projectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      const previewUrl = await projectService.startPreview(projectId);

      res.json({
        success: true,
        previewUrl,
        projectId,
        message: 'Preview started successfully'
      });

    } catch (error: any) {
      console.error('Error starting preview:', error);
      res.status(500).json({
        error: 'Failed to start preview',
        message: error.message
      });
    }
  }

  /**
   * List all projects
   */
  async listProjects(req: Request, res: Response): Promise<void> {
    try {
      const projects = await projectService.listProjects();
      
      res.json({
        success: true,
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          type: p.type,
          fileCount: p.files.length,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }))
      });

    } catch (error: any) {
      console.error('Error listing projects:', error);
      res.status(500).json({
        error: 'Failed to list projects',
        message: error.message
      });
    }
  }
}

export const projectController = new ProjectController(); 