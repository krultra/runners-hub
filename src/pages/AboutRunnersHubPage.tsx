import React from 'react';
import { Container, Typography, Box, Grid, Paper, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const AboutRunnersHubPage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ pt: 8, pb: 6 }}>
      <Typography variant="h3" component="h1" align="center" fontWeight={800} gutterBottom>
        About KrUltra Runners Hub
      </Typography>
      <Typography variant="h6" align="center" color="text.secondary" sx={{ mb: 5 }}>
        Your companion for exploring KrUltra's events.
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              What you can do here
            </Typography>
            <List>
              {[
                'Browse upcoming event editions and sign up for participation',
                'Check out participation lists and follow up on your own registration details',
                'Dive into historic results, leaderboards, and records',
                'Follow live timing links when races are in progress',
              ].map((text) => (
                <ListItem key={text} sx={{ pl: 0 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckCircleIcon color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={text} />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Powered by KrUltra
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              KrUltra is short for "Kruke's Ultra". And behind KrUltra is mainly me, Torgeir Kruke, with help from a few very close race co-organizers. 
              The digital side projects are intended to support the running community and make it easy for runners to find and participate in KrUltra events.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Feedback or feature ideas? Reach out via <a href="mailto:post@krultra.no">post@krultra.no</a>.
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Box mt={6}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          What’s next
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          We are continuously expanding the hub with richer statistics and new events. Stay tuned for future KrUltra adventures.
        </Typography>
      </Box>
    </Container>
  );
};

export default AboutRunnersHubPage;
