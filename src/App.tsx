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
import KUTCOverviewPage from './pages/KUTCOverviewPage';
import MO2025Page from './pages/MO2025Page';
import MOOverviewPage from './pages/MOOverviewPage';
import AboutRunnersHubPage from './pages/AboutRunnersHubPage';
import RegistrationPage from './pages/RegistrationPage';
import NotFoundPage from './pages/NotFoundPage';
import AuthTest from './components/AuthTest';
import AdminPage from './pages/AdminPage';
import RequireAdmin from './components/RequireAdmin';
import PublicRegistrationsPage from './pages/PublicRegistrationsPage';
import ImportMalvikingenPage from './pages/admin/ImportMalvikingenPage';
import EQImportPage from './pages/admin/EQImportPage';
import ResultsPage from './pages/ResultsPage';
import GeneralResultsPage from './pages/GeneralResultsPage';
import KUTCResultsOverviewPage from './pages/KUTCResultsOverviewPage';
import KUTCYearResultsPage from './pages/KUTCYearResultsPage';
import KUTCAllTimeLeaderboardPage from './pages/KUTCAllTimeLeaderboardPage';
import KUTCRecordsPage from './pages/KUTCRecordsPage';
import CheckpointTestPage from './pages/CheckpointTestPage';
import RunnerSearchPage from './pages/RunnerSearchPage';
import RunnerProfilePage from './pages/RunnerProfilePage';
import RunnerCheckpointAnalysisPage from './pages/RunnerCheckpointAnalysisPage';

import AppHeader from './components/AppHeader';

function App() {
  // Detect system/browser dark mode
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = createRunnersHubTheme(prefersDarkMode ? 'dark' : 'light');
  const stage = process.env.REACT_APP_STAGE || 'local';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <AppHeader />
        {/* Spacer matching AppBar height to prevent overlap */}
        <Toolbar />
        {/* Stage banner below header */}
        {stage !== 'production' && (
          <Alert severity="warning" variant="filled" sx={{ width: '100%', textAlign: 'center' }}>
            {`Mode: ${stage.toUpperCase()}`}
          </Alert>
        )}
        {/* Ensure content isn't hidden behind fixed header or fixed footer */}
        <Box component="main" sx={{
          pb: (theme) => theme.mixins.toolbar.minHeight,
        }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/kutc" element={<KUTCOverviewPage />} />
            <Route path="/kutc-2025" element={<KUTC2025Page />} />
            <Route path="/mo" element={<MOOverviewPage />} />
            <Route path="/mo-2025" element={<MO2025Page />} />
            <Route path="/about" element={<AboutRunnersHubPage />} />
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
            {/* Add new admin route for EQ Timing CSV import */}
            <Route path="/admin/eqimport" element={
              <RequireAdmin>
                <EQImportPage />
              </RequireAdmin>
            } />
            <Route path="/results" element={<GeneralResultsPage />} />
            <Route path="/results/mo-2025" element={<ResultsPage />} />
            {/* KUTC Results Routes */}
            <Route path="/kutc/results" element={<KUTCResultsOverviewPage />} />
            <Route path="/kutc/results/:year" element={<KUTCYearResultsPage />} />
            <Route path="/kutc/all-time" element={<KUTCAllTimeLeaderboardPage />} />
            <Route path="/kutc/records" element={<KUTCRecordsPage />} />
            {/* Runner Search */}
            <Route path="/runners/search" element={<RunnerSearchPage />} />
            <Route path="/runners/:userId" element={<RunnerProfilePage />} />
            <Route path="/runners/:userId/kutc/:editionId" element={<RunnerCheckpointAnalysisPage />} />
            {/* Test route for checkpoint service (non-production) */}
            {stage !== 'production' && (
              <Route path="/test/checkpoint" element={<CheckpointTestPage />} />
            )}
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
        KrUltra 2025 - v{process.env.REACT_APP_VERSION || 'dev'}
      </Box>
    </ThemeProvider>
  );
}

export default App;
