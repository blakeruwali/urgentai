import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../stores/chatStore';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { ErrorNotification, PreviewError } from './ErrorNotification';

interface LivePreview {
  url: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  message?: string;
}

interface ProjectResponse {
  project: {
    id: string;
    name: string;
    description?: string;
    fileCount: number;
    files?: Array<{
      path: string;
      content: string;
      type: string;
    }>;
  };
  livePreview?: LivePreview;
  conversationalResponse?: {
    text: string;
    actions: string[];
  };
}

export const ProjectView: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const { 
    messages, 
    isLoading, 
    sendMessage, 
    currentConversation, 
    addMessage,
    setCurrentConversation
  } = useChatStore();
  
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<ProjectResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [detectedErrors, setDetectedErrors] = useState<PreviewError[]>([]);
  const [isScanningErrors, setIsScanningErrors] = useState(false);
  const [showErrorCards, setShowErrorCards] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get current conversation messages
  const currentMessages = currentConversation ? messages[currentConversation.id] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  // Load project on mount
  useEffect(() => {
    if (projectId) {
      selectProject(projectId);
    }
  }, [projectId]);

  // Auto-start preview when project loads
  useEffect(() => {
    if (currentProject?.project?.id && previewStatus === 'idle') {
      console.log('🔄 Auto-starting preview for project:', currentProject.project.id);
      startPreview();
    }
  }, [currentProject?.project?.id, previewStatus]);

  // Auto-scan for errors when preview is running
  useEffect(() => {
    if (previewStatus === 'running' && currentProject?.project?.id) {
      console.log('🔍 Auto-scanning for errors...');
      scanForErrors();
    }
  }, [previewStatus, currentProject?.project?.id]);

  // Cleanup preview on unmount
  useEffect(() => {
    return () => {
      if (previewStatus === 'running' && currentProject?.project?.id) {
        stopPreview();
      }
    };
  }, [previewStatus, currentProject?.project?.id]);

  const selectProject = async (projectId: string) => {
    try {
      console.log('🔍 Loading project:', projectId);
      
      // Get project details
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      const projectData = await projectResponse.json();
      
      if (projectData.success) {
        console.log('✅ Project loaded:', projectData.project);
        setCurrentProject(projectData);
        
        // Load project-specific conversation history
        const conversationResponse = await fetch(`/api/projects/${projectId}/conversation`);
        const conversationData = await conversationResponse.json();
        
        if (conversationData.success && conversationData.conversation) {
          console.log('✅ Project conversation loaded:', conversationData.messages.length, 'messages');
          
          // Set the current conversation in the store
          setCurrentConversation(conversationData.conversation);
          
          // Add messages to chat
          if (conversationData.messages && conversationData.messages.length > 0) {
            conversationData.messages.forEach((msg: any) => {
              addMessage({
                id: msg.id,
                role: msg.role.toLowerCase(),
                content: msg.content,
                timestamp: msg.createdAt,
                conversationId: conversationData.conversation.id
              });
            });
          }
        } else {
          console.log('ℹ️ No conversation history found for project');
        }
      } else {
        console.error('❌ Failed to load project:', projectData.error);
      }
    } catch (error) {
      console.error('❌ Error loading project:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    console.log('🔍 Current project:', currentProject);
    console.log('🔍 Current conversation:', currentConversation);
    console.log('🔍 URL project ID:', projectId);
    
    // If we have a current project OR a project ID in the URL, use the project modification endpoint
    const targetProjectId = currentProject?.project?.id || projectId;
    
    if (targetProjectId) {
      try {
        // First, check if we have a project-specific conversation
        const conversationResponse = await fetch(`/api/projects/${targetProjectId}/conversation`);
        const conversationData = await conversationResponse.json();
        
        let conversationId = null;
        let conversation = null;
        if (conversationData.success && conversationData.conversation) {
          conversation = conversationData.conversation;
          conversationId = conversation.id;
          console.log('✅ Found existing project conversation:', conversationId);
        } else {
          // Create a new project-specific conversation
          console.log('🆕 Creating new project conversation');
          const createResponse = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `Chat about ${currentProject?.project?.name || 'Project'}`,
              userId: 'default-user',
              metadata: { projectId: targetProjectId }
            })
          });
          
          if (createResponse.ok) {
            conversation = await createResponse.json();
            conversationId = conversation.id;
            console.log('✅ Created new project conversation:', conversationId);
          }
        }

        // Set the current conversation in the store
        if (conversation) {
          setCurrentConversation(conversation);
        }

        // Now send the message to the project chat endpoint
        const response = await fetch(`/api/projects/${targetProjectId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: targetProjectId,
            message: content,
            userId: 'default-user'
          })
        });

        const data = await response.json();
        if (data.success) {
          console.log('✅ Project modification response:', data);
          
          // Add user message to chat
          addMessage({
            id: 'user-message-' + Date.now(),
            role: 'user',
            content: content,
            timestamp: new Date().toISOString(),
            conversationId: conversationId
          });
          
          // Add conversational response
          addMessage({
            id: 'claude-response-' + Date.now(),
            role: 'assistant',
            content: data.response,
            timestamp: new Date().toISOString(),
            conversationId: conversationId
          });
          
          // Add detailed technical response if available
          if (data.technicalDetails) {
            const technicalMessage = `📋 **Technical Details:**
• Files Read: ${data.technicalDetails.filesRead.join(', ') || 'None'}
• Files Modified: ${data.technicalDetails.filesModified.join(', ') || 'None'}
• Actions: ${data.technicalDetails.actionsTaken}
• Database Operations: ${data.technicalDetails.databaseOperations.join(', ')}`;
            
            addMessage({
              id: 'technical-details-' + Date.now(),
              role: 'assistant',
              content: technicalMessage,
              timestamp: new Date().toISOString(),
              conversationId: conversationId
            });
          }
          
          // Refresh the project to get updated files
          setTimeout(() => {
            selectProject(targetProjectId);
          }, 1000);
        } else {
          console.error('❌ Project modification failed:', data.error);
          // Fallback to normal chat
          await sendMessage(content);
        }
      } catch (error) {
        console.error('❌ Error with project modification:', error);
        // Fallback to normal chat
        await sendMessage(content);
      }
    } else {
      // Normal chat when no project is selected
      await sendMessage(content);
    }
  };

  const getFileIcon = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx': case 'ts': return '⚛️';
      case 'css': return '🎨';
      case 'json': return '📋';
      case 'html': return '🌐';
      case 'js': case 'jsx': return '📜';
      default: return '📄';
    }
  };

  const getFileLanguage = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx': case 'ts': return 'typescript';
      case 'jsx': case 'js': return 'javascript';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'json': return 'json';
      default: return 'text';
    }
  };

  const startPreview = async () => {
    if (!currentProject?.project?.id) return;
    
    try {
      setPreviewStatus('starting');
      setPreviewError(null);
      
      console.log('🚀 Starting preview for project:', currentProject.project.id);
      
      const response = await fetch(`/api/projects/${currentProject.project.id}/preview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default-user',
          autoCleanup: true,
          timeout: 30
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Preview started:', data.preview.url);
        setCurrentPreviewUrl(data.preview.url);
        setPreviewStatus('starting');
        
        // Poll for preview to be ready
        pollPreviewStatus();
      } else {
        throw new Error(data.error || 'Failed to start preview');
      }
    } catch (error) {
      console.error('❌ Error starting preview:', error);
      setPreviewStatus('error');
      setPreviewError(error instanceof Error ? error.message : 'Failed to start preview');
    }
  };

  const pollPreviewStatus = async () => {
    if (!currentProject?.project?.id) return;
    
    const maxAttempts = 30; // 30 seconds
    let attempts = 0;
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/projects/${currentProject.project.id}/preview`);
        const data = await response.json();
        
        if (data.success && data.preview.status === 'running') {
          console.log('✅ Preview is running:', data.preview.url);
          setPreviewStatus('running');
          setCurrentPreviewUrl(data.preview.url);
          
          // Check for detected errors
          if (data.preview.detectedErrors && data.preview.detectedErrors.length > 0) {
            console.log('🔍 Found detected errors:', data.preview.detectedErrors.length);
            setDetectedErrors(data.preview.detectedErrors);
          }
          
          return;
        } else if (data.success && data.preview.status === 'error') {
          throw new Error('Preview failed to start');
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          throw new Error('Preview startup timeout');
        }
      } catch (error) {
        console.error('❌ Error polling preview status:', error);
        setPreviewStatus('error');
        setPreviewError(error instanceof Error ? error.message : 'Preview failed to start');
      }
    };
    
    poll();
  };

  const stopPreview = async () => {
    if (!currentProject?.project?.id) return;
    
    try {
      const response = await fetch(`/api/projects/${currentProject.project.id}/preview`, {
        method: 'DELETE'
      });
      
             if (response.ok) {
         console.log('✅ Preview stopped');
         setPreviewStatus('idle');
         setCurrentPreviewUrl(null);
         setPreviewError(null);
         setDetectedErrors([]);
         setShowErrorCards(false);
       }
    } catch (error) {
      console.error('❌ Error stopping preview:', error);
    }
  };

  // Error detection methods
  const scanForErrors = async () => {
    if (!currentProject?.project?.id) return;
    
    setIsScanningErrors(true);
    try {
      const response = await fetch(`/api/projects/${currentProject.project.id}/preview/errors`);
      const data = await response.json();
      
      if (data.success) {
        console.log('🔍 Error scan completed:', data.errors.length, 'errors found');
        setDetectedErrors(data.errors || []);
      }
    } catch (error) {
      console.error('❌ Error scanning for errors:', error);
    } finally {
      setIsScanningErrors(false);
    }
  };

  const showErrorDetails = () => {
    if (detectedErrors.length === 0) {
      alert('✅ No errors detected in the preview!');
    } else {
      setShowErrorCards(true);
    }
  };

  const handleFixError = async (error: PreviewError) => {
    if (!currentProject?.project?.id) return;
    
    try {
      console.log('🔧 AI fixing error:', error.message);
      
      const response = await fetch(`/api/projects/${currentProject.project.id}/fix-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorId: error.id })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ AI fix applied successfully');
        alert(`✅ AI fix applied successfully!\n\n${data.fixResult.explanation}`);
        
        // Refresh project and restart preview
        setTimeout(() => {
          selectProject(currentProject.project.id);
        }, 2000);
      } else {
        console.error('❌ AI fix failed:', data.error);
        alert(`❌ AI fix failed: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Error applying AI fix:', error);
      alert(`❌ Error applying AI fix: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFixAllErrors = async () => {
    if (!currentProject?.project?.id) return;
    
    const fixableErrors = detectedErrors.filter(error => error.autoFixable);
    if (fixableErrors.length === 0) {
      alert('❌ No auto-fixable errors found!');
      return;
    }
    
    try {
      console.log('🔧 AI fixing all errors:', fixableErrors.length);
      
      const response = await fetch(`/api/projects/${currentProject.project.id}/fix-all-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ AI fixes applied successfully');
        alert(`✅ AI fixes applied successfully!\n\nApplied ${data.fixResults.length} fixes:\n${data.fixResults.map((fix: any) => `• ${fix.explanation}`).join('\n')}`);
        
        // Refresh project and restart preview
        setTimeout(() => {
          selectProject(currentProject.project.id);
        }, 2000);
      } else {
        console.error('❌ AI fixes failed:', data.error);
        alert(`❌ AI fixes failed: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Error applying AI fixes:', error);
      alert(`❌ Error applying AI fixes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleViewErrorDetails = (error: PreviewError) => {
    console.log('👁️ Viewing error details:', error);
    alert(`Error Details:\n\nType: ${error.type}\nSeverity: ${error.severity}\nMessage: ${error.message}\nDetails: ${error.details}\nSuggested Fix: ${error.suggestedFix}`);
  };

  const handleIgnoreError = (error: PreviewError) => {
    console.log('✕ Ignoring error:', error.message);
    setDetectedErrors(prev => prev.filter(e => e.id !== error.id));
  };

  const handleCloseErrorCards = () => {
    setShowErrorCards(false);
  };

  if (!currentProject) {
    return (
      <div className="flex h-full bg-gray-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Loading Project...</h2>
          <p className="text-gray-600">Please wait while we load your project.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Chat Panel - Left 1/3 */}
      <div className="w-1/3 flex flex-col border-r border-gray-300 bg-white">
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">🚀</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold">UrgentAI</h1>
                <p className="text-xs text-blue-100">AI Assistant</p>
              </div>
            </div>
            <button
              onClick={() => {
                setCurrentProject(null);
                setSelectedFile(null);
                navigate('/chat');
              }}
              className="text-white hover:text-blue-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-2 text-xs text-green-200">
            📁 {currentProject.project.name} ({currentProject.project.fileCount} files)
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {currentMessages.map((message: any) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm">Claude is working...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t border-gray-200 bg-white p-3">
          <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
        </div>
      </div>

      {/* File System & Preview - Right 2/3 */}
      <div className="w-2/3 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">
              📁 {currentProject.project.name}
            </h2>
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
              {currentProject.project.fileCount} files
            </span>
                         <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
               REACT
             </span>
             {detectedErrors.length > 0 && (
               <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">
                 ⚠️ {detectedErrors.length} Error(s)
               </span>
             )}
          </div>
          
                     <div className="flex items-center space-x-4">
             <div className="flex items-center space-x-2">
               <span className="text-sm text-gray-600">Live Preview</span>
               {previewStatus === 'running' && (
                 <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                   <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                   <span>Running</span>
                 </div>
               )}
               {previewStatus === 'starting' && (
                 <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                   <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600"></div>
                   <span>Starting</span>
                 </div>
               )}
               {isScanningErrors && (
                 <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                   <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                   <span>Scanning Errors</span>
                 </div>
               )}
             </div>
            <button
              onClick={() => setActiveTab(activeTab === 'preview' ? 'code' : 'preview')}
              className={`px-3 py-1 rounded text-sm transition-colors flex items-center space-x-2 ${
                activeTab === 'code' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{activeTab === 'preview' ? '💻' : '👀'}</span>
              <span>{activeTab === 'preview' ? 'View Code' : 'View Preview'}</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {activeTab === 'preview' ? (
            /* Preview View - Full Width */
            <div className="w-full flex flex-col">
                             {/* Error Notifications */}
               {detectedErrors.length > 0 && showErrorCards && (
                 <div className="bg-white border-b border-gray-200 p-4">
                   <ErrorNotification
                     errors={detectedErrors}
                     onFixError={handleFixError}
                     onFixAll={handleFixAllErrors}
                     onViewDetails={handleViewErrorDetails}
                     onIgnore={handleIgnoreError}
                     onClose={handleCloseErrorCards}
                   />
                 </div>
               )}
              
              {/* Preview Status Bar */}
              <div className="bg-white border-b border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-900">Live App Preview</span>
                    {previewStatus === 'running' && currentPreviewUrl && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">URL:</span>
                        <span className="text-xs font-mono text-blue-600">{currentPreviewUrl}</span>
                        <button
                          onClick={() => window.open(currentPreviewUrl, '_blank')}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                        >
                          Open
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {previewStatus === 'idle' && (
                      <button
                        onClick={startPreview}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors flex items-center space-x-2"
                      >
                        <span>🚀</span>
                        <span>Start Preview</span>
                      </button>
                    )}
                    {previewStatus === 'starting' && (
                      <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                        <span>Starting...</span>
                      </div>
                    )}
                                         {previewStatus === 'running' && (
                       <>
                         <button
                           onClick={showErrorDetails}
                           className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors flex items-center space-x-2"
                         >
                           <span>👁️</span>
                           <span>View Errors ({detectedErrors.length})</span>
                         </button>
                        <button
                          onClick={stopPreview}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                        >
                          Stop
                        </button>
                      </>
                    )}
                    {previewStatus === 'error' && (
                      <button
                        onClick={startPreview}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 bg-gray-100">
                {previewStatus === 'idle' && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🚀</div>
                      <h3 className="text-xl font-medium text-gray-900 mb-2">Ready to Preview</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Click "Start Preview" to run your app in a live environment
                      </p>
                      <div className="text-xs text-gray-500">
                        Your app will be available at a unique URL
                      </div>
                    </div>
                  </div>
                )}
                
                {previewStatus === 'starting' && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <h3 className="text-xl font-medium text-gray-900 mb-2">Starting Preview</h3>
                      <p className="text-sm text-gray-600">
                        Setting up your live environment...
                      </p>
                    </div>
                  </div>
                )}
                
                {previewStatus === 'running' && currentPreviewUrl && (
                  <div className="w-full h-full">
                    <iframe
                      src={currentPreviewUrl}
                      className="w-full h-full border-0"
                      title="Live Preview"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  </div>
                )}
                
                {previewStatus === 'error' && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-6xl mb-4">❌</div>
                      <h3 className="text-xl font-medium text-gray-900 mb-2">Preview Error</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {previewError || 'Failed to start preview'}
                      </p>
                      <button
                        onClick={startPreview}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Code View - Split Layout */
            <>
              {/* File Tree */}
              <div className="w-1/3 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                <div className="p-3 border-b border-gray-200 bg-white">
                  <h3 className="font-medium text-gray-900">📂 Project Files</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {currentProject.project.description}
                  </p>
                </div>
                <div className="p-2">
                  {currentProject.project.files?.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(file.path)}
                      className={`w-full text-left p-3 rounded text-sm hover:bg-gray-200 transition-colors mb-1 ${
                        selectedFile === file.path ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getFileIcon(file.path)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{file.path.split('/').pop()}</div>
                          <div className="text-xs text-gray-500 truncate">{file.path}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Code Viewer */}
              <div className="w-2/3 flex flex-col">
                <div className="bg-gray-900 flex-1">
                  {selectedFile ? (
                    <>
                      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getFileIcon(selectedFile)}</span>
                          <span className="text-white font-medium">{selectedFile}</span>
                          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                            {getFileLanguage(selectedFile)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-400">
                            {currentProject.project.files?.find(f => f.path === selectedFile)?.content.split('\n').length || 0} lines
                          </span>
                          <button
                            onClick={() => {
                              const content = currentProject.project.files?.find(f => f.path === selectedFile)?.content || '';
                              navigator.clipboard.writeText(content);
                            }}
                            className="text-xs text-gray-400 hover:text-white px-2 py-1 hover:bg-gray-700 rounded"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <pre className="p-4 text-sm font-mono text-gray-100 leading-relaxed">
                          <code className={`language-${getFileLanguage(selectedFile)}`}>
                            {currentProject.project.files?.find(f => f.path === selectedFile)?.content || 'Loading...'}
                          </code>
                        </pre>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <div className="text-4xl mb-4">📄</div>
                        <p>Select a file to view its contents</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 