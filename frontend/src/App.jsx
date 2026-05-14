import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AutoUWPlatform from './apps/AutoUW/AutoUWPlatform';
import GigShieldDashboard from './apps/GigShield/GigShieldDashboard';
import UtilityTrustModule from './apps/UtilityTrust/UtilityTrustModule';
import UnderwriterDashboard from './apps/Underwriter/UnderwriterDashboard';
import { ShieldCheck } from 'lucide-react';

const Layout = ({ children }) => (
  <div className="min-h-screen flex flex-col">
    <nav className="bg-govNavy text-white px-6 py-4 flex justify-between items-center shadow-md">
      <div className="flex items-center space-x-2">
        <ShieldCheck className="w-8 h-8 text-white" />
        <span className="text-xl font-bold tracking-wide">AutoUW ecosystem</span>
      </div>
      <div className="flex space-x-6 text-sm font-medium">
        <Link to="/" className="hover:text-govLightBlue transition-colors">Applicant Portal</Link>
        <Link to="/gigshield" className="hover:text-govLightBlue transition-colors">GigShield</Link>
        <Link to="/utility" className="hover:text-govLightBlue transition-colors">UtilityTrust</Link>
        <Link to="/underwriter" className="hover:text-govLightBlue transition-colors">Underwriter Admin</Link>
      </div>
    </nav>
    <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
      {children}
    </main>
    <footer className="bg-gray-100 border-t py-6 text-center text-gray-500 text-sm">
      <p>AutoUW Prototype Platform. Underwriting Ecosystem for Stable & Gig Workers.</p>
    </footer>
  </div>
);

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<AutoUWPlatform />} />
          <Route path="/gigshield" element={<GigShieldDashboard />} />
          <Route path="/utility" element={<UtilityTrustModule />} />
          <Route path="/underwriter" element={<UnderwriterDashboard />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
