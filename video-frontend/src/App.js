import React, {useEffect, useState} from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
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
import axios from 'axios'

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

const ProtectedRoute = ({ isLoggedIn, children }) => {
  return isLoggedIn ? children : <Navigate to="/" />;
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Add loading state

  // Check login status on app load
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}auth/check-login-status`, { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn) {
          setIsLoggedIn(true);
          sessionStorage.setItem("isSignedIn", true);
        } else {
          setIsLoggedIn(false);
          sessionStorage.removeItem("isSignedIn");
        }
      })
      .catch(() => {
        setIsLoggedIn(false);
        sessionStorage.removeItem("isSignedIn");
      })
      .finally(() => {
        setIsLoading(false); // Mark loading as complete
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-solid mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }
  

  return (
    <Router>
      <Navbar />
      <AppLayout>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/compress" element={<Compressor />} />
          <Route path="/resize" element={<Resizer />} />

          {/* Protected Routes */}
          <Route
            path="/api"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <API_page />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pricing"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Pricing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscriptions"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Subscriptions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Invoices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Account />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AppLayout>
    </Router>
  );
};

export default App;