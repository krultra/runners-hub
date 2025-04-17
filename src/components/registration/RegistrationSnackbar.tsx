import React from 'react';
import { Snackbar, Alert } from '@mui/material';

interface RegistrationSnackbarProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

const RegistrationSnackbar: React.FC<RegistrationSnackbarProps> = ({ open, message, onClose }) => (
  <Snackbar open={open} autoHideDuration={6000} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
    <Alert onClose={onClose} severity="error" sx={{ width: '100%' }}>
      {message}
    </Alert>
  </Snackbar>
);

export default RegistrationSnackbar;
