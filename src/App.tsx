import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './config/theme';

// Import pages (we'll create these next)
import HomePage from './pages/HomePage';
import RegistrationPage from './pages/RegistrationPage';
import NotFoundPage from './pages/NotFoundPage';
import EmailTestPage from './pages/EmailTestPage';
import AuthTest from './components/AuthTest';
import AdminPage from './pages/AdminPage';
import RequireAdmin from './components/RequireAdmin';

import AppHeader from './components/AppHeader';

function App() {
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
