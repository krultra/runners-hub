import React from 'react';
import { Box, Card, CardActionArea, CardContent, Grid, Typography } from '@mui/material';
import { adminSections, AdminSectionKey } from '../../constants/adminSections';

interface Props {
  onSelect: (key: AdminSectionKey) => void;
}

const AdminLandingPanel: React.FC<Props> = ({ onSelect }) => {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>Admin</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose an admin feature below. You can switch sections anytime using the drawer.
      </Typography>
      <Grid container spacing={2}>
        {adminSections.map((s) => (
          <Grid item key={s.key} xs={12} sm={6} md={4} lg={3}>
            <Card variant="outlined">
              <CardActionArea onClick={() => onSelect(s.key)}>
                <CardContent>
                  <Typography variant="h6">{s.label}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {/** Optional short descriptions per section could be added later */}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AdminLandingPanel;
