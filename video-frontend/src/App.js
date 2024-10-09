// App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Compressor from './components/Compressor';
import Resizer from './components/Resizer';
import API_page from './components/API_page';

const App = () => {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/compress" element={<Compressor />} />
        <Route path="/resize" element={<Resizer/>} />
        <Route path="/api" element={<API_page/>} />
      </Routes>
    </Router>
  );
};

export default App;
