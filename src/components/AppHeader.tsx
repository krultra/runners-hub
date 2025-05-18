import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Tooltip, Box, Button, Chip, Menu, MenuItem, ListItemIcon } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { adminSections } from '../constants/adminSections';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import Divider from '@mui/material/Divider';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LoginIcon from '@mui/icons-material/Login';
import { useNavigate, useLocation } from 'react-router-dom';
import { createOrUpdateUser } from '../utils/userUtils';
import { isAdminUser } from '../utils/adminUtils';

// Get environment variables
const APP_VERSION = process.env.REACT_APP_VERSION || 'unknown';
const APP_STAGE = process.env.REACT_APP_STAGE || 'production';
const IS_TEST_ENV = APP_STAGE === 'test';

const AppHeader: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

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
    navigate('/login');
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
      } else {
        setIsAdmin(false);
      }
    });
    return unsub;
  }, []);

  const handleLogout = async () => {
    handleAvatarMenuClose();
    const auth = getAuth();
    await signOut(auth);
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: (theme) => theme.palette.background.paper,
        color: (theme) => theme.palette.text.primary,
        borderBottom: (theme) => `1.5px solid ${theme.palette.divider}`,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <Toolbar>
        <Box component="img" src="/krultra-logo.png" alt="Logo" sx={{ height: 40, width: 'auto', mr: 1, cursor: 'pointer' }} onClick={() => navigate('/')} />
        {/* Responsive App Name: hide on xs screens */}
        <Typography
          variant="h6"
          sx={{
            flexGrow: 1,
            cursor: 'pointer',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pr: { xs: 1, sm: 3 },
            display: { xs: 'none', sm: 'block' }, // Hide on xs screens
          }}
          onClick={() => navigate('/')}
        >
          RunnersHub
          {IS_TEST_ENV && (
            <Chip 
              label={`TEST v${APP_VERSION}`}
              color="warning"
              size="small"
              sx={{ 
                ml: 2, 
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
        </Typography>
        {/* Hamburger menu and avatar/login always flush right, grouped in a flex box */}
        <Box display="flex" alignItems="center" sx={{ ml: 'auto', flexDirection: 'row-reverse' }}>
          {/* Hamburger menu rightmost */}
          <IconButton
            color="inherit"
            size="large"
            onClick={handleMenuOpen}
          >
            <MenuIcon />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            {/* Menu content logic */}
            {!user && (
              <MenuItem onClick={handleLogin}>
                <ListItemIcon><LoginIcon fontSize="small" /></ListItemIcon>
                Log in
              </MenuItem>
            )}
            {user && !isAdmin && (
              <MenuItem onClick={handleLogout}>
                Log out
              </MenuItem>
            )}
            {user && isAdmin && location.pathname !== '/admin' && (
              <>
                <MenuItem onClick={handleAdminPage}>
                  Admin Page
                </MenuItem>
                <MenuItem onClick={() => { navigate('/admin/import-malvikingen'); handleMenuClose(); }}>
                  MO Import
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem onClick={handleLogout} sx={{ fontSize: '0.92rem', opacity: 0.85 }}>
                  <Typography variant="body2">Log out</Typography>
                </MenuItem>
              </>
            )}
            {user && isAdmin && location.pathname === '/admin' && (
              <>
                <Box px={2} py={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Admin Features
                  </Typography>
                </Box>
                {adminSections.map((section) => (
                  <MenuItem
                    key={section.key}
                    selected={false} // Optionally highlight the current section
                    onClick={() => handleAdminSectionSelect(section.key)}
                  >
                    {section.label}
                  </MenuItem>
                ))}
                <MenuItem onClick={() => { navigate('/admin/import-malvikingen'); handleMenuClose(); }}>
                  MO Import
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem onClick={handleLogout} sx={{ fontSize: '0.92rem', opacity: 0.85 }}>
                  <Typography variant="body2">Log out</Typography>
                </MenuItem>
              </>
            )}
          </Menu>

          {/* Avatar/login icon to the left of hamburger */}
          {user ? (
            <Tooltip title={user.email || 'Logged in'}>
              <IconButton
                color="inherit"
                size="large"
                sx={{ mr: 1 }}
                onClick={handleAvatarMenuOpen}
              >
                <AccountCircleIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Log in">
              <IconButton
                color="inherit"
                onClick={() => {
                  // Store the current path to return to after authentication
                  const currentPath = window.location.pathname;
                  // Store the return path in localStorage for after email authentication
                  localStorage.setItem('authReturnPath', currentPath);
                  // Navigate to auth page
                  navigate('/auth');
                }}
                sx={{ mr: 1 }}
              >
                <LoginIcon />
              </IconButton>
            </Tooltip>
          )}

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
                <Typography variant="subtitle2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.displayName || user.email}
                </Typography>
              </Box>
              <MenuItem onClick={handleLogout}>Log out</MenuItem>
            </Menu>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
