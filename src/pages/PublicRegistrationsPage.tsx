import React, { useEffect, useState } from 'react';
import { fetchPublicRegistrations, PublicRegistration } from '../utils/publicRegistrations';
import { Container, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress } from '@mui/material';

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
      <Typography variant="h4" gutterBottom>
        Registered Participants
      </Typography>
      {loading ? (
        <CircularProgress />
      ) : registrations && registrations.length > 0 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Nationality</TableCell>
                <TableCell>Representing</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {registrations.map((reg) => (
                <TableRow key={reg.registrationNumber}>
                  <TableCell>{reg.registrationNumber}</TableCell>
                  <TableCell>{reg.firstName} {reg.lastName}</TableCell>
                  <TableCell>{reg.nationality}</TableCell>
                  <TableCell>{reg.representing}</TableCell>
                  <TableCell>{reg.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography>No participants registered yet.</Typography>
      )}
    </Container>
  );
};

export { PublicRegistrationsPage };
export default PublicRegistrationsPage;
