export interface PreviewError {
  id: string;
  type: 'compilation' | 'runtime' | 'dependency' | 'network' | 'container' | 'import';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: string;
  suggestedFix: string;
  autoFixable: boolean;
  detectedAt: Date;
  containerId?: string;
  logs?: string[];
  errorPattern?: string;
}

export interface ErrorAnalysis {
  totalErrors: number;
  criticalErrors: number;
  autoFixableErrors: number;
  errorTypeBreakdown: Record<string, number>;
  mostCriticalError?: PreviewError;
  mostAutoFixableError?: PreviewError;
  summary: string;
} 