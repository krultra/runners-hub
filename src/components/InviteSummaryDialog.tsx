import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';

interface InviteSummaryDialogProps {
  open: boolean;
  onClose: () => void;
  onTest: () => void;
  onRun: () => void;
  numTest: number;
  numRun: number;
  loading?: boolean;
}

const InviteSummaryDialog: React.FC<InviteSummaryDialogProps> = ({
  open,
  onClose,
  onTest,
  onRun,
  numTest,
  numRun,
  loading = false,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Send Invitations</DialogTitle>
      <DialogContent>
        <Box mb={2}>
          <Typography variant="body1">
            <b>Test:</b> {numTest} invitation(s) will be sent to the test list.
          </Typography>
          <Typography variant="body1">
            <b>Run:</b> {numRun} invitation(s) will be sent to the full invitee list.
          </Typography>
        </Box>
        <Typography variant="body2" color="textSecondary">
          Please confirm which operation you want to perform. This action will send emails to the selected recipients.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onTest} color="primary" variant="outlined" disabled={loading}>
          Test
        </Button>
        <Button onClick={onRun} color="secondary" variant="contained" disabled={loading}>
          Run
        </Button>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteSummaryDialog;
