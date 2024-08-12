// App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Compressor from './components/Compressor';
import Resizer from './components/Resizer';

const App = () => {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/compress" element={<Compressor />} />
        <Route path="/resize" element={<Resizer/>} />
      </Routes>
    </Router>
  );
};

export default App;
