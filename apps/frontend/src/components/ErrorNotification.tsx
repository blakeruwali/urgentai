import React from 'react';

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

interface ErrorNotificationProps {
  errors: PreviewError[];
  onFixError: (error: PreviewError) => void;
  onFixAll: () => void;
  onViewDetails: (error: PreviewError) => void;
  onIgnore: (error: PreviewError) => void;
  onClose?: () => void;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-600 border-red-700';
    case 'high':
      return 'bg-orange-500 border-orange-600';
    case 'medium':
      return 'bg-yellow-500 border-yellow-600';
    case 'low':
      return 'bg-blue-500 border-blue-600';
    default:
      return 'bg-gray-500 border-gray-600';
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'critical':
      return '🚨';
    case 'high':
      return '⚠️';
    case 'medium':
      return '⚠️';
    case 'low':
      return 'ℹ️';
    default:
      return '❓';
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'compilation':
      return '🔧';
    case 'runtime':
      return '⚡';
    case 'dependency':
      return '📦';
    case 'network':
      return '🌐';
    case 'container':
      return '🐳';
    case 'import':
      return '📁';
    default:
      return '❓';
  }
};

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  errors,
  onFixError,
  onFixAll,
  onViewDetails,
  onIgnore,
  onClose
}) => {
  if (errors.length === 0) {
    return null;
  }

  // Sort errors by severity (critical first)
  const sortedErrors = [...errors].sort((a, b) => {
    const severityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });

  return (
    <div className="space-y-4">
             <div className="flex items-center justify-between">
         <h3 className="text-lg font-semibold text-gray-900">
           Preview Issues ({errors.length})
         </h3>
         <div className="flex items-center space-x-4">
           <div className="text-sm text-gray-500">
             {errors.filter(e => e.autoFixable).length} auto-fixable
           </div>
           {errors.filter(e => e.autoFixable).length > 0 && (
             <button
               onClick={onFixAll}
               className="bg-green-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
             >
               <span>🔧</span>
               <span>Fix All ({errors.filter(e => e.autoFixable).length})</span>
             </button>
           )}
           {onClose && (
             <button
               onClick={onClose}
               className="text-gray-500 hover:text-gray-700 transition-colors"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
           )}
         </div>
       </div>
      
      {sortedErrors.map((error) => (
        <div
          key={error.id}
          className={`border rounded-lg p-4 ${getSeverityColor(error.severity)} text-white`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">{getSeverityIcon(error.severity)}</span>
                <span className="text-lg">{getTypeIcon(error.type)}</span>
                <h4 className="font-medium text-white">
                  {error.message}
                </h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  error.severity === 'critical' ? 'bg-red-700' :
                  error.severity === 'high' ? 'bg-orange-600' :
                  error.severity === 'medium' ? 'bg-yellow-600' :
                  'bg-blue-600'
                }`}>
                  {error.severity.toUpperCase()}
                </span>
              </div>
              
              <p className="text-sm text-gray-100 mb-3">
                {error.details}
              </p>
              
              <div className="text-sm text-gray-200">
                <strong>Suggested fix:</strong> {error.suggestedFix}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 mt-4">
            {error.autoFixable && (
              <button
                onClick={() => onFixError(error)}
                className="bg-white text-gray-900 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors flex items-center space-x-2"
              >
                <span>🔧</span>
                <span>Fix This</span>
              </button>
            )}
            
            <button
              onClick={() => onViewDetails(error)}
              className="bg-transparent border border-white text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-white hover:text-gray-900 transition-colors flex items-center space-x-2"
            >
              <span>👁️</span>
              <span>View Details</span>
            </button>
            
            <button
              onClick={() => onIgnore(error)}
              className="bg-transparent border border-white text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-white hover:text-gray-900 transition-colors flex items-center space-x-2"
            >
              <span>✕</span>
              <span>Ignore</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}; 