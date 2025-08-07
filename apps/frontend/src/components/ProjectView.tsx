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
  const [activeTab, setActiveTab] = useState<'overview' | 'preview' | 'code' | 'errors'>('overview');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [detectedErrors, setDetectedErrors] = useState<PreviewError[]>([]);
  const [isScanningErrors, setIsScanningErrors] = useState(false);
  const [showErrorCards, setShowErrorCards] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
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
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar Chat Panel - Collapsible */}
      <div className={`${isChatCollapsed ? 'w-16' : 'w-96'} transition-all duration-300 flex flex-col border-r border-gray-200 bg-white shadow-lg relative`}>
        {/* Chat Header - Condensed */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3">
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-2 ${isChatCollapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">🚀</span>
              </div>
              {!isChatCollapsed && (
                <div>
                  <h1 className="text-sm font-semibold">UrgentAI Assistant</h1>
                  <p className="text-xs text-indigo-200">Ready to help</p>
                </div>
              )}
            </div>
            {!isChatCollapsed && (
              <button
                onClick={() => navigate('/chat')}
                className="text-white/80 hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {!isChatCollapsed && currentProject && (
            <div className="mt-2 text-xs text-indigo-200 flex items-center space-x-2">
              <span>📁 {currentProject.project.name}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full">{currentProject.project.fileCount} files</span>
            </div>
          )}
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsChatCollapsed(!isChatCollapsed)}
          className="absolute -right-3 top-12 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:shadow-lg transition-all z-10"
        >
          <svg 
            className={`w-4 h-4 text-gray-600 transition-transform ${isChatCollapsed ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Messages - Hidden when collapsed */}
        {!isChatCollapsed && (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {currentMessages.map((message: any) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div>
                  <span className="text-xs">Claude is thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-200 bg-gray-50 p-3">
              <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
            </div>
          </>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Compact Header with Tabs */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          {/* Project Info Bar */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">📱</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{currentProject?.project.name || 'Loading...'}</h2>
                    <p className="text-xs text-gray-500">{currentProject?.project.description || 'React Application'}</p>
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>
                    {currentProject?.project.fileCount || 0} files
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    React 18
                  </span>
                  {detectedErrors.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {detectedErrors.length} errors
                    </span>
                  )}
                  {previewStatus === 'running' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-1"></span>
                      Live
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {previewStatus === 'idle' && (
                  <button
                    onClick={startPreview}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm hover:shadow-md"
                  >
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Preview
                  </button>
                )}
                {previewStatus === 'running' && (
                  <>
                    <button
                      onClick={() => window.open(currentPreviewUrl!, '_blank')}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open External
                    </button>
                    <button
                      onClick={stopPreview}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                      Stop
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Condensed Tab Navigation */}
          <div className="px-4">
            <nav className="flex space-x-1">
              {[
                { id: 'overview', label: 'Overview', icon: '📊' },
                { id: 'preview', label: 'Live Preview', icon: '👁️', badge: previewStatus === 'running' },
                { id: 'code', label: 'Source Code', icon: '💻', badge: currentProject?.project.fileCount },
                { id: 'errors', label: 'Issues', icon: '⚠️', badge: detectedErrors.length || null }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    relative px-3 py-2 text-xs font-medium rounded-t-lg transition-all
                    ${activeTab === tab.id 
                      ? 'bg-gradient-to-t from-white to-gray-50 text-indigo-600 border-t border-l border-r border-gray-200 -mb-px' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
                  `}
                >
                  <span className="flex items-center space-x-1.5">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className={`
                        ml-1 px-1.5 py-0.5 text-xs rounded-full
                        ${activeTab === tab.id 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'bg-gray-200 text-gray-600'}
                      `}>
                        {typeof tab.badge === 'boolean' ? '●' : tab.badge}
                      </span>
                    )}
                  </span>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Project Stats Grid */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Total Files</p>
                        <p className="text-2xl font-bold text-gray-900">{currentProject?.project.fileCount || 0}</p>
                      </div>
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">📄</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Components</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {currentProject?.project.files?.filter(f => f.path.includes('.tsx')).length || 0}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">⚛️</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Styles</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {currentProject?.project.files?.filter(f => f.path.includes('.css')).length || 0}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">🎨</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <p className="text-sm font-bold text-green-600">Active</p>
                      </div>
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">✅</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* File Structure Overview */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Project Structure</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-2">
                      {currentProject?.project.files?.slice(0, 8).map((file) => (
                        <div 
                          key={file.path}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedFile(file.path);
                            setActiveTab('code');
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{getFileIcon(file.path)}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.path.split('/').pop()}</p>
                              <p className="text-xs text-gray-500">{file.path}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-400">
                              {file.content.split('\n').length} lines
                            </span>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                    {currentProject?.project.files && currentProject.project.files.length > 8 && (
                      <button
                        onClick={() => setActiveTab('code')}
                        className="mt-3 w-full text-center text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        View all {currentProject.project.files.length} files →
                      </button>
                    )}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      {currentMessages.slice(-3).map((message: any) => (
                        <div key={message.id} className="flex items-start space-x-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            message.role === 'user' ? 'bg-blue-100' : 'bg-purple-100'
                          }`}>
                            {message.role === 'user' ? '👤' : '🤖'}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">
                              {message.role === 'user' ? 'You' : 'Claude'} • {new Date(message.timestamp).toLocaleTimeString()}
                            </p>
                            <p className="text-sm text-gray-700 line-clamp-2">{message.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="h-full flex flex-col">
              {/* Preview Controls */}
              <div className="bg-white border-b border-gray-200 px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {previewStatus === 'running' && currentPreviewUrl && (
                      <>
                        <div className="flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          <span className="text-xs font-medium text-gray-700">Live</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <span className="text-xs font-mono text-gray-600">{currentPreviewUrl}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {detectedErrors.length > 0 && (
                    <button
                      onClick={showErrorDetails}
                      className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {detectedErrors.length} Error{detectedErrors.length !== 1 ? 's' : ''} Detected
                    </button>
                  )}
                </div>
              </div>

              {/* Error Cards */}
              {showErrorCards && detectedErrors.length > 0 && (
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

              {/* Preview Frame */}
              <div className="flex-1 bg-gray-100">
                {previewStatus === 'idle' && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Preview Ready</h3>
                      <p className="text-sm text-gray-600 mb-4">Start the preview to see your app in action</p>
                      <button
                        onClick={startPreview}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                      >
                        Start Live Preview
                      </button>
                    </div>
                  </div>
                )}
                
                {previewStatus === 'starting' && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 relative mx-auto mb-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl animate-pulse"></div>
                        <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Starting Preview</h3>
                      <p className="text-sm text-gray-600">Preparing your development environment...</p>
                    </div>
                  </div>
                )}
                
                {previewStatus === 'running' && currentPreviewUrl && (
                  <iframe
                    src={currentPreviewUrl}
                    className="w-full h-full border-0"
                    title="Live Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                )}
                
                {previewStatus === 'error' && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Preview Error</h3>
                      <p className="text-sm text-gray-600 mb-4">{previewError || 'Failed to start preview'}</p>
                      <button
                        onClick={startPreview}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Code Tab */}
          {activeTab === 'code' && (
            <div className="h-full flex">
              {/* File Explorer - Condensed */}
              <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
                <div className="p-3 border-b border-gray-100 sticky top-0 bg-white">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Files</h3>
                    <span className="text-xs text-gray-500">{currentProject?.project.fileCount}</span>
                  </div>
                </div>
                <div className="p-2">
                  {currentProject?.project.files?.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(file.path)}
                      className={`
                        w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all mb-0.5
                        ${selectedFile === file.path 
                          ? 'bg-indigo-50 text-indigo-700 font-medium' 
                          : 'text-gray-700 hover:bg-gray-50'}
                      `}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{getFileIcon(file.path)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{file.path.split('/').pop()}</div>
                          <div className="text-xs text-gray-500 truncate">{file.path}</div>
                        </div>
                        {selectedFile === file.path && (
                          <svg className="w-3 h-3 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Code Editor */}
              <div className="flex-1 flex flex-col bg-gray-900">
                {selectedFile ? (
                  <>
                    <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm">{getFileIcon(selectedFile)}</span>
                        <span className="text-white text-sm font-medium">{selectedFile}</span>
                        <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                          {getFileLanguage(selectedFile)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-400">
                          {currentProject.project.files?.find(f => f.path === selectedFile)?.content.split('\n').length || 0} lines
                        </span>
                        <button
                          onClick={() => {
                            const content = currentProject.project.files?.find(f => f.path === selectedFile)?.content || '';
                            navigator.clipboard.writeText(content);
                          }}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 hover:bg-gray-700 rounded transition-colors"
                        >
                          Copy
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
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      <p className="text-sm">Select a file to view its code</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Errors Tab */}
          {activeTab === 'errors' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                {detectedErrors.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Issues Found</h3>
                      <p className="text-sm text-gray-600">Your application is running without any detected errors.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {detectedErrors.length} Issue{detectedErrors.length !== 1 ? 's' : ''} Detected
                      </h3>
                      <button
                        onClick={handleFixAllErrors}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm hover:shadow-md"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        Fix All Auto-fixable
                      </button>
                    </div>
                    
                    {detectedErrors.map((error) => (
                      <div key={error.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className={`p-4 border-l-4 ${
                          error.severity === 'error' ? 'border-red-500 bg-red-50' : 
                          error.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' : 
                          'border-blue-500 bg-blue-50'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  error.severity === 'error' ? 'bg-red-100 text-red-800' :
                                  error.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {error.severity}
                                </span>
                                <span className="text-xs text-gray-500">{error.type}</span>
                                {error.autoFixable && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Auto-fixable
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-1">{error.message}</h4>
                              <p className="text-xs text-gray-600 mb-2">{error.details}</p>
                              {error.suggestedFix && (
                                <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                                  <p className="text-xs text-gray-700">
                                    <span className="font-medium">Suggested fix:</span> {error.suggestedFix}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              {error.autoFixable && (
                                <button
                                  onClick={() => handleFixError(error)}
                                  className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                  title="Fix automatically"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={() => handleViewErrorDetails(error)}
                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="View details"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleIgnoreError(error)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Dismiss"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 