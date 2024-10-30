// App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Compressor from './components/Compressor';
import Resizer from './components/Resizer';
import API_page from './components/API_page';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import Subscriptions from './components/Subscriptions';
import Invoices from './components/Invoices';
import Account from './components/Account';

const App = () => {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/compress" element={<Compressor />} />
        <Route path="/resize" element={<Resizer/>} />
        <Route path="/api" element={<API_page />} />
        <Route path="/pricing" element={<Pricing/>}/>
        <Route path="/subscriptions" element={<Subscriptions/>}/>
        <Route path="/invoices" element={<Invoices/>}/>
        <Route path="/account" element={<Account/>}/>
      </Routes>
      <Footer/>
    </Router>
  );
};

export default App;
