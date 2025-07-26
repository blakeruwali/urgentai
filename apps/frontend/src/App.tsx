import { Chat } from './components/Chat';
import { MessageSquare, Settings, User } from 'lucide-react';
import { Button } from './components/ui/Button';

function App() {
  return (
    <div className="h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <div className="w-64 bg-muted/30 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">AI App Platform</h1>
          <p className="text-sm text-muted-foreground">Build apps with conversation</p>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4">
          <nav className="space-y-2">
            <Button variant="ghost" className="w-full justify-start">
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
            <Button variant="ghost" className="w-full justify-start" disabled>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </nav>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start" disabled>
            <User className="w-4 h-4 mr-2" />
            Sign In
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6">
          <div>
            <h2 className="text-lg font-semibold">New Conversation</h2>
            <p className="text-sm text-muted-foreground">Start building your app</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-muted-foreground">Ready</span>
          </div>
        </div>

        {/* Chat Area */}
        <Chat />
      </div>
    </div>
  );
}

export default App;