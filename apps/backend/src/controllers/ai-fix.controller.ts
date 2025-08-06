import { Request, Response } from 'express';
import { aiFixService } from '../services/ai-fix.service';
import { databaseProjectService } from '../services/database-project.service';
import { livePreviewService } from '../services/live-preview.service';
import { PreviewError } from '../types/error-detection.types';

export const aiFixController = {
  /**
   * Fix a single error
   */
  async fixError(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { errorId } = req.body;

      console.log('🔧 AI fixing error:', errorId, 'for project:', projectId);

      // Get project files from database
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      // Get current errors from preview
      const preview = await livePreviewService.getPreview(projectId);
      if (!preview || !preview.detectedErrors) {
        return res.status(404).json({ success: false, error: 'No errors found' });
      }

      // Find the specific error
      const error = preview.detectedErrors.find(e => e.id === errorId);
      if (!error) {
        return res.status(404).json({ success: false, error: 'Error not found' });
      }

      // Convert database project files to the format expected by AI fix service
      const projectFiles = project.files?.map(file => ({
        path: file.path,
        content: file.content,
        type: file.type
      })) || [];

      // Apply AI fix
      const fixResult = await aiFixService.fixError(error, projectFiles);

      if (fixResult.success) {
        // Apply the fix to the database project
        await databaseProjectService.applyAIFix(projectId, fixResult);
        
        // Restart preview to apply changes
        await livePreviewService.updatePreview(projectId);
        
        console.log('✅ AI fix applied successfully');
        return res.json({
          success: true,
          fixResult,
          message: 'AI fix applied successfully'
        });
      } else {
        console.error('❌ AI fix failed:', fixResult.error);
        return res.status(500).json({
          success: false,
          error: fixResult.error || 'AI fix failed'
        });
      }
    } catch (error) {
      console.error('❌ Error in AI fix controller:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  /**
   * Fix all auto-fixable errors
   */
  async fixAllErrors(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      console.log('🔧 AI fixing all errors for project:', projectId);

      // Get project files from database
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      // Get current errors from preview
      const preview = await livePreviewService.getPreview(projectId);
      if (!preview || !preview.detectedErrors) {
        return res.status(404).json({ success: false, error: 'No errors found' });
      }

      const autoFixableErrors = preview.detectedErrors.filter(e => e.autoFixable);
      if (autoFixableErrors.length === 0) {
        return res.json({
          success: true,
          message: 'No auto-fixable errors found'
        });
      }

      // Convert database project files to the format expected by AI fix service
      const projectFiles = project.files?.map(file => ({
        path: file.path,
        content: file.content,
        type: file.type
      })) || [];

      // Apply AI fixes
      const fixResults = await aiFixService.fixAllErrors(autoFixableErrors, projectFiles);

      const successfulFixes = fixResults.filter(r => r.success);
      
      if (successfulFixes.length > 0) {
        // Apply all successful fixes to the database project
        for (const fixResult of successfulFixes) {
          await databaseProjectService.applyAIFix(projectId, fixResult);
        }
        
        // Restart preview to apply changes
        await livePreviewService.updatePreview(projectId);
        
        console.log('✅ AI fixes applied successfully:', successfulFixes.length, 'fixes');
        return res.json({
          success: true,
          fixResults: successfulFixes,
          message: `Applied ${successfulFixes.length} AI fixes successfully`
        });
      } else {
        console.error('❌ All AI fixes failed');
        return res.status(500).json({
          success: false,
          error: 'All AI fixes failed'
        });
      }
    } catch (error) {
      console.error('❌ Error in AI fix all controller:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}; 