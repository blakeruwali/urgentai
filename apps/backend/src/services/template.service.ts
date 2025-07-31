import { ProjectTemplate, ProjectFile } from './project.service';

export class TemplateService {
  private templates: Map<string, ProjectTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // React Todo App Template
    this.templates.set('react-todo', {
      id: 'react-todo',
      name: 'React Todo App',
      description: 'A modern todo application with dark mode and local storage',
      type: 'react',
      files: [
        {
          path: 'package.json',
          type: 'config',
          content: JSON.stringify({
            name: '{{projectName}}',
            version: '0.1.0',
            private: true,
            dependencies: {
              'react': '^18.2.0',
              'react-dom': '^18.2.0',
              'react-scripts': '5.0.1',
              'typescript': '^4.9.5'
            },
            scripts: {
              'start': 'react-scripts start',
              'build': 'react-scripts build',
              'test': 'react-scripts test',
              'eject': 'react-scripts eject'
            },
            browserslist: {
              production: ['>0.2%', 'not dead', 'not op_mini all'],
              development: ['last 1 chrome version', 'last 1 firefox version', 'last 1 safari version']
            }
          }, null, 2)
        },
        {
          path: 'public/index.html',
          type: 'config',
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="{{projectName}} - A modern todo application" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`
        },
        {
          path: 'src/index.tsx',
          type: 'config',
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
          path: 'src/App.tsx',
          type: 'component',
          content: `import React, { useState, useEffect } from 'react';
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

  // Load todos from localStorage on mount
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  // Save todos to localStorage whenever todos change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    document.body.className = darkMode ? 'dark' : '';
  }, [darkMode]);

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

  const completedCount = todos.filter(todo => todo.completed).length;

  return (
    <div className={\`app \${darkMode ? 'dark' : ''}\`}>
      <div className="container">
        <header className="header">
          <h1>{{projectName}}</h1>
          <button 
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </header>

        <div className="todo-input">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new todo..."
            className="input"
          />
          <button onClick={addTodo} className="add-button">
            Add
          </button>
        </div>

        <div className="stats">
          {todos.length > 0 && (
            <p>{completedCount} of {todos.length} completed</p>
          )}
        </div>

        <ul className="todo-list">
          {todos.map(todo => (
            <li key={todo.id} className={\`todo-item \${todo.completed ? 'completed' : ''}\`}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="checkbox"
              />
              <span className="todo-text">{todo.text}</span>
              <button 
                onClick={() => deleteTodo(todo.id)}
                className="delete-button"
                aria-label="Delete todo"
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>

        {todos.length === 0 && (
          <div className="empty-state">
            <p>No todos yet. Add one above! 🎯</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;`
        },
        {
          path: 'src/App.css',
          type: 'style',
          content: `/* Global Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Light Theme Variables */
:root {
  --bg-color: #f8fafc;
  --container-bg: #ffffff;
  --text-color: #1a202c;
  --text-muted: #718096;
  --border-color: #e2e8f0;
  --primary-color: #3182ce;
  --primary-hover: #2c5aa0;
  --success-color: #38a169;
  --danger-color: #e53e3e;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Dark Theme Variables */
body.dark {
  --bg-color: #1a202c;
  --container-bg: #2d3748;
  --text-color: #f7fafc;
  --text-muted: #a0aec0;
  --border-color: #4a5568;
  --primary-color: #63b3ed;
  --primary-hover: #4299e1;
  --success-color: #68d391;
  --danger-color: #f56565;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
}

/* App Container */
.app {
  min-height: 100vh;
  background-color: var(--bg-color);
  padding: 2rem 1rem;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  background-color: var(--container-bg);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border-color);
}

.header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary-color);
}

.theme-toggle {
  background: none;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  padding: 0.5rem;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--container-bg);
}

.theme-toggle:hover {
  border-color: var(--primary-color);
  transform: scale(1.05);
}

/* Todo Input */
.todo-input {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  background-color: var(--container-bg);
  color: var(--text-color);
  transition: border-color 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.input::placeholder {
  color: var(--text-muted);
}

.add-button {
  padding: 0.75rem 1.5rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.add-button:hover {
  background-color: var(--primary-hover);
  transform: translateY(-1px);
}

/* Stats */
.stats {
  margin-bottom: 1rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* Todo List */
.todo-list {
  list-style: none;
  margin-bottom: 1rem;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  margin-bottom: 0.5rem;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.todo-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.todo-item.completed {
  opacity: 0.7;
}

.checkbox {
  width: 1.2rem;
  height: 1.2rem;
  cursor: pointer;
  accent-color: var(--success-color);
}

.todo-text {
  flex: 1;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
  color: var(--text-muted);
}

.delete-button {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.delete-button:hover {
  opacity: 1;
  background-color: var(--danger-color);
  transform: scale(1.1);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
  font-size: 1.1rem;
}

/* Responsive Design */
@media (max-width: 640px) {
  .app {
    padding: 1rem 0.5rem;
  }
  
  .container {
    padding: 1.5rem;
  }
  
  .header h1 {
    font-size: 1.5rem;
  }
  
  .todo-input {
    flex-direction: column;
  }
  
  .add-button {
    width: 100%;
  }
}`
        },
        {
          path: 'src/index.css',
          type: 'style',
          content: `/* Global Reset and Base Styles */
body {
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
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-color);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--primary-color);
}`
        }
      ]
    });

    // React Landing Page Template
    this.templates.set('react-landing', {
      id: 'react-landing',
      name: 'React Landing Page',
      description: 'A modern landing page with hero section, features, and CTA',
      type: 'react',
      files: [
        {
          path: 'package.json',
          type: 'config',
          content: JSON.stringify({
            name: '{{projectName}}',
            version: '0.1.0',
            private: true,
            dependencies: {
              'react': '^18.2.0',
              'react-dom': '^18.2.0',
              'react-scripts': '5.0.1',
              'typescript': '^4.9.5'
            },
            scripts: {
              'start': 'react-scripts start',
              'build': 'react-scripts build',
              'test': 'react-scripts test',
              'eject': 'react-scripts eject'
            }
          }, null, 2)
        },
        {
          path: 'public/index.html',
          type: 'config',
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="{{projectName}} - Modern landing page" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`
        },
        {
          path: 'src/index.tsx',
          type: 'config',
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
          path: 'src/App.tsx',
          type: 'component',
          content: `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="app">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="nav-brand">{{projectName}}</div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <h1 className="hero-title">
            Welcome to {{projectName}}
          </h1>
          <p className="hero-subtitle">
            The modern solution for your needs. Built with React and designed for performance.
          </p>
          <button className="cta-button">
            Get Started
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="container">
          <h2 className="section-title">Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Fast Performance</h3>
              <p>Optimized for speed and efficiency</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Modern Design</h3>
              <p>Clean and contemporary interface</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Responsive</h3>
              <p>Works perfectly on all devices</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 {{projectName}}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;`
        },
        {
          path: 'src/App.css',
          type: 'style',
          content: `/* Landing Page Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.6;
  color: #333;
}

.app {
  min-height: 100vh;
}

/* Navigation */
.nav {
  background: #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 1000;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-brand {
  font-size: 1.5rem;
  font-weight: bold;
  color: #007bff;
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-links a {
  text-decoration: none;
  color: #333;
  font-weight: 500;
  transition: color 0.3s;
}

.nav-links a:hover {
  color: #007bff;
}

/* Hero Section */
.hero {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: white;
  padding: 8rem 2rem 4rem;
  text-align: center;
}

.hero-container {
  max-width: 800px;
  margin: 0 auto;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.cta-button {
  background: #fff;
  color: #007bff;
  border: none;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: bold;
  border-radius: 50px;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.2);
}

/* Features Section */
.features {
  padding: 4rem 2rem;
  background: #f8f9fa;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 3rem;
  color: #333;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  text-align: center;
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  transition: transform 0.3s;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.feature-card p {
  color: #666;
}

/* Footer */
.footer {
  background: #333;
  color: white;
  text-align: center;
  padding: 2rem;
}

/* Responsive */
@media (max-width: 768px) {
  .nav-links {
    display: none;
  }
  
  .hero-title {
    font-size: 2.5rem;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
  }
}`
        },
        {
          path: 'src/index.css',
          type: 'style',
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
}

html {
  scroll-behavior: smooth;}`
        }
      ]
    });

    console.log('✅ Templates initialized:', Array.from(this.templates.keys()));
  }

  /**
   * Get all available templates
   */
  getTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get templates by type
   */
  getTemplatesByType(type: string): ProjectTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.type === type);
  }
}

export const templateService = new TemplateService(); 