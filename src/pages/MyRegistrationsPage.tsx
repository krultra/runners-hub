import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Container, Typography } from '@mui/material';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../utils/userUtils';

const MyRegistrationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u?.uid) {
        navigate('/auth', { replace: true } as any);
        return;
      }
      try {
        const appUser = await getUser(u.uid);
        const personId = (appUser as any)?.personId;
        const routeId = Number.isFinite(personId) && personId != null ? String(personId) : u.uid;
        navigate(`/runners/${routeId}` as any, { replace: true } as any);
      } catch {
        navigate(`/runners/${u.uid}` as any, { replace: true } as any);
      }
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight={180}>
        <CircularProgress />
        {!loading && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Redirecting…
          </Typography>
        )}
      </Box>
    </Container>
  );
};

export default MyRegistrationsPage;
