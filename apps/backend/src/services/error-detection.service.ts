import { exec } from 'child_process';
import { promisify } from 'util';
import { PreviewError, ErrorAnalysis } from '../types/error-detection.types';

const execAsync = promisify(exec);

export class ErrorDetectionService {
  private compilationPatterns = [
    {
      pattern: /Module not found: Error: Can't resolve '([^']+)'/,
      type: 'import' as const,
      severity: 'high' as const,
      message: 'Missing module or import error',
      details: 'The app cannot find a required file or module',
      autoFixable: true,
      suggestedFix: 'Add missing file or fix import path'
    },
    {
      pattern: /Failed to compile/,
      type: 'compilation' as const,
      severity: 'critical' as const,
      message: 'React app compilation failed',
      details: 'The React development server cannot compile the application',
      autoFixable: true,
      suggestedFix: 'Fix syntax errors or missing dependencies'
    },
    {
      pattern: /ERROR in ([^:]+):/,
      type: 'compilation' as const,
      severity: 'high' as const,
      message: 'Webpack compilation error',
      details: 'There are syntax or import errors in the code',
      autoFixable: true,
      suggestedFix: 'Check for syntax errors and missing imports'
    },
    {
      pattern: /Cannot find module '([^']+)'/,
      type: 'dependency' as const,
      severity: 'high' as const,
      message: 'Missing dependency',
      details: 'A required npm package is not installed',
      autoFixable: true,
      suggestedFix: 'Install missing npm package'
    },
    {
      pattern: /EADDRINUSE/,
      type: 'network' as const,
      severity: 'medium' as const,
      message: 'Port already in use',
      details: 'The development server port is already occupied',
      autoFixable: true,
      suggestedFix: 'Use a different port or stop conflicting process'
    }
  ];

  private runtimePatterns = [
    {
      pattern: /TypeError: ([^\\n]+)/,
      type: 'runtime' as const,
      severity: 'high' as const,
      message: 'Runtime type error',
      details: 'The app encountered a type error during execution',
      autoFixable: false,
      suggestedFix: 'Check variable types and null handling'
    },
    {
      pattern: /ReferenceError: ([^\\n]+)/,
      type: 'runtime' as const,
      severity: 'high' as const,
      message: 'Reference error',
      details: 'The app is trying to use an undefined variable or function',
      autoFixable: false,
      suggestedFix: 'Check for undefined variables and function declarations'
    }
  ];

  /**
   * Scan container logs for errors
   */
  async scanContainerLogs(containerId: string): Promise<PreviewError[]> {
    try {
      const { stdout } = await execAsync(`docker logs ${containerId}`);
      const logs = stdout.split('\n');
      
      return this.analyzeLogs(logs, containerId);
    } catch (error) {
      console.error('Error scanning container logs:', error);
      return [];
    }
  }

  /**
   * Analyze logs for error patterns
   */
  private analyzeLogs(logs: string[], containerId: string): PreviewError[] {
    const errors: PreviewError[] = [];
    const allPatterns = [...this.compilationPatterns, ...this.runtimePatterns];

    for (const logLine of logs) {
      for (const pattern of allPatterns) {
        const match = logLine.match(pattern.pattern);
        if (match) {
          const error: PreviewError = {
            id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: pattern.type,
            severity: pattern.severity,
            message: pattern.message,
            details: pattern.details,
            suggestedFix: pattern.suggestedFix,
            autoFixable: pattern.autoFixable,
            detectedAt: new Date(),
            containerId,
            logs: [logLine],
            errorPattern: match[0]
          };

          // Avoid duplicate errors
          const isDuplicate = errors.some(existing => 
            existing.type === error.type && 
            existing.message === error.message
          );

          if (!isDuplicate) {
            errors.push(error);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Get error analysis summary
   */
  getErrorAnalysis(errors: PreviewError[]): ErrorAnalysis {
    const fixableErrors = errors.filter(error => error.autoFixable);
    const mostCriticalError = errors.reduce((most, current) => {
      const severityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
      return severityOrder[current.severity] > severityOrder[most.severity] ? current : most;
    }, errors[0]);

    const summary = `${errors.length} error(s) detected - ${fixableErrors.length} auto-fixable`;

    return {
      errors,
      summary,
      mostCriticalError,
      fixableErrors
    };
  }

  /**
   * Check if container has critical errors
   */
  hasCriticalErrors(errors: PreviewError[]): boolean {
    return errors.some(error => error.severity === 'critical');
  }

  /**
   * Get most common error types
   */
  getErrorTypeBreakdown(errors: PreviewError[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

export const errorDetectionService = new ErrorDetectionService(); 