import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Tooltip, Box, Button } from '@mui/material';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LoginIcon from '@mui/icons-material/Login';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate, useLocation } from 'react-router-dom';
import { createOrUpdateUser, getUser } from '../utils/userUtils';

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
        const userDoc = await getUser(u.uid);
        setIsAdmin(!!userDoc?.isAdmin);
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
      position="static"
      elevation={0}
      sx={{
        background: 'var(--color-header-bg)',
        color: 'var(--color-text)',
        borderBottom: '1.5px solid var(--color-header-border)'
      }}
    >
      <Toolbar>
        <Typography
          variant="h6"
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          RunnersHub
        </Typography>
        {user ? (
          <Box display="flex" alignItems="center">
            {/* Admin drawer toggle on admin pages */}
            {isAdmin && location.pathname.startsWith('/admin') && (
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
