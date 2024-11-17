import React from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
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
import Sidebar from './components/Sidebar';
import Tasks from './components/Tasks';

const AppLayout = ({ children }) => {
  const location = useLocation();
  
  // Specify the paths where the sidebar should be displayed
  const showSidebar = ['/subscriptions', '/invoices', '/account'].includes(location.pathname);

  return (
    <div className="flex">
      {/* Conditionally render Sidebar */}
      {showSidebar && <Sidebar />}
      
      {/* Main Content Area */}
      <div className={`${showSidebar ? 'pl-60' : ''} flex-1`}>
        {children}
        <Footer />
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <Navbar />
      <AppLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/compress" element={<Compressor />} />
          <Route path="/resize" element={<Resizer />} />
          <Route path="/api" element={<API_page />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/account" element={<Account />} />
        </Routes>
      </AppLayout>
    </Router>
  );
};

export default App;
