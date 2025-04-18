import React, { useState } from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';
import InviteSummaryDialog from '../components/InviteSummaryDialog';
import * as XLSX from 'xlsx';

// Helper to fetch and parse xlsx files in public/data
async function fetchInviteesFromXlsx(url: string): Promise<{ email: string; name: string }[]> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' }) as { email: string; name: string }[];
}

const AdminPage: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [numTest, setNumTest] = useState(0);
  const [numRun, setNumRun] = useState(0);
  const [loading, setLoading] = useState(false);
  const [testInvitees, setTestInvitees] = useState<{ email: string; name: string }[]>([]);
  const [runInvitees, setRunInvitees] = useState<{ email: string; name: string }[]>([]);

  const handleSendInvitations = async () => {
    setLoading(true);
    // Load both invitee lists from public/data
    const [test, run] = await Promise.all([
      fetchInviteesFromXlsx('/data/invitees_test.xlsx'),
      fetchInviteesFromXlsx('/data/invitees.xlsx'),
    ]);
    setTestInvitees(test);
    setRunInvitees(run);
    setNumTest(test.length);
    setNumRun(run.length);
    setDialogOpen(true);
    setLoading(false);
  };

  const handleDialogClose = () => setDialogOpen(false);
  const sendInvitations = async (invitees: { email: string; name: string }[], label: string) => {
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    for (const invitee of invitees) {
      try {
        // Only send if both fields are present
        if (invitee.email && invitee.name) {
          // Dynamically import to avoid SSR issues
          const { sendInvitationEmail } = await import('../services/emailService');
          await sendInvitationEmail(invitee.email, invitee.name);
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to send invitation to ${invitee.email}:`, error);
        errorCount++;
      }
    }
    setLoading(false);
    alert(`${label}: Sent ${successCount} invitations successfully.${errorCount > 0 ? ` Failed: ${errorCount}` : ''}`);
  };

  const handleTest = async () => {
    setDialogOpen(false);
    await sendInvitations(testInvitees, 'Test');
  };
  const handleRun = async () => {
    setDialogOpen(false);
    await sendInvitations(runInvitees, 'Run');
  };

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
      <Paper elevation={3} sx={{ p: 4, width: 400, maxWidth: '90%' }}>
        <Typography variant="h4" gutterBottom>Admin Panel</Typography>
        <Typography variant="body1" gutterBottom>
          Only visible to admin users. Here you can send invitations and manage event communications.
        </Typography>
        <Button variant="contained" color="primary" onClick={handleSendInvitations} sx={{ mt: 3 }} disabled={loading}>
          Send invitations
        </Button>
      </Paper>
      <InviteSummaryDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onTest={handleTest}
        onRun={handleRun}
        numTest={numTest}
        numRun={numRun}
        loading={loading}
      />
    </Box>
  );
};

export default AdminPage;
