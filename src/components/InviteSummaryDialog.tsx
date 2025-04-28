import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';

interface InviteSummaryDialogProps {
  open: boolean;
  onClose: () => void;
  onRun: () => void;
  numRun: number;
  loading?: boolean;
}

const InviteSummaryDialog: React.FC<InviteSummaryDialogProps> = ({ open, onClose, onRun, numRun, loading = false }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Send Invitations</DialogTitle>
      <DialogContent>
        <Box mb={2}>
          <Typography variant="body1">
            <b>Run:</b> {numRun} invitation(s) will be sent.
          </Typography>
        </Box>
        <Typography variant="body2" color="textSecondary">
          Please confirm which operation you want to perform. This action will send emails to the selected recipients.
        </Typography>
      </DialogContent>
      <DialogActions>
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
