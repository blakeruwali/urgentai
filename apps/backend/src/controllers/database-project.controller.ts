import { Request, Response } from 'express';
import { databaseProjectService } from '../services/database-project.service';
import { templateService } from '../services/template.service';
import { anthropicService } from '../services/anthropic.service';
import { livePreviewService } from '../services/live-preview.service';
import { ProjectType } from '../generated/prisma';
import { conversationService } from '../services/conversation.service';

export class DatabaseProjectController {
  /**
   * Get all available templates
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = templateService.getTemplates();
      
      res.json({
        success: true,
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          type: t.type
        }))
      });
    } catch (error: any) {
      console.error('Error getting templates:', error);
      res.status(500).json({
        error: 'Failed to get templates',
        message: error.message
      });
    }
  }

  /**
   * Create a new project from natural language description - STORED IN DATABASE + AUTO LIVE PREVIEW
   */
  async createProjectFromDescription(req: Request, res: Response): Promise<void> {
    try {
      const { description, projectName, userId = 'default-user' } = req.body;

      if (!description || !projectName) {
        res.status(400).json({
          error: 'Description and project name are required'
        });
        return;
      }

      console.log(`🎯 Creating project: "${projectName}" - "${description}"`);

      // Generate unique application code based on description
      const codeGenerationPrompt = `
You are an expert React/TypeScript developer. Create a complete, functional application based on this description:

DESCRIPTION: "${description}"
PROJECT NAME: "${projectName}"

Generate a complete React TypeScript application that matches the description. Create a functional, interactive application that actually does what the user requested.

REQUIREMENTS:
- Use modern React with TypeScript
- Create a functional, interactive application that matches the description
- Use modern CSS with responsive design
- Include proper TypeScript types
- Make it visually appealing and professional
- The app should actually work and be functional
- Use localStorage for data persistence where appropriate
- Include dark mode support
- Make it mobile-responsive
- Create unique, specific code for this exact project

Return ONLY a valid JSON object with this exact structure. No explanations, no markdown blocks, no extra text.

{
  "files": [
    {
      "path": "package.json",
      "content": "{\"name\":\"${projectName}\",\"version\":\"0.1.0\",\"private\":true,\"dependencies\":{\"react\":\"^18.2.0\",\"react-dom\":\"^18.2.0\",\"react-scripts\":\"5.0.1\",\"typescript\":\"^4.9.5\"},\"scripts\":{\"start\":\"react-scripts start\",\"build\":\"react-scripts build\",\"test\":\"react-scripts test\",\"eject\":\"react-scripts eject\"},\"browserslist\":{\"production\":[\">0.2%\",\"not dead\",\"not op_mini all\"],\"development\":[\"last 1 chrome version\",\"last 1 firefox version\",\"last 1 safari version\"]}}"
    },
    {
      "path": "public/index.html",
      "content": "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"/><link rel=\"icon\" href=\"%PUBLIC_URL%/favicon.ico\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><meta name=\"theme-color\" content=\"#000000\"/><meta name=\"description\" content=\"${projectName} - A modern React application\"/><title>${projectName}</title></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id=\"root\"></div></body></html>"
    },
    {
      "path": "src/App.tsx",
      "content": "import React, { useState, useEffect } from 'react';\\nimport './App.css';\\n\\nfunction App() {\\n  return (\\n    <div className=\"App\">\\n      <header className=\"App-header\">\\n        <h1>${projectName}</h1>\\n        <p>Welcome to your new app!</p>\\n      </header>\\n    </div>\\n  );\\n}\\n\\nexport default App;"
    },
    {
      "path": "src/App.css",
      "content": ".App {\\n  text-align: center;\\n}\\n\\n.App-header {\\n  background-color: #282c34;\\n  padding: 20px;\\n  color: white;\\n}\\n\\n.App-header h1 {\\n  font-size: 2rem;\\n  margin-bottom: 1rem;\\n}"
    },
    {
      "path": "src/index.tsx",
      "content": "import React from 'react';\\nimport ReactDOM from 'react-dom/client';\\nimport './index.css';\\nimport App from './App';\\n\\nconst root = ReactDOM.createRoot(\\n  document.getElementById('root') as HTMLElement\\n);\\nroot.render(\\n  <React.StrictMode>\\n    <App />\\n  </React.StrictMode>\\n);"
    },
    {
      "path": "src/index.css",
      "content": "body {\\n  margin: 0;\\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',\\n    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',\\n    sans-serif;\\n  -webkit-font-smoothing: antialiased;\\n  -moz-osx-font-smoothing: grayscale;\\n}\\n\\ncode {\\n  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',\\n    monospace;\\n}"
    }
  ]
}`;

      const codeGenerationResponse = await anthropicService.sendMessage({
        messages: [{ 
          id: 'code-gen-' + Date.now(),
          role: 'user', 
          content: codeGenerationPrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `code-generation-${Date.now()}`,
        options: { temperature: 0.2 }
      });

      // Parse the generated code
      let generatedFiles: Array<{path: string, content: string}> = [];
      try {
        // Clean the response and parse JSON
        let cleanedResponse = codeGenerationResponse.content.trim();
        
        // Remove markdown code blocks if present
        if (cleanedResponse.includes('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/\s*```/, '');
        }
        if (cleanedResponse.includes('```')) {
          cleanedResponse = cleanedResponse.replace(/```\s*/, '').replace(/\s*```/, '');
        }
        
        // Try to find JSON object in the response
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }
        
        const parsedResponse = JSON.parse(cleanedResponse);
        generatedFiles = parsedResponse.files || [];
        
        console.log(`✅ Generated ${generatedFiles.length} files for project`);
        console.log(`📝 AI Response length: ${codeGenerationResponse.content.length} characters`);
        
        // Validate that we have the required files
        const requiredFiles = ['package.json', 'public/index.html', 'src/App.tsx', 'src/App.css', 'src/index.tsx', 'src/index.css'];
        const missingFiles = requiredFiles.filter(file => !generatedFiles.find(f => f.path === file));
        
        if (missingFiles.length > 0) {
          console.warn(`⚠️ Missing required files: ${missingFiles.join(', ')}`);
          throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
        }
        
        // Check if the generated content is actually unique (not just template)
        const appFile = generatedFiles.find(f => f.path === 'src/App.tsx');
        if (appFile && appFile.content.includes('Welcome to your new app!')) {
          console.warn(`⚠️ Generated content appears to be template, not unique`);
          throw new Error('Generated content is template, not unique');
        }
        
      } catch (parseError) {
        console.error('Failed to parse generated code:', parseError);
        console.log('Raw response:', codeGenerationResponse.content);
        
        // Create a fallback basic project
        console.log('🔄 Creating fallback project with basic template...');
        
        // Generate more specific fallback based on description
        const descriptionLower = description.toLowerCase();
        let appContent = '';
        let appCss = '';
        
        if (descriptionLower.includes('calculator') || descriptionLower.includes('calc')) {
          appContent = `import React, { useState } from 'react';
import './App.css';

function App() {
  const [result, setResult] = useState('0');
  const [darkMode, setDarkMode] = useState(false);

  const handleButtonClick = (value: string) => {
    if (value === 'C') {
      setResult('0');
    } else if (value === '=') {
      try {
        setResult(eval(result).toString());
      } catch (error) {
        setResult('Error');
      }
    } else {
      setResult(result === '0' ? value : result + value);
    }
  };

  return (
    <div className={\`App \${darkMode ? 'dark-mode' : ''}\`}>
      <div className="calculator">
        <div className="display">{result}</div>
        <div className="buttons">
          <button onClick={() => handleButtonClick('7')}>7</button>
          <button onClick={() => handleButtonClick('8')}>8</button>
          <button onClick={() => handleButtonClick('9')}>9</button>
          <button onClick={() => handleButtonClick('+')}>+</button>
          <button onClick={() => handleButtonClick('4')}>4</button>
          <button onClick={() => handleButtonClick('5')}>5</button>
          <button onClick={() => handleButtonClick('6')}>6</button>
          <button onClick={() => handleButtonClick('-')}>-</button>
          <button onClick={() => handleButtonClick('1')}>1</button>
          <button onClick={() => handleButtonClick('2')}>2</button>
          <button onClick={() => handleButtonClick('3')}>3</button>
          <button onClick={() => handleButtonClick('*')}>*</button>
          <button onClick={() => handleButtonClick('0')}>0</button>
          <button onClick={() => handleButtonClick('.')}>.</button>
          <button onClick={() => handleButtonClick('=')}>=</button>
          <button onClick={() => handleButtonClick('/')}>/</button>
          <button onClick={() => handleButtonClick('C')}>C</button>
        </div>
      </div>
      <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
    </div>
  );
}

export default App;`;
          
          appCss = `.App {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f0f0f0;
  transition: background-color 0.3s ease;
}

.App.dark-mode {
  background-color: #222;
  color: #fff;
}

.calculator {
  width: 320px;
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.display {
  background-color: #f5f5f5;
  border-radius: 5px;
  padding: 10px;
  margin-bottom: 20px;
  text-align: right;
  font-size: 24px;
}

.buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

button {
  background-color: #e0e0e0;
  border: none;
  border-radius: 5px;
  padding: 15px;
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

button:hover {
  background-color: #d0d0d0;
}

.dark-mode-toggle {
  background-color: #555;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.dark-mode-toggle:hover {
  background-color: #777;
}`;
        } else if (descriptionLower.includes('weather')) {
          appContent = `import React, { useState, useEffect } from 'react';
import './App.css';

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

function App() {
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 22,
    condition: 'Sunny',
    humidity: 65,
    windSpeed: 12
  });
  const [location, setLocation] = useState('New York');
  const [darkMode, setDarkMode] = useState(false);

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'sunny': return '☀️';
      case 'cloudy': return '☁️';
      case 'rainy': return '🌧️';
      case 'snowy': return '❄️';
      default: return '🌤️';
    }
  };

  return (
    <div className={\`App \${darkMode ? 'dark-mode' : ''}\`}>
      <div className="weather-card">
        <h1>Weather App</h1>
        <div className="location">
          <input 
            type="text" 
            value={location} 
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Enter city name"
          />
        </div>
        <div className="weather-info">
          <div className="temperature">
            {weather.temperature}°C
          </div>
          <div className="condition">
            {getWeatherIcon(weather.condition)} {weather.condition}
          </div>
          <div className="details">
            <div>Humidity: {weather.humidity}%</div>
            <div>Wind: {weather.windSpeed} km/h</div>
          </div>
        </div>
      </div>
      <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
    </div>
  );
}

export default App;`;
          
          appCss = `.App {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: background-color 0.3s ease;
}

.App.dark-mode {
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  color: #fff;
}

.weather-card {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  padding: 30px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  text-align: center;
  backdrop-filter: blur(10px);
}

.dark-mode .weather-card {
  background: rgba(0, 0, 0, 0.8);
}

.weather-card h1 {
  margin-bottom: 20px;
  color: #333;
}

.dark-mode .weather-card h1 {
  color: #fff;
}

.location input {
  padding: 10px 15px;
  border: 2px solid #ddd;
  border-radius: 25px;
  font-size: 16px;
  margin-bottom: 20px;
  width: 200px;
}

.weather-info {
  margin-top: 20px;
}

.temperature {
  font-size: 3rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 10px;
}

.dark-mode .temperature {
  color: #fff;
}

.condition {
  font-size: 1.5rem;
  margin-bottom: 20px;
}

.details {
  display: flex;
  justify-content: space-around;
  margin-top: 20px;
}

.details div {
  padding: 10px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 10px;
  margin: 0 5px;
}

.dark-mode-toggle {
  margin-top: 20px;
  background-color: #555;
  color: #fff;
  border: none;
  border-radius: 25px;
  padding: 12px 24px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.dark-mode-toggle:hover {
  background-color: #777;
}`;
        } else if (descriptionLower.includes('todo') || descriptionLower.includes('task')) {
          appContent = `import React, { useState, useEffect } from 'react';
import './App.css';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (inputValue.trim() !== '') {
      const newTodo: Todo = {
        id: Date.now(),
        text: inputValue.trim(),
        completed: false
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <div className={\`App \${darkMode ? 'dark-mode' : ''}\`}>
      <div className="todo-container">
        <h1>Todo App</h1>
        <div className="todo-input">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new todo..."
          />
          <button onClick={addTodo}>Add</button>
        </div>
        <ul className="todo-list">
          {todos.map(todo => (
            <li key={todo.id} className={\`todo-item \${todo.completed ? 'completed' : ''}\`}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
              />
              <span>{todo.text}</span>
              <button onClick={() => deleteTodo(todo.id)}>🗑️</button>
            </li>
          ))}
        </ul>
      </div>
      <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
    </div>
  );
}

export default App;`;
          
          appCss = `.App {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f8fafc;
  transition: background-color 0.3s ease;
}

.App.dark-mode {
  background-color: #1a202c;
  color: #f7fafc;
}

.todo-container {
  max-width: 500px;
  width: 100%;
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.dark-mode .todo-container {
  background: #2d3748;
}

.todo-container h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #2d3748;
}

.dark-mode .todo-container h1 {
  color: #f7fafc;
}

.todo-input {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.todo-input input {
  flex: 1;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
}

.todo-input button {
  padding: 12px 24px;
  background-color: #3182ce;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
}

.todo-list {
  list-style: none;
  padding: 0;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  border-bottom: 1px solid #e2e8f0;
}

.todo-item.completed span {
  text-decoration: line-through;
  color: #a0aec0;
}

.todo-item button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
}

.dark-mode-toggle {
  margin-top: 20px;
  background-color: #555;
  color: #fff;
  border: none;
  border-radius: 25px;
  padding: 12px 24px;
  font-size: 16px;
  cursor: pointer;
}`;
        } else {
          // Generic fallback
          appContent = `import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('Welcome to ${projectName}!');

  return (
    <div className="App">
      <header className="App-header">
        <h1>{message}</h1>
        <p>This is a basic React app created from your description: "${description}"</p>
        <p>You can modify this code to match your specific requirements.</p>
      </header>
    </div>
  );
}

export default App;`;
          
          appCss = `.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: white;
}

.App-header h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #61dafb;
}

.App-header p {
  font-size: 1.2rem;
  margin: 0.5rem 0;
  max-width: 600px;
  line-height: 1.6;
}`;
        }
        
        generatedFiles = [
          {
            path: "package.json",
            content: JSON.stringify({
              name: projectName,
              version: "0.1.0",
              private: true,
              dependencies: {
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "react-scripts": "5.0.1",
                "typescript": "^4.9.5"
              },
              scripts: {
                "start": "react-scripts start",
                "build": "react-scripts build",
                "test": "react-scripts test",
                "eject": "react-scripts eject"
              },
              browserslist: {
                production: [">0.2%", "not dead", "not op_mini all"],
                development: ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
              }
            }, null, 2)
          },
          {
            path: "public/index.html",
            content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="${projectName} - A modern React application" />
    <title>${projectName}</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`
          },
          {
            path: "src/App.tsx",
            content: appContent
          },
          {
            path: "src/App.css",
            content: appCss
          },
          {
            path: "src/index.tsx",
            content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
          },
          {
            path: "src/index.css",
            content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`
          }
        ];
        
        console.log(`✅ Created fallback project with ${generatedFiles.length} files`);
      }

      // Create the project in database
      const project = await databaseProjectService.createProject({
        name: projectName,
        description: description,
        type: ProjectType.REACT,
        templateId: 'custom-generated',
        userId,
        customizations: { 
          projectName, 
          description,
          generatedFromDescription: true
        }
      });

      // Add the generated files to the database
      for (const file of generatedFiles) {
        await databaseProjectService.addFile(
          project.id,
          file.path,
          file.content
        );
      }

      // Get the complete project with files
      const completeProject = await databaseProjectService.getProject(project.id);

      console.log(`✅ Database project created: ${project.id} with ${completeProject?.files?.length || 0} files`);

      // Temporarily disable live preview to fix project creation
      // TODO: Re-enable live preview once npm PATH issues are resolved
      /*
      // Auto-start live preview
      console.log(`🚀 Auto-starting live preview for: ${projectName}`);
      try {
        const preview = await livePreviewService.createPreview({
          projectId: project.id,
          userId
        });
        console.log(`✅ Live preview auto-started: ${preview.url}`);
      } catch (previewError) {
        console.warn('⚠️ Live preview failed to start:', previewError);
        // Don't fail the entire request if preview fails
      }
      */

      res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          type: project.type,
          fileCount: completeProject?.files?.length || 0,
          files: completeProject?.files,
          createdAt: project.createdAt
        },
        message: 'Project created successfully with unique code!',
        // previewUrl: preview?.url // Temporarily disabled
      });

    } catch (error: any) {
      console.error('Error creating project from description:', error);
      res.status(500).json({
        error: 'Failed to create project',
        message: error.message
      });
    }
  }

  /**
   * Create project from specific template - STORED IN DATABASE + AUTO LIVE PREVIEW
   */
  async createProject(req: Request, res: Response): Promise<void> {
    try {
      const { templateId, projectName, customizations, userId = 'default-user' } = req.body;

      if (!templateId || !projectName) {
        res.status(400).json({
          error: 'Template ID and project name are required'
        });
        return;
      }

      const template = templateService.getTemplate(templateId);
      if (!template) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      const project = await databaseProjectService.createProject({
        name: projectName,
        type: ProjectType.REACT, // Default to React for now
        templateId,
        userId,
        customizations: { projectName, ...customizations }
      });

      // Temporarily disable live preview to fix project creation
      // TODO: Re-enable live preview once npm PATH issues are resolved
      /*
      // 🚀 AUTOMATICALLY START LIVE PREVIEW
      let previewUrl = null;
      
      try {
        const preview = await livePreviewService.createPreview({
          projectId: project.id,
          userId
        });
        previewUrl = preview.url;
      } catch (previewError) {
        console.warn('Failed to auto-start preview:', previewError);
      }
      */

      res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          type: project.type,
          fileCount: project.files?.length || 0,
          status: project.status,
          createdAt: project.createdAt
        },
        // livePreview: previewUrl ? {
        //   url: previewUrl,
        //   status: 'starting'
        // } : null,
        storage: 'database'
      });

    } catch (error: any) {
      console.error('Error creating project:', error);
      res.status(500).json({
        error: 'Failed to create project',
        message: error.message
      });
    }
  }

  /**
   * Get project details from database
   */
  async getProject(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      // Check if live preview exists
      let livePreview = null;
      try {
        const preview = await livePreviewService.getPreview(projectId);
        if (preview) {
          livePreview = {
            url: preview.url,
            status: preview.status,
            lastAccessed: preview.lastAccessed
          };
        }
      } catch (previewError) {
        console.warn('Error getting preview status:', previewError);
      }

      res.json({
        success: true,
        project,
        livePreview,
        storage: 'database'
      });

    } catch (error: any) {
      console.error('Error getting project:', error);
      res.status(500).json({
        error: 'Failed to get project',
        message: error.message
      });
    }
  }

  /**
   * List all projects for a user from database
   */
  async listUserProjects(req: Request, res: Response): Promise<void> {
    try {
      const { userId = 'default-user' } = req.query;
      
      const projects = await databaseProjectService.listUserProjects(userId as string);
      
      // Check live preview status for each project
      const projectsWithPreviews = await Promise.all(
        projects.map(async (p) => {
          try {
            const preview = await livePreviewService.getPreview(p.id);
            return {
              id: p.id,
              name: p.name,
              description: p.description,
              type: p.type,
              status: p.status,
              fileCount: p.metadata?.fileCount || 0,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
              livePreview: preview ? {
                url: preview.url,
                status: preview.status
              } : null
            };
          } catch {
            return {
              id: p.id,
              name: p.name,
              description: p.description,
              type: p.type,
              status: p.status,
              fileCount: p.metadata?.fileCount || 0,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
              livePreview: null
            };
          }
        })
      );
      
      res.json({
        success: true,
        projects: projectsWithPreviews,
        storage: 'database'
      });

    } catch (error: any) {
      console.error('Error listing projects:', error);
      res.status(500).json({
        error: 'Failed to list projects',
        message: error.message
      });
    }
  }

  /**
   * Get project conversation history
   */
  async getProjectConversation(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      // Get project-specific conversation
      const conversation = await conversationService.getConversationByProject(projectId);
      
      if (!conversation) {
        res.json({
          success: true,
          conversation: null,
          messages: []
        });
        return;
      }

      // Get conversation with messages
      const conversationWithMessages = await conversationService.getConversationWithMessages(conversation.id);
      
      res.json({
        success: true,
        conversation: conversationWithMessages,
        messages: conversationWithMessages?.messages || []
      });

    } catch (error: any) {
      console.error('Error getting project conversation:', error);
      res.status(500).json({
        error: 'Failed to get project conversation',
        message: error.message
      });
    }
  }

  /**
   * Handle ongoing chat conversation and project modifications
   */
  async handleChatModification(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, message, userId = 'default-user' } = req.body;

      if (!projectId || !message) {
        res.status(400).json({
          error: 'Project ID and message are required'
        });
        return;
      }

      // Get current project from database
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      // Create or get project-specific conversation
      let conversation = await conversationService.getConversationByProject(projectId);
      if (!conversation) {
        conversation = await conversationService.createConversation({
          title: `Project: ${project.name}`,
          userId,
          metadata: { projectId, projectName: project.name }
        });
      }

      // Add user message to conversation
      await conversationService.addMessage({
        conversationId: conversation.id,
        role: 'USER',
        content: message,
        metadata: { projectId, action: 'user_request' }
      });

      // Use Claude to analyze the message and determine what changes to make
      const analysisPrompt = `
Analyze this request: "${message}"

Project: ${project.name}
Files: ${project.files?.map(f => f.path).join(', ')}

You are a helpful AI assistant. When the user asks to add or modify something, respond conversationally like "I've added..." or "I've updated..." - NOT like a tutorial.

Return ONLY a JSON object like this:

For "add nav bar for this app":
{"action":"add_file","newFileName":"src/components/Navbar.tsx","instruction":"Create a navigation bar component with Home, About, Contact links","response":"I've added a navigation bar to your app!"}

For "add footer":
{"action":"add_file","newFileName":"src/components/Footer.tsx","instruction":"Create a footer component with copyright and links","response":"I've added a footer to your app!"}

For "make buttons bigger":
{"action":"update_file","targetFile":"src/App.css","instruction":"Increase button size and padding","response":"I've made the buttons bigger!"}

For "add live chat":
{"action":"add_file","newFileName":"src/components/LiveChat.tsx","instruction":"Create a live chat component with WebSocket connection","response":"I've added a live chat feature to your app!"}

For "add dark mode":
{"action":"update_file","targetFile":"src/App.tsx","instruction":"Add dark mode toggle functionality","response":"I've added dark mode to your app!"}

For "add team info":
{"action":"add_file","newFileName":"src/components/TeamInfo.tsx","instruction":"Create a team information page component","response":"I've added a team info page to your app!"}

For general conversation:
{"action":"conversation","response":"I understand your request. How can I help you modify the project?"}

IMPORTANT: Keep responses short and conversational. Use "I've added..." or "I've updated..." format. The technical details will be shown separately.

ONLY return valid JSON, no other text.`;

      const analysisResponse = await anthropicService.sendMessage({
        messages: [{ 
          id: 'analysis-' + Date.now(),
          role: 'user', 
          content: analysisPrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `project-modification-${Date.now()}`,
        options: { temperature: 0.3 }
      });

      // Parse Claude's response
      let action = 'conversation';
      let response = 'I understand your request. How can I help you modify the project?';
      let filesChanged = [];
      
      console.log('🔍 Claude analysis response:', analysisResponse.content);
      
      try {
        const analysis = JSON.parse(analysisResponse.content);
        console.log('✅ Parsed analysis:', analysis);
        action = analysis.action;
        
        if (action === 'update_file' && analysis.targetFile && analysis.instruction) {
          // Update existing file
          const targetFile = project.files?.find(f => f.path === analysis.targetFile);
          if (targetFile) {
            const modificationResponse = await anthropicService.sendMessage({
              messages: [{ 
                id: 'modification-' + Date.now(),
                role: 'user', 
                content: `Update this file based on the instruction. Return ONLY the updated file content, no explanations.

File: ${analysis.targetFile}
Instruction: ${analysis.instruction}

Current content:
${targetFile.content}

Updated content:`,
                timestamp: new Date().toISOString()
              }],
              conversationId: `file-modification-${Date.now()}`,
              options: { temperature: 0.2 }
            });

            await databaseProjectService.updateFile(projectId, analysis.targetFile, modificationResponse.content);
            filesChanged.push(analysis.targetFile);
            response = analysis.response || `I've updated ${analysis.targetFile} as requested. The changes have been saved.`;
          } else {
            response = `Sorry, I couldn't find the file ${analysis.targetFile} in your project.`;
          }
        } else if (action === 'add_file' && analysis.newFileName && analysis.instruction) {
          // Add new file
          const newFileResponse = await anthropicService.sendMessage({
            messages: [{ 
              id: 'new-file-' + Date.now(),
              role: 'user', 
              content: `Create a new React component file. Return ONLY the file content, no explanations.

File: ${analysis.newFileName}
Requirements: ${analysis.instruction}

File content:`,
              timestamp: new Date().toISOString()
            }],
            conversationId: `new-file-${Date.now()}`,
            options: { temperature: 0.2 }
          });

          await databaseProjectService.addFile(projectId, analysis.newFileName, newFileResponse.content);
          filesChanged.push(analysis.newFileName);
          response = analysis.response || `I've created a new file: ${analysis.newFileName}`;
        } else if (action === 'modify_multiple' && analysis.instructions) {
          // Modify multiple files
          for (const instruction of analysis.instructions) {
            const targetFile = project.files?.find(f => f.path === instruction.targetFile);
            if (targetFile) {
              const modificationResponse = await anthropicService.sendMessage({
                messages: [{ 
                  id: 'multi-modification-' + Date.now(),
                  role: 'user', 
                  content: `Update this file based on the instruction. Return ONLY the updated file content.

File: ${instruction.targetFile}
Instruction: ${instruction.instruction}

Current content:
${targetFile.content}

Updated content:`,
                  timestamp: new Date().toISOString()
                }],
                conversationId: `multi-modification-${Date.now()}`,
                options: { temperature: 0.2 }
              });

              await databaseProjectService.updateFile(projectId, instruction.targetFile, modificationResponse.content);
              filesChanged.push(instruction.targetFile);
            }
          }
          response = analysis.response || `I've updated ${filesChanged.length} files as requested.`;
        } else if (action === 'conversation') {
          response = analysis.response || 'I understand your request. How can I help you modify the project?';
        }
      } catch (parseError) {
        console.error('❌ Failed to parse Claude analysis:', parseError);
        console.error('Raw response:', analysisResponse.content);
        console.error('Response length:', analysisResponse.content.length);
        console.error('First 200 chars:', analysisResponse.content.substring(0, 200));
        response = 'I understand your request. How can I help you modify the project?';
      }

      // Add Claude's response to conversation
      await conversationService.addMessage({
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: response,
        metadata: { 
          projectId, 
          action: action,
          filesChanged: filesChanged.length > 0 ? filesChanged : undefined
        }
      });

      // Create a detailed technical response
      const technicalDetails = {
        filesRead: project.files?.map(f => f.path) || [],
        filesModified: filesChanged,
        databaseOperations: [
          'Project loaded from database',
          'File created/updated in database',
          'Conversation updated in database'
        ],
        actionsTaken: action === 'add_file' ? 'Created new file' : 
                     action === 'update_file' ? 'Updated existing file' : 
                     action === 'modify_multiple' ? 'Updated multiple files' : 'No file changes'
      };

      res.json({
        success: true,
        action,
        response, // Conversational response
        technicalDetails, // Detailed technical response
        projectId,
        conversationId: conversation.id,
        filesChanged,
        storage: 'database'
      });

    } catch (error: any) {
      console.error('Error handling chat modification:', error);
      res.status(500).json({
        error: 'Failed to process modification',
        message: error.message
      });
    }
  }

  /**
   * Update a file in the project using Claude - DATABASE STORAGE + AUTO PREVIEW UPDATE
   */
  async updateFile(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { filePath, instruction, currentContent } = req.body;

      if (!filePath || !instruction) {
        res.status(400).json({
          error: 'File path and instruction are required'
        });
        return;
      }

      // Get current project from database
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      // Use Claude to modify the file
      const modificationPrompt = `
You are a code generation expert. Update the following file based on the instruction.

File: ${filePath}
Current Content:
\`\`\`
${currentContent}
\`\`\`

Instruction: ${instruction}

Respond with ONLY the updated file content. No explanations, no markdown code blocks, just the raw content.`;

      const modificationResponse = await anthropicService.sendMessage({
        messages: [{ 
          id: 'modification-' + Date.now(),
          role: 'user', 
          content: modificationPrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `file-modification-${Date.now()}`,
        options: { temperature: 0.2 }
      });

      // Update the file in database
      const updatedFile = await databaseProjectService.updateFile(
        projectId, 
        filePath, 
        modificationResponse.content
      );

      // Temporarily disable live preview updates
      // TODO: Re-enable live preview once npm PATH issues are resolved
      /*
      // 🔄 AUTOMATICALLY UPDATE LIVE PREVIEW
      let previewUpdated = false;
      try {
        await livePreviewService.updatePreview(projectId);
        previewUpdated = true;
        console.log(`🔄 Live preview auto-updated for: ${project.name}`);
      } catch (previewError) {
        console.warn('Failed to auto-update preview:', previewError);
      }
      */

      res.json({
        success: true,
        message: 'File updated successfully in database',
        file: updatedFile,
        // livePreviewUpdated: previewUpdated,
        storage: 'database',
        conversationalResponse: {
          text: `I've updated ${filePath} as requested. The changes have been saved to the database.`,
          actions: [
            'View changes',
            'Make more edits',
            'Add another feature'
          ]
        }
      });

    } catch (error: any) {
      console.error('Error updating file:', error);
      res.status(500).json({
        error: 'Failed to update file',
        message: error.message
      });
    }
  }

  /**
   * Add a new file to the project using Claude - DATABASE STORAGE + AUTO PREVIEW UPDATE
   */
  async addFile(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { filePath, instruction } = req.body;

      if (!filePath || !instruction) {
        res.status(400).json({
          error: 'File path and instruction are required'
        });
        return;
      }

      // Get current project from database
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      // Use Claude to generate the file content
      const generationPrompt = `
You are a code generation expert. Create a new file based on the instruction.

File: ${filePath}
Project: ${project.name} (${project.type})
Context: This is a ${project.type} project with existing files.

Instruction: ${instruction}

Respond with ONLY the file content. No explanations, no markdown code blocks, just the raw content.`;

      const generationResponse = await anthropicService.sendMessage({
        messages: [{ 
          id: 'generation-' + Date.now(),
          role: 'user', 
          content: generationPrompt,
          timestamp: new Date().toISOString()
        }],
        conversationId: `file-generation-${Date.now()}`,
        options: { temperature: 0.3 }
      });

      // Add the file to database
      const newFile = await databaseProjectService.addFile(
        projectId, 
        filePath, 
        generationResponse.content
      );

      // 🔄 AUTOMATICALLY UPDATE LIVE PREVIEW
      let previewUpdated = false;
      try {
        await livePreviewService.updatePreview(projectId);
        previewUpdated = true;
        console.log(`🔄 Live preview auto-updated with new file: ${filePath}`);
      } catch (previewError) {
        console.warn('Failed to auto-update preview:', previewError);
      }

      res.json({
        success: true,
        message: 'File added successfully to database',
        file: newFile,
        livePreviewUpdated: previewUpdated,
        storage: 'database',
        conversationalResponse: {
          text: `I've created ${filePath} for you! ${previewUpdated ? 'The live preview now includes this new file.' : 'Refresh your preview to see the new file.'}`,
          actions: [
            'View the new file',
            'Add more files',
            'Modify existing code'
          ]
        }
      });

    } catch (error: any) {
      console.error('Error adding file:', error);
      res.status(500).json({
        error: 'Failed to add file',
        message: error.message
      });
    }
  }

  /**
   * Generate project files on demand for preview
   */
  async generatePreview(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      // Generate files temporarily for preview
      const tempDir = `./temp-preview/${projectId}-${Date.now()}`;
      const outputPath = await databaseProjectService.generateProjectFiles(projectId, tempDir);

      res.json({
        success: true,
        message: 'Preview files generated',
        outputPath,
        fileCount: project.files?.length || 0,
        storage: 'database -> temporary files'
      });

    } catch (error: any) {
      console.error('Error generating preview:', error);
      res.status(500).json({
        error: 'Failed to generate preview',
        message: error.message
      });
    }
  }

  /**
   * Export project as downloadable zip
   */
  async exportProject(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await databaseProjectService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          error: 'Project not found'
        });
        return;
      }

      // TODO: Implement zip generation from database files
      res.json({
        success: true,
        message: 'Export feature coming soon',
        project: {
          id: project.id,
          name: project.name,
          fileCount: project.files?.length || 0
        },
        note: 'Will generate downloadable zip file'
      });

    } catch (error: any) {
      console.error('Error exporting project:', error);
      res.status(500).json({
        error: 'Failed to export project',
        message: error.message
      });
    }
  }
}

export const databaseProjectController = new DatabaseProjectController(); 