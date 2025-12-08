import React, { useEffect, useState, useContext } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Tooltip, Box, Chip, Menu, MenuItem, ListItemIcon, Stack, Container, Divider } from '@mui/material';
import { Menu as MenuIcon, Settings, Sun, Moon, SunMoon, CircleUser, LogIn, Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supportedLocales, localeNames, Locale } from '../i18n/locales';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [kutcMenuAnchor, setKutcMenuAnchor] = useState<null | HTMLElement>(null);
  const [moMenuAnchor, setMoMenuAnchor] = useState<null | HTMLElement>(null);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState<null | HTMLElement>(null);
  const [userName, setUserName] = useState<string>('');
  const location = useLocation();
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

  // Hamburger menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };
  const handleMenuClose = () => {
    setMenuAnchor(null);
    setKutcMenuAnchor(null);
    setMoMenuAnchor(null);
  };
  const openKutcMenu = (event: React.MouseEvent<HTMLElement>) => {
    setKutcMenuAnchor(event.currentTarget);
  };
  const closeKutcMenu = () => {
    setKutcMenuAnchor(null);
  };
  const openMoMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMoMenuAnchor(event.currentTarget);
  };
  const closeMoMenu = () => {
    setMoMenuAnchor(null);
  };
  // Admin section selection (when on /admin)
  const handleAdminSectionSelect = (sectionKey: string) => {
    window.dispatchEvent(new CustomEvent('setAdminSection', { detail: sectionKey }));
    handleMenuClose();
  };

  const handleAdminPage = () => {
    navigate('/admin');
    handleMenuClose();
  };

  const handleLogin = () => {
    navigate('/auth');
    handleMenuClose();
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

            {/* Hamburger menu */}
            <IconButton
              color="inherit"
              size="small"
              onClick={handleMenuOpen}
              sx={{ width: 36, height: 36 }}
            >
              <MenuIcon size={20} />
            </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            {/* Main navigation */}
            <Box px={2} py={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Navigate
              </Typography>
            </Box>
            <MenuItem onClick={() => { navigate('/'); handleMenuClose(); }}>Home</MenuItem>
            <MenuItem onClick={() => { navigate('/runners/search'); handleMenuClose(); }}>Runner search</MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={openKutcMenu}>KUTC</MenuItem>
            <Menu
              anchorEl={kutcMenuAnchor}
              open={Boolean(kutcMenuAnchor)}
              onClose={closeKutcMenu}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              keepMounted
            >
              <MenuItem onClick={() => { navigate('/kutc'); closeKutcMenu(); handleMenuClose(); }}>Overview</MenuItem>
              <MenuItem onClick={() => { navigate('/kutc/results'); closeKutcMenu(); handleMenuClose(); }}>Results</MenuItem>
              <MenuItem onClick={() => { navigate('/kutc/all-time'); closeKutcMenu(); handleMenuClose(); }}>All-time</MenuItem>
              <MenuItem onClick={() => { navigate('/kutc/records'); closeKutcMenu(); handleMenuClose(); }}>Records</MenuItem>
            </Menu>
            <MenuItem onClick={openMoMenu}>MO</MenuItem>
            <Menu
              anchorEl={moMenuAnchor}
              open={Boolean(moMenuAnchor)}
              onClose={closeMoMenu}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              keepMounted
            >
              <MenuItem onClick={() => { navigate('/mo'); closeMoMenu(); handleMenuClose(); }}>Overview</MenuItem>
              <MenuItem onClick={() => { navigate('/mo/results'); closeMoMenu(); handleMenuClose(); }}>Results</MenuItem>
              <MenuItem onClick={() => { navigate('/mo/all-time'); closeMoMenu(); handleMenuClose(); }}>All-time</MenuItem>
              <MenuItem onClick={() => { navigate('/mo/records'); closeMoMenu(); handleMenuClose(); }}>Records</MenuItem>
            </Menu>
            {isAdmin && (
              <MenuItem onClick={handleAdminPage}>Admin</MenuItem>
            )}
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={() => { navigate('/about'); handleMenuClose(); }}>About</MenuItem>
            <Divider sx={{ my: 0.5 }} />

            {/* Auth/Admin */}
            {!user && (
              <MenuItem onClick={handleLogin}>
                <ListItemIcon><LogIn size={18} /></ListItemIcon>
                Log in
              </MenuItem>
            )}
            {user && !isAdmin && (
              <MenuItem onClick={handleLogout}>
                Log out
              </MenuItem>
            )}
          </Menu>

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
