import React, { useEffect, useState, useContext } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Tooltip, Box, Chip, Menu, MenuItem, Stack, Container, Divider, Button } from '@mui/material';
import { Settings, CircleUser, LogIn, Globe, ChevronDown, Ruler, SunMoon } from 'lucide-react';
import { notifyUnitsChange } from '../hooks/useUnits';
import { KRULTRA_URL } from '../config/urls';
import { useTranslation } from 'react-i18next';
import { supportedLocales, Locale } from '../i18n/locales';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { createOrUpdateUser, getUser } from '../utils/userUtils';
import { isAdminUser } from '../utils/adminUtils';
import { ThemeModeContext } from '../App';

// Get environment variables
const APP_VERSION = process.env.REACT_APP_VERSION || 'unknown';
const APP_STAGE = process.env.REACT_APP_STAGE || 'production';
const IS_TEST_ENV = APP_STAGE === 'test';

const AppHeader: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<null | HTMLElement>(null);
  const [eventsMenuAnchor, setEventsMenuAnchor] = useState<null | HTMLElement>(null);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState<null | HTMLElement>(null);
  const [userName, setUserName] = useState<string>('');
  const [runnerRouteId, setRunnerRouteId] = useState<string | null>(null);
  const [units, setUnits] = useState<'km' | 'mi'>('km');
  const navigate = useNavigate();
  const { mode, setMode } = useContext(ThemeModeContext);

  const currentLocale = (i18n.language?.substring(0, 2) as Locale) || 'no';

  // Load units preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('pref_units');
    if (stored === 'mi') setUnits('mi');
  }, []);

  const handleUnitsChange = (newUnits: 'km' | 'mi') => {
    setUnits(newUnits);
    localStorage.setItem('pref_units', newUnits);
    // Notify all useUnits hooks to re-render
    notifyUnitsChange();
  };

  const handleLanguageChange = (locale: Locale) => {
    i18n.changeLanguage(locale);
  };

  const handleAvatarMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAvatarMenuAnchor(event.currentTarget);
  };

  const handleAvatarMenuClose = () => {
    setAvatarMenuAnchor(null);
  };

  // Events dropdown menu handlers
  const openEventsMenu = (event: React.MouseEvent<HTMLElement>) => {
    setEventsMenuAnchor(event.currentTarget);
  };
  const closeEventsMenu = () => {
    setEventsMenuAnchor(null);
  };

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          await createOrUpdateUser(u);
        } catch (err) {
          console.warn('Unable to createOrUpdateUser during auth init', err);
        }

        try {
          const adminFlag = await isAdminUser(u.email!);
          setIsAdmin(adminFlag);
        } catch (err) {
          console.warn('Unable to determine admin status during auth init', err);
          setIsAdmin(false);
        }
        try {
          const appUser = await getUser(u.uid);
          const personId = (appUser as any)?.personId;
          setRunnerRouteId(
            Number.isFinite(personId) && personId != null ? String(personId) : (u.uid || null)
          );
          const computedName = [appUser?.firstName, appUser?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
          const fallbackName = appUser?.displayName || u.displayName || '';
          setUserName(computedName || fallbackName || u.email || '');
        } catch (err) {
          setRunnerRouteId(u.uid || null);
          setUserName(u.displayName || u.email || '');
        }
      } else {
        setIsAdmin(false);
        setUserName('');
        setRunnerRouteId(null);
      }
    });
    return unsub;
  }, []);

  const handleLogout = async () => {
    handleAvatarMenuClose();
    const auth = getAuth();
    await signOut(auth);
  };

  const handleRunnerProfile = () => {
    if (!user) {
      return;
    }
    const target = runnerRouteId || user.uid;
    navigate(`/runners/${target}`);
    handleAvatarMenuClose();
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: (theme) => 
          theme.palette.mode === 'dark' 
            ? 'rgba(3, 7, 18, 0.8)'  // gray-950 with opacity
            : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
        color: (theme) => theme.palette.text.primary,
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      {/* Gradient overlay - fades from transparent to brand color to transparent */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          opacity: (theme) => theme.palette.mode === 'dark' ? 0.5 : 0.8,
          background: (theme) => 
            theme.palette.mode === 'dark'
              ? 'linear-gradient(to right, transparent, rgba(65, 113, 156, 0.25), transparent)'
              : 'linear-gradient(to right, transparent, rgba(219, 238, 253, 1), transparent)',
          pointerEvents: 'none',
        }}
      />
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: { xs: 48, sm: 48 }, gap: 1, py: 0.5 }}>
          {/* Left: KrUltra Logo + Title (links to krultra.no) */}
          <Box 
            component="a"
            href={KRULTRA_URL}
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5, 
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <Box 
              component="img" 
              src="/krultra-logo.png" 
              alt={t('common.krultraLogoAlt')} 
              sx={{ 
                height: 24, 
                width: 24, 
                borderRadius: '4px',
              }} 
            />
            <Typography
              sx={{
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                color: (theme) => theme.palette.mode === 'dark' ? '#69A9E1' : '#41719C',
                fontSize: { xs: '1.125rem', md: '1.25rem' },
                display: { xs: 'none', sm: 'block' },
              }}
            >
              KrUltra
            </Typography>
          </Box>

          {/* RunnersHub title (links to RunnersHub home) */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              ml: 0.5,
            }}
            onClick={() => navigate('/')}
          >
            <Typography
              sx={{
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                color: (theme) => theme.palette.mode === 'dark' ? '#69A9E1' : '#41719C',
                fontSize: { xs: '1.125rem', md: '1.25rem' },
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            >
              RunnersHub
            </Typography>
            {IS_TEST_ENV && (
              <Chip 
                label={`TEST v${APP_VERSION}`}
                color="warning"
                size="small"
                sx={{ 
                  ml: 1, 
                  fontWeight: 'bold', 
                  height: 20,
                  '& .MuiChip-label': { px: 1, fontSize: '0.65rem' },
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 0.7 },
                    '50%': { opacity: 1 },
                    '100%': { opacity: 0.7 }
                  }
                }}
              />
            )}
          </Box>

          {/* Center: Navigation Links (desktop only) */}
          <Box 
            sx={{ 
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center', 
              gap: 0.5,
              ml: 1,
            }}
          >
            {/* Events dropdown */}
            <Button
              onClick={openEventsMenu}
              endIcon={<ChevronDown size={14} />}
              sx={{
                color: (theme) => theme.palette.mode === 'dark' ? '#9ca3af' : '#374151',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                minWidth: 'auto',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  color: (theme) => theme.palette.mode === 'dark' ? '#d1d5db' : '#1f2937',
                },
              }}
            >
              {t('nav.events')}
            </Button>
            <Menu
              anchorEl={eventsMenuAnchor}
              open={Boolean(eventsMenuAnchor)}
              onClose={closeEventsMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              <MenuItem onClick={() => { navigate('/kutc'); closeEventsMenu(); }}>{t('kutc.title')}</MenuItem>
              <MenuItem onClick={() => { navigate('/mo'); closeEventsMenu(); }}>{t('mo.title')}</MenuItem>
            </Menu>

            {/* Runners link */}
            <Button
              onClick={() => navigate('/runners/search')}
              sx={{
                color: (theme) => theme.palette.mode === 'dark' ? '#9ca3af' : '#374151',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                minWidth: 'auto',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  color: (theme) => theme.palette.mode === 'dark' ? '#d1d5db' : '#1f2937',
                },
              }}
            >
              {t('nav.runners')}
            </Button>

            {/* About link */}
            <Button
              onClick={() => navigate('/about')}
              sx={{
                color: (theme) => theme.palette.mode === 'dark' ? '#9ca3af' : '#374151',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                minWidth: 'auto',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  color: (theme) => theme.palette.mode === 'dark' ? '#d1d5db' : '#1f2937',
                },
              }}
            >
              {t('nav.about')}
            </Button>

            {/* Admin link - only for admins */}
            {isAdmin && (
              <Button
                onClick={() => navigate('/admin')}
                sx={{
                  color: (theme) => theme.palette.mode === 'dark' ? '#9ca3af' : '#374151',
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  minWidth: 'auto',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    color: (theme) => theme.palette.mode === 'dark' ? '#d1d5db' : '#1f2937',
                  },
                }}
              >
                {t('nav.admin')}
              </Button>
            )}
          </Box>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Right: Icons */}
          <Box display="flex" alignItems="center" gap={0.5}>

            {/* Avatar/login icon */}
            {user ? (
              <Tooltip title={userName || user.email || t('common.loggedIn')}>
                <IconButton
                  color="inherit"
                  size="small"
                  onClick={handleAvatarMenuOpen}
                  sx={{ width: 36, height: 36 }}
                >
                  <CircleUser size={20} />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title={t('nav.login')}>
                <IconButton
                  color="inherit"
                  size="small"
                  onClick={() => {
                    const currentPath = window.location.pathname;
                    localStorage.setItem('authReturnPath', currentPath);
                    navigate('/auth');
                  }}
                  sx={{ width: 36, height: 36 }}
                >
                  <LogIn size={20} />
                </IconButton>
              </Tooltip>
            )}

            {/* Settings menu (theme toggle) */}
            <Tooltip title={t('common.settings')}>
              <IconButton
                color="inherit"
                size="small"
                onClick={(e) => setSettingsMenuAnchor(e.currentTarget)}
                sx={{ width: 36, height: 36 }}
              >
                <Settings size={20} />
              </IconButton>
            </Tooltip>


          {/* Avatar dropdown menu */}
          {user && (
            <Menu
              anchorEl={avatarMenuAnchor}
              open={Boolean(avatarMenuAnchor)}
              onClose={handleAvatarMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Box px={2} py={1}>
                <Stack spacing={0.5} sx={{ maxWidth: 220 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {userName || user.email}
                  </Typography>
                  {user.email && (
                    <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.email}
                    </Typography>
                  )}
                </Stack>
              </Box>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={handleRunnerProfile}>{t('nav.myRunnerPage')}</MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={handleLogout}>{t('nav.logout')}</MenuItem>
            </Menu>
          )}

          {/* Settings menu - krultra style with 3 horizontal rows */}
          <Menu
            anchorEl={settingsMenuAnchor}
            open={Boolean(settingsMenuAnchor)}
            onClose={() => setSettingsMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: { 
                minWidth: 220, 
                p: 0.5,
                '& .MuiMenuItem-root': { py: 0.5 },
              }
            }}
          >
            {/* Language row */}
            <Box sx={{ px: 1, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Globe size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {supportedLocales.map((locale) => (
                  <Box
                    key={locale}
                    component="button"
                    onClick={() => { handleLanguageChange(locale); setSettingsMenuAnchor(null); }}
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      border: '1px solid',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      ...(locale === currentLocale ? {
                        backgroundColor: '#41719C',
                        color: 'white',
                        borderColor: '#41719C',
                      } : {
                        backgroundColor: 'transparent',
                        color: 'text.secondary',
                        borderColor: (theme: any) => theme.palette.mode === 'dark' ? '#374151' : '#d1d5db',
                        '&:hover': {
                          backgroundColor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        },
                      }),
                    }}
                  >
                    {locale.toUpperCase()}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Units row */}
            <Box sx={{ px: 1, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Ruler size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(['km', 'mi'] as const).map((u) => (
                  <Box
                    key={u}
                    component="button"
                    onClick={() => { handleUnitsChange(u); setSettingsMenuAnchor(null); }}
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      border: '1px solid',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      ...(units === u ? {
                        backgroundColor: '#41719C',
                        color: 'white',
                        borderColor: '#41719C',
                      } : {
                        backgroundColor: 'transparent',
                        color: 'text.secondary',
                        borderColor: (theme: any) => theme.palette.mode === 'dark' ? '#374151' : '#d1d5db',
                        '&:hover': {
                          backgroundColor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        },
                      }),
                    }}
                  >
                    {u}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Theme row */}
            <Box sx={{ px: 1, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SunMoon size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(['system', 'light', 'dark'] as const).map((theme) => (
                  <Box
                    key={theme}
                    component="button"
                    onClick={() => { setMode(theme); setSettingsMenuAnchor(null); }}
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      border: '1px solid',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s',
                      ...(mode === theme ? {
                        backgroundColor: '#41719C',
                        color: 'white',
                        borderColor: '#41719C',
                      } : {
                        backgroundColor: 'transparent',
                        color: 'text.secondary',
                        borderColor: (theme: any) => theme.palette.mode === 'dark' ? '#374151' : '#d1d5db',
                        '&:hover': {
                          backgroundColor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        },
                      }),
                    }}
                  >
                    {theme}
                  </Box>
                ))}
              </Box>
            </Box>
          </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default AppHeader;
