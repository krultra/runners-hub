import React, { useEffect, useState } from 'react';
import { fetchPublicRegistrations, PublicRegistration } from '../utils/publicRegistrations';
import StatusIndicator from '../components/StatusIndicator';
import { Container, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress, Box } from '@mui/material';

interface PublicRegistrationsPageProps {
  editionId?: string;
}

const PublicRegistrationsPage: React.FC<PublicRegistrationsPageProps> = ({ editionId = 'kutc-2025' }) => {
  const [registrations, setRegistrations] = useState<PublicRegistration[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicRegistrations(editionId).then(data => {
      setRegistrations(data);
      setLoading(false);
    });
  }, [editionId]);

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
        Registered Participants
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          bgcolor: (theme: import('@mui/material').Theme) => theme.palette.mode === 'dark'
            ? 'rgba(33, 150, 243, 0.08)'
            : 'rgba(33, 150, 243, 0.08)',
          borderLeft: '4px solid',
          borderColor: 'info.main',
          p: 2,
          mb: 3,
          borderRadius: 1,
          maxWidth: 600
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 12, marginTop: 2 }}>
          <circle cx="12" cy="12" r="12" fill="#0288d1" fillOpacity="0.15"/>
          <path d="M12 17V11" stroke="#0288d1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="8" r="1" fill="#0288d1"/>
        </svg>
        <Typography variant="body2" color="text.secondary">
          This table shows all public registrations for the current race edition. Only basic information is displayed for privacy. Status is updated as registrations are confirmed or processed.
        </Typography>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 180 }}>
          <CircularProgress />
        </Box>
      ) : registrations && registrations.length > 0 ? (
        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2, boxShadow: 2 }}>
          <Table stickyHeader aria-label="public registrations table">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.light', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.main' }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.light', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.main' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.light', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.main' }}>Nationality</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.light', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.main' }}>Representing</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.light', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.main' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {registrations.map((reg, idx) => (
                <TableRow
                  key={reg.registrationNumber}
                  sx={{
                    backgroundColor: idx % 2 === 0 ? 'background.default' : 'action.hover',
                    '&:last-child td, &:last-child th': { border: 0 }
                  }}
                >
                  <TableCell>{reg.registrationNumber}</TableCell>
                  <TableCell>{reg.firstName} {reg.lastName}</TableCell>
                  <TableCell>{reg.nationality}</TableCell>
                  <TableCell>{reg.representing}</TableCell>
                  <TableCell><StatusIndicator status={reg.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="text.secondary" sx={{ mt: 4, fontStyle: 'italic' }}>No participants registered yet.</Typography>
      )}
    </Container>
  );
};

export { PublicRegistrationsPage };
export default PublicRegistrationsPage;
