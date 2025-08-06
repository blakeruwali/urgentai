import React, { useState, useEffect } from 'react';
import './App.css';

interface GrowthData {
  date: string;
  weight: number;
  height: number;
}

const App: React.FC = () => {
  const [growthData, setGrowthData] = useState<GrowthData[]>(() => {
    const storedData = localStorage.getItem('growthData');
    return storedData ? JSON.parse(storedData) : [];
  });
  const [weight, setWeight] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('growthData', JSON.stringify(growthData));
  }, [growthData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newData: GrowthData = {
      date: new Date().toISOString().slice(0, 10),
      weight,
      height,
    };
    setGrowthData([...growthData, newData]);
    setWeight(0);
    setHeight(0);
  };

  return (
    <div className={`App ${darkMode ? 'dark-mode' : ''}`}>
      <header>
        <h1>Baby Growth Tracker</h1>
        <button onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
      </header>
      <main>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="weight">Weight (kg):</label>
            <input
              type="number"
              id="weight"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              step="0.1"
              required
            />
          </div>
          <div>
            <label htmlFor="height">Height (cm):</label>
            <input
              type="number"
              id="height"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              step="0.1"
              required
            />
          </div>
          <button type="submit">Add Data</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Weight (kg)</th>
              <th>Height (cm)</th>
            </tr>
          </thead>
          <tbody>
            {growthData.map((data, index) => (
              <tr key={index}>
                <td>{data.date}</td>
                <td>{data.weight}</td>
                <td>{data.height}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
};

export default App;