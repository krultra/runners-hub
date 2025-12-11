import React, { useEffect, useState, useContext } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Tooltip, Box, Chip, Menu, MenuItem, ListItemIcon, Stack, Container, Divider, Button } from '@mui/material';
import { Settings, Sun, Moon, SunMoon, CircleUser, LogIn, Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supportedLocales, localeNames, Locale } from '../i18n/locales';
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
  const { i18n } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<null | HTMLElement>(null);
  const [eventsMenuAnchor, setEventsMenuAnchor] = useState<null | HTMLElement>(null);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState<null | HTMLElement>(null);
  const [userName, setUserName] = useState<string>('');
  const navigate = useNavigate();
  const { mode, setMode } = useContext(ThemeModeContext);

  const currentLocale = (i18n.language?.substring(0, 2) as Locale) || 'no';

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

  const handleLogin = () => {
    navigate('/auth');
  };

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await createOrUpdateUser(u);
        const adminFlag = await isAdminUser(u.email!);
        setIsAdmin(adminFlag);
        try {
          const appUser = await getUser(u.uid);
          const computedName = [appUser?.firstName, appUser?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
          const fallbackName = appUser?.displayName || u.displayName || '';
          setUserName(computedName || fallbackName || u.email || '');
        } catch (err) {
          setUserName(u.displayName || u.email || '');
        }
      } else {
        setIsAdmin(false);
        setUserName('');
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
    navigate(`/runners/${user.uid}`);
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
        <Toolbar disableGutters sx={{ minHeight: { xs: 48, sm: 56 }, gap: 2 }}>
          {/* Left: Logo + Title */}
          <Box 
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <Box 
              component="img" 
              src="/krultra-logo.png" 
              alt="Logo" 
              sx={{ 
                height: 24, 
                width: 24, 
                borderRadius: '4px',
              }} 
            />
            <Typography
              sx={{
                fontWeight: 500,
                whiteSpace: 'nowrap',
                color: (theme) => theme.palette.mode === 'dark' ? '#69A9E1' : '#41719C', // brand-400 / brand-700
                fontSize: { xs: '1.125rem', md: '1.25rem' }, // text-lg / text-xl
                display: { xs: 'none', sm: 'block' },
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

          {/* Center: Navigation Links */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: { xs: 0.5, sm: 1, md: 2 },
              ml: { xs: 1, sm: 2 },
            }}
          >
            {/* krultra.no link */}
            <Button
              component="a"
              href="https://lab.krultra.no"
              sx={{
                color: 'text.primary',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                minWidth: 'auto',
                px: { xs: 0.5, sm: 1 },
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              krultra.no
            </Button>

            {/* Events dropdown */}
            <Button
              onClick={openEventsMenu}
              endIcon={<ChevronDown size={16} />}
              sx={{
                color: 'text.primary',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                minWidth: 'auto',
                px: { xs: 0.5, sm: 1 },
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              Events
            </Button>
            <Menu
              anchorEl={eventsMenuAnchor}
              open={Boolean(eventsMenuAnchor)}
              onClose={closeEventsMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              <MenuItem onClick={() => { navigate('/kutc'); closeEventsMenu(); }}>Kruke's Ultra-Trail Challenge</MenuItem>
              <MenuItem onClick={() => { navigate('/mo'); closeEventsMenu(); }}>Malvikingen Opp</MenuItem>
            </Menu>

            {/* Runners link */}
            <Button
              onClick={() => navigate('/runners/search')}
              sx={{
                color: 'text.primary',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                minWidth: 'auto',
                px: { xs: 0.5, sm: 1 },
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              Runners
            </Button>

            {/* About link */}
            <Button
              onClick={() => navigate('/about')}
              sx={{
                color: 'text.primary',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                minWidth: 'auto',
                px: { xs: 0.5, sm: 1 },
                display: { xs: 'none', sm: 'flex' },
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              About
            </Button>

            {/* Admin link - only for admins */}
            {isAdmin && (
              <Button
                onClick={() => navigate('/admin')}
                sx={{
                  color: 'text.primary',
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                  minWidth: 'auto',
                  px: { xs: 0.5, sm: 1 },
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                Admin
              </Button>
            )}
          </Box>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Right: Icons */}
          <Box display="flex" alignItems="center" gap={0.5}>

            {/* Avatar/login icon */}
            {user ? (
              <Tooltip title={userName || user.email || 'Logged in'}>
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
              <Tooltip title="Log in">
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
            <Tooltip title="Settings">
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
              <MenuItem onClick={handleRunnerProfile}>My runner page</MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={handleLogout}>Log out</MenuItem>
            </Menu>
          )}

          {/* Settings menu */}
          <Menu
            anchorEl={settingsMenuAnchor}
            open={Boolean(settingsMenuAnchor)}
            onClose={() => setSettingsMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box px={2} py={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Theme
              </Typography>
            </Box>
            <MenuItem 
              onClick={() => { setMode('system'); setSettingsMenuAnchor(null); }}
              selected={mode === 'system'}
            >
              <ListItemIcon><SunMoon size={18} /></ListItemIcon>
              System
            </MenuItem>
            <MenuItem 
              onClick={() => { setMode('light'); setSettingsMenuAnchor(null); }}
              selected={mode === 'light'}
            >
              <ListItemIcon><Sun size={18} /></ListItemIcon>
              Light
            </MenuItem>
            <MenuItem 
              onClick={() => { setMode('dark'); setSettingsMenuAnchor(null); }}
              selected={mode === 'dark'}
            >
              <ListItemIcon><Moon size={18} /></ListItemIcon>
              Dark
            </MenuItem>
            <Divider sx={{ my: 1 }} />
            <Box px={2} py={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Language
              </Typography>
            </Box>
            {supportedLocales.map((locale) => (
              <MenuItem
                key={locale}
                onClick={() => { handleLanguageChange(locale); setSettingsMenuAnchor(null); }}
                selected={locale === currentLocale}
              >
                <ListItemIcon>
                  {locale === currentLocale ? <Check size={18} /> : <Globe size={18} />}
                </ListItemIcon>
                {localeNames[locale]}
              </MenuItem>
            ))}
          </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default AppHeader;
