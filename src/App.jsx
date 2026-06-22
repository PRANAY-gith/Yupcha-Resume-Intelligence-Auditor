import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Users, Settings, Brain, BarChart2 } from 'lucide-react';
import CandidatesPage from './pages/CandidatesPage.jsx';
import CandidateFormPage from './pages/CandidateFormPage.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { supabase } from './lib/supabase.js';

function Sidebar() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    supabase.from('candidates').select('id', { count: 'exact', head: true })
      .then(({ count }) => setCount(count));
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Brain size={16} color="#fff" />
        </div>
        <div className="sidebar-brand-text">
          <h1>Resume Auditor</h1>
          <p>Intelligence Platform</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Workspace</span>

        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Users size={15} />
          Candidates
          {count !== null && <span className="nav-badge">{count}</span>}
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Settings size={15} />
          Settings
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: 11, color: 'var(--slate-600)', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, color: 'var(--slate-500)', marginBottom: 2 }}>AI Workflow</div>
          Parse → Match → Analyze → Recommend
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/"                            element={<CandidatesPage />} />
            <Route path="/candidates/new"              element={<CandidateFormPage />} />
            <Route path="/candidates/:id/edit"         element={<CandidateFormPage />} />
            <Route path="/candidates/:id/analysis"     element={<AnalysisPage />} />
            <Route path="/settings"                    element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
