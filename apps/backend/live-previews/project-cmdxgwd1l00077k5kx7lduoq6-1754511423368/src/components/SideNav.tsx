```tsx
import React from 'react';
import { Link } from 'react-router-dom';

const SideNav: React.FC = () => {
  return (
    <nav className="side-nav">
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/dashboard">Dashboard</Link>
        </li>
        <li>
          <Link to="/projects">Projects</Link>
        </li>
        <li>
          <Link to="/settings">Settings</Link>
        </li>
      </ul>
    </nav>
  );
};

export default SideNav;
```