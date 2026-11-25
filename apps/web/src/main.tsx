import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { Footer } from './components/Footer.tsx';
import { Navbar } from './components/Navbar.tsx';
import './index.css';
import { Account } from './pages/dashboard/Account.tsx';
import { DashboardLayout } from './pages/dashboard/DashboardLayout.tsx';
import { Analytics } from './pages/dashboard/Analytics.tsx';
import { History } from './pages/dashboard/History.tsx';
import { VideoDetail } from './pages/dashboard/VideoDetail.tsx';
import { Videos } from './pages/dashboard/Videos.tsx';
import { Webhooks } from './pages/dashboard/Webhooks.tsx';
import { Benchmarks } from './pages/Benchmarks.tsx';
import { Docs } from './pages/Docs.tsx';
import { Explore } from './pages/Explore.tsx';
import { Home } from './pages/Home.tsx';
import { Pricing } from './pages/Pricing.tsx';
import { CompressPage } from './tools/CompressPage.tsx';
import { ResizePage } from './tools/ResizePage.tsx';

function NotFound() {
  return (
    <div className="px-4 py-32 text-center">
      <h1 className="mb-4 text-4xl font-bold">Page not found</h1>
      <Link to="/" className="text-brand underline">
        Back to the tools
      </Link>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/benchmarks" element={<Benchmarks />} />
          <Route path="/compress" element={<CompressPage />} />
          <Route path="/resize" element={<ResizePage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route path="videos" element={<Videos />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="webhooks" element={<Webhooks />} />
            <Route path="videos/:id" element={<VideoDetail />} />
            <Route path="history" element={<History />} />
            <Route path="account" element={<Account />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
        <AuthModal />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
