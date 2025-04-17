import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Tooltip, Box, Button } from '@mui/material';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LoginIcon from '@mui/icons-material/Login';
import { useLocation, useNavigate } from 'react-router-dom';

const AppHeader: React.FC = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  return (
    <AppBar position="static" color="primary" elevation={2}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          RunnersHub
        </Typography>
        {user ? (
          <Box display="flex" alignItems="center">
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
                const location = window.location.pathname + window.location.search;
                window.location.href = `/auth?returnTo=${encodeURIComponent(location)}`;
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
