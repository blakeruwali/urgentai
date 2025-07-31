import { anthropicService } from './anthropic.service';
import { templateService } from './template.service';
import { ProjectTemplate } from './project.service';

export interface AppGenerationRequest {
  description: string;
  projectName: string;
  preferredType?: 'react' | 'vue' | 'node' | 'static';
  features?: string[];
  style?: 'modern' | 'minimal' | 'colorful';
}

export interface AppGenerationResult {
  templateId: string;
  customizations: Record<string, any>;
  additionalFiles?: Array<{
    path: string;
    content: string;
    type: 'component' | 'style' | 'config' | 'data';
  }>;
  reasoning: string;
}

export class CodeGenerationService {
  /**
   * Analyze user description and determine best approach for app creation
   */
  async analyzeAppDescription(request: AppGenerationRequest): Promise<AppGenerationResult> {
    const templates = templateService.getTemplates();
    const templateDescriptions = templates.map(t => 
      `${t.id}: ${t.name} - ${t.description}`
    ).join('\n');

    const analysisPrompt = `
You are an expert app development assistant. Analyze this request and determine the best approach.

USER REQUEST:
Description: "${request.description}"
Project Name: "${request.projectName}"
Preferred Type: ${request.preferredType || 'any'}
Features: ${request.features?.join(', ') || 'none specified'}
Style: ${request.style || 'modern'}

AVAILABLE TEMPLATES:
${templateDescriptions}

ANALYSIS TASK:
1. Choose the most appropriate template
2. Identify customizations needed
3. Determine if additional files are needed
4. Provide clear reasoning

Respond with this EXACT JSON format:
{
  "templateId": "react-todo",
  "customizations": {
    "projectName": "${request.projectName}",
    "primaryColor": "#3182ce",
    "features": ["dark-mode", "local-storage"]
  },
  "additionalFiles": [
    {
      "path": "src/components/CustomComponent.tsx",
      "content": "// Component code here",
      "type": "component"
    }
  ],
  "reasoning": "Brief explanation of choices made"
}`;

    try {
      const response = await anthropicService.sendMessage({
        messages: [{
          id: `analysis-${Date.now()}`,
          role: 'user',
          content: analysisPrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `app-analysis-${Date.now()}`,
        options: { 
          temperature: 0.1, // Low temperature for consistent structured output
          max_tokens: 2000 
        }
      });

      // Parse Claude's response
      const result = this.parseClaudeResponse(response.content, request);
      
      return result;

    } catch (error) {
      console.error('Error analyzing app description:', error);
      
      // Fallback to simple template selection
      return this.getFallbackAnalysis(request);
    }
  }

  /**
   * Generate additional components based on user request
   */
  async generateComponent(
    componentName: string,
    description: string,
    projectType: string,
    existingContext?: string
  ): Promise<string> {
    const componentPrompt = `
You are a React/TypeScript expert. Generate a high-quality component.

COMPONENT REQUEST:
Name: ${componentName}
Description: ${description}
Project Type: ${projectType}
Context: ${existingContext || 'New component for modern React app'}

REQUIREMENTS:
- Use TypeScript with proper types
- Follow modern React patterns (hooks, functional components)
- Include proper props interface
- Add responsive design with CSS modules or styled-components
- Include accessibility attributes
- Use modern ES6+ syntax

Generate ONLY the component code. No explanations, no markdown blocks.`;

    try {
      const response = await anthropicService.sendMessage({
        messages: [{
          id: `component-${Date.now()}`,
          role: 'user',
          content: componentPrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `component-gen-${Date.now()}`,
        options: { temperature: 0.3 }
      });

      return response.content;

    } catch (error) {
      console.error('Error generating component:', error);
      throw new Error('Failed to generate component');
    }
  }

  /**
   * Modify existing code based on user instruction
   */
  async modifyCode(
    currentCode: string,
    instruction: string,
    fileType: string,
    fileName: string
  ): Promise<string> {
    const modificationPrompt = `
You are a code modification expert. Update the existing code based on the instruction.

FILE: ${fileName}
TYPE: ${fileType}
CURRENT CODE:
\`\`\`
${currentCode}
\`\`\`

INSTRUCTION: ${instruction}

REQUIREMENTS:
- Maintain existing functionality unless explicitly asked to change
- Follow best practices and conventions
- Preserve code style and formatting
- Add comments for complex changes
- Ensure TypeScript compatibility

Return ONLY the modified code. No explanations, no markdown blocks.`;

    try {
      const response = await anthropicService.sendMessage({
        messages: [{
          id: `modification-${Date.now()}`,
          role: 'user',
          content: modificationPrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `code-mod-${Date.now()}`,
        options: { temperature: 0.2 }
      });

      return response.content;

    } catch (error) {
      console.error('Error modifying code:', error);
      throw new Error('Failed to modify code');
    }
  }

  /**
   * Generate CSS styles based on description
   */
  async generateStyles(
    description: string,
    componentName: string,
    styleType: 'css' | 'scss' | 'styled-components' = 'css'
  ): Promise<string> {
    const stylePrompt = `
You are a CSS/styling expert. Create modern, responsive styles.

STYLE REQUEST:
Component: ${componentName}
Description: ${description}
Type: ${styleType}

REQUIREMENTS:
- Modern CSS with flexbox/grid
- Responsive design (mobile-first)
- Professional color scheme
- Smooth transitions and animations
- Accessibility considerations
- Dark mode compatible variables

Generate ONLY the style code. No explanations, no markdown blocks.`;

    try {
      const response = await anthropicService.sendMessage({
        messages: [{
          id: `styles-${Date.now()}`,
          role: 'user',
          content: stylePrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `styles-gen-${Date.now()}`,
        options: { temperature: 0.4 }
      });

      return response.content;

    } catch (error) {
      console.error('Error generating styles:', error);
      throw new Error('Failed to generate styles');
    }
  }

  private parseClaudeResponse(content: string, request: AppGenerationRequest): AppGenerationResult {
    try {
      // Try to extract JSON from Claude's response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate required fields
        if (parsed.templateId && parsed.customizations && parsed.reasoning) {
          return {
            templateId: parsed.templateId,
            customizations: {
              projectName: request.projectName,
              ...parsed.customizations
            },
            additionalFiles: parsed.additionalFiles || [],
            reasoning: parsed.reasoning
          };
        }
      }
    } catch (error) {
      console.warn('Failed to parse Claude response as JSON:', error);
    }

    // Fallback parsing
    return this.getFallbackAnalysis(request);
  }

  private getFallbackAnalysis(request: AppGenerationRequest): AppGenerationResult {
    // Simple keyword-based template selection
    const description = request.description.toLowerCase();
    
    let templateId = 'react-todo'; // Default
    let reasoning = 'Default todo template selected';

    if (description.includes('landing') || description.includes('website') || 
        description.includes('marketing') || description.includes('homepage')) {
      templateId = 'react-landing';
      reasoning = 'Landing page template selected based on keywords';
    } else if (description.includes('todo') || description.includes('task') || 
               description.includes('list') || description.includes('crud')) {
      templateId = 'react-todo';
      reasoning = 'Todo app template selected based on keywords';
    }

    return {
      templateId,
      customizations: {
        projectName: request.projectName,
        features: request.features || []
      },
      additionalFiles: [],
      reasoning
    };
  }
}

export const codeGenerationService = new CodeGenerationService(); 