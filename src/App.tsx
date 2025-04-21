import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { createRunnersHubTheme } from './config/theme';

// Import pages (we'll create these next)
import HomePage from './pages/HomePage';
import RegistrationPage from './pages/RegistrationPage';
import NotFoundPage from './pages/NotFoundPage';
import EmailTestPage from './pages/EmailTestPage';
import AuthTest from './components/AuthTest';
import AdminPage from './pages/AdminPage';
import RequireAdmin from './components/RequireAdmin';
import PublicRegistrationsPage from './pages/PublicRegistrationsPage';

import AppHeader from './components/AppHeader';

function App() {
  // Detect system/browser dark mode
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = createRunnersHubTheme(prefersDarkMode ? 'dark' : 'light');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Provides a consistent baseline CSS */}
      <Router>
        <AppHeader />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/auth" element={<AuthTest />} />
          <Route path="/email-test" element={<EmailTestPage />} />
          <Route path="/participants" element={<PublicRegistrationsPage />} />
          <Route path="/admin" element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          } />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
