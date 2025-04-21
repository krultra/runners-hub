import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Box, Button, Paper } from '@mui/material';

const NotFoundPage: React.FC = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 8, textAlign: 'center' }}>
        <Paper 
  elevation={0}
  sx={{
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-surface-border)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    borderRadius: 2,
    p: 3,
    mb: 4
  }}
>
          <Typography variant="h2" component="h1" gutterBottom>
            404
          </Typography>
          <Typography variant="h4" gutterBottom>
            Page Not Found
          </Typography>
          <Typography variant="body1" paragraph>
            The page you are looking for doesn't exist or has been moved.
          </Typography>
          <Button
            component={RouterLink}
            to="/"
            variant="contained"
            size="large"
            sx={{ mt: 2 }}
          >
            Return to Home
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

export default NotFoundPage;
