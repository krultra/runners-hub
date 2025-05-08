import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Tooltip, Box, Button, Chip } from '@mui/material';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LoginIcon from '@mui/icons-material/Login';
import MenuIcon from '@mui/icons-material/Menu';
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
  const location = useLocation();
  const navigate = useNavigate();

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
        <Typography
          variant="h6"
          sx={{ flexGrow: 1, cursor: 'pointer' }}
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
        {user ? (
          <Box display="flex" alignItems="center">
            {/* Admin drawer toggle on admin pages */}
            {isAdmin && location.pathname === '/admin' && (
              <Tooltip title="Toggle menu">
                <IconButton color="inherit" onClick={() => window.dispatchEvent(new Event('toggleAdminDrawer'))} sx={{ mr: 1 }}>
                  <MenuIcon />
                </IconButton>
              </Tooltip>
            )}
            {isAdmin && (
              <Button color="inherit" onClick={() => navigate('/admin')} sx={{ mr: 2 }}>
                Admin
              </Button>
            )}
            <Tooltip title={user.email || 'Logged in'}>
              <IconButton color="inherit" size="large" sx={{ mr: 1 }}>
                <AccountCircleIcon />
              </IconButton>
            </Tooltip>
            <Button color="inherit" onClick={handleLogout} sx={{ ml: 1 }}>
              Log out
            </Button>
          </Box>
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
            >
              <LoginIcon />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
