import React, { useState, useMemo, createContext } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, useMediaQuery, Toolbar, PaletteMode } from '@mui/material';
import { createRunnersHubTheme } from './config/theme';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';

// Import pages
import HomePage from './pages/HomePage';
import KUTC2025Page from './pages/KUTC2025Page';
import KUTC2026Page from './pages/KUTC2026Page';
import KUTCOverviewPage from './pages/KUTCOverviewPage';
import MO2025Page from './pages/MO2025Page';
import MO2026Page from './pages/MO2026Page';
import MOOverviewPage from './pages/MOOverviewPage';
import AboutRunnersHubPage from './pages/AboutRunnersHubPage';
import RegistrationPage from './pages/RegistrationPage';
import MyRegistrationsPage from './pages/MyRegistrationsPage';
import NotFoundPage from './pages/NotFoundPage';
import AuthTest from './components/AuthTest';
import AdminPage from './pages/AdminPage';
import RequireAdmin from './components/RequireAdmin';
import PublicRegistrationsPage from './pages/PublicRegistrationsPage';
import EQImportPage from './pages/admin/EQImportPage';
import KUTCResultsOverviewPage from './pages/KUTCResultsOverviewPage';
import KUTCYearResultsPage from './pages/KUTCYearResultsPage';
import KUTCAllTimeLeaderboardPage from './pages/KUTCAllTimeLeaderboardPage';
import KUTCRecordsPage from './pages/KUTCRecordsPage';
import MOResultsOverviewPage from './pages/MOResultsOverviewPage';
import MOEditionResultsPage from './pages/MOEditionResultsPage';
import MOAllTimeLeaderboardPage from './pages/MOAllTimeLeaderboardPage';
import MORecordsPage from './pages/MORecordsPage';
import KUTCResultsYearRedirect from './pages/KUTCResultsYearRedirect';
import CheckpointTestPage from './pages/CheckpointTestPage';
import RunnerSearchPage from './pages/RunnerSearchPage';
import RunnerProfilePage from './pages/RunnerProfilePage';
import RunnerCheckpointAnalysisPage from './pages/RunnerCheckpointAnalysisPage';
import AppHeader from './components/AppHeader';

// Theme context for toggling
type ThemeMode = 'system' | 'light' | 'dark';
interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}
export const ThemeModeContext = createContext<ThemeContextType>({
  mode: 'system',
  setMode: () => {},
});

function App() {
  const { t } = useTranslation();

  // Theme mode state with localStorage persistence
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('theme_mode');
    return (stored as ThemeMode) || 'system';
  });
  
  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('theme_mode', newMode);
  };

  // Detect system/browser dark mode
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  
  // Resolve actual palette mode
  const resolvedMode: PaletteMode = useMemo(() => {
    if (mode === 'system') return prefersDarkMode ? 'dark' : 'light';
    return mode;
  }, [mode, prefersDarkMode]);
  
  const theme = useMemo(() => createRunnersHubTheme(resolvedMode), [resolvedMode]);
  const stage = process.env.REACT_APP_STAGE || 'local';

  return (
    <ThemeModeContext.Provider value={{ mode, setMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router
          future={{
            v7_relativeSplatPath: true
          }}
        >
        <AppHeader />
        {/* Spacer matching AppBar height to prevent overlap */}
        <Toolbar />
        {/* Stage banner below header */}
        {stage !== 'production' && (
          <Alert severity="warning" variant="filled" sx={{ width: '100%', textAlign: 'center' }}>
            {t('common.stageBanner', { stage: stage.toUpperCase() })}
          </Alert>
        )}
        {/* Ensure content isn't hidden behind fixed header or fixed footer */}
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Box component="main" sx={{
            pb: (theme) => theme.mixins.toolbar.minHeight,
          }}>
            <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/kutc" element={<KUTCOverviewPage />} />
            <Route path="/kutc-2025" element={<KUTC2025Page />} />
            <Route path="/kutc-2026" element={<KUTC2026Page />} />
            <Route path="/mo" element={<MOOverviewPage />} />
            <Route path="/mo-2025" element={<MO2025Page />} />
            <Route path="/mo-2026" element={<MO2026Page />} />
            <Route path="/about" element={<AboutRunnersHubPage />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/my-registrations" element={<MyRegistrationsPage />} />
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
                <NotFoundPage />
              </RequireAdmin>
            } />
            {/* Add new admin route for EQ Timing CSV import */}
            <Route path="/admin/eqimport" element={
              <RequireAdmin>
                <EQImportPage />
              </RequireAdmin>
            } />
            {/* KUTC Results Routes */}
            <Route path="/kutc/results" element={<KUTCResultsOverviewPage />} />
            <Route path="/kutc/results/:year(\\d{4})" element={<KUTCResultsYearRedirect />} />
            <Route path="/kutc/results/:editionId" element={<KUTCYearResultsPage />} />
            <Route path="/kutc/all-time" element={<KUTCAllTimeLeaderboardPage />} />
            <Route path="/kutc/records" element={<KUTCRecordsPage />} />

            {/* MO Results Routes */}
            <Route path="/mo/results" element={<MOResultsOverviewPage />} />
            <Route path="/mo/results/:editionId" element={<MOEditionResultsPage />} />
            <Route path="/mo/all-time" element={<MOAllTimeLeaderboardPage />} />
            <Route path="/mo/records" element={<MORecordsPage />} />
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
        </Container>
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
        {t('common.versionFooter', {
          year: 2025,
          version: process.env.REACT_APP_VERSION || 'dev'
        })}
        </Box>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export default App;
