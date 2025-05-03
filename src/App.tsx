import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, useMediaQuery, Toolbar } from '@mui/material';
import { createRunnersHubTheme } from './config/theme';
import Box from '@mui/material/Box';

// Import pages (we'll create these next)
import HomePage from './pages/HomePage';
import NewHomePage from './pages/NewHomePage';
import Kutc2025Page from './pages/Kutc2025Page';
import MalvikingenOpp2025Page from './pages/MalvikingenOpp2025Page';
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
        <Toolbar />
        {/* Ensure bottom content isn't hidden behind footer */}
        <Box component="main" sx={{ pb: (theme) => theme.mixins.toolbar.minHeight }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/newhome" element={<NewHomePage />} />
            <Route path="/kutc-2025" element={<Kutc2025Page />} />
            <Route path="/malvikingen-opp-2025" element={<MalvikingenOpp2025Page />} />
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
        </Box>
      </Router>
      {/* Version footer */}
      <Box
        position="fixed"
        bottom={0}
        width="100%"
        textAlign="center"
        fontSize="0.75rem"
        color="text.secondary"
        p={1}
        sx={{
          backgroundColor: (theme) => theme.palette.background.paper,
          borderTop: (theme) => `1.5px solid ${theme.palette.divider}`,
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        Made by KrUltra 2025 v{process.env.REACT_APP_VERSION || 'dev'}
      </Box>
    </ThemeProvider>
  );
}

export default App;
