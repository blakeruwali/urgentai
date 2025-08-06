import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../stores/chatStore';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

// Add TypeScript declarations for speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

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

interface Project {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  fileCount: number;
  createdAt: string;
}

interface ChatProps {
  className?: string;
}

export const Chat: React.FC<ChatProps> = ({ className = '' }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const { 
    messages, 
    isLoading, 
    sendMessage, 
    currentConversation, 
    addMessage
  } = useChatStore();
  
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<ProjectResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('code');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Get current conversation messages
  const currentMessages = currentConversation ? messages[currentConversation.id] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  // Load all projects on mount and handle URL-based project loading
  useEffect(() => {
    loadAllProjects();
    
    // If there's a projectId in the URL, load that project
    if (projectId) {
      selectProject(projectId);
    }
  }, [projectId]);



  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Add hotkey listener for ` key
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === '`' && !isListening) {
        event.preventDefault();
        startListening();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isListening]);

  // Load all projects on app start
  useEffect(() => {
    loadAllProjects();
  }, []);

  const loadAllProjects = async () => {
    try {
      setIsLoadingProjects(true);
      console.log('📡 Loading all user projects...');
      const response = await fetch('/api/projects?userId=default-user');
      const data = await response.json();
      
      if (data.success && data.projects) {
        console.log('✅ Loaded', data.projects.length, 'projects');
        setAllProjects(data.projects);
      }
    } catch (error) {
      console.error('❌ Error loading projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const selectProject = async (projectId: string) => {
    try {
      console.log('🔍 Loading project:', projectId);
      
      // Update URL to reflect the selected project
      navigate(`/project/${projectId}`);
      
      // Get project details
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      const projectData = await projectResponse.json();
      
      if (projectData.success) {
        console.log('✅ Project loaded:', projectData.project);
        setCurrentProject(projectData);
        
        // Load project-specific conversation history
        const conversationResponse = await fetch(`/api/projects/${projectId}/conversation`);
        const conversationData = await conversationResponse.json();
        
        if (conversationData.success && conversationData.messages) {
          console.log('✅ Project conversation loaded:', conversationData.messages.length, 'messages');
          
          // Add messages to chat
          if (conversationData.conversation) {
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

  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleCreateProject = async () => {
    if (!inputValue.trim()) return;
    
    try {
      setIsCreatingProject(true);
      console.log('🚀 Creating project from description:', inputValue);
      
      // Generate a project name from the description
      const projectName = inputValue.split(' ').slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'my-app';
      
      // First, send the message to chat so Claude responds
      await sendMessage(inputValue);
      
      // Then create the project in the background
      const response = await fetch('/api/projects/create-from-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: inputValue,
          projectName: projectName,
          userId: 'default-user'
        })
      });

      const data = await response.json();
      console.log('📡 Project creation response:', data);
      
      if (data.success) {
        console.log('✅ Project created successfully!');
        setInputValue('');
        
        // Wait a moment then load the project and refresh project list
        setTimeout(() => {
          loadAllProjects(); // Refresh project list
          if (data.project) {
            selectProject(data.project.id);
          }
        }, 1000);
      } else {
        console.error('❌ Project creation failed:', data.error);
        alert('Failed to create project. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error creating project:', error);
      alert('Error creating project. Please check the console for details.');
    } finally {
      setIsCreatingProject(false);
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
        if (conversationData.success && conversationData.conversation) {
          conversationId = conversationData.conversation.id;
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
            const newConversation = await createResponse.json();
            conversationId = newConversation.id;
            console.log('✅ Created new project conversation:', conversationId);
          }
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
            conversationId: conversationId || 'temp'
          });
          
          // Add conversational response
          addMessage({
            id: 'claude-response-' + Date.now(),
            role: 'assistant',
            content: data.response,
            timestamp: new Date().toISOString(),
            conversationId: conversationId || 'temp'
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
              conversationId: conversationId || 'temp'
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };



  // Main interface - Input field at top, projects below
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Top 1/3 - Beautiful Input Section */}
      <div className="h-1/3 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🚀</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">UrgentAI</h1>
            <p className="text-xl text-gray-600 mb-8">Describe your app idea and watch it come to life</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Describe your app idea... (e.g., 'Create a todo app with dark mode')"
                  className="w-full px-4 py-4 text-lg border-0 focus:ring-0 focus:outline-none placeholder-gray-400"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                />
              </div>
              
              <button
                onClick={startListening}
                disabled={isListening}
                className={`p-4 rounded-full transition-all duration-200 ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105'
                }`}
                title="Press ` key for voice input"
              >
                {isListening ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C13.1 2 14 2.9 14 4V8C14 9.1 13.1 10 12 10C10.9 10 10 9.1 10 8V4C10 2.9 10.9 2 12 2ZM18 10C18 13.31 15.31 16 12 16C8.69 16 6 13.31 6 10H8C8 12.21 9.79 14 12 14C14.21 14 16 12.21 16 10H18ZM12 18C12.55 18 13 18.45 13 19V22H11V19C11 18.45 11.45 18 12 18Z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C13.1 2 14 2.9 14 4V8C14 9.1 13.1 10 12 10C10.9 10 10 9.1 10 8V4C10 2.9 10.9 2 12 2ZM18 10C18 13.31 15.31 16 12 16C8.69 16 6 13.31 6 10H8C8 12.21 9.79 14 12 14C14.21 14 16 12.21 16 10H18ZM12 18C12.55 18 13 18.45 13 19V22H11V19C11 18.45 11.45 18 12 18Z"/>
                  </svg>
                )}
              </button>
              
              <button
                onClick={handleCreateProject}
                disabled={!inputValue.trim() || isCreatingProject}
                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 ${
                  inputValue.trim() && !isCreatingProject
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isCreatingProject ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </div>
                ) : (
                  'Create App'
                )}
              </button>
            </div>
            
            {isListening && (
              <div className="mt-4 text-center">
                <div className="flex items-center justify-center space-x-2 text-blue-600">
                  <div className="animate-pulse">🎤</div>
                  <span className="font-medium">Listening... Speak now!</span>
                </div>
              </div>
            )}
            
            <div className="mt-4 text-center text-sm text-gray-500">
              💡 Press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">`</kbd> key for voice input
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 2/3 - Project Gallery */}
      <div className="h-2/3 bg-white">
        <div className="max-w-7xl mx-auto p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Your Projects</h2>
            <button
              onClick={loadAllProjects}
              disabled={isLoadingProjects}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {isLoadingProjects ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
          </div>
          
          {allProjects.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-8xl mb-6">🎨</div>
              <h3 className="text-2xl font-medium text-gray-900 mb-4">No Projects Yet</h3>
              <p className="text-lg text-gray-600 mb-8">Start by describing your first app idea above!</p>
              <div className="space-y-4 max-w-md mx-auto">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-lg mb-2">💡 Try these ideas:</div>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div>• "Create a todo app with dark mode"</div>
                    <div>• "Build a landing page for my startup"</div>
                    <div>• "Make a dashboard with charts"</div>
                    <div>• "Design a portfolio website"</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => window.open(`/project/${project.id}`, '_blank')}
                  className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-gray-600 mt-2 line-clamp-2">{project.description}</p>
                    </div>
                    <div className="text-2xl">🚀</div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                        {project.type}
                      </span>
                      <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                        {project.fileCount} files
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(project.createdAt)}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Click to open in new tab</span>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};