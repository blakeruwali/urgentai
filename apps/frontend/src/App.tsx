import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Chat } from './components/Chat';
import { ProjectView } from './components/ProjectView';

const App: React.FC = () => {
  return (
    <Router>
      <div className="h-screen bg-background text-foreground">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="flex h-16 items-center px-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">AI</span>
              </div>
              <h1 className="text-xl font-semibold">UrgentAI Platform</h1>
            </div>
            
            <div className="ml-auto flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Powered by Claude
              </span>
              <div className="w-2 h-2 bg-green-500 rounded-full" title="Connected"></div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="h-[calc(100vh-4rem)]">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route 
              path="/chat" 
              element={
                <Chat className="h-full" />
              } 
            />
            <Route 
              path="/chat/:conversationId" 
              element={
                <Chat className="h-full" />
              } 
            />
            <Route 
              path="/project/:projectId" 
              element={
                <ProjectView />
              } 
            />
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App; 