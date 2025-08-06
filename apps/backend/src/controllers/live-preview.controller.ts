import { Request, Response } from 'express';
import { livePreviewService } from '../services/live-preview.service';

export const livePreviewController = {
  /**
   * Start a live preview for a project
   */
  async startPreview(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { userId, autoCleanup = true, timeout = 30 } = req.body;

      if (!projectId || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: projectId and userId'
        });
      }

      console.log(`🚀 Starting VM preview for project: ${projectId}`);

      const preview = await livePreviewService.createPreview({
        projectId,
        userId,
        autoCleanup,
        timeout
      });

      res.json({
        success: true,
        preview: {
          id: preview.id,
          url: preview.url,
          status: preview.status,
          port: preview.port,
          containerId: preview.containerId
        }
      });

    } catch (error) {
      console.error('Error starting VM preview:', error);
      res.status(500).json({
        success: false,
        error: `Failed to start VM preview: ${error}`
      });
    }
  },

  /**
   * Get preview status and URL
   */
  async getPreview(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing projectId parameter'
        });
      }

      const preview = await livePreviewService.getPreview(projectId);

      if (!preview) {
        return res.status(404).json({
          success: false,
          error: 'Preview not found'
        });
      }

      res.json({
        success: true,
        preview: {
          id: preview.id,
          url: preview.url,
          status: preview.status,
          port: preview.port,
          containerId: preview.containerId,
          createdAt: preview.createdAt,
          lastAccessed: preview.lastAccessed,
          errors: preview.errors || [],
          detectedErrors: preview.detectedErrors || [],
          lastErrorScan: preview.lastErrorScan
        }
      });

    } catch (error) {
      console.error('Error getting VM preview:', error);
      res.status(500).json({
        success: false,
        error: `Failed to get VM preview: ${error}`
      });
    }
  },

  /**
   * Stop a preview
   */
  async stopPreview(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing projectId parameter'
        });
      }

      await livePreviewService.stopPreview(projectId);

      res.json({
        success: true,
        message: 'VM preview stopped successfully'
      });

    } catch (error) {
      console.error('Error stopping VM preview:', error);
      res.status(500).json({
        success: false,
        error: `Failed to stop VM preview: ${error}`
      });
    }
  },

  /**
   * List all active previews
   */
  async listPreviews(req: Request, res: Response) {
    try {
      const previews = await livePreviewService.listPreviews();

      res.json({
        success: true,
        previews: previews.map(preview => ({
          id: preview.id,
          projectId: preview.projectId,
          url: preview.url,
          status: preview.status,
          port: preview.port,
          containerId: preview.containerId,
          createdAt: preview.createdAt,
          lastAccessed: preview.lastAccessed
        }))
      });

    } catch (error) {
      console.error('Error listing VM previews:', error);
      res.status(500).json({
        success: false,
        error: `Failed to list VM previews: ${error}`
      });
    }
  },

  /**
   * Update preview with latest code
   */
  async updatePreview(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing projectId parameter'
        });
      }

      console.log(`🔄 Updating VM preview for project: ${projectId}`);

      const preview = await livePreviewService.updatePreview(projectId);

      res.json({
        success: true,
        preview: {
          id: preview.id,
          url: preview.url,
          status: preview.status,
          port: preview.port,
          containerId: preview.containerId
        }
      });

    } catch (error) {
      console.error('Error updating VM preview:', error);
      res.status(500).json({
        success: false,
        error: `Failed to update VM preview: ${error}`
      });
    }
  },

  /**
   * Get container logs for debugging
   */
  async getContainerLogs(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing projectId parameter'
        });
      }

      const logs = await livePreviewService.getContainerLogs(projectId);

      res.json({
        success: true,
        logs: logs
      });

    } catch (error) {
      console.error('Error getting container logs:', error);
      res.status(500).json({
        success: false,
        error: `Failed to get container logs: ${error}`
      });
    }
  },

  /**
   * Execute command inside the container (for AI fixes)
   */
  async executeInContainer(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { command } = req.body;

      if (!projectId || !command) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: projectId and command'
        });
      }

      console.log(`🔧 Executing command in VM container: ${command}`);

      const output = await livePreviewService.executeInContainer(projectId, command);

      res.json({
        success: true,
        output: output
      });

    } catch (error) {
      console.error('Error executing command in container:', error);
      res.status(500).json({
        success: false,
        error: `Failed to execute command in container: ${error}`
      });
    }
  },

  /**
   * Get detailed container information including errors
   */
  async getContainerInfo(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing projectId parameter'
        });
      }

      const preview = await livePreviewService.getPreview(projectId);
      if (!preview) {
        return res.status(404).json({
          success: false,
          error: 'Preview not found'
        });
      }

      // Get container logs
      const logs = await livePreviewService.getContainerLogs(projectId);

      res.json({
        success: true,
        container: {
          id: preview.id,
          projectId: preview.projectId,
          url: preview.url,
          status: preview.status,
          port: preview.port,
          containerId: preview.containerId,
          createdAt: preview.createdAt,
          lastAccessed: preview.lastAccessed,
          errors: preview.errors || [],
          detectedErrors: preview.detectedErrors || [],
          lastErrorScan: preview.lastErrorScan,
          logs: logs
        }
      });

    } catch (error) {
      console.error('Error getting container info:', error);
      res.status(500).json({
        success: false,
        error: `Failed to get container info: ${error}`
      });
    }
  },

  /**
   * Detect errors in container logs
   */
  async detectErrors(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing projectId parameter'
        });
      }

      const preview = await livePreviewService.getPreview(projectId);
      if (!preview || !preview.containerId) {
        return res.status(404).json({
          success: false,
          error: 'Preview not found or container not running'
        });
      }

      console.log(`🔍 Detecting errors for project: ${projectId}`);

      const errorAnalysis = await livePreviewService.getErrorAnalysis(preview.containerId);
      const updatedContainer = await livePreviewService.updateContainerErrors(projectId);

      res.json({
        success: true,
        errors: errorAnalysis.errors,
        analysis: errorAnalysis.analysis,
        hasCriticalErrors: errorAnalysis.hasCriticalErrors,
        container: updatedContainer
      });

    } catch (error) {
      console.error('Error detecting errors:', error);
      res.status(500).json({
        success: false,
        error: `Failed to detect errors: ${error}`
      });
    }
  },

  /**
   * Get error analysis for a preview
   */
  async getErrorAnalysis(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing projectId parameter'
        });
      }

      const preview = await livePreviewService.getPreview(projectId);
      if (!preview || !preview.containerId) {
        return res.status(404).json({
          success: false,
          error: 'Preview not found or container not running'
        });
      }

      const errorAnalysis = await livePreviewService.getErrorAnalysis(preview.containerId);

      res.json({
        success: true,
        errors: errorAnalysis.errors,
        analysis: errorAnalysis.analysis,
        hasCriticalErrors: errorAnalysis.hasCriticalErrors,
        errorCount: errorAnalysis.errors.length,
        fixableErrors: errorAnalysis.errors.filter(e => e.autoFixable).length
      });

    } catch (error) {
      console.error('Error getting error analysis:', error);
      res.status(500).json({
        success: false,
        error: `Failed to get error analysis: ${error}`
      });
    }
  }
}; 