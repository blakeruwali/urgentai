import { anthropicService } from './anthropic.service';
import { PreviewError } from '../types/error-detection.types';

export interface AIFixResult {
  success: boolean;
  fixType: 'file_creation' | 'file_modification' | 'dependency_install' | 'configuration_fix';
  filesCreated?: Array<{
    path: string;
    content: string;
  }>;
  filesModified?: Array<{
    path: string;
    content: string;
    lineNumber?: number;
  }>;
  commandsToRun?: string[];
  explanation: string;
  error?: string;
}

export class AIFixService {
  private async analyzeError(error: PreviewError, projectFiles: any[]): Promise<string> {
    const prompt = `
You are an expert React/JavaScript developer. Analyze this error and provide a detailed fix.

ERROR DETAILS:
- Type: ${error.type}
- Severity: ${error.severity}
- Message: ${error.message}
- Details: ${error.details}
- Suggested Fix: ${error.suggestedFix}

PROJECT FILES:
${projectFiles.map(f => `- ${f.path}: ${f.content.split('\n').length} lines`).join('\n')}

TASK: Analyze this error and provide a step-by-step fix. Focus on:
1. What's causing the error
2. What files need to be created/modified
3. What commands need to be run
4. The exact code changes needed

Be specific and provide exact file contents and commands.
`;

    const response = await anthropicService.sendMessage(prompt);
    return response;
  }

  private async generateFix(error: PreviewError, projectFiles: any[], analysis: string): Promise<AIFixResult> {
    const prompt = `
Based on this error analysis, generate the exact fix implementation:

ANALYSIS:
${analysis}

ERROR:
- Type: ${error.type}
- Message: ${error.message}

PROJECT FILES:
${projectFiles.map(f => `- ${f.path}: ${f.content.split('\n').length} lines`).join('\n')}

TASK: Generate the exact implementation for the fix. Return a JSON object with this structure:
{
  "success": true,
  "fixType": "file_creation|file_modification|dependency_install|configuration_fix",
  "filesCreated": [
    {
      "path": "src/App.tsx",
      "content": "import React from 'react';\\n\\nfunction App() {\\n  return (\\n    <div>Hello World</div>\\n  );\\n}\\n\\nexport default App;"
    }
  ],
  "filesModified": [
    {
      "path": "src/index.tsx",
      "content": "// modified content",
      "lineNumber": 7
    }
  ],
  "commandsToRun": [
    "npm install react-router-dom"
  ],
  "explanation": "Created missing App.tsx component that index.tsx was trying to import"
}

IMPORTANT: 
- Return ONLY valid JSON
- Use proper escaping for newlines (\\n)
- Be specific about file paths and content
- Include all necessary imports and exports
`;

    try {
      const response = await anthropicService.sendMessage(prompt);
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const fixResult: AIFixResult = JSON.parse(jsonMatch[0]);
      return fixResult;
    } catch (error) {
      console.error('❌ Error parsing AI fix response:', error);
      return {
        success: false,
        fixType: 'file_creation',
        explanation: 'Failed to parse AI response',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fixError(error: PreviewError, projectFiles: any[]): Promise<AIFixResult> {
    try {
      console.log('🔧 AI analyzing error:', error.message);
      
      // Step 1: Analyze the error
      const analysis = await this.analyzeError(error, projectFiles);
      console.log('📋 AI analysis completed');
      
      // Step 2: Generate the fix
      const fixResult = await this.generateFix(error, projectFiles, analysis);
      console.log('🔧 AI fix generated:', fixResult.fixType);
      
      return fixResult;
    } catch (error) {
      console.error('❌ Error in AI fix process:', error);
      return {
        success: false,
        fixType: 'file_creation',
        explanation: 'AI fix process failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fixAllErrors(errors: PreviewError[], projectFiles: any[]): Promise<AIFixResult[]> {
    console.log('🔧 AI fixing all errors:', errors.length);
    
    const fixPromises = errors
      .filter(error => error.autoFixable)
      .map(error => this.fixError(error, projectFiles));
    
    const results = await Promise.all(fixPromises);
    console.log('✅ AI fixes completed:', results.filter(r => r.success).length, 'successful');
    
    return results;
  }
}

export const aiFixService = new AIFixService(); 