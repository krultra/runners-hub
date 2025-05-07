import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, useMediaQuery, Toolbar } from '@mui/material';
import { createRunnersHubTheme } from './config/theme';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';

// Import pages
import HomePage from './pages/HomePage';
import KUTC2025Page from './pages/KUTC2025Page';
import MO2025Page from './pages/MO2025Page';
import RegistrationPage from './pages/RegistrationPage';
import NotFoundPage from './pages/NotFoundPage';
import AuthTest from './components/AuthTest';
import AdminPage from './pages/AdminPage';
import RequireAdmin from './components/RequireAdmin';
import PublicRegistrationsPage from './pages/PublicRegistrationsPage';
import ImportMalvikingenPage from './pages/admin/ImportMalvikingenPage';
import ResultsPage from './pages/ResultsPage';

import AppHeader from './components/AppHeader';

function App() {
  // Detect system/browser dark mode
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = createRunnersHubTheme(prefersDarkMode ? 'dark' : 'light');
  const stage = process.env.REACT_APP_STAGE || 'local';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {stage !== 'production' && (
        <Alert severity="warning" variant="filled" sx={{ width: '100%', textAlign: 'center' }}>
          {`Mode: ${stage.toUpperCase()}`}
        </Alert>
      )}
      <Router>
        <AppHeader />
        <Toolbar />
        {/* Ensure bottom content isn't hidden behind footer */}
        <Box component="main" sx={{ pb: (theme) => theme.mixins.toolbar.minHeight }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/kutc-2025" element={<KUTC2025Page />} />
            <Route path="/mo-2025" element={<MO2025Page />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/auth" element={<AuthTest />} />
            <Route path="/participants" element={<PublicRegistrationsPage />} />
            <Route path="/admin" element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            } />
            {/* Add the new admin route for importing Malvikingen data */}
            <Route path="/admin/import-malvikingen" element={
              <RequireAdmin>
                <ImportMalvikingenPage />
              </RequireAdmin>
            } />
            <Route path="/results/mo-2025" element={<ResultsPage />} />
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
